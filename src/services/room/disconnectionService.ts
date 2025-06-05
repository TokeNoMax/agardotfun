
import { supabase } from "@/integrations/supabase/client";
import { playerService } from "../player/playerService";

export class DisconnectionService {
  private disconnectionTimers = new Map<string, NodeJS.Timeout>();
  private readonly DISCONNECTION_DELAY = 10000; // 10 secondes

  scheduleDisconnection(roomId: string, playerId: string): void {
    console.log(`[DisconnectionService] Scheduling disconnection for player ${playerId} in room ${roomId}`);
    
    // Annuler le timer existant s'il y en a un
    this.cancelDisconnection(playerId);
    
    const timer = setTimeout(async () => {
      try {
        console.log(`[DisconnectionService] Processing delayed disconnection for player ${playerId}`);
        await playerService.markPlayerDisconnected(roomId, playerId);
        this.disconnectionTimers.delete(playerId);
      } catch (error) {
        console.error(`[DisconnectionService] Error processing disconnection:`, error);
      }
    }, this.DISCONNECTION_DELAY);
    
    this.disconnectionTimers.set(playerId, timer);
  }

  cancelDisconnection(playerId: string): void {
    const timer = this.disconnectionTimers.get(playerId);
    if (timer) {
      console.log(`[DisconnectionService] Cancelling scheduled disconnection for player ${playerId}`);
      clearTimeout(timer);
      this.disconnectionTimers.delete(playerId);
    }
  }

  cleanup(): void {
    console.log(`[DisconnectionService] Cleaning up ${this.disconnectionTimers.size} pending disconnections`);
    for (const [playerId, timer] of this.disconnectionTimers) {
      clearTimeout(timer);
    }
    this.disconnectionTimers.clear();
  }

  async forceDisconnectInactivePlayer(roomId: string, playerId: string): Promise<void> {
    console.log(`[DisconnectionService] Force disconnecting inactive player ${playerId} from room ${roomId}`);
    
    try {
      // Vérifier la dernière activité du joueur
      const { data: player, error } = await supabase
        .from('game_room_players')
        .select('last_position_update')
        .eq('room_id', roomId)
        .eq('player_id', playerId)
        .single();

      if (error) {
        console.error('Error checking player activity:', error);
        return;
      }

      if (player) {
        const lastUpdate = new Date(player.last_position_update || 0).getTime();
        const now = Date.now();
        const inactiveTime = now - lastUpdate;
        
        // Si inactif depuis plus de 30 secondes, marquer comme déconnecté
        if (inactiveTime > 30000) {
          await playerService.markPlayerDisconnected(roomId, playerId);
          console.log(`[DisconnectionService] Marked inactive player ${playerId} as disconnected`);
        }
      }
    } catch (error) {
      console.error('[DisconnectionService] Error in forceDisconnectInactivePlayer:', error);
    }
  }
}

export const disconnectionService = new DisconnectionService();
