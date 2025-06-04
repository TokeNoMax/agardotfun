
import { useEffect, useRef, useState, useCallback } from "react";
import { OptimizedGameSyncService, OptimizedGameSyncCallbacks, OptimizedPlayerPosition } from "@/services/realtime/optimizedGameSync";
import { useConnectionHeartbeat } from "./useConnectionHeartbeat";
import { useConnectionManager } from "./useConnectionManager";

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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const syncServiceRef = useRef<OptimizedGameSyncService | null>(null);
  const connectionAttemptRef = useRef<boolean>(false);
  const lastConnectionKey = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gestionnaire de connexions pour éviter les doublons
  const { cleanupAllConnections, createUniqueChannel, validateConnection, saveConnectionState, restoreConnectionState } = useConnectionManager({
    roomId,
    playerId
  });

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

  // Gestion de la reconnexion automatique
  const attemptReconnection = useCallback(async () => {
    if (!roomId || !playerId || !isEnabled || isReconnecting) return;

    console.log('Attempting reconnection...');
    setIsReconnecting(true);

    try {
      // Valider que la connexion est toujours nécessaire
      const isValid = await validateConnection();
      if (!isValid) {
        console.log('Connection no longer valid, aborting reconnection');
        setIsReconnecting(false);
        return;
      }

      // Nettoyer les anciennes connexions
      if (syncServiceRef.current) {
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
      }

      // Créer une nouvelle connexion
      const syncService = new OptimizedGameSyncService(roomId, playerId, {
        onPlayerUpdate: stableOnPlayerUpdate,
        onPlayerEliminated: stableOnPlayerEliminated,
        onGameStateUpdate: stableOnGameStateUpdate
      });

      await syncService.connect();
      
      syncServiceRef.current = syncService;
      setIsConnected(true);
      setIsReconnecting(false);
      connectionAttemptRef.current = false;

      console.log('Reconnection successful');

    } catch (error) {
      console.error('Reconnection failed:', error);
      setIsReconnecting(false);
      
      // Programmer une nouvelle tentative dans 5 secondes
      reconnectTimeoutRef.current = setTimeout(() => {
        attemptReconnection();
      }, 5000);
    }
  }, [roomId, playerId, isEnabled, isReconnecting, validateConnection, stableOnPlayerUpdate, stableOnPlayerEliminated, stableOnGameStateUpdate]);

  // Heartbeat pour détecter les déconnexions
  const { connectionState } = useConnectionHeartbeat({
    roomId,
    playerId,
    enabled: isEnabled && isConnected,
    onConnectionLost: () => {
      console.log('Connection lost detected by heartbeat');
      setIsConnected(false);
      attemptReconnection();
    },
    onConnectionRestored: () => {
      console.log('Connection restored detected by heartbeat');
      if (!isConnected && !isReconnecting) {
        attemptReconnection();
      }
    }
  });

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
      cleanupAllConnections();
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

          // Sauvegarder l'état de connexion pour récupération
          saveConnectionState(currentConnectionKey, {
            roomId,
            playerId,
            connectedAt: Date.now()
          });
        } else {
          console.log("Connection completed but key changed, discarding");
          syncService.disconnect();
        }
      } catch (error) {
        console.error("Failed to connect optimized game sync:", error);
        if (lastConnectionKey.current === currentConnectionKey) {
          setIsConnected(false);
          connectionAttemptRef.current = false;
          
          // Programmer une reconnexion automatique
          attemptReconnection();
        }
      }
    };

    connectAsync();

    return () => {
      console.log("Cleaning up optimized game sync connection");
      
      // Nettoyer les timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (syncServiceRef.current) {
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
        setIsConnected(false);
      }
      connectionAttemptRef.current = false;
    };
  }, [currentConnectionKey, isEnabled, roomId, playerId, stableOnPlayerUpdate, stableOnPlayerEliminated, stableOnGameStateUpdate, cleanupAllConnections, saveConnectionState, attemptReconnection]);

  const syncPlayerPosition = useCallback(async (position: OptimizedPlayerPosition) => {
    if (syncServiceRef.current && isConnected) {
      try {
        await syncServiceRef.current.syncPlayerPosition(position);
      } catch (error) {
        console.error("Error syncing player position:", error);
        // En cas d'erreur, tenter une reconnexion
        setIsConnected(false);
        attemptReconnection();
      }
    } else {
      console.warn("Cannot sync position - not connected:", { 
        hasService: !!syncServiceRef.current, 
        isConnected 
      });
    }
  }, [isConnected, attemptReconnection]);

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
        // En cas d'erreur, tenter une reconnexion
        setIsConnected(false);
        attemptReconnection();
      }
    } else {
      console.warn("Cannot broadcast collision - not connected:", { 
        hasService: !!syncServiceRef.current, 
        isConnected 
      });
    }
  }, [isConnected, attemptReconnection]);

  return {
    isConnected,
    isReconnecting,
    connectionState,
    syncPlayerPosition,
    getInterpolatedPosition,
    broadcastCollision,
    forceReconnect: attemptReconnection
  };
};
