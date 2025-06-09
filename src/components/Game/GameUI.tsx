import React, { useEffect, useRef, useState, useCallback } from "react";
import { useGame } from "@/context/GameContext";
import Canvas, { CanvasRef } from "./Canvas";
import Leaderboard from "./Leaderboard";
import TouchControlArea from "./TouchControlArea";
import GameOverModal from "./GameOverModal";
import ZoneCounter from "./ZoneCounter";
import { Player, SafeZone } from "@/types/game";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUnifiedGameSync } from "@/hooks/useUnifiedGameSync";
import { useToast } from "@/hooks/use-toast";

interface GameUIProps {
  roomId?: string;
}

// Create a default local player for solo mode
const createDefaultLocalPlayer = (): Player => ({
  id: 'local-player',
  walletAddress: 'local',
  name: 'Joueur Solo',
  color: 'blue',
  size: 20,
  x: 400,
  y: 300,
  isAlive: true,
  isReady: true,
  velocityX: 0,
  velocityY: 0
});

export default function GameUI({ roomId }: GameUIProps) {
  const { currentRoom, player: currentPlayer } = useGame();
  const { toast } = useToast();
  const canvasRef = useRef<CanvasRef>(null);
  const isMobile = useIsMobile();
  
  // Game state
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [eliminationType, setEliminationType] = useState<'absorption' | 'zone' | 'timeout'>('absorption');
  const [safeZone, setSafeZone] = useState<SafeZone | null>(null);
  const [isPlayerInZone, setIsPlayerInZone] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [timeUntilShrink, setTimeUntilShrink] = useState(0);
  
  // Check if we're in local mode
  const isLocalMode = !currentRoom && !roomId;
  
  // Create effective player and players for UI display
  const effectivePlayer = isLocalMode ? createDefaultLocalPlayer() : currentPlayer;
  const effectivePlayers = isLocalMode ? [createDefaultLocalPlayer()] : players;
  
  // Determine game mode for zone battle features
  const isZoneMode = currentRoom?.gameMode === 'battle_royale';

  console.log("GameUI: Rendering with", { 
    isLocalMode, 
    roomId, 
    currentRoom: !!currentRoom, 
    isZoneMode,
    effectivePlayer: !!effectivePlayer,
    effectivePlayers: effectivePlayers.length
  });

  // UNIFIED: Callbacks for the unified sync service
  const handlePlayerPositionUpdate = useCallback((playerId: string, position: { x: number; y: number; size: number; velocityX?: number; velocityY?: number }) => {
    console.log("GameUI: Received position update for player:", playerId, position);
    if (canvasRef.current) {
      canvasRef.current.updatePlayerPosition(playerId, {
        x: position.x,
        y: position.y,
        size: position.size
      });
    }
    
    // Update players state
    setPlayers(prev => prev.map(p => 
      p.id === playerId 
        ? { ...p, x: position.x, y: position.y, size: position.size }
        : p
    ));
  }, []);

  const handlePlayerCollision = useCallback((eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => {
    console.log("GameUI: Received collision event:", { eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize });
    
    // Update Canvas with size changes
    if (canvasRef.current) {
      canvasRef.current.eliminatePlayer(eliminatedId, eliminatorId);
    }
    
    // Update players state
    setPlayers(prev => prev.map(p => {
      if (p.id === eliminatedId) {
        return { ...p, isAlive: false };
      }
      if (p.id === eliminatorId) {
        return { ...p, size: eliminatorNewSize };
      }
      return p;
    }));
    
    // Show toast notification
    if (eliminatedId === currentPlayer?.id) {
      toast({
        title: "Vous avez été éliminé !",
        description: `Éliminé par ${eliminatorId}`,
        variant: "destructive",
        duration: 3000
      });
    } else if (eliminatorId === currentPlayer?.id) {
      toast({
        title: "Élimination !",
        description: `Vous avez éliminé ${eliminatedId}`,
        duration: 2000
      });
    }
  }, [currentPlayer?.id, toast]);

  const handlePlayerEliminated = useCallback((eliminatedId: string, eliminatorId: string) => {
    console.log("GameUI: Received elimination event:", { eliminatedId, eliminatorId });
    
    // Canvas should already be updated via collision event
    // This is for final cleanup and notifications
    
    if (eliminatedId === currentPlayer?.id) {
      console.log("GameUI: Our player was eliminated remotely");
      setGameOver(true);
      setWinner(null); // Will be determined by Canvas
      setEliminationType('absorption');
    }
  }, [currentPlayer?.id]);

  const handlePlayerJoined = useCallback((player: any) => {
    console.log("GameUI: Player joined:", player);
    if (canvasRef.current) {
      canvasRef.current.addPlayer(player);
    }
    
    // Update players state
    setPlayers(prev => [...prev.filter(p => p.id !== player.id), player]);
    
    toast({
      title: "Nouveau joueur",
      description: `${player.name} a rejoint la partie`,
      duration: 2000
    });
  }, [toast]);

  const handlePlayerLeft = useCallback((playerId: string) => {
    console.log("GameUI: Player left:", playerId);
    
    // Update players state
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    
    toast({
      title: "Joueur parti",
      description: `Un joueur a quitté la partie`,
      duration: 2000
    });
  }, [toast]);

  const handleGameStart = useCallback((gameData: any) => {
    console.log("GameUI: Game started with data:", gameData);
    
    toast({
      title: "Partie commencée !",
      description: "La partie a démarré",
      duration: 2000
    });
  }, [toast]);

  // UNIFIED: Use the unified sync service
  const {
    isConnected: syncConnected,
    broadcastPlayerPosition,
    broadcastPlayerCollision,
    broadcastPlayerElimination
  } = useUnifiedGameSync({
    roomId: roomId || currentRoom?.id,
    playerId: currentPlayer?.id,
    playerName: currentPlayer?.name,
    enabled: !isLocalMode && !!currentPlayer && !!currentRoom,
    onPlayerPositionUpdate: handlePlayerPositionUpdate,
    onPlayerCollision: handlePlayerCollision,
    onPlayerEliminated: handlePlayerEliminated,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onGameStart: handleGameStart
  });

  // Initialize players from current room or set default for local mode
  useEffect(() => {
    if (isLocalMode) {
      setPlayers([createDefaultLocalPlayer()]);
    } else if (currentRoom?.players) {
      setPlayers(currentRoom.players);
    }
  }, [currentRoom?.players, isLocalMode]);

  // Update zone timer
  useEffect(() => {
    if (safeZone) {
      const updateTimer = () => {
        const now = Date.now();
        const timeLeft = Math.max(0, safeZone.nextShrinkTime - now);
        setTimeUntilShrink(timeLeft);
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [safeZone]);

  // Position sync callback for Canvas
  const handlePlayerPositionSync = useCallback(async (position: { x: number; y: number; size: number }) => {
    if (!isLocalMode && syncConnected) {
      await broadcastPlayerPosition(position.x, position.y, position.size);
    }
  }, [isLocalMode, syncConnected, broadcastPlayerPosition]);

  // Collision callback for Canvas
  const handlePlayerCollisionBroadcast = useCallback(async (
    eliminatedPlayerId: string, 
    eliminatorPlayerId: string, 
    eliminatedSize: number, 
    eliminatorNewSize: number
  ) => {
    if (!isLocalMode && syncConnected) {
      console.log("GameUI: Broadcasting collision:", { eliminatedPlayerId, eliminatorPlayerId, eliminatedSize, eliminatorNewSize });
      await broadcastPlayerCollision(eliminatedPlayerId, eliminatorPlayerId, eliminatedSize, eliminatorNewSize);
    }
  }, [isLocalMode, syncConnected, broadcastPlayerCollision]);

  // Elimination callback for Canvas
  const handlePlayerEliminationBroadcast = useCallback(async (
    eliminatedPlayerId: string, 
    eliminatorPlayerId: string
  ) => {
    if (!isLocalMode && syncConnected) {
      console.log("GameUI: Broadcasting elimination:", { eliminatedPlayerId, eliminatorPlayerId });
      await broadcastPlayerElimination(eliminatedPlayerId, eliminatorPlayerId);
    }
  }, [isLocalMode, syncConnected, broadcastPlayerElimination]);

  // Game over handler
  const handleGameOver = useCallback((winnerPlayer: Player | null, type: 'absorption' | 'zone' | 'timeout' = 'absorption') => {
    console.log("GameUI: Game over triggered", { winner: winnerPlayer, type });
    setGameOver(true);
    setWinner(winnerPlayer);
    setEliminationType(type);
  }, []);

  // Zone update handler
  const handleZoneUpdate = useCallback((zone: SafeZone, playerInZone: boolean) => {
    setSafeZone(zone);
    setIsPlayerInZone(playerInZone);
  }, []);

  // Mobile control handler
  const handleMobileDirection = useCallback((direction: { x: number; y: number } | null) => {
    if (canvasRef.current) {
      canvasRef.current.setMobileDirection(direction);
    }
  }, []);

  // Show loading screen while connecting (only in multiplayer)
  if (!isLocalMode && !effectivePlayer) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg font-medium">Connexion à la partie...</p>
          {roomId && (
            <p className="text-sm text-gray-400 mt-1">Room: {roomId}</p>
          )}
        </div>
      </div>
    );
  }

  // Show connection status for debugging
  useEffect(() => {
    if (!isLocalMode) {
      console.log("GameUI: Sync connection status:", syncConnected);
    }
  }, [syncConnected, isLocalMode]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Main Canvas */}
      <Canvas
        ref={canvasRef}
        onGameOver={handleGameOver}
        isLocalMode={isLocalMode}
        localPlayer={effectivePlayer}
        isZoneMode={isZoneMode}
        onZoneUpdate={handleZoneUpdate}
        onPlayerPositionSync={handlePlayerPositionSync}
        onPlayerCollision={handlePlayerCollisionBroadcast}
        onPlayerElimination={handlePlayerEliminationBroadcast}
        roomId={roomId || currentRoom?.id}
      />

      {/* Leaderboard - Always show with effective players */}
      <div className="absolute top-4 left-4 z-10">
        <Leaderboard 
          players={effectivePlayers}
          currentPlayerId={effectivePlayer?.id}
        />
      </div>

      {/* Zone Counter (Battle Royale mode) */}
      {isZoneMode && safeZone && (
        <div className="absolute top-4 right-4 z-10">
          <ZoneCounter 
            safeZone={safeZone} 
            isPlayerInZone={isPlayerInZone}
            timeUntilShrink={timeUntilShrink}
          />
        </div>
      )}

      {/* Mobile Touch Controls - Always show on mobile */}
      {isMobile && (
        <TouchControlArea onDirectionChange={handleMobileDirection} />
      )}

      {/* Connection Status Indicator (only in multiplayer) */}
      {!isLocalMode && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className={`px-2 py-1 rounded text-xs font-mono ${
            syncConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            SYNC: {syncConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
      )}

      {/* Local Mode Indicator */}
      {isLocalMode && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="px-2 py-1 rounded text-xs font-mono bg-blue-500/20 text-blue-400">
            MODE: SOLO
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      <GameOverModal
        open={gameOver}
        winner={winner}
        eliminationType={eliminationType}
        onPlayAgain={() => {
          setGameOver(false);
          setWinner(null);
          // Navigation handled by the modal itself
        }}
        onBackToLobby={() => {
          setGameOver(false);
          setWinner(null);
          // Navigation handled by the modal itself
        }}
      />
    </div>
  );
}
