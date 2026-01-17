
import { useEffect, useRef, useState, useCallback } from 'react';
import { SocketGameSyncService, SocketGameSyncCallbacks, GameSnapshot } from '@/services/realtime/socketGameSync';

interface UseSocketGameSyncProps extends SocketGameSyncCallbacks {
  roomId?: string;
  playerId?: string;
  playerName?: string;
  playerColor?: string;
  enabled: boolean;
  serverUrl?: string;
}

export const useSocketGameSync = ({
  roomId,
  playerId,
  playerName,
  playerColor,
  enabled,
  serverUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001',
  onSnapshot,
  onPlayerJoined,
  onPlayerLeft,
  onRoomJoined,
  onConnectionChange
}: UseSocketGameSyncProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const serviceRef = useRef<SocketGameSyncService | null>(null);
  const connectionAttemptRef = useRef(false);

  // Stable callbacks
  const stableCallbacks = useRef<SocketGameSyncCallbacks>({
    onSnapshot,
    onPlayerJoined,
    onPlayerLeft,
    onRoomJoined,
    onConnectionChange: (connected: boolean) => {
      setIsConnected(connected);
      setConnectionInfo(serviceRef.current?.getConnectionInfo() || null);
      onConnectionChange?.(connected);
    }
  });

  // Update callbacks without triggering reconnection
  useEffect(() => {
    stableCallbacks.current = {
      onSnapshot,
      onPlayerJoined,
      onPlayerLeft,
      onRoomJoined,
      onConnectionChange: stableCallbacks.current.onConnectionChange
    };
  }, [onSnapshot, onPlayerJoined, onPlayerLeft, onRoomJoined]);

  // Connection management
  const connect = useCallback(async () => {
    if (!enabled || connectionAttemptRef.current) {
      return false;
    }

    connectionAttemptRef.current = true;
    console.log('[useSocketGameSync] Attempting connection...');

    try {
      // Clean up existing service
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }

      // Create new service
      const service = new SocketGameSyncService(stableCallbacks.current);
      const connected = await service.connect(serverUrl);

      if (connected) {
        serviceRef.current = service;
        setConnectionInfo(service.getConnectionInfo());
        console.log('[useSocketGameSync] Connected successfully');
        return true;
      } else {
        console.error('[useSocketGameSync] Failed to connect');
        return false;
      }
    } catch (error) {
      console.error('[useSocketGameSync] Connection error:', error);
      return false;
    } finally {
      connectionAttemptRef.current = false;
    }
  }, [enabled, serverUrl]);

  // Join room when conditions are met
  useEffect(() => {
    if (isConnected && serviceRef.current && roomId && playerId && playerName && playerColor) {
      console.log('[useSocketGameSync] Joining room:', roomId);
      serviceRef.current.joinRoom(roomId, playerId, playerName, playerColor);
    }
  }, [isConnected, roomId, playerId, playerName, playerColor]);

  // Main connection effect
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      // Cleanup when disabled
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
        setIsConnected(false);
        setConnectionInfo(null);
      }
    }

    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, [enabled, connect]);

  // Broadcast functions
  const sendPlayerInput = useCallback((moveX: number, moveY: number, boost: boolean = false) => {
    if (serviceRef.current && isConnected) {
      serviceRef.current.sendPlayerInput(moveX, moveY, boost);
    }
  }, [isConnected]);

  const leaveRoom = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.leaveRoom();
    }
  }, []);

  const forceReconnect = useCallback(async () => {
    console.log('[useSocketGameSync] Force reconnecting...');
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
      setIsConnected(false);
    }
    return await connect();
  }, [connect]);

  return {
    isConnected,
    connectionInfo,
    sendPlayerInput,
    leaveRoom,
    forceReconnect
  };
};
