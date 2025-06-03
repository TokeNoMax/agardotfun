import { supabase } from "@/integrations/supabase/client";
import { GameRoom } from "@/types/game";
import { convertToGameRoom } from "../database/converters";
import { activityService } from "./activityService";
import { GameStateService } from "../game/gameStateService";

export const roomService = {
  async getAllRooms(): Promise<GameRoom[]> {
    console.log("Fetching all rooms from Supabase...");
    
    const { data: rooms, error: roomsError } = await supabase
      .from('game_rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (roomsError) {
      console.error("Error fetching rooms:", roomsError);
      throw roomsError;
    }

    if (!rooms || rooms.length === 0) {
      console.log("No rooms found");
      return [];
    }

    const { data: players, error: playersError } = await supabase
      .from('game_room_players')
      .select('*')
      .in('room_id', rooms.map(r => r.id));

    if (playersError) {
      console.error("Error fetching players:", playersError);
      throw playersError;
    }

    const gameRooms = rooms.map(room => {
      const roomPlayers = players?.filter(p => p.room_id === room.id) || [];
      const convertedRoom = convertToGameRoom(room, roomPlayers);
      console.log(`Room ${room.name}: ${roomPlayers.length} players`, roomPlayers.map(p => p.player_name));
      return convertedRoom;
    });

    console.log(`Found ${gameRooms.length} rooms`);
    return gameRooms;
  },

  async createRoom(name: string, maxPlayers: number): Promise<string> {
    console.log(`Creating room: ${name} with max ${maxPlayers} players`);
    
    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        name,
        max_players: maxPlayers,
        status: 'waiting',
        last_activity: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating room:", error);
      throw error;
    }

    console.log("Room created successfully:", data.id);
    return data.id;
  },

  async startGame(roomId: string): Promise<void> {
    console.log(`Starting game in room ${roomId}`);
    
    // Initialize game state with map seed
    await GameStateService.initializeGameState(roomId);
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ 
        status: 'playing',
        last_activity: new Date().toISOString()
      })
      .eq('id', roomId);

    if (error) {
      console.error("Error starting game:", error);
      throw error;
    }

    console.log("Game started successfully with synchronized map");
    
    // Verify that the status was updated
    const { data: room } = await supabase
      .from('game_rooms')
      .select('status, game_seed')
      .eq('id', roomId)
      .single();
      
    if (room?.status !== 'playing') {
      console.error("Room status not updated correctly:", room?.status);
      throw new Error("Failed to update room status");
    }
    
    console.log("Room status verified as playing with seed:", room.game_seed);
  },

  async getRoom(roomId: string): Promise<GameRoom | null> {
    console.log(`Fetching room ${roomId}`);
    
    const { data: room, error: roomError } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      console.log("Room not found:", roomError?.message);
      return null;
    }

    const { data: players, error: playersError } = await supabase
      .from('game_room_players')
      .select('*')
      .eq('room_id', roomId);

    if (playersError) {
      console.error("Error fetching room players:", playersError);
      throw playersError;
    }

    const convertedRoom = convertToGameRoom(room, players || []);
    console.log(`Room ${room.name} has ${players?.length || 0} players`);
    return convertedRoom;
  },

  async updateRoomStatus(roomId: string, status: 'waiting' | 'playing' | 'finished'): Promise<void> {
    console.log(`Updating room ${roomId} status to ${status}`);
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ 
        status,
        last_activity: new Date().toISOString()
      })
      .eq('id', roomId);

    if (error) {
      console.error("Error updating room status:", error);
      throw error;
    }

    console.log(`Room status updated to ${status}`);
  },

  async checkGhostRooms(): Promise<void> {
    console.log("Checking for ghost rooms...");
    
    try {
      const { data: playingRooms, error } = await supabase
        .from('game_rooms')
        .select('id, name, status, last_activity')
        .eq('status', 'playing');

      if (error) {
        console.error("Error checking ghost rooms:", error);
        return;
      }

      if (!playingRooms || playingRooms.length === 0) {
        console.log("No playing rooms to check");
        return;
      }

      for (const room of playingRooms) {
        const { data: players, error: playersError } = await supabase
          .from('game_room_players')
          .select('player_id')
          .eq('room_id', room.id);

        if (playersError) {
          console.error(`Error checking players for room ${room.id}:`, playersError);
          continue;
        }

        const playerCount = players?.length || 0;
        const lastActivity = new Date(room.last_activity);
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

        if (playerCount === 0 && lastActivity < fiveMinutesAgo) {
          console.log(`Ghost room detected: ${room.name} (${room.id})`);
          await this.updateRoomStatus(room.id, 'finished');
        }
      }
    } catch (error) {
      console.error("Error in ghost room check:", error);
    }
  }
};
