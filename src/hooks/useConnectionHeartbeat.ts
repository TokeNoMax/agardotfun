
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ConnectionState = 'connected' | 'lost' | 'checking';

interface ConnectionHeartbeatOptions {
  roomId?: string;
  playerId?: string;
  enabled: boolean;
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
}

export const useConnectionHeartbeat = ({
  roomId,
  playerId,
  enabled,
  onConnectionLost,
  onConnectionRestored
}: ConnectionHeartbeatOptions) => {
  const { toast } = useToast();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());
  const connectionStateRef = useRef<ConnectionState>('connected');
  const missedHeartbeatsRef = useRef(0);
  const maxMissedHeartbeats = 3;

  const checkConnection = useCallback(async () => {
    if (!roomId || !playerId || !enabled) return true;

    try {
      const { data, error } = await supabase
        .from('game_room_players')
        .select('id')
        .eq('room_id', roomId)
        .eq('player_id', playerId)
        .maybeSingle();

      if (error) {
        console.error('Heartbeat check failed:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Connection check error:', error);
      return false;
    }
  }, [roomId, playerId, enabled]);

  const performHeartbeat = useCallback(async () => {
    if (!enabled) return;

    const previousState = connectionStateRef.current;
    connectionStateRef.current = 'checking';
    
    const isConnected = await checkConnection();
    const now = Date.now();

    if (isConnected) {
      lastHeartbeatRef.current = now;
      missedHeartbeatsRef.current = 0;
      
      if (previousState === 'lost') {
        console.log('Connection restored');
        connectionStateRef.current = 'connected';
        onConnectionRestored?.();
        toast({
          title: "Connexion rétablie",
          description: "Synchronisation multi-joueurs active",
        });
      } else {
        connectionStateRef.current = 'connected';
      }
    } else {
      missedHeartbeatsRef.current++;
      
      if (missedHeartbeatsRef.current >= maxMissedHeartbeats && previousState !== 'lost') {
        console.warn('Connection lost after', maxMissedHeartbeats, 'missed heartbeats');
        connectionStateRef.current = 'lost';
        onConnectionLost?.();
        toast({
          title: "Connexion perdue",
          description: "Tentative de reconnexion en cours...",
          variant: "destructive",
        });
      } else {
        // Restore previous state if not enough missed heartbeats
        connectionStateRef.current = previousState;
      }
    }
  }, [enabled, checkConnection, onConnectionLost, onConnectionRestored, toast]);

  useEffect(() => {
    if (!enabled || !roomId || !playerId) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      return;
    }

    // Premier heartbeat immédiat
    performHeartbeat();

    // Heartbeat toutes les 10 secondes
    heartbeatIntervalRef.current = setInterval(performHeartbeat, 10000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [enabled, roomId, playerId, performHeartbeat]);

  return {
    connectionState: connectionStateRef.current,
    lastHeartbeat: lastHeartbeatRef.current,
    missedHeartbeats: missedHeartbeatsRef.current,
    forceHeartbeat: performHeartbeat
  };
};
