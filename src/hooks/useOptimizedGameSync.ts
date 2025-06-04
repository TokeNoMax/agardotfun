
import { useEffect, useRef, useState } from "react";
import { OptimizedGameSyncService, OptimizedGameSyncCallbacks, OptimizedPlayerPosition } from "@/services/realtime/optimizedGameSync";

interface UseOptimizedGameSyncProps extends OptimizedGameSyncCallbacks {
  roomId?: string;
  playerId?: string;
  isEnabled: boolean;
}

export const useOptimizedGameSync = ({
  roomId,
  playerId,
  isEnabled,
  onPlayerUpdate,
  onPlayerEliminated,
  onGameStateUpdate
}: UseOptimizedGameSyncProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const syncServiceRef = useRef<OptimizedGameSyncService | null>(null);

  useEffect(() => {
    if (!isEnabled || !roomId || !playerId) {
      // Cleanup if conditions not met
      if (syncServiceRef.current) {
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // FIXED: Create new sync service instance for this specific room
    console.log("Creating optimized game sync for room:", roomId, "player:", playerId);
    
    const syncService = new OptimizedGameSyncService(roomId, playerId, {
      onPlayerUpdate,
      onPlayerEliminated,
      onGameStateUpdate
    });

    syncService.connect().then(() => {
      console.log("Optimized game sync connected for room:", roomId);
      setIsConnected(true);
    }).catch((error) => {
      console.error("Failed to connect optimized game sync:", error);
      setIsConnected(false);
    });

    syncServiceRef.current = syncService;

    return () => {
      if (syncServiceRef.current) {
        console.log("Cleaning up optimized game sync for room:", roomId);
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
        setIsConnected(false);
      }
    };
  }, [roomId, playerId, isEnabled, onPlayerUpdate, onPlayerEliminated, onGameStateUpdate]);

  const syncPlayerPosition = async (position: OptimizedPlayerPosition) => {
    if (syncServiceRef.current && isConnected) {
      await syncServiceRef.current.syncPlayerPosition(position);
    }
  };

  const getInterpolatedPosition = (playerId: string, position: OptimizedPlayerPosition): OptimizedPlayerPosition => {
    if (syncServiceRef.current) {
      return syncServiceRef.current.getInterpolatedPosition(playerId, position);
    }
    return position;
  };

  const broadcastCollision = async (eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) => {
    if (syncServiceRef.current && isConnected) {
      await syncServiceRef.current.broadcastCollision(eliminatedPlayerId, eliminatorPlayerId, eliminatedSize, eliminatorNewSize);
    }
  };

  return {
    isConnected,
    syncPlayerPosition,
    getInterpolatedPosition,
    broadcastCollision
  };
};
