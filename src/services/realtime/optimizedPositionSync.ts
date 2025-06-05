
import { supabase } from "@/integrations/supabase/client";

interface PositionUpdate {
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
}

export class OptimizedPositionSyncService {
  private roomId: string;
  private playerId: string;
  private channel: any;
  private lastDbUpdate = 0;
  private lastBroadcast = 0;
  private dbUpdateInterval = 1000; // 1 seconde pour la DB
  private broadcastInterval = 50; // 50ms pour le broadcast
  private onPositionUpdate?: (playerId: string, position: PositionUpdate) => void;

  constructor(
    roomId: string, 
    playerId: string, 
    onPositionUpdate?: (playerId: string, position: PositionUpdate) => void
  ) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.onPositionUpdate = onPositionUpdate;
  }

  async connect(): Promise<boolean> {
    try {
      const channelName = `position-sync-${this.roomId}`;
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false }
        }
      });

      // Écouter les broadcasts de position
      this.channel.on('broadcast', { event: 'position_update' }, (payload: any) => {
        const { playerId, position } = payload.payload;
        if (playerId !== this.playerId && this.onPositionUpdate) {
          this.onPositionUpdate(playerId, position);
        }
      });

      const status = await this.channel.subscribe();
      return status === 'SUBSCRIBED';
    } catch (error) {
      console.error('[OptimizedPositionSync] Connection error:', error);
      return false;
    }
  }

  async updatePosition(position: PositionUpdate): Promise<void> {
    const now = Date.now();

    // Broadcast temps réel (fréquence élevée)
    if (now - this.lastBroadcast >= this.broadcastInterval) {
      this.lastBroadcast = now;
      await this.broadcastPosition(position);
    }

    // Sauvegarde en base (fréquence plus faible)
    if (now - this.lastDbUpdate >= this.dbUpdateInterval) {
      this.lastDbUpdate = now;
      await this.savePositionToDb(position);
    }
  }

  private async broadcastPosition(position: PositionUpdate): Promise<void> {
    if (!this.channel) return;

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'position_update',
        payload: {
          playerId: this.playerId,
          position,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('[OptimizedPositionSync] Broadcast error:', error);
    }
  }

  private async savePositionToDb(position: PositionUpdate): Promise<void> {
    try {
      const { error } = await supabase
        .from('game_room_players')
        .update({
          x: position.x,
          y: position.y,
          size: position.size,
          velocity_x: position.velocityX || 0,
          velocity_y: position.velocityY || 0,
          last_position_update: new Date().toISOString()
        })
        .eq('room_id', this.roomId)
        .eq('player_id', this.playerId);

      if (error) {
        console.error('[OptimizedPositionSync] DB update error:', error);
      }
    } catch (error) {
      console.error('[OptimizedPositionSync] DB save error:', error);
    }
  }

  disconnect(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
