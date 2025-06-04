
import { useEffect, useRef, useState, useCallback } from "react";
import { OptimizedGameSyncService, OptimizedPlayerPosition } from "@/services/realtime/optimizedGameSync";

interface UseOptimizedGameSyncProps {
  roomId?: string;
  playerId?: string;
  isEnabled: boolean;
  onPlayerUpdate?: (playerId: string, position: OptimizedPlayerPosition) => void;
  onPlayerEliminated?: (eliminatedPlayerId: string, eliminatorPlayerId: string) => void;
  onGameStateUpdate?: (gameState: any) => void;
}

export const useOptimizedGameSync = ({
  roomId,
  playerId,
  isEnabled,
  onPlayerUpdate,
  onPlayerEliminated,
  onGameStateUpdate
}: UseOptimizedGameSyncProps) => {
  const gameSyncRef = useRef<OptimizedGameSyncService | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isEnabled || !roomId || !playerId) {
      return;
    }

    const gameSync = new OptimizedGameSyncService(roomId, playerId, {
      onPlayerUpdate,
      onPlayerEliminated,
      onGameStateUpdate
    });
    
    gameSyncRef.current = gameSync;

    const connect = async () => {
      try {
        await gameSync.connect();
        setIsConnected(true);
      } catch (error) {
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      gameSync.disconnect();
      gameSyncRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, playerId, isEnabled, onPlayerUpdate, onPlayerEliminated, onGameStateUpdate]);

  const syncPlayerPosition = useCallback(async (position: OptimizedPlayerPosition) => {
    if (gameSyncRef.current && isConnected) {
      await gameSyncRef.current.syncPlayerPosition(position);
    }
  }, [isConnected]);

  const getInterpolatedPosition = useCallback((playerId: string, targetPosition: OptimizedPlayerPosition) => {
    if (gameSyncRef.current) {
      return gameSyncRef.current.getInterpolatedPosition(playerId, targetPosition);
    }
    return targetPosition;
  }, []);

  const broadcastCollision = useCallback(async (
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
  }, [isConnected]);

  return {
    isConnected,
    syncPlayerPosition,
    getInterpolatedPosition,
    broadcastCollision
  };
};
