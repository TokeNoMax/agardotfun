import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import Canvas, { CanvasRef } from "./Canvas";
import GameOverModal from "./GameOverModal";
import Leaderboard from "./Leaderboard";
import ZoneCounter from "./ZoneCounter";
import TouchControlArea from "./TouchControlArea";
import { Player, SafeZone } from "@/types/game";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOptimizedGameSync } from "@/hooks/useOptimizedGameSync";
import { OptimizedPlayerPosition } from "@/services/realtime/optimizedGameSync";

export default function GameUI() {
  const { currentRoom, leaveRoom, player } = useGame();
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [alivePlayers, setAlivePlayers] = useState<number>(0);
  const [localMode, setLocalMode] = useState<boolean>(false);
  const [localPlayer, setLocalPlayer] = useState<Player | null>(null);
  const [isZoneMode, setIsZoneMode] = useState<boolean>(false);
  const [currentZone, setCurrentZone] = useState<SafeZone | null>(null);
  const [isPlayerInZone, setIsPlayerInZone] = useState<boolean>(true);
  const [timeUntilShrink, setTimeUntilShrink] = useState<number>(0);
  const [gameStartTime] = useState<number>(Date.now());
  const [eliminationType, setEliminationType] = useState<'absorption' | 'zone' | 'timeout'>('absorption');
  const canvasRef = useRef<CanvasRef>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Optimized game sync hooks for real-time synchronization
  const {
    isConnected: gameSyncConnected,
    syncPlayerPosition,
    getInterpolatedPosition,
    broadcastCollision
  } = useOptimizedGameSync({
    roomId: currentRoom?.id,
    playerId: player?.id,
    isEnabled: !localMode && !!currentRoom && !!player,
    onPlayerUpdate: handlePlayerPositionUpdate,
    onPlayerEliminated: handlePlayerEliminated,
    onGameStateUpdate: handleGameStateUpdate
  });
  
  // Check URL parameters and set modes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocalMode = urlParams.get('local') === 'true';
    const gameMode = urlParams.get('mode');
    const isZoneBattle = gameMode === 'zone';
    
    console.log('GameUI: Checking URL params:', { isLocalMode, gameMode, isZoneBattle });
    
    if (isLocalMode) {
      setLocalMode(true);
      setIsZoneMode(isZoneBattle);
      
      // Create a local player
      const newLocalPlayer = {
        id: "local-player",
        walletAddress: "local-player",
        name: player?.name || "LocalPlayer",
        color: player?.color || "blue",
        size: 15,
        x: 1500,
        y: 1500,
        isAlive: true
      };
      
      setLocalPlayer(newLocalPlayer);
      setAlivePlayers(1);
      
      console.log('GameUI: Local mode initialized:', { isZoneBattle, player: newLocalPlayer });
      
      if (isZoneBattle) {
        toast({
          title: "Zone Battle Activé",
          description: "La zone commencera à rétrécir dans 30 secondes !",
        });
      }
    } else if (currentRoom) {
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [player]);

  // Update alive players count
  useEffect(() => {
    if (!localMode && currentRoom) {
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [currentRoom?.players, localMode]);

  // Redirect if no valid session
  useEffect(() => {
    if (!localMode && (!currentRoom || !player || !currentRoom.players.some(p => p.id === player.id))) {
      const timer = setTimeout(() => {
        navigate('/lobby');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [currentRoom, player, navigate, localMode]);

  // Handle real-time player position updates with interpolation
  function handlePlayerPositionUpdate(playerId: string, position: OptimizedPlayerPosition) {
    console.log('GameUI: Received player position update:', playerId, position);
    if (canvasRef.current) {
      // Use interpolated position for smoother movement
      const interpolatedPos = getInterpolatedPosition(playerId, position);
      canvasRef.current.updatePlayerPosition(playerId, interpolatedPos);
    }
  }

  // Handle real-time player elimination
  function handlePlayerEliminated(eliminatedPlayerId: string, eliminatorPlayerId: string) {
    console.log('GameUI: Player eliminated via sync:', eliminatedPlayerId, 'by', eliminatorPlayerId);
    if (canvasRef.current) {
      canvasRef.current.eliminatePlayer(eliminatedPlayerId, eliminatorPlayerId);
    }
    
    // Show toast notification
    const eliminatedPlayer = currentRoom?.players.find(p => p.id === eliminatedPlayerId);
    const eliminatorPlayer = currentRoom?.players.find(p => p.id === eliminatorPlayerId);
    
    if (eliminatedPlayer && eliminatorPlayer) {
      toast({
        title: "Élimination !",
        description: `${eliminatorPlayer.name} a absorbé ${eliminatedPlayer.name} !`,
        variant: "destructive",
        duration: 3000,
      });
    }
  }

  // Handle game state updates
  function handleGameStateUpdate(gameState: any) {
    console.log('GameUI: Game state update received:', gameState);
  }

  // Handle zone updates from Canvas
  const handleZoneUpdate = (zone: SafeZone, playerInZone: boolean) => {
    setCurrentZone(zone);
    setIsPlayerInZone(playerInZone);
    setTimeUntilShrink(zone.nextShrinkTime - Date.now());
  };

  // Handle mobile direction change
  const handleMobileDirectionChange = (direction: { x: number; y: number } | null) => {
    console.log('GameUI: Received mobile direction change:', direction);
    if (canvasRef.current) {
      canvasRef.current.setMobileDirection(direction);
    } else {
      console.warn('GameUI: Canvas ref not available');
    }
  };

  // Handle player position sync (called by Canvas) - optimized frequency
  const handlePlayerPositionSync = async (position: OptimizedPlayerPosition) => {
    if (!localMode && gameSyncConnected) {
      await syncPlayerPosition(position);
    }
  };

  // Handle collision detection (called by Canvas)
  const handlePlayerCollision = async (
    eliminatedPlayerId: string, 
    eliminatorPlayerId: string, 
    eliminatedSize: number, 
    eliminatorNewSize: number
  ) => {
    if (!localMode && gameSyncConnected) {
      console.log('GameUI: Broadcasting collision:', { eliminatedPlayerId, eliminatorPlayerId });
      await broadcastCollision(eliminatedPlayerId, eliminatorPlayerId, eliminatedSize, eliminatorNewSize);
    }
  };

  const handleGameOver = (winner: Player | null, eliminationType: 'absorption' | 'zone' | 'timeout' = 'absorption') => {
    setWinner(winner);
    setEliminationType(eliminationType);
    setIsGameOver(true);
    
    // Show victory toast
    if (winner) {
      const gameMode = localMode ? (isZoneMode ? 'zone' : 'local') : 'multiplayer';
      const victoryMessages = {
        multiplayer: `🏆 ${winner.name} remporte la bataille synchronisée !`,
        zone: `🛡️ ${winner.name} survit à la zone mortelle !`,
        local: `🎉 Excellent travail ${winner.name} !`
      };
      
      toast({
        title: "VICTOIRE !",
        description: victoryMessages[gameMode as keyof typeof victoryMessages],
        duration: 5000,
      });
    }
    
    // Store game result
    if (currentRoom) {
      localStorage.setItem('blob-battle-game-state', JSON.stringify({
        status: 'finished',
        roomId: currentRoom.id,
        winner: winner ? winner.name : 'Nobody'
      }));
    }
  };
  
  const handlePlayAgain = async () => {
    if (localMode) {
      window.location.reload();
    } else {
      localStorage.removeItem('blob-battle-game-state');
      await leaveRoom();
      setIsGameOver(false);
      navigate('/lobby');
    }
  };
  
  const handleBackToLobby = async () => {
    localStorage.removeItem('blob-battle-game-state');
    
    if (localMode) {
      navigate('/lobby');
    } else {
      await leaveRoom();
      setIsGameOver(false);
      navigate('/lobby');
    }
  };
  
  // Handle player eaten event
  const handlePlayerEaten = (eatenPlayer: Player, eaterPlayer: Player) => {
    toast({
      title: "Élimination Synchronisée !",
      description: `${eaterPlayer.name} a absorbé ${eatenPlayer.name} !`,
      variant: "destructive",
      duration: 3000,
    });
    
    console.log(`${eatenPlayer.name} was eaten by ${eaterPlayer.name}`);
  };
  
  // Show loading if not ready
  if (!localMode && !currentRoom) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium mb-4">Synchronisation de la partie...</p>
          <Button onClick={() => navigate('/lobby')}>
            Retour au lobby
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full relative">
      {/* Game status */}
      <div className={`absolute top-4 left-4 bg-black/80 backdrop-blur-sm ${
        isMobile ? 'p-2 text-sm' : 'p-3'
      } rounded-md shadow-md z-10 text-white`}>
        <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
          {localMode ? (isZoneMode ? "Mode Zone Battle" : "Mode Solo Local") : `Joueurs en vie: ${alivePlayers}`}
        </div>
        {!localMode && currentRoom && (
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-cyber-cyan`}>
            Match #{currentRoom.matchNumber} - {currentRoom.name}
          </div>
        )}
        <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
          Vous: {localMode ? localPlayer?.name : player?.name}
        </div>
        {!localMode && (
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} ${gameSyncConnected ? 'text-green-400' : 'text-red-400'}`}>
            Sync: {gameSyncConnected ? 'Optimisé ✓' : 'Déconnecté'}
          </div>
        )}
        <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-cyan-400`}>
          Map: Synchronisée ✓
        </div>
      </div>
      
      {/* Zone Counter for Zone Battle mode */}
      {isZoneMode && currentZone && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <ZoneCounter 
            safeZone={currentZone}
            isPlayerInZone={isPlayerInZone}
            timeUntilShrink={timeUntilShrink}
          />
        </div>
      )}
      
      {/* Exit button */}
      <div className="absolute top-4 right-4 z-10">
        <Button 
          variant="destructive" 
          size={isMobile ? "sm" : "default"}
          className={isMobile ? "text-xs px-2 py-1" : ""}
          onClick={handleBackToLobby}
        >
          Quitter
        </Button>
      </div>
      
      {/* Leaderboard */}
      <div className={`absolute top-4 ${isMobile ? 'right-4 mt-12' : 'right-20'} z-10`}>
        <Leaderboard 
          players={localMode ? (localPlayer ? [localPlayer] : []) : (currentRoom ? currentRoom.players : [])} 
          currentPlayerId={localMode ? localPlayer?.id : player?.id}
          onPlayerEaten={handlePlayerEaten}
        />
      </div>
      
      {/* Synchronized Game canvas */}
      <div className="w-full h-full">
        <Canvas 
          ref={canvasRef}
          onGameOver={handleGameOver} 
          isLocalMode={localMode}
          localPlayer={localPlayer}
          isZoneMode={isZoneMode}
          onZoneUpdate={handleZoneUpdate}
          onPlayerPositionSync={handlePlayerPositionSync}
          onPlayerCollision={handlePlayerCollision}
        />
      </div>
      
      {/* Mobile Touch Control Area */}
      <TouchControlArea 
        onDirectionChange={handleMobileDirectionChange}
      />
      
      {/* Game over modal */}
      <GameOverModal
        open={isGameOver}
        winner={winner}
        onPlayAgain={handlePlayAgain}
        onBackToLobby={handleBackToLobby}
        gameMode={localMode ? (isZoneMode ? 'zone' : 'local') : 'multiplayer'}
        gameDuration={Date.now() - gameStartTime}
        finalSize={winner?.size}
        eliminationType={eliminationType}
      />
    </div>
  );
}
