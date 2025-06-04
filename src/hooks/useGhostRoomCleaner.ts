
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GhostRoomCleanerOptions {
  intervalMinutes?: number;
  enableLogging?: boolean;
}

export const useGhostRoomCleaner = ({
  intervalMinutes = 2,
  enableLogging = true
}: GhostRoomCleanerOptions = {}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanGhostRooms = async () => {
    try {
      if (enableLogging) {
        console.log('Starting ghost room cleanup...');
      }

      // Nettoyer les salles en statut "playing" sans joueurs
      const { data: ghostRooms, error: ghostError } = await supabase
        .from('game_rooms')
        .select(`
          id, 
          name,
          game_room_players!inner(room_id)
        `)
        .eq('status', 'playing')
        .having('count', 'eq', 0);

      if (ghostError) {
        console.error('Error finding ghost rooms:', ghostError);
        return;
      }

      // Supprimer les salles fantômes
      if (ghostRooms && ghostRooms.length > 0) {
        const roomIds = ghostRooms.map(room => room.id);
        
        const { error: deleteError } = await supabase
          .from('game_rooms')
          .delete()
          .in('id', roomIds);

        if (deleteError) {
          console.error('Error deleting ghost rooms:', deleteError);
        } else if (enableLogging) {
          console.log(`Cleaned up ${ghostRooms.length} ghost rooms:`, ghostRooms.map(r => r.name));
        }
      }

      // Nettoyer les joueurs orphelins (dans des salles qui n'existent plus)
      const { data: orphanPlayers, error: orphanError } = await supabase
        .from('game_room_players')
        .select(`
          id,
          room_id,
          player_id,
          game_rooms!inner(id)
        `)
        .is('game_rooms.id', null);

      if (!orphanError && orphanPlayers && orphanPlayers.length > 0) {
        const { error: deleteOrphanError } = await supabase
          .from('game_room_players')
          .delete()
          .in('id', orphanPlayers.map(p => p.id));

        if (deleteOrphanError) {
          console.error('Error deleting orphan players:', deleteOrphanError);
        } else if (enableLogging) {
          console.log(`Cleaned up ${orphanPlayers.length} orphan players`);
        }
      }

      if (enableLogging) {
        console.log('Ghost room cleanup completed');
      }

    } catch (error) {
      console.error('Unexpected error during ghost room cleanup:', error);
    }
  };

  useEffect(() => {
    // Premier nettoyage après 5 secondes
    const initialTimeout = setTimeout(cleanGhostRooms, 5000);

    // Nettoyage périodique
    intervalRef.current = setInterval(cleanGhostRooms, intervalMinutes * 60 * 1000);

    if (enableLogging) {
      console.log(`Ghost room cleaner started: every ${intervalMinutes} minutes`);
    }

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalMinutes, enableLogging]);

  return {
    triggerCleanup: cleanGhostRooms
  };
};
