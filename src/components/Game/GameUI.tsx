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
import { useUnifiedGameSync } from "@/hooks/useUnifiedGameSync";
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
  const canvasRef = useRef<CanvasRef>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Ghost room cleaner
  useGhostRoomCleaner({
    enabled: !localMode,
    intervalMinutes: 1
  });

  // Enhanced unified game sync with comprehensive logging
  const {
    isConnected: gameConnected,
    connectionState: gameState,
    broadcastPlayerPosition,
    broadcastPlayerCollision,
    broadcastPlayerElimination,
    forceReconnect
  } = useUnifiedGameSync({
    roomId: currentRoom?.id,
    playerId: player?.id,
    playerName: player?.name,
    enabled: !localMode && !!currentRoom && !!player && currentRoom.status === 'playing',
    onPlayerPositionUpdate: (playerId: string, position) => {
      console.log(`[GameUI] 📍 Position update received for ${playerId}:`, position);
      if (canvasRef.current && playerId !== player?.id) {
        canvasRef.current.updatePlayerPosition(playerId, position);
      } else if (playerId === player?.id) {
        console.log(`[GameUI] ⏭️ Ignoring own position update`);
      } else if (!canvasRef.current) {
        console.warn(`[GameUI] ⚠️ Canvas not ready for position update`);
      }
    },
    onPlayerCollision: (eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => {
      console.log(`[GameUI] 💥 Collision received:`, { eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize });
      if (canvasRef.current) {
        canvasRef.current.eliminatePlayer(eliminatedId, eliminatorId);
      }
      
      const eliminatedPlayer = currentRoom?.players.find(p => p.id === eliminatedId);
      const eliminatorPlayer = currentRoom?.players.find(p => p.id === eliminatorId);
      
      if (eliminatedPlayer && eliminatorPlayer) {
        toast({
          title: "Collision Synchronisée !",
          description: `${eliminatorPlayer.name} a absorbé ${eliminatedPlayer.name} !`,
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    onPlayerEliminated: (eliminatedId: string, eliminatorId: string) => {
      console.log(`[GameUI] ☠️ Elimination received:`, { eliminatedId, eliminatorId });
      if (canvasRef.current) {
        canvasRef.current.eliminatePlayer(eliminatedId, eliminatorId);
      }
    },
    onPlayerJoined: (joinedPlayer) => {
      console.log(`[GameUI] 🆕 Player joined:`, joinedPlayer);
      
      if (canvasRef.current) {
        canvasRef.current.addPlayer(joinedPlayer);
        console.log(`[GameUI] ✅ Player added to canvas:`, joinedPlayer.name);
      } else {
        console.warn(`[GameUI] ⚠️ Canvas not ready, player join queued`);
      }
      
      toast({
        title: "Nouveau joueur",
        description: `${joinedPlayer.name} a rejoint la partie !`,
        duration: 2000,
      });
    },
    onPlayerLeft: (leftPlayerId) => {
      console.log(`[GameUI] ❌ Player left:`, leftPlayerId);
      const leftPlayer = currentRoom?.players.find(p => p.id === leftPlayerId);
      if (leftPlayer) {
        toast({
          title: "Joueur parti",
          description: `${leftPlayer.name} a quitté la partie`,
          variant: "destructive",
          duration: 2000,
        });
      }
    }
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

  // Enhanced player position sync with detailed logging
  const handlePlayerPositionUpdate = async (position: { x: number; y: number; size: number; velocityX?: number; velocityY?: number }) => {
    if (!localMode && gameConnected) {
      try {
        await broadcastPlayerPosition(position.x, position.y, position.size, position.velocityX, position.velocityY);
        // Log every 60 frames (about once per second at 60fps)
        if (Math.random() < 0.016) { // ~1/60 chance
          console.log(`[GameUI] 📤 Position broadcasted:`, { x: Math.round(position.x), y: Math.round(position.y), size: Math.round(position.size) });
        }
      } catch (error) {
        console.error('[GameUI] ❌ Error broadcasting position:', error);
      }
    }
  };

  // Enhanced collision broadcast with logging
  const handlePlayerCollisionBroadcast = async (
    eliminatedPlayerId: string, 
    eliminatorPlayerId: string, 
    eliminatedSize: number, 
    eliminatorNewSize: number
  ) => {
    if (!localMode && gameConnected) {
      try {
        console.log(`[GameUI] 💥 Broadcasting collision:`, { 
          eliminatedPlayerId, 
          eliminatorPlayerId, 
          eliminatedSize, 
          eliminatorNewSize 
        });
        await broadcastPlayerCollision(eliminatedPlayerId, eliminatorPlayerId, eliminatedSize, eliminatorNewSize);
      } catch (error) {
        console.error('[GameUI] ❌ Error broadcasting collision:', error);
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
              Sync: {gameConnected ? '✅ Connecté' : '❌ Déconnecté'}
            </div>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-400`}>
              Canal: game-{currentRoom?.id?.substring(0, 6)}
            </div>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-400`}>
              État: {gameState}
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
            {/* Diagnostic info toggle */}
            <details className="mt-2">
              <summary className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-300 cursor-pointer`}>
                Diagnostics
              </summary>
              <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-400 mt-1`}>
                Player ID: {player?.id?.substring(0, 8)}...
              </div>
            </details>
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
      
      {/* Leaderboard */}
      <div className={`absolute top-4 ${isMobile ? 'right-4 mt-12' : 'right-20'} z-10`}>
        <Leaderboard 
          players={localMode ? (localPlayer ? [localPlayer] : []) : (currentRoom ? currentRoom.players : [])} 
          currentPlayerId={localMode ? localPlayer?.id : player?.id}
          onPlayerEaten={handlePlayerEaten}
        />
      </div>
      
      {/* Enhanced Canvas with better position sync */}
      <div className="w-full h-full">
        <Canvas 
          ref={canvasRef}
          onGameOver={handleGameOver} 
          isLocalMode={localMode}
          localPlayer={localPlayer}
          isZoneMode={isZoneMode}
          onZoneUpdate={handleZoneUpdate}
          onPlayerPositionSync={handlePlayerPositionUpdate}
          onPlayerCollision={handlePlayerCollisionBroadcast}
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
