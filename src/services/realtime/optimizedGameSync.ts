
import { supabase } from "@/integrations/supabase/client";
import { PositionInterpolator, InterpolatedPosition } from "../game/positionInterpolator";

export interface OptimizedPlayerPosition {
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
}

export interface OptimizedGameSyncCallbacks {
  onPlayerUpdate?: (playerId: string, position: OptimizedPlayerPosition) => void;
  onPlayerEliminated?: (eliminatedPlayerId: string, eliminatorPlayerId: string) => void;
  onGameStateUpdate?: (gameState: any) => void;
}

export class OptimizedGameSyncService {
  private roomId: string;
  private playerId: string;
  private channel: any;
  private callbacks: OptimizedGameSyncCallbacks;
  private lastPositionSync = 0;
  private syncInterval = 200; // Reduced to 200ms (5fps) for DB sync
  private interpolators = new Map<string, PositionInterpolator>();
  private lastRenderTime = 0;

  constructor(roomId: string, playerId: string, callbacks: OptimizedGameSyncCallbacks) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.callbacks = callbacks;
  }

  async connect() {
    this.channel = supabase
      .channel(`optimized-game-sync-${this.roomId}`)
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
      .subscribe();

    return this.channel;
  }

  private handlePlayerUpdate(payload: any) {
    if (payload.new && payload.new.player_id !== this.playerId) {
      const position: OptimizedPlayerPosition = {
        x: payload.new.x,
        y: payload.new.y,
        size: payload.new.size,
        velocityX: payload.new.velocity_x || 0,
        velocityY: payload.new.velocity_y || 0
      };
      
      // Get or create interpolator for this player
      let interpolator = this.interpolators.get(payload.new.player_id);
      if (!interpolator) {
        interpolator = new PositionInterpolator();
        this.interpolators.set(payload.new.player_id, interpolator);
      }
      
      // Convert to InterpolatedPosition with required velocity fields
      const interpolatedPosition: InterpolatedPosition = {
        x: position.x,
        y: position.y,
        size: position.size,
        velocityX: position.velocityX || 0,
        velocityY: position.velocityY || 0
      };
      
      // Add snapshot for interpolation
      interpolator.addSnapshot(interpolatedPosition);
      
      this.callbacks.onPlayerUpdate?.(payload.new.player_id, position);
    }
  }

  private handleGameEvent(payload: any) {
    const event = payload.payload;
    
    switch (event.type) {
      case 'player_collision':
      case 'player_elimination':
        this.callbacks.onPlayerEliminated?.(event.data.eliminatedPlayerId, event.data.eliminatorPlayerId);
        // Remove interpolator for eliminated player
        this.interpolators.delete(event.data.eliminatedPlayerId);
        break;
    }
  }

  async syncPlayerPosition(position: OptimizedPlayerPosition) {
    const now = Date.now();
    if (now - this.lastPositionSync < this.syncInterval) {
      return; // Rate limit position updates
    }
    
    this.lastPositionSync = now;

    try {
      await supabase
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
    } catch (error) {
      // Silent error handling to avoid console spam
    }
  }

  getInterpolatedPosition(playerId: string, targetPosition: OptimizedPlayerPosition): OptimizedPlayerPosition {
    const interpolator = this.interpolators.get(playerId);
    if (!interpolator) {
      return targetPosition;
    }

    const now = Date.now();
    const deltaTime = now - this.lastRenderTime;
    this.lastRenderTime = now;

    // Convert to InterpolatedPosition for interpolation
    const interpolatedTarget: InterpolatedPosition = {
      x: targetPosition.x,
      y: targetPosition.y,
      size: targetPosition.size,
      velocityX: targetPosition.velocityX || 0,
      velocityY: targetPosition.velocityY || 0
    };

    const result = interpolator.interpolate(interpolatedTarget, deltaTime);
    
    // Convert back to OptimizedPlayerPosition
    return {
      x: result.x,
      y: result.y,
      size: result.size,
      velocityX: result.velocityX,
      velocityY: result.velocityY
    };
  }

  async broadcastCollision(eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) {
    try {
      await supabase
        .from('game_room_players')
        .update({ 
          is_alive: false,
          size: 0
        })
        .eq('room_id', this.roomId)
        .eq('player_id', eliminatedPlayerId);

      await supabase
        .from('game_room_players')
        .update({ 
          size: eliminatorNewSize
        })
        .eq('room_id', this.roomId)
        .eq('player_id', eliminatorPlayerId);

      await this.channel?.send({
        type: 'broadcast',
        event: 'game_event',
        payload: {
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
        }
      });

    } catch (error) {
      // Silent error handling
    }
  }

  disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.interpolators.clear();
  }
}
