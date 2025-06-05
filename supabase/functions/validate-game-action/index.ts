
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationRequest {
  action: 'move' | 'collision' | 'elimination';
  playerId: string;
  roomId: string;
  data: any;
  timestamp: number;
}

interface PositionData {
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
}

class GameValidator {
  private static readonly MAX_SPEED = 600; // pixels per second
  private static readonly WORLD_BOUNDS = { minX: 0, maxX: 3000, minY: 0, maxY: 3000 };
  private static readonly MAX_SIZE = 200;
  private static readonly MIN_SIZE = 5;

  static validateMove(data: PositionData, lastPosition: any, timeDelta: number): { valid: boolean; reason?: string } {
    // Validate bounds
    if (data.x < this.WORLD_BOUNDS.minX || data.x > this.WORLD_BOUNDS.maxX ||
        data.y < this.WORLD_BOUNDS.minY || data.y > this.WORLD_BOUNDS.maxY) {
      return { valid: false, reason: 'Position out of bounds' };
    }

    // Validate size
    if (data.size < this.MIN_SIZE || data.size > this.MAX_SIZE) {
      return { valid: false, reason: 'Invalid size' };
    }

    // Validate speed if we have previous position
    if (lastPosition && timeDelta > 0) {
      const distance = Math.sqrt(
        Math.pow(data.x - lastPosition.x, 2) + Math.pow(data.y - lastPosition.y, 2)
      );
      const speed = distance / (timeDelta / 1000); // pixels per second

      if (speed > this.MAX_SPEED) {
        return { valid: false, reason: 'Movement too fast' };
      }
    }

    return { valid: true };
  }

  static validateCollision(player1: any, player2: any): boolean {
    const distance = Math.sqrt(
      Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2)
    );
    const combinedRadius = (player1.size + player2.size) / 2;
    return distance <= combinedRadius * 1.1; // 10% tolerance
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user from the JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { action, playerId, roomId, data, timestamp }: ValidationRequest = await req.json();

    // Verify the player is making requests for themselves
    if (playerId !== user.id) {
      throw new Error('Player ID mismatch');
    }

    // Verify player is in the room
    const { data: playerInRoom, error: roomError } = await supabase
      .from('game_room_players')
      .select('*')
      .eq('room_id', roomId)
      .eq('player_id', playerId)
      .single();

    if (roomError || !playerInRoom) {
      throw new Error('Player not in room');
    }

    let validationResult = { valid: false, reason: 'Unknown action' };

    switch (action) {
      case 'move':
        const lastUpdate = new Date(playerInRoom.last_position_update).getTime();
        const timeDelta = timestamp - lastUpdate;
        
        validationResult = GameValidator.validateMove(data, {
          x: playerInRoom.x,
          y: playerInRoom.y,
          size: playerInRoom.size
        }, timeDelta);

        if (validationResult.valid) {
          // Update position in database
          await supabase
            .from('game_room_players')
            .update({
              x: data.x,
              y: data.y,
              size: data.size,
              velocity_x: data.velocityX || 0,
              velocity_y: data.velocityY || 0,
              last_position_update: new Date().toISOString()
            })
            .eq('room_id', roomId)
            .eq('player_id', playerId);
        }
        break;

      case 'collision':
        // Validate collision between two players
        const { data: otherPlayer } = await supabase
          .from('game_room_players')
          .select('*')
          .eq('room_id', roomId)
          .eq('player_id', data.eliminatedId)
          .single();

        if (otherPlayer) {
          const collisionValid = GameValidator.validateCollision(
            { x: playerInRoom.x, y: playerInRoom.y, size: playerInRoom.size },
            { x: otherPlayer.x, y: otherPlayer.y, size: otherPlayer.size }
          );

          if (collisionValid && playerInRoom.size > otherPlayer.size) {
            validationResult = { valid: true };
            
            // Update both players
            await supabase
              .from('game_room_players')
              .update({ is_alive: false })
              .eq('room_id', roomId)
              .eq('player_id', data.eliminatedId);

            await supabase
              .from('game_room_players')
              .update({ size: data.eliminatorNewSize })
              .eq('room_id', roomId)
              .eq('player_id', playerId);
          } else {
            validationResult = { valid: false, reason: 'Invalid collision' };
          }
        }
        break;
    }

    return new Response(
      JSON.stringify({
        success: validationResult.valid,
        reason: validationResult.reason,
        timestamp: Date.now()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: validationResult.valid ? 200 : 400
      }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
