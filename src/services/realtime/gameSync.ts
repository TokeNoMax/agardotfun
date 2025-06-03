
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/types/game";

export interface GameSyncEvent {
  type: 'position_update' | 'player_collision' | 'player_elimination' | 'food_consumed';
  playerId: string;
  roomId: string;
  data: any;
  timestamp: number;
}

export interface PlayerPosition {
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
}

export class GameSyncService {
  private roomId: string;
  private playerId: string;
  private channel: any;
  private onPlayerUpdate?: (playerId: string, position: PlayerPosition) => void;
  private onPlayerEliminated?: (eliminatedPlayerId: string, eliminatorPlayerId: string) => void;
  private onGameStateUpdate?: (gameState: any) => void;
  private lastPositionSync = 0;
  private syncInterval = 100; // Sync every 100ms

  constructor(roomId: string, playerId: string) {
    this.roomId = roomId;
    this.playerId = playerId;
  }

  async connect(callbacks: {
    onPlayerUpdate?: (playerId: string, position: PlayerPosition) => void;
    onPlayerEliminated?: (eliminatedPlayerId: string, eliminatorPlayerId: string) => void;
    onGameStateUpdate?: (gameState: any) => void;
  }) {
    this.onPlayerUpdate = callbacks.onPlayerUpdate;
    this.onPlayerEliminated = callbacks.onPlayerEliminated;
    this.onGameStateUpdate = callbacks.onGameStateUpdate;

    console.log("Connecting to realtime game sync for room:", this.roomId);

    // Create channel for game sync
    this.channel = supabase
      .channel(`game-sync-${this.roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_room_players',
          filter: `room_id=eq.${this.roomId}`
        },
        this.handlePlayerUpdate.bind(this)
      )
      .on(
        'broadcast',
        { event: 'game_event' },
        this.handleGameEvent.bind(this)
      )
      .subscribe((status) => {
        console.log('Game sync status:', status);
      });

    return this.channel;
  }

  private handlePlayerUpdate(payload: any) {
    console.log('Player position update:', payload);
    
    if (payload.new && payload.new.player_id !== this.playerId) {
      const position: PlayerPosition = {
        x: payload.new.x,
        y: payload.new.y,
        size: payload.new.size,
        velocityX: payload.new.velocity_x || 0,
        velocityY: payload.new.velocity_y || 0
      };
      
      this.onPlayerUpdate?.(payload.new.player_id, position);
    }
  }

  private handleGameEvent(payload: any) {
    console.log('Game event received:', payload);
    const event: GameSyncEvent = payload.payload;
    
    switch (event.type) {
      case 'player_collision':
        if (event.data.eliminatedPlayerId !== this.playerId) {
          this.onPlayerEliminated?.(event.data.eliminatedPlayerId, event.data.eliminatorPlayerId);
        }
        break;
      case 'player_elimination':
        this.onPlayerEliminated?.(event.data.eliminatedPlayerId, event.data.eliminatorPlayerId);
        break;
    }
  }

  async syncPlayerPosition(position: PlayerPosition) {
    const now = Date.now();
    if (now - this.lastPositionSync < this.syncInterval) {
      return; // Rate limit position updates
    }
    
    this.lastPositionSync = now;

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
        console.error('Error syncing player position:', error);
      }
    } catch (error) {
      console.error('Error in syncPlayerPosition:', error);
    }
  }

  async broadcastCollision(eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) {
    console.log('Broadcasting collision:', { eliminatedPlayerId, eliminatorPlayerId });
    
    try {
      // Update eliminated player status
      await supabase
        .from('game_room_players')
        .update({ 
          is_alive: false,
          size: 0
        })
        .eq('room_id', this.roomId)
        .eq('player_id', eliminatedPlayerId);

      // Update eliminator size
      await supabase
        .from('game_room_players')
        .update({ 
          size: eliminatorNewSize
        })
        .eq('room_id', this.roomId)
        .eq('player_id', eliminatorPlayerId);

      // Broadcast the collision event
      const event: GameSyncEvent = {
        type: 'player_collision',
        playerId: eliminatorPlayerId,
        roomId: this.roomId,
        data: {
          eliminatedPlayerId,
          eliminatorPlayerId,
          eliminatedSize,
          eliminatorNewSize
        },
        timestamp: Date.now()
      };

      await this.channel?.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event
      });

    } catch (error) {
      console.error('Error broadcasting collision:', error);
    }
  }

  async broadcastPlayerElimination(eliminatedPlayerId: string, eliminatorPlayerId: string) {
    const event: GameSyncEvent = {
      type: 'player_elimination',
      playerId: eliminatorPlayerId,
      roomId: this.roomId,
      data: {
        eliminatedPlayerId,
        eliminatorPlayerId
      },
      timestamp: Date.now()
    };

    try {
      await this.channel?.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event
      });
    } catch (error) {
      console.error('Error broadcasting elimination:', error);
    }
  }

  disconnect() {
    if (this.channel) {
      console.log('Disconnecting from game sync');
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
