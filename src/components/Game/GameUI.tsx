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

interface GameUIProps {
  roomId?: string;
}

export default function GameUI({ roomId }: GameUIProps) {
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
  const [syncInitialized, setSyncInitialized] = useState(false);
  const canvasRef = useRef<CanvasRef>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // FIXED: Improved game sync with better validation and logging
  const {
    isConnected: gameSyncConnected,
    syncPlayerPosition,
    getInterpolatedPosition,
    broadcastCollision
  } = useOptimizedGameSync({
    roomId: currentRoom?.id,
    playerId: player?.id,
    // FIXED: Better validation and logging for sync conditions
    isEnabled: (() => {
      const shouldEnable = !localMode && 
        !!currentRoom && 
        !!player && 
        currentRoom.status === 'playing' &&
        (!roomId || currentRoom.id === roomId);
      
      console.log("GameUI: Sync enabled check:", {
        localMode,
        hasRoom: !!currentRoom,
        hasPlayer: !!player,
        roomStatus: currentRoom?.status,
        roomIdMatch: !roomId || currentRoom?.id === roomId,
        shouldEnable
      });
      
      return shouldEnable;
    })(),
    onPlayerUpdate: (playerId: string, position: OptimizedPlayerPosition) => {
      console.log('GameUI: Player position update received:', playerId, position);
      if (canvasRef.current) {
        const interpolatedPos = getInterpolatedPosition(playerId, position);
        canvasRef.current.updatePlayerPosition(playerId, interpolatedPos);
      }
    },
    onPlayerEliminated: (eliminatedPlayerId: string, eliminatorPlayerId: string) => {
      console.log('GameUI: Player elimination received:', eliminatedPlayerId, 'by', eliminatorPlayerId);
      if (canvasRef.current) {
        canvasRef.current.eliminatePlayer(eliminatedPlayerId, eliminatorPlayerId);
      }
      
      const eliminatedPlayer = currentRoom?.players.find(p => p.id === eliminatedPlayerId);
      const eliminatorPlayer = currentRoom?.players.find(p => p.id === eliminatorPlayerId);
      
      if (eliminatedPlayer && eliminatorPlayer) {
        toast({
          title: "Élimination Synchronisée !",
          description: `${eliminatorPlayer.name} a absorbé ${eliminatedPlayer.name} !`,
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    onGameStateUpdate: (gameState: any) => {
      console.log('GameUI: Game state update received:', gameState);
    }
  });

  // FIXED: Improved sync initialization tracking
  useEffect(() => {
    if (gameSyncConnected && !syncInitialized) {
      console.log("GameUI: Sync connection established, marking as initialized");
      setSyncInitialized(true);
      
      toast({
        title: "Synchronisation établie",
        description: "Connexion au serveur de jeu réussie",
        duration: 2000,
      });
    } else if (!gameSyncConnected && syncInitialized) {
      console.log("GameUI: Sync connection lost");
      setSyncInitialized(false);
    }
  }, [gameSyncConnected, syncInitialized, toast]);

  // Check URL parameters and set modes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocalMode = urlParams.get('local') === 'true';
    const gameMode = urlParams.get('mode');
    const isZoneBattle = gameMode === 'zone';
    
    console.log('GameUI: Checking URL params:', { isLocalMode, gameMode, isZoneBattle, roomId });
    
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
      // FIXED: Validate room ID matches URL
      if (roomId && currentRoom.id !== roomId) {
        console.error("Room ID mismatch in GameUI:", { roomId, currentRoomId: currentRoom.id });
        toast({
          title: "Erreur de synchronisation",
          description: "ID de partie incorrect. Redirection...",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      }
      
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
      
      console.log("GameUI: Multiplayer mode initialized for room:", currentRoom.id);
    }
  }, [player, roomId, currentRoom, navigate, toast]);

  // Update alive players count
  useEffect(() => {
    if (!localMode && currentRoom) {
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [currentRoom?.players, localMode]);

  // FIXED: Enhanced validation for room session
  useEffect(() => {
    if (!localMode && (!currentRoom || !player || !currentRoom.players.some(p => p.id === player.id))) {
      console.log("Invalid session detected, redirecting to lobby");
      const timer = setTimeout(() => {
        navigate('/lobby');
      }, 500);
      
      return () => clearTimeout(timer);
    }
    
    // FIXED: Additional check for room ID mismatch
    if (!localMode && roomId && currentRoom && currentRoom.id !== roomId) {
      console.log("Room ID mismatch detected, redirecting to lobby");
      toast({
        title: "Erreur de partie",
        description: "Vous n'êtes pas dans la bonne partie.",
        variant: "destructive"
      });
      navigate('/lobby');
    }
  }, [currentRoom, player, navigate, localMode, roomId, toast]);

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
    console.log('GameUI: Mobile direction change:', direction);
    if (canvasRef.current) {
      canvasRef.current.setMobileDirection(direction);
    }
  };

  // FIXED: Enhanced position sync with better error handling and logging
  const handlePlayerPositionSync = async (position: OptimizedPlayerPosition) => {
    if (!localMode && gameSyncConnected) {
      try {
        console.log('GameUI: Syncing position to server:', position);
        await syncPlayerPosition(position);
      } catch (error) {
        console.error("GameUI: Error syncing position:", error);
      }
    }
  };

  // FIXED: Enhanced collision handling with validation
  const handlePlayerCollision = async (
    eliminatedPlayerId: string, 
    eliminatorPlayerId: string, 
    eliminatedSize: number, 
    eliminatorNewSize: number
  ) => {
    if (!localMode && gameSyncConnected) {
      try {
        console.log('GameUI: Broadcasting collision to server:', { 
          eliminatedPlayerId, 
          eliminatorPlayerId, 
          eliminatedSize, 
          eliminatorNewSize 
        });
        await broadcastCollision(eliminatedPlayerId, eliminatorPlayerId, eliminatedSize, eliminatorNewSize);
      } catch (error) {
        console.error("GameUI: Error broadcasting collision:", error);
      }
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
        {!localMode && currentRoom && (
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-400`}>
            Room: {currentRoom.id.substring(0, 8)}...
          </div>
        )}
        <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
          Vous: {localMode ? localPlayer?.name : player?.name}
        </div>
        {!localMode && (
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} ${gameSyncConnected ? 'text-green-400' : 'text-red-400'}`}>
            Sync: {gameSyncConnected ? 'Connecté ✓' : 'Déconnecté ⚠️'}
          </div>
        )}
        {!localMode && syncInitialized && (
          <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-green-400`}>
            Status: Synchronisé ✓
          </div>
        )}
        <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-cyan-400`}>
          Map: Chargée ✓
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
      
      {/* FIXED: Enhanced synchronized game canvas with room validation */}
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
          roomId={roomId}
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
