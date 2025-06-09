
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
  
  // Check if we're in local mode
  const isLocalMode = !currentRoom && !roomId;
  
  // Determine game mode for zone battle features
  const isZoneMode = currentRoom?.gameMode === 'battle_royale';

  console.log("GameUI: Rendering with", { 
    isLocalMode, 
    roomId, 
    currentRoom: !!currentRoom, 
    isZoneMode,
    currentPlayer: !!currentPlayer 
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
  }, []);

  const handlePlayerCollision = useCallback((eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => {
    console.log("GameUI: Received collision event:", { eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize });
    
    // Update Canvas with size changes
    if (canvasRef.current) {
      canvasRef.current.eliminatePlayer(eliminatedId, eliminatorId);
    }
    
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
    
    toast({
      title: "Nouveau joueur",
      description: `${player.name} a rejoint la partie`,
      duration: 2000
    });
  }, [toast]);

  const handlePlayerLeft = useCallback((playerId: string) => {
    console.log("GameUI: Player left:", playerId);
    
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
        localPlayer={currentPlayer}
        isZoneMode={isZoneMode}
        onZoneUpdate={handleZoneUpdate}
        onPlayerPositionSync={handlePlayerPositionSync}
        onPlayerCollision={handlePlayerCollisionBroadcast}
        onPlayerElimination={handlePlayerEliminationBroadcast}
        roomId={roomId || currentRoom?.id}
      />

      {/* Leaderboard */}
      <div className="absolute top-4 left-4 z-10">
        <Leaderboard />
      </div>

      {/* Zone Counter (Battle Royale mode) */}
      {isZoneMode && safeZone && (
        <div className="absolute top-4 right-4 z-10">
          <ZoneCounter 
            safeZone={safeZone} 
            isPlayerInZone={isPlayerInZone}
          />
        </div>
      )}

      {/* Mobile Touch Controls */}
      {isMobile && (
        <TouchControlArea onDirectionChange={handleMobileDirection} />
      )}

      {/* Connection Status Indicator (debug) */}
      {!isLocalMode && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className={`px-2 py-1 rounded text-xs font-mono ${
            syncConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            SYNC: {syncConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={gameOver}
        winner={winner}
        eliminationType={eliminationType}
        onRestart={() => {
          setGameOver(false);
          setWinner(null);
          // Navigation handled by the modal itself
        }}
      />
    </div>
  );
}
