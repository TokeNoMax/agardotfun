
import { useEffect, useRef, useCallback } from 'react';
import { OptimizedPositionSyncService } from '@/services/realtime/optimizedPositionSync';

interface PositionUpdate {
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
}

interface UseOptimizedPositionSyncProps {
  roomId?: string;
  playerId?: string;
  enabled: boolean;
  onPositionUpdate?: (playerId: string, position: PositionUpdate) => void;
}

export const useOptimizedPositionSync = ({
  roomId,
  playerId,
  enabled,
  onPositionUpdate
}: UseOptimizedPositionSyncProps) => {
  const serviceRef = useRef<OptimizedPositionSyncService | null>(null);

  useEffect(() => {
    if (!enabled || !roomId || !playerId) {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
      return;
    }

    const connectService = async () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }

      const service = new OptimizedPositionSyncService(
        roomId,
        playerId,
        onPositionUpdate
      );

      const connected = await service.connect();
      if (connected) {
        serviceRef.current = service;
        console.log('[Hook] Optimized position sync connected');
      } else {
        console.error('[Hook] Failed to connect optimized position sync');
      }
    };

    connectService();

    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, [roomId, playerId, enabled, onPositionUpdate]);

  const updatePosition = useCallback(async (position: PositionUpdate) => {
    if (serviceRef.current) {
      await serviceRef.current.updatePosition(position);
    }
  }, []);

  return {
    updatePosition,
    isConnected: !!serviceRef.current
  };
};
