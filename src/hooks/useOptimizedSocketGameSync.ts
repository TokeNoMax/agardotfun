import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  OptimizedSocketGameSyncService, 
  OptimizedSocketGameSyncCallbacks, 
  CompactSnapshot 
} from '@/services/realtime/optimizedSocketGameSync';

interface UseOptimizedSocketGameSyncProps extends OptimizedSocketGameSyncCallbacks {
  roomId?: string;
  playerId?: string;
  playerName?: string;
  playerColor?: string;
  enabled: boolean;
  serverUrl?: string;
}

interface InterpolationBuffer {
  [playerId: string]: {
    positions: Array<{ x: number; y: number; size: number; timestamp: number }>;
    lastUpdate: number;
  };
}

interface ClientPredictionState {
  localPosition: { x: number; y: number; size: number };
  pendingInputs: Array<{ seq: number; moveX: number; moveY: number; timestamp: number }>;
  lastServerTick: number;
}

export const useOptimizedSocketGameSync = ({
  roomId,
  playerId,
  playerName,
  playerColor,
  enabled,
  serverUrl = 'http://localhost:3001',
  onSnapshot,
  onPlayerJoined,
  onPlayerLeft,
  onRoomJoined,
  onConnectionChange,
  onPing
}: UseOptimizedSocketGameSyncProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const serviceRef = useRef<OptimizedSocketGameSyncService | null>(null);
  const connectionAttemptRef = useRef(false);
  
  // Client-side prediction state
  const predictionRef = useRef<ClientPredictionState>({
    localPosition: { x: 0, y: 0, size: 20 },
    pendingInputs: [],
    lastServerTick: 0
  });
  
  // Interpolation buffer for smooth movement
  const interpolationRef = useRef<InterpolationBuffer>({});
  const interpolationBufferSize = 150; // 150ms buffer
  
  // Performance tracking
  const [diagnostics, setDiagnostics] = useState({
    rtt: 0,
    packetsSent: 0,
    packetsReceived: 0,
    inputRate: 0,
    snapshotRate: 0
  });

  // Stable callbacks with optimized features
  const stableCallbacks = useRef<OptimizedSocketGameSyncCallbacks>({
    onSnapshot: (snapshot: CompactSnapshot) => {
      // Update interpolation buffer
      updateInterpolationBuffer(snapshot);
      
      // Handle client-side prediction reconciliation
      handleServerReconciliation(snapshot);
      
      // Update diagnostics
      updateDiagnostics();
      
      onSnapshot?.(snapshot);
    },
    onPlayerJoined,
    onPlayerLeft,
    onRoomJoined,
    onConnectionChange: (connected: boolean) => {
      setIsConnected(connected);
      if (serviceRef.current) {
        const info = serviceRef.current.getDiagnostics();
        setConnectionInfo(info);
        setNetworkQuality(serviceRef.current.getNetworkQuality());
      }
      onConnectionChange?.(connected);
    },
    onPing: (rtt: number) => {
      setDiagnostics(prev => ({ ...prev, rtt }));
      onPing?.(rtt);
    }
  });

  // Update callbacks without triggering reconnection
  useEffect(() => {
    stableCallbacks.current = {
      ...stableCallbacks.current,
      onSnapshot: stableCallbacks.current.onSnapshot, // Keep optimized version
      onPlayerJoined,
      onPlayerLeft,
      onRoomJoined
    };
  }, [onPlayerJoined, onPlayerLeft, onRoomJoined]);

  // Interpolation buffer management
  const updateInterpolationBuffer = useCallback((snapshot: CompactSnapshot) => {
    const now = Date.now();
    const targetTime = now - interpolationBufferSize;
    
    // Update player positions in buffer
    if (snapshot.ps) {
      for (const [playerId, playerData] of Object.entries(snapshot.ps)) {
        if (!interpolationRef.current[playerId]) {
          interpolationRef.current[playerId] = { positions: [], lastUpdate: 0 };
        }
        
        const buffer = interpolationRef.current[playerId];
        buffer.positions.push({
          x: playerData.x,
          y: playerData.y,
          size: playerData.r,
          timestamp: snapshot.t
        });
        
        // Remove old positions
        buffer.positions = buffer.positions.filter(pos => pos.timestamp > targetTime);
        buffer.lastUpdate = now;
      }
    }
    
    // Clean up buffers for players that left AOI
    if (snapshot.rm) {
      for (const removedId of snapshot.rm) {
        delete interpolationRef.current[removedId];
      }
    }
  }, []);

  // Client-side prediction and reconciliation
  const handleServerReconciliation = useCallback((snapshot: CompactSnapshot) => {
    if (!snapshot.you) return;
    
    const prediction = predictionRef.current;
    const serverPosition = snapshot.you;
    
    // Update server state
    prediction.lastServerTick = snapshot.tick;
    
    // Check for prediction error
    const errorThreshold = 2.0; // pixels
    const positionError = Math.sqrt(
      Math.pow(prediction.localPosition.x - serverPosition.x, 2) +
      Math.pow(prediction.localPosition.y - serverPosition.y, 2)
    );
    
    if (positionError > errorThreshold) {
      // Reconciliation needed - adjust local position
      console.log(`[ClientPrediction] Reconciliation needed, error: ${positionError.toFixed(2)}px`);
      prediction.localPosition = {
        x: serverPosition.x,
        y: serverPosition.y,
        size: serverPosition.r
      };
      
      // Re-apply pending inputs
      for (const input of prediction.pendingInputs) {
        applyInputToPosition(prediction.localPosition, input);
      }
    } else {
      // Update size (server authoritative)
      prediction.localPosition.size = serverPosition.r;
    }
    
    // Clean up acknowledged inputs (assuming server processed up to current tick)
    // In a real implementation, the server should send back the last processed input seq
    prediction.pendingInputs = prediction.pendingInputs.slice(-10); // Keep last 10
  }, []);

  const applyInputToPosition = useCallback((position: { x: number; y: number; size: number }, input: any) => {
    // Simple movement prediction (should match server logic)
    const speed = Math.max(20, 100 * Math.max(0.3, 1 - (position.size - 20) / 200)); // Simplified speed calc
    const deltaTime = 1/40; // Assume 40Hz input rate
    
    position.x += input.moveX * speed * deltaTime;
    position.y += input.moveY * speed * deltaTime;
    
    // Apply boundaries (should match server)
    const radius = position.size / 2;
    position.x = Math.max(radius, Math.min(2000 - radius, position.x));
    position.y = Math.max(radius, Math.min(2000 - radius, position.y));
  }, []);

  // Interpolated position getter
  const getInterpolatedPosition = useCallback((playerId: string): { x: number; y: number; size: number } | null => {
    const buffer = interpolationRef.current[playerId];
    if (!buffer || buffer.positions.length === 0) return null;
    
    const now = Date.now();
    const targetTime = now - interpolationBufferSize;
    
    // Find two positions to interpolate between
    let before = null;
    let after = null;
    
    for (let i = 0; i < buffer.positions.length - 1; i++) {
      if (buffer.positions[i].timestamp <= targetTime && buffer.positions[i + 1].timestamp >= targetTime) {
        before = buffer.positions[i];
        after = buffer.positions[i + 1];
        break;
      }
    }
    
    if (!before || !after) {
      // Use latest position if no interpolation possible
      return buffer.positions[buffer.positions.length - 1];
    }
    
    // Linear interpolation
    const timeDiff = after.timestamp - before.timestamp;
    const progress = timeDiff > 0 ? (targetTime - before.timestamp) / timeDiff : 0;
    
    return {
      x: before.x + (after.x - before.x) * progress,
      y: before.y + (after.y - before.y) * progress,
      size: before.size + (after.size - before.size) * progress
    };
  }, []);

  const updateDiagnostics = useCallback(() => {
    if (serviceRef.current) {
      const serviceDiagnostics = serviceRef.current.getDiagnostics();
      setDiagnostics(prev => ({
        ...prev,
        packetsSent: serviceDiagnostics.packetsSent,
        packetsReceived: serviceDiagnostics.packetsReceived
      }));
    }
  }, []);

  // Connection management
  const connect = useCallback(async () => {
    if (!enabled || connectionAttemptRef.current) {
      return false;
    }

    connectionAttemptRef.current = true;
    console.log('[useOptimizedSocketGameSync] Attempting connection...');

    try {
      // Clean up existing service
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }

      // Create new optimized service
      const service = new OptimizedSocketGameSyncService(stableCallbacks.current);
      const connected = await service.connect(serverUrl);

      if (connected) {
        serviceRef.current = service;
        setConnectionInfo(service.getDiagnostics());
        setNetworkQuality(service.getNetworkQuality());
        console.log('[useOptimizedSocketGameSync] Connected successfully');
        return true;
      } else {
        console.error('[useOptimizedSocketGameSync] Failed to connect');
        return false;
      }
    } catch (error) {
      console.error('[useOptimizedSocketGameSync] Connection error:', error);
      return false;
    } finally {
      connectionAttemptRef.current = false;
    }
  }, [enabled, serverUrl]);

  // Join room when conditions are met
  useEffect(() => {
    if (isConnected && serviceRef.current && roomId && playerId && playerName && playerColor) {
      console.log('[useOptimizedSocketGameSync] Joining room:', roomId);
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

  // Optimized input sending with client-side prediction
  const sendPlayerInput = useCallback((moveX: number, moveY: number, boost: boolean = false) => {
    if (serviceRef.current && isConnected) {
      // Apply client-side prediction immediately
      const prediction = predictionRef.current;
      const input = { moveX, moveY, boost, seq: Date.now(), timestamp: Date.now() };
      
      applyInputToPosition(prediction.localPosition, input);
      prediction.pendingInputs.push(input);
      
      // Send to server
      serviceRef.current.sendPlayerInput(moveX, moveY, boost);
    }
  }, [isConnected]);

  const leaveRoom = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.leaveRoom();
    }
  }, []);

  const forceReconnect = useCallback(async () => {
    console.log('[useOptimizedSocketGameSync] Force reconnecting...');
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
      setIsConnected(false);
    }
    return await connect();
  }, [connect]);

  const measureRTT = useCallback(async () => {
    if (serviceRef.current) {
      return await serviceRef.current.measureRTT();
    }
    return -1;
  }, []);

  return {
    // Connection state
    isConnected,
    connectionInfo,
    networkQuality,
    diagnostics,
    
    // Game functions
    sendPlayerInput,
    leaveRoom,
    forceReconnect,
    
    // Advanced features
    getInterpolatedPosition,
    getPredictedPosition: () => predictionRef.current.localPosition,
    measureRTT
  };
};