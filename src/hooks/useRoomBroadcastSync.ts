
import { useEffect, useRef, useState, useCallback } from "react";
import { RoomBroadcastSyncService, RoomSyncCallbacks } from "@/services/realtime/roomBroadcastSync";
import { useToast } from "@/hooks/use-toast";

interface UseRoomBroadcastSyncProps extends RoomSyncCallbacks {
  roomId?: string;
  playerId?: string;
  playerName?: string;
  enabled: boolean;
}

export const useRoomBroadcastSync = ({
  roomId,
  playerId,
  playerName,
  enabled,
  onPlayerMove,
  onPlayerCollision,
  onPlayerEliminated,
  onPlayerJoined,
  onPlayerLeft,
  onGameStart
}: UseRoomBroadcastSyncProps) => {
  const { toast } = useToast();
  const [connectionState, setConnectionState] = useState<{
    isConnected: boolean;
    state: string;
    roomId?: string;
  }>({ isConnected: false, state: 'disconnected' });
  
  const syncServiceRef = useRef<RoomBroadcastSyncService | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptRef = useRef(false);

  // Stabiliser les callbacks pour éviter les re-connexions inutiles
  const stableCallbacks = useRef<RoomSyncCallbacks>({
    onPlayerMove,
    onPlayerCollision,
    onPlayerEliminated,
    onPlayerJoined,
    onPlayerLeft,
    onGameStart
  });

  // Mettre à jour les callbacks sans déclencher de reconnexion
  useEffect(() => {
    stableCallbacks.current = {
      onPlayerMove,
      onPlayerCollision,
      onPlayerEliminated,
      onPlayerJoined,
      onPlayerLeft,
      onGameStart
    };
  }, [onPlayerMove, onPlayerCollision, onPlayerEliminated, onPlayerJoined, onPlayerLeft, onGameStart]);

  const connect = useCallback(async () => {
    if (!enabled || !roomId || !playerId || !playerName || connectionAttemptRef.current) {
      return false;
    }

    connectionAttemptRef.current = true;
    console.log('[Hook] Attempting to connect to room broadcast:', roomId);

    try {
      // Nettoyer l'ancien service
      if (syncServiceRef.current) {
        syncServiceRef.current.disconnect();
      }

      // Créer le nouveau service
      const service = new RoomBroadcastSyncService(
        roomId,
        playerId,
        playerName,
        stableCallbacks.current
      );

      const connected = await service.connect();
      
      if (connected) {
        syncServiceRef.current = service;
        setConnectionState(service.getConnectionState());
        
        toast({
          title: "Synchronisation établie",
          description: "Connexion temps réel active !",
          duration: 2000,
        });

        console.log('[Hook] Successfully connected to room broadcast');
        return true;
      } else {
        console.error('[Hook] Failed to connect to room broadcast');
        return false;
      }
    } catch (error) {
      console.error('[Hook] Connection error:', error);
      return false;
    } finally {
      connectionAttemptRef.current = false;
    }
  }, [enabled, roomId, playerId, playerName, toast]);

  const attemptReconnection = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    console.log('[Hook] Attempting reconnection...');
    const success = await connect();
    
    if (!success) {
      // Programmer une nouvelle tentative dans 3 secondes
      reconnectTimeoutRef.current = setTimeout(() => {
        attemptReconnection();
      }, 3000);
    }
  }, [connect]);

  // Effet principal de connexion
  useEffect(() => {
    if (enabled && roomId && playerId && playerName) {
      connect();
    } else {
      // Nettoyer si les conditions ne sont plus remplies
      if (syncServiceRef.current) {
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
        syncServiceRef.current.disconnect();
        syncServiceRef.current = null;
      }
    };
  }, [enabled, roomId, playerId, playerName, connect]);

  // Fonctions de broadcast
  const broadcastPlayerMove = useCallback(async (x: number, y: number, size: number, velocityX = 0, velocityY = 0) => {
    if (syncServiceRef.current && connectionState.isConnected) {
      await syncServiceRef.current.broadcastPlayerMove(x, y, size, velocityX, velocityY);
    }
  }, [connectionState.isConnected]);

  const broadcastPlayerCollision = useCallback(async (eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => {
    if (syncServiceRef.current && connectionState.isConnected) {
      await syncServiceRef.current.broadcastPlayerCollision(eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize);
    }
  }, [connectionState.isConnected]);

  const broadcastPlayerElimination = useCallback(async (eliminatedId: string, eliminatorId: string) => {
    if (syncServiceRef.current && connectionState.isConnected) {
      await syncServiceRef.current.broadcastPlayerElimination(eliminatedId, eliminatorId);
    }
  }, [connectionState.isConnected]);

  return {
    isConnected: connectionState.isConnected,
    connectionState: connectionState.state,
    roomId: connectionState.roomId,
    broadcastPlayerMove,
    broadcastPlayerCollision,
    broadcastPlayerElimination,
    forceReconnect: attemptReconnection
  };
};
