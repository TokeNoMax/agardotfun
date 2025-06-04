
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

      // Récupérer toutes les salles en statut "playing"
      const { data: playingRooms, error: roomsError } = await supabase
        .from('game_rooms')
        .select('id, name')
        .eq('status', 'playing');

      if (roomsError) {
        console.error('Error fetching playing rooms:', roomsError);
        return;
      }

      if (!playingRooms || playingRooms.length === 0) {
        if (enableLogging) {
          console.log('No playing rooms found');
        }
        return;
      }

      // Vérifier chaque salle pour voir si elle a des joueurs
      const ghostRoomIds: string[] = [];
      
      for (const room of playingRooms) {
        const { data: players, error: playersError } = await supabase
          .from('game_room_players')
          .select('id')
          .eq('room_id', room.id);

        if (playersError) {
          console.error('Error checking players for room:', room.id, playersError);
          continue;
        }

        if (!players || players.length === 0) {
          ghostRoomIds.push(room.id);
          if (enableLogging) {
            console.log('Found ghost room:', room.name, room.id);
          }
        }
      }

      // Supprimer les salles fantômes
      if (ghostRoomIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('game_rooms')
          .delete()
          .in('id', ghostRoomIds);

        if (deleteError) {
          console.error('Error deleting ghost rooms:', deleteError);
        } else if (enableLogging) {
          console.log(`Cleaned up ${ghostRoomIds.length} ghost rooms`);
        }
      }

      // Nettoyer les joueurs orphelins (dans des salles qui n'existent plus)
      const { data: allPlayers, error: allPlayersError } = await supabase
        .from('game_room_players')
        .select('id, room_id');

      if (allPlayersError) {
        console.error('Error fetching all players:', allPlayersError);
        return;
      }

      if (allPlayers && allPlayers.length > 0) {
        const orphanPlayerIds: string[] = [];
        
        for (const player of allPlayers) {
          const { data: room, error: roomError } = await supabase
            .from('game_rooms')
            .select('id')
            .eq('id', player.room_id)
            .maybeSingle();

          if (roomError || !room) {
            orphanPlayerIds.push(player.id);
          }
        }

        if (orphanPlayerIds.length > 0) {
          const { error: deleteOrphanError } = await supabase
            .from('game_room_players')
            .delete()
            .in('id', orphanPlayerIds);

          if (deleteOrphanError) {
            console.error('Error deleting orphan players:', deleteOrphanError);
          } else if (enableLogging) {
            console.log(`Cleaned up ${orphanPlayerIds.length} orphan players`);
          }
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
