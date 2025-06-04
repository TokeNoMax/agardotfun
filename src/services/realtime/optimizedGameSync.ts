
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
    // FIXED: Use room-specific channel name for better isolation
    const channelName = `optimized-game-sync-${this.roomId}`;
    console.log("Connecting to optimized game sync channel:", channelName);
    
    this.channel = supabase
      .channel(channelName)
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
        console.log('Optimized game sync status for room', this.roomId, ':', status);
      });

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

  // FIXED: Enhanced position sync with validation
  async syncPlayerPosition(position: OptimizedPlayerPosition) {
    const now = Date.now();
    if (now - this.lastPositionSync < this.syncInterval) {
      return; // Rate limit position updates
    }
    
    this.lastPositionSync = now;

    try {
      // FIXED: Add validation for position data
      if (isNaN(position.x) || isNaN(position.y) || isNaN(position.size)) {
        console.warn("Invalid position data, skipping sync:", position);
        return;
      }

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
        console.error("Error syncing player position:", error);
      }
    } catch (error) {
      console.error("Error in syncPlayerPosition:", error);
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

  // FIXED: Enhanced collision broadcast with better error handling
  async broadcastCollision(eliminatedPlayerId: string, eliminatorPlayerId: string, eliminatedSize: number, eliminatorNewSize: number) {
    try {
      console.log(`Broadcasting collision in room ${this.roomId}:`, { eliminatedPlayerId, eliminatorPlayerId });

      // Update eliminated player status
      const { error: eliminatedError } = await supabase
        .from('game_room_players')
        .update({ 
          is_alive: false,
          size: 0
        })
        .eq('room_id', this.roomId)
        .eq('player_id', eliminatedPlayerId);

      if (eliminatedError) {
        console.error("Error updating eliminated player:", eliminatedError);
      }

      // Update eliminator size
      const { error: eliminatorError } = await supabase
        .from('game_room_players')
        .update({ 
          size: eliminatorNewSize
        })
        .eq('room_id', this.roomId)
        .eq('player_id', eliminatorPlayerId);

      if (eliminatorError) {
        console.error("Error updating eliminator size:", eliminatorError);
      }

      // Broadcast the collision event
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
      console.error("Error in broadcastCollision:", error);
    }
  }

  disconnect() {
    if (this.channel) {
      console.log('Disconnecting from optimized game sync for room:', this.roomId);
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.interpolators.clear();
  }
}
