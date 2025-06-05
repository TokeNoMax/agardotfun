
import { supabase } from "@/integrations/supabase/client";

export class GhostRoomCleanerService {
  private static instance: GhostRoomCleanerService | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  static getInstance(): GhostRoomCleanerService {
    if (!GhostRoomCleanerService.instance) {
      GhostRoomCleanerService.instance = new GhostRoomCleanerService();
    }
    return GhostRoomCleanerService.instance;
  }

  startCleaning(intervalMinutes = 1) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[GhostCleaner] Starting ghost room cleaning service');

    // Premier nettoyage immédiat
    this.performCleanup();

    // Nettoyage périodique
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, intervalMinutes * 60 * 1000);
  }

  stopCleaning() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('[GhostCleaner] Ghost room cleaning service stopped');
  }

  private async performCleanup() {
    try {
      console.log('[GhostCleaner] Starting cleanup cycle...');

      // 1. Nettoyer les salles "playing" sans joueurs
      await this.cleanupGhostRooms();

      // 2. Nettoyer les joueurs orphelins
      await this.cleanupOrphanPlayers();

      // 3. Nettoyer les salles trop anciennes en attente
      await this.cleanupOldWaitingRooms();

      console.log('[GhostCleaner] Cleanup cycle completed');
    } catch (error) {
      console.error('[GhostCleaner] Error during cleanup:', error);
    }
  }

  private async cleanupGhostRooms() {
    try {
      // Récupérer toutes les salles en statut "playing"
      const { data: playingRooms, error: roomsError } = await supabase
        .from('game_rooms')
        .select('id, name, created_at')
        .eq('status', 'playing');

      if (roomsError) {
        console.error('[GhostCleaner] Error fetching playing rooms:', roomsError);
        return;
      }

      if (!playingRooms || playingRooms.length === 0) {
        return;
      }

      const ghostRoomIds: string[] = [];

      // Vérifier chaque salle pour voir si elle a des joueurs
      for (const room of playingRooms) {
        const { data: players, error: playersError } = await supabase
          .from('game_room_players')
          .select('id')
          .eq('room_id', room.id);

        if (playersError) {
          console.error('[GhostCleaner] Error checking players for room:', room.id, playersError);
          continue;
        }

        if (!players || players.length === 0) {
          ghostRoomIds.push(room.id);
          console.log('[GhostCleaner] Found ghost room:', room.name, room.id);
        }
      }

      // Supprimer les salles fantômes
      if (ghostRoomIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('game_rooms')
          .delete()
          .in('id', ghostRoomIds);

        if (deleteError) {
          console.error('[GhostCleaner] Error deleting ghost rooms:', deleteError);
        } else {
          console.log(`[GhostCleaner] Cleaned up ${ghostRoomIds.length} ghost rooms`);
        }
      }
    } catch (error) {
      console.error('[GhostCleaner] Error in cleanupGhostRooms:', error);
    }
  }

  private async cleanupOrphanPlayers() {
    try {
      // Trouver les joueurs dans des salles qui n'existent plus
      const { data: orphanPlayers, error } = await supabase
        .from('game_room_players')
        .select(`
          id,
          room_id,
          game_rooms!inner(id)
        `)
        .is('game_rooms.id', null);

      if (error) {
        console.error('[GhostCleaner] Error finding orphan players:', error);
        return;
      }

      if (orphanPlayers && orphanPlayers.length > 0) {
        const orphanIds = orphanPlayers.map(p => p.id);
        
        const { error: deleteError } = await supabase
          .from('game_room_players')
          .delete()
          .in('id', orphanIds);

        if (deleteError) {
          console.error('[GhostCleaner] Error deleting orphan players:', deleteError);
        } else {
          console.log(`[GhostCleaner] Cleaned up ${orphanIds.length} orphan players`);
        }
      }
    } catch (error) {
      console.error('[GhostCleaner] Error in cleanupOrphanPlayers:', error);
    }
  }

  private async cleanupOldWaitingRooms() {
    try {
      // Supprimer les salles en attente créées il y a plus de 2 heures
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data: oldRooms, error: fetchError } = await supabase
        .from('game_rooms')
        .select('id, name')
        .eq('status', 'waiting')
        .lt('created_at', twoHoursAgo);

      if (fetchError) {
        console.error('[GhostCleaner] Error fetching old waiting rooms:', fetchError);
        return;
      }

      if (oldRooms && oldRooms.length > 0) {
        const oldRoomIds = oldRooms.map(r => r.id);

        // Supprimer d'abord les joueurs de ces salles
        await supabase
          .from('game_room_players')
          .delete()
          .in('room_id', oldRoomIds);

        // Puis supprimer les salles
        const { error: deleteError } = await supabase
          .from('game_rooms')
          .delete()
          .in('id', oldRoomIds);

        if (deleteError) {
          console.error('[GhostCleaner] Error deleting old waiting rooms:', deleteError);
        } else {
          console.log(`[GhostCleaner] Cleaned up ${oldRoomIds.length} old waiting rooms`);
        }
      }
    } catch (error) {
      console.error('[GhostCleaner] Error in cleanupOldWaitingRooms:', error);
    }
  }

  async forceCleanup(): Promise<void> {
    console.log('[GhostCleaner] Force cleanup requested');
    await this.performCleanup();
  }
}

export const ghostRoomCleaner = GhostRoomCleanerService.getInstance();
