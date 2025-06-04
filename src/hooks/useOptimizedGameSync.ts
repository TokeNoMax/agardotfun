
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
  const lastConnectionKey = useRef<string>('');

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

  // FIXED: Create connection key for tracking
  const currentConnectionKey = `${roomId}-${playerId}-${isEnabled}`;

  // FIXED: Enhanced connection logic with better duplicate prevention
  useEffect(() => {
    console.log("useOptimizedGameSync effect triggered:", { 
      roomId, 
      playerId, 
      isEnabled, 
      currentConnection: !!syncServiceRef.current,
      connectionAttempt: connectionAttemptRef.current,
      lastKey: lastConnectionKey.current,
      currentKey: currentConnectionKey
    });

    // If the connection key hasn't changed and we have a valid connection, skip
    if (lastConnectionKey.current === currentConnectionKey && syncServiceRef.current && isConnected) {
      console.log("Connection already established for this key, skipping");
      return;
    }

    // Prevent multiple connection attempts for the same key
    if (connectionAttemptRef.current && lastConnectionKey.current === currentConnectionKey) {
      console.log("Connection attempt already in progress for this key, skipping");
      return;
    }

    // Clean up existing connection if conditions changed
    if (syncServiceRef.current) {
      console.log("Cleaning up existing connection");
      syncServiceRef.current.disconnect();
      syncServiceRef.current = null;
      setIsConnected(false);
      connectionAttemptRef.current = false;
    }

    if (!isEnabled || !roomId || !playerId) {
      console.log("Conditions not met for sync:", { isEnabled, roomId, playerId });
      lastConnectionKey.current = '';
      return;
    }

    // Set connection attempt flag and update last connection key
    connectionAttemptRef.current = true;
    lastConnectionKey.current = currentConnectionKey;
    
    console.log("Creating new optimized game sync connection for:", { roomId, playerId });
    
    const connectAsync = async () => {
      try {
        const syncService = new OptimizedGameSyncService(roomId, playerId, {
          onPlayerUpdate: stableOnPlayerUpdate,
          onPlayerEliminated: stableOnPlayerEliminated,
          onGameStateUpdate: stableOnGameStateUpdate
        });

        await syncService.connect();
        
        // Only set as connected if this is still the current connection attempt
        if (lastConnectionKey.current === currentConnectionKey) {
          console.log("Optimized game sync connected successfully for room:", roomId);
          syncServiceRef.current = syncService;
          setIsConnected(true);
          connectionAttemptRef.current = false;
        } else {
          console.log("Connection completed but key changed, discarding");
          syncService.disconnect();
        }
      } catch (error) {
        console.error("Failed to connect optimized game sync:", error);
        if (lastConnectionKey.current === currentConnectionKey) {
          setIsConnected(false);
          connectionAttemptRef.current = false;
        }
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
  }, [currentConnectionKey, isEnabled, roomId, playerId, stableOnPlayerUpdate, stableOnPlayerEliminated, stableOnGameStateUpdate]);

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
