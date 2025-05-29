
import { supabase } from "@/integrations/supabase/client";
import { GameRoom } from "@/types/game";
import { convertToGameRoom } from "../database/converters";
import { activityService } from "./activityService";

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
      return convertToGameRoom(room, roomPlayers);
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

    console.log("Game started successfully");
    
    // Wait for database synchronization with longer delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify the status was actually updated
    const { data: room } = await supabase
      .from('game_rooms')
      .select('status')
      .eq('id', roomId)
      .single();
      
    if (room?.status !== 'playing') {
      console.error("Room status not updated correctly:", room?.status);
      throw new Error("Failed to update room status");
    }
    
    console.log("Room status verified as playing");
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

    return convertToGameRoom(room, players || []);
  }
};
