
import { useEffect, useRef } from 'react';
import { activityService } from '@/services/room/activityService';
import { roomService } from '@/services/room/roomService';

interface UsePlayerHeartbeatOptions {
  roomId?: string;
  playerId?: string;
  intervalSeconds?: number;
  enableLogging?: boolean;
}

export const usePlayerHeartbeat = (options: UsePlayerHeartbeatOptions = {}) => {
  const { roomId, playerId, intervalSeconds = 30, enableLogging = false } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const ghostCheckRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(0);

  const sendHeartbeat = async () => {
    if (!roomId || !playerId) return;

    const now = Date.now();
    // Éviter les heartbeats trop fréquents
    if (now - lastHeartbeatRef.current < intervalSeconds * 1000) {
      return;
    }

    try {
      await activityService.updateRoomActivity(roomId);
      lastHeartbeatRef.current = now;
      
      if (enableLogging) {
        console.log(`Heartbeat sent for player ${playerId} in room ${roomId}`);
      }
    } catch (error) {
      if (enableLogging) {
        console.error('Error sending heartbeat:', error);
      }
    }
  };

  const checkGhostRooms = async () => {
    try {
      await roomService.checkGhostRooms();
    } catch (error) {
      if (enableLogging) {
        console.error('Error checking ghost rooms:', error);
      }
    }
  };

  useEffect(() => {
    if (!roomId || !playerId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ghostCheckRef.current) {
        clearInterval(ghostCheckRef.current);
        ghostCheckRef.current = null;
      }
      return;
    }

    // Envoyer un heartbeat initial
    sendHeartbeat();

    // Configurer l'intervalle pour les heartbeats réguliers
    intervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, intervalSeconds * 1000);

    // Vérification périodique des salles fantômes (toutes les 2 minutes)
    ghostCheckRef.current = setInterval(() => {
      checkGhostRooms();
    }, 2 * 60 * 1000);

    if (enableLogging) {
      console.log(`Player heartbeat started: every ${intervalSeconds} seconds`);
      console.log('Ghost room checking enabled: every 2 minutes');
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (ghostCheckRef.current) {
        clearInterval(ghostCheckRef.current);
        ghostCheckRef.current = null;
      }
      if (enableLogging) {
        console.log('Player heartbeat and ghost room checking stopped');
      }
    };
  }, [roomId, playerId, intervalSeconds, enableLogging]);

  return {
    sendManualHeartbeat: sendHeartbeat,
    checkGhostRooms
  };
};
