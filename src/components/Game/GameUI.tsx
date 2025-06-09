import { useEffect, useState, useRef, useCallback } from "react";
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
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useGhostRoomCleaner } from "@/hooks/useGhostRoomCleaner";

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
  const [gameConnected, setGameConnected] = useState(false);
  const canvasRef = useRef<CanvasRef>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Players registry for realtime sync
  const playersRef = useRef<Record<string, any>>({});

  // FIXED: Score update handler moved before its usage
  const handleScoreUpdate = useCallback((playerId: string, newScore: number) => {
    console.log(`[GameUI] Score update for ${playerId}: ${newScore}`);
    
    // Update current room players if in multiplayer mode
    if (!localMode && currentRoom) {
      // This will trigger a re-render of the leaderboard
      const updatedPlayers = currentRoom.players.map(p => 
        p.id === playerId ? { ...p, size: newScore } : p
      );
      
      // Update alive players count if needed
      const alive = updatedPlayers.filter(p => p.isAlive).length;
      setAlivePlayers(alive);
    }
  }, [localMode, currentRoom]);

  // Create blob function for realtime sync
  const createBlob = useCallback((id: string) => {
    console.log(`[GameUI] Creating blob for player: ${id}`);
    // This will be handled by the canvas
    if (canvasRef.current) {
      return canvasRef.current.getOrCreatePlayer(id);
    }
    return { setPos: () => {}, setSize: () => {} };
  }, []);

  // Ghost room cleaner
  useGhostRoomCleaner({
    enabled: !localMode,
    intervalMinutes: 1
  });

  // Simplified realtime sync with score updates
  const { isConnected: syncConnected, forceReconnect, updateLocalScore } = useRealtimeSync({
    roomId: currentRoom?.id,
    playerId: player?.id,
    enabled: !localMode && !!currentRoom && !!player && currentRoom.status === 'playing',
    players: playersRef.current,
    createBlob,
    onConnectionChange: setGameConnected,
    onScoreUpdate: handleScoreUpdate
  });

  // Check URL parameters and set modes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocalMode = urlParams.get('local') === 'true';
    const gameMode = urlParams.get('mode');
    const isZoneBattle = gameMode === 'zone';
    
    console.log('[GameUI] Checking URL params:', { isLocalMode, gameMode, isZoneBattle, roomId });
    
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
      
      console.log('[GameUI] Local mode initialized:', { isZoneBattle, player: newLocalPlayer });
      
      if (isZoneBattle) {
        toast({
          title: "Zone Battle Activé",
          description: "La zone commencera à rétrécir dans 30 secondes !",
        });
      }
    } else if (currentRoom) {
      // Enhanced room validation
      if (roomId && currentRoom.id !== roomId) {
        console.error('[GameUI] Room ID mismatch:', { roomId, currentRoomId: currentRoom.id });
        toast({
          title: "Erreur de synchronisation",
          description: "ID de partie incorrect. Redirection...",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      }
      
      // Validate player is actually in the room
      const isPlayerInRoom = currentRoom.players.some(p => p.id === player?.id);
      if (!isPlayerInRoom) {
        console.error('[GameUI] Player not found in room:', { playerId: player?.id, roomPlayers: currentRoom.players });
        toast({
          title: "Erreur de session",
          description: "Vous n'êtes plus dans cette partie. Redirection...",
          variant: "destructive"
        });
        navigate('/lobby');
        return;
      }
      
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
      
      console.log('[GameUI] Multiplayer mode initialized for room:', currentRoom.id, 'with', alive, 'alive players');
    }
  }, [player, roomId, currentRoom, navigate, toast]);

  // Update alive players count
  useEffect(() => {
    if (!localMode && currentRoom) {
      const alive = currentRoom.players.filter(p => p.isAlive).length;
      setAlivePlayers(alive || currentRoom.players.length);
    }
  }, [currentRoom?.players, localMode]);

  // Enhanced session validation
  useEffect(() => {
    if (!localMode && (!currentRoom || !player)) {
      console.log('[GameUI] Invalid session detected - missing room or player, redirecting to lobby');
      const timer = setTimeout(() => {
        navigate('/lobby');
      }, 500);
      
      return () => clearTimeout(timer);
    }
    
    // Additional validation for player in room
    if (!localMode && currentRoom && player && !currentRoom.players.some(p => p.id === player.id)) {
      console.log('[GameUI] Player not in room, redirecting to lobby');
      toast({
        title: "Session invalide",
        description: "Vous n'êtes plus dans cette partie.",
        variant: "destructive"
      });
      navigate('/lobby');
    }
    
    // Room ID validation
    if (!localMode && roomId && currentRoom && currentRoom.id !== roomId) {
      console.log('[GameUI] Room ID mismatch detected, redirecting to lobby');
      toast({
        title: "Erreur de partie",
        description: "Vous n'êtes pas dans la bonne partie.",
        variant: "destructive"
      });
      navigate('/lobby');
    }
  }, [currentRoom, player, navigate, localMode, roomId, toast]);

  // Handle zone updates from Canvas
  const handleZoneUpdate = (zone: SafeZone, playerInZone: boolean) => {
    setCurrentZone(zone);
    setIsPlayerInZone(playerInZone);
    setTimeUntilShrink(zone.nextShrinkTime - Date.now());
  };

  // Handle mobile direction change
  const handleMobileDirectionChange = (direction: { x: number; y: number } | null) => {
    console.log('[GameUI] Mobile direction change:', direction);
    if (canvasRef.current) {
      canvasRef.current.setMobileDirection(direction);
    }
  };

  // Update player in realtime sync registry and handle score updates
  const handlePlayerPositionUpdate = useCallback((position: { x: number; y: number; size: number }) => {
    if (player?.id) {
      // Update player in registry for realtime sync
      playersRef.current[player.id] = {
        x: position.x,
        y: position.y,
        r: position.size, // radius/score
        setPos: () => {},
        setSize: () => {}
      };

      // Broadcast score update if it changed significantly
      if (updateLocalScore && Math.abs(position.size - (playersRef.current[player.id]?.prevSize || 0)) > 1) {
        updateLocalScore(position.size);
        playersRef.current[player.id].prevSize = position.size;
      }
    }
  }, [player?.id, updateLocalScore]);

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
      {/* Enhanced status display with diagnostics */}
      <div className={`absolute top-4 left-4 bg-black/80 backdrop-blur-sm ${
        isMobile ? 'p-2 text-sm' : 'p-3'
      } rounded-md shadow-md z-10 text-white`}>
        <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
          {localMode ? (isZoneMode ? "Mode Zone Battle" : "Mode Solo Local") : `Joueurs en vie: ${alivePlayers}`}
        </div>
        {!localMode && currentRoom && (
          <>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-cyber-cyan`}>
              Match #{currentRoom.matchNumber} - {currentRoom.name}
            </div>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-400`}>
              Room: {currentRoom.id.substring(0, 8)}...
            </div>
          </>
        )}
        <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
          Vous: {localMode ? localPlayer?.name : player?.name}
        </div>
        {!localMode && (
          <>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} ${gameConnected ? 'text-green-400' : 'text-red-400'}`}>
              Sync: {gameConnected ? '✅ 30Hz' : '❌ Offline'}
            </div>
            {!gameConnected && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-1 text-xs"
                onClick={forceReconnect}
              >
                Reconnecter
              </Button>
            )}
          </>
        )}
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
      
      {/* Optimized Leaderboard positioning - moved to bottom right and made more compact */}
      <div className={`absolute ${
        isMobile 
          ? 'bottom-20 right-4' // Mobile: bottom right, above touch controls
          : isZoneMode 
            ? 'bottom-4 right-4' // Zone mode: bottom right to avoid zone counter
            : 'top-20 right-4' // Normal mode: top right but below exit button
      } z-10`}>
        <Leaderboard 
          players={localMode ? (localPlayer ? [localPlayer] : []) : (currentRoom ? currentRoom.players : [])} 
          currentPlayerId={localMode ? localPlayer?.id : player?.id}
          onPlayerEaten={handlePlayerEaten}
        />
      </div>
      
      {/* Enhanced Canvas with simplified position sync */}
      <div className="w-full h-full">
        <Canvas 
          ref={canvasRef}
          onGameOver={handleGameOver} 
          isLocalMode={localMode}
          localPlayer={localPlayer}
          isZoneMode={isZoneMode}
          onZoneUpdate={handleZoneUpdate}
          onPlayerPositionSync={handlePlayerPositionUpdate}
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
