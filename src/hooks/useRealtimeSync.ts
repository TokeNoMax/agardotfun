
import { useEffect, useRef, useCallback } from "react";
import { RealtimeSync, PosPayload, ScorePayload } from "@/services/realtime/realtimeSync";
import { supabase } from "@/integrations/supabase/client";

interface UseRealtimeSyncProps {
  roomId?: string;
  playerId?: string;
  enabled: boolean;
  players: Record<string, any>;
  createBlob: (id: string) => any;
  onConnectionChange?: (connected: boolean) => void;
  onScoreUpdate?: (id: string, r: number) => void;
}

export const useRealtimeSync = ({
  roomId,
  playerId,
  enabled,
  players,
  createBlob,
  onConnectionChange,
  onScoreUpdate
}: UseRealtimeSyncProps) => {
  const syncRef = useRef<RealtimeSync | null>(null);

  const connect = useCallback(async () => {
    if (!enabled || !roomId || !playerId) {
      return;
    }

    // Cleanup existing sync
    if (syncRef.current) {
      syncRef.current.disconnect();
      syncRef.current = null;
    }

    try {
      const sync = new RealtimeSync({
        supabase,
        roomId,
        myId: playerId,
        players,
        createBlob,
        sendIntervalMs: 33, // 30 Hz
        onScoreUpdate
      });

      await sync.connect();
      syncRef.current = sync;
      onConnectionChange?.(true);
      
      console.log(`[RealtimeSync] Connected to room: ${roomId}`);
    } catch (error) {
      console.error('[RealtimeSync] Connection failed:', error);
      onConnectionChange?.(false);
    }
  }, [enabled, roomId, playerId, players, createBlob, onConnectionChange, onScoreUpdate]);

  useEffect(() => {
    connect();

    return () => {
      if (syncRef.current) {
        syncRef.current.disconnect();
        syncRef.current = null;
        onConnectionChange?.(false);
      }
    };
  }, [connect]);

  const updateLocalScore = useCallback((newR: number) => {
    if (syncRef.current) {
      syncRef.current.updateLocalScore(newR);
    }
  }, []);

  const isConnected = !!syncRef.current;

  return {
    isConnected,
    forceReconnect: connect,
    updateLocalScore
  };
};
