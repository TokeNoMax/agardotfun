
import { useEffect, useRef, useState } from "react";
import { GameSyncService, PlayerPosition } from "@/services/realtime/gameSync";
import { Player } from "@/types/game";

interface UseGameSyncProps {
  roomId?: string;
  playerId?: string;
  isEnabled: boolean;
  onPlayerUpdate?: (playerId: string, position: PlayerPosition) => void;
  onPlayerEliminated?: (eliminatedPlayerId: string, eliminatorPlayerId: string) => void;
  onGameStateUpdate?: (gameState: any) => void;
}

export const useGameSync = ({
  roomId,
  playerId,
  isEnabled,
  onPlayerUpdate,
  onPlayerEliminated,
  onGameStateUpdate
}: UseGameSyncProps) => {
  const gameSyncRef = useRef<GameSyncService | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isEnabled || !roomId || !playerId) {
      return;
    }

    console.log("Setting up game sync for room:", roomId, "player:", playerId);

    const gameSync = new GameSyncService(roomId, playerId);
    gameSyncRef.current = gameSync;

    const connect = async () => {
      try {
        await gameSync.connect({
          onPlayerUpdate,
          onPlayerEliminated,
          onGameStateUpdate
        });
        setIsConnected(true);
        console.log("Game sync connected successfully");
      } catch (error) {
        console.error("Failed to connect game sync:", error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      console.log("Cleaning up game sync");
      gameSync.disconnect();
      gameSyncRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, playerId, isEnabled]);

  const syncPlayerPosition = async (position: PlayerPosition) => {
    if (gameSyncRef.current && isConnected) {
      await gameSyncRef.current.syncPlayerPosition(position);
    }
  };

  const broadcastCollision = async (
    eliminatedPlayerId: string, 
    eliminatorPlayerId: string, 
    eliminatedSize: number, 
    eliminatorNewSize: number
  ) => {
    if (gameSyncRef.current && isConnected) {
      await gameSyncRef.current.broadcastCollision(
        eliminatedPlayerId, 
        eliminatorPlayerId, 
        eliminatedSize, 
        eliminatorNewSize
      );
    }
  };

  const broadcastPlayerElimination = async (eliminatedPlayerId: string, eliminatorPlayerId: string) => {
    if (gameSyncRef.current && isConnected) {
      await gameSyncRef.current.broadcastPlayerElimination(eliminatedPlayerId, eliminatorPlayerId);
    }
  };

  return {
    isConnected,
    syncPlayerPosition,
    broadcastCollision,
    broadcastPlayerElimination
  };
};
