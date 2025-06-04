
import { useEffect, useRef, useState, useCallback } from "react";
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
  const connectionAttemptRef = useRef<boolean>(false);

  // FIXED: Memoize callbacks to prevent dependency changes
  const stableOnPlayerUpdate = useCallback((playerId: string, position: OptimizedPlayerPosition) => {
    console.log("Stable player update received:", playerId, position);
    onPlayerUpdate?.(playerId, position);
  }, [onPlayerUpdate]);

  const stableOnPlayerEliminated = useCallback((eliminatedPlayerId: string, eliminatorPlayerId: string) => {
    console.log("Stable player elimination received:", eliminatedPlayerId, eliminatorPlayerId);
    onPlayerEliminated?.(eliminatedPlayerId, eliminatorPlayerId);
  }, [onPlayerEliminated]);

  const stableOnGameStateUpdate = useCallback((gameState: any) => {
    console.log("Stable game state update received:", gameState);
    onGameStateUpdate?.(gameState);
  }, [onGameStateUpdate]);

  // FIXED: Stabilize connection logic with proper cleanup
  useEffect(() => {
    console.log("useOptimizedGameSync effect triggered:", { 
      roomId, 
      playerId, 
      isEnabled, 
      currentConnection: !!syncServiceRef.current,
      connectionAttempt: connectionAttemptRef.current 
    });

    // Prevent multiple connection attempts
    if (connectionAttemptRef.current) {
      console.log("Connection attempt already in progress, skipping");
      return;
    }

    if (!isEnabled || !roomId || !playerId) {
      console.log("Conditions not met for sync, cleaning up existing connection");
      if (syncServiceRef.current) {
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
        setIsConnected(false);
        connectionAttemptRef.current = false;
      }
      return;
    }

    // Check if we already have a connection for this room
    if (syncServiceRef.current) {
      console.log("Already connected to optimized game sync, skipping");
      return;
    }

    // FIXED: Set connection attempt flag
    connectionAttemptRef.current = true;
    console.log("Creating new optimized game sync connection for:", { roomId, playerId });
    
    const connectAsync = async () => {
      try {
        const syncService = new OptimizedGameSyncService(roomId, playerId, {
          onPlayerUpdate: stableOnPlayerUpdate,
          onPlayerEliminated: stableOnPlayerEliminated,
          onGameStateUpdate: stableOnGameStateUpdate
        });

        await syncService.connect();
        
        console.log("Optimized game sync connected successfully for room:", roomId);
        syncServiceRef.current = syncService;
        setIsConnected(true);
        connectionAttemptRef.current = false;
      } catch (error) {
        console.error("Failed to connect optimized game sync:", error);
        setIsConnected(false);
        connectionAttemptRef.current = false;
      }
    };

    connectAsync();

    return () => {
      console.log("Cleaning up optimized game sync connection");
      if (syncServiceRef.current) {
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
        setIsConnected(false);
      }
      connectionAttemptRef.current = false;
    };
  }, [roomId, playerId, isEnabled, stableOnPlayerUpdate, stableOnPlayerEliminated, stableOnGameStateUpdate]);

  const syncPlayerPosition = useCallback(async (position: OptimizedPlayerPosition) => {
    if (syncServiceRef.current && isConnected) {
      try {
        await syncServiceRef.current.syncPlayerPosition(position);
      } catch (error) {
        console.error("Error syncing player position:", error);
      }
    } else {
      console.warn("Cannot sync position - not connected:", { 
        hasService: !!syncServiceRef.current, 
        isConnected 
      });
    }
  }, [isConnected]);

  const getInterpolatedPosition = useCallback((playerId: string, position: OptimizedPlayerPosition): OptimizedPlayerPosition => {
    if (syncServiceRef.current) {
      return syncServiceRef.current.getInterpolatedPosition(playerId, position);
    }
    return position;
  }, []);

  const broadcastCollision = useCallback(async (eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) => {
    if (syncServiceRef.current && isConnected) {
      try {
        console.log("Broadcasting collision via hook:", { eliminatedPlayerId, eliminatorPlayerId });
        await syncServiceRef.current.broadcastCollision(eliminatedPlayerId, eliminatorPlayerId, eliminatedSize, eliminatorNewSize);
      } catch (error) {
        console.error("Error broadcasting collision:", error);
      }
    } else {
      console.warn("Cannot broadcast collision - not connected:", { 
        hasService: !!syncServiceRef.current, 
        isConnected 
      });
    }
  }, [isConnected]);

  return {
    isConnected,
    syncPlayerPosition,
    getInterpolatedPosition,
    broadcastCollision
  };
};
