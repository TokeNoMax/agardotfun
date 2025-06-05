
import { useEffect, useRef, useState, useCallback } from "react";
import { UnifiedGameSyncService, GameSyncCallbacks } from "@/services/realtime/unifiedGameSync";
import { useToast } from "@/hooks/use-toast";

interface UseUnifiedGameSyncProps extends GameSyncCallbacks {
  roomId?: string;
  playerId?: string;
  playerName?: string;
  enabled: boolean;
}

export const useUnifiedGameSync = ({
  roomId,
  playerId,
  playerName,
  enabled,
  onPlayerPositionUpdate,
  onPlayerCollision,
  onPlayerEliminated,
  onPlayerJoined,
  onPlayerLeft,
  onGameStart
}: UseUnifiedGameSyncProps) => {
  const { toast } = useToast();
  const [connectionState, setConnectionState] = useState<{
    isConnected: boolean;
    state: string;
    roomId?: string;
    diagnostics?: any;
  }>({ isConnected: false, state: 'disconnected' });
  
  const syncServiceRef = useRef<UnifiedGameSyncService | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptRef = useRef(false);
  const lastToastRef = useRef<number>(0);

  // Stabilize callbacks to prevent unnecessary reconnections
  const stableCallbacks = useRef<GameSyncCallbacks>({
    onPlayerPositionUpdate,
    onPlayerCollision,
    onPlayerEliminated,
    onPlayerJoined,
    onPlayerLeft,
    onGameStart
  });

  // Update callbacks without triggering reconnection
  useEffect(() => {
    stableCallbacks.current = {
      onPlayerPositionUpdate,
      onPlayerCollision,
      onPlayerEliminated,
      onPlayerJoined,
      onPlayerLeft,
      onGameStart
    };
    
    // Update callbacks in existing service
    if (syncServiceRef.current) {
      syncServiceRef.current['callbacks'] = stableCallbacks.current;
    }
  }, [onPlayerPositionUpdate, onPlayerCollision, onPlayerEliminated, onPlayerJoined, onPlayerLeft, onGameStart]);

  // Throttled toast to prevent spam
  const showThrottledToast = useCallback((title: string, description: string, duration = 2000) => {
    const now = Date.now();
    if (now - lastToastRef.current > 5000) { // 5 second throttle
      lastToastRef.current = now;
      toast({ title, description, duration });
    }
  }, [toast]);

  const connect = useCallback(async () => {
    if (!enabled || !roomId || !playerId || !playerName || connectionAttemptRef.current) {
      console.log(`[useUnifiedGameSync] ⏭️ Skipping connection - conditions not met:`, {
        enabled, roomId: !!roomId, playerId: !!playerId, playerName: !!playerName, 
        attempting: connectionAttemptRef.current
      });
      return false;
    }

    connectionAttemptRef.current = true;
    console.log(`[useUnifiedGameSync] 🔄 Attempting connection to room: ${roomId}, player: ${playerId}`);

    try {
      // Clean up existing service
      if (syncServiceRef.current) {
        console.log(`[useUnifiedGameSync] 🧹 Cleaning up existing service`);
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
      }

      // Create new unified service
      const service = new UnifiedGameSyncService(
        roomId,
        playerId,
        playerName,
        stableCallbacks.current
      );

      console.log(`[useUnifiedGameSync] 🚀 Connecting service...`);
      const connected = await service.connect();
      
      if (connected) {
        syncServiceRef.current = service;
        const state = service.getConnectionState();
        setConnectionState(state);
        
        console.log(`[useUnifiedGameSync] ✅ Successfully connected:`, state);
        
        showThrottledToast(
          "Synchronisation établie",
          "Connexion temps réel active !",
          2000
        );

        return true;
      } else {
        console.error(`[useUnifiedGameSync] ❌ Failed to connect`);
        setConnectionState({ isConnected: false, state: 'failed' });
        
        showThrottledToast(
          "Erreur de connexion",
          "Impossible de se connecter au serveur temps réel",
          3000
        );
        
        return false;
      }
    } catch (error) {
      console.error('[useUnifiedGameSync] ❌ Connection error:', error);
      setConnectionState({ isConnected: false, state: 'error' });
      
      showThrottledToast(
        "Erreur de synchronisation",
        "Une erreur est survenue lors de la connexion",
        3000
      );
      
      return false;
    } finally {
      connectionAttemptRef.current = false;
    }
  }, [enabled, roomId, playerId, playerName, showThrottledToast]);

  const attemptReconnection = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    console.log('[useUnifiedGameSync] 🔄 Attempting reconnection...');
    const success = await connect();
    
    if (!success && enabled) {
      // Schedule retry in 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled && roomId && playerId && playerName) {
          console.log('[useUnifiedGameSync] ⏰ Retrying connection...');
          attemptReconnection();
        }
      }, 3000);
    }
  }, [connect, enabled, roomId, playerId, playerName]);

  // Main connection effect
  useEffect(() => {
    console.log(`[useUnifiedGameSync] 🔍 Connection effect triggered:`, {
      enabled, roomId: !!roomId, playerId: !!playerId, playerName: !!playerName
    });

    if (enabled && roomId && playerId && playerName) {
      connect();
    } else {
      // Clean up if conditions not met
      if (syncServiceRef.current) {
        console.log(`[useUnifiedGameSync] 🧹 Cleaning up - conditions not met`);
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
        setConnectionState({ isConnected: false, state: 'disconnected' });
      }
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (syncServiceRef.current) {
        console.log(`[useUnifiedGameSync] 🔌 Cleanup - disconnecting service`);
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
      }
    };
  }, [enabled, roomId, playerId, playerName, connect]);

  // Broadcast functions with enhanced error handling
  const broadcastPlayerPosition = useCallback(async (x: number, y: number, size: number, velocityX = 0, velocityY = 0) => {
    if (syncServiceRef.current && connectionState.isConnected) {
      try {
        await syncServiceRef.current.broadcastPlayerPosition(x, y, size, velocityX, velocityY);
      } catch (error) {
        console.error('[useUnifiedGameSync] ❌ Error broadcasting position:', error);
      }
    } else if (syncServiceRef.current && !connectionState.isConnected) {
      console.warn('[useUnifiedGameSync] ⚠️ Cannot broadcast position - not connected');
    }
  }, [connectionState.isConnected]);

  const broadcastPlayerCollision = useCallback(async (eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => {
    if (syncServiceRef.current && connectionState.isConnected) {
      try {
        await syncServiceRef.current.broadcastPlayerCollision(eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize);
      } catch (error) {
        console.error('[useUnifiedGameSync] ❌ Error broadcasting collision:', error);
      }
    }
  }, [connectionState.isConnected]);

  const broadcastPlayerElimination = useCallback(async (eliminatedId: string, eliminatorId: string) => {
    if (syncServiceRef.current && connectionState.isConnected) {
      try {
        await syncServiceRef.current.broadcastPlayerElimination(eliminatedId, eliminatorId);
      } catch (error) {
        console.error('[useUnifiedGameSync] ❌ Error broadcasting elimination:', error);
      }
    }
  }, [connectionState.isConnected]);

  // Enhanced diagnostic information
  const getDiagnostics = useCallback(() => {
    return syncServiceRef.current?.getDiagnostics() || null;
  }, []);

  return {
    isConnected: connectionState.isConnected,
    connectionState: connectionState.state,
    roomId: connectionState.roomId,
    diagnostics: connectionState.diagnostics,
    broadcastPlayerPosition,
    broadcastPlayerCollision,
    broadcastPlayerElimination,
    forceReconnect: attemptReconnection,
    getDiagnostics
  };
};
