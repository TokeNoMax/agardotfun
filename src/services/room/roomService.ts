
import { supabase } from "@/integrations/supabase/client";
import { GameRoom, GameMode } from "@/types/game";
import { convertDatabaseRoomToGameRoom } from "../database/converters";
import { DatabaseGameRoom } from "../database/types";

export const roomService = {
  async getAllRooms(): Promise<GameRoom[]> {
    console.log("Getting all rooms...");
    
    const { data: roomsData, error: roomsError } = await supabase
      .from('game_rooms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (roomsError) {
      console.error("Error fetching rooms:", roomsError);
      throw roomsError;
    }

    if (!roomsData || roomsData.length === 0) {
      console.log("No rooms found");
      return [];
    }

    console.log(`Found ${roomsData.length} rooms from database`);
    
    const roomsWithPlayers = await Promise.all(
      roomsData.map(async (room: DatabaseGameRoom) => {
        // Debug the game mode from database
        console.log(`Room ${room.name} - DB gameMode:`, room.game_mode);
        
        const { data: playersData, error: playersError } = await supabase
          .from('game_room_players')
          .select('*')
          .eq('room_id', room.id);

        if (playersError) {
          console.error(`Error fetching players for room ${room.id}:`, playersError);
          return convertDatabaseRoomToGameRoom(room, []);
        }

        const gameRoom = convertDatabaseRoomToGameRoom(room, playersData || []);
        console.log(`Converted room ${room.name} - gameMode:`, gameRoom.gameMode);
        return gameRoom;
      })
    );

    return roomsWithPlayers;
  },

  async createRoom(name: string, maxPlayers: number, gameMode: GameMode = 'classic'): Promise<GameRoom> {
    console.log(`Creating room with gameMode: ${gameMode}`);
    
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          name,
          max_players: maxPlayers,
          game_mode: gameMode,
          status: 'waiting'
        })
        .select()
        .single();

      if (roomError) {
        console.error("Error creating room:", roomError);
        throw roomError;
      }

      console.log("Room created successfully:", roomData);
      console.log("Created room gameMode:", roomData.game_mode);

      const createdRoom = convertDatabaseRoomToGameRoom(roomData, []);
      console.log("Returning created room:", createdRoom);
      return createdRoom;
    } catch (error) {
      console.error("Failed to create room:", error);
      throw error;
    }
  },

  async getRoom(roomId: string): Promise<GameRoom | null> {
    console.log(`Fetching room ${roomId}`);
    
    const { data: roomData, error: roomError } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      console.error("Room not found:", roomError);
      return null;
    }

    // Debug game mode from database
    console.log(`Room ${roomData.name} - Raw DB game_mode:`, roomData.game_mode);

    const { data: playersData, error: playersError } = await supabase
      .from('game_room_players')
      .select('*')
      .eq('room_id', roomId);

    if (playersError) {
      console.error(`Error fetching players for room ${roomId}:`, playersError);
      return convertDatabaseRoomToGameRoom(roomData, []);
    }

    console.log(`Room ${roomData.name} has ${playersData?.length || 0} players`);
    
    const gameRoom = convertDatabaseRoomToGameRoom(roomData, playersData || []);
    console.log(`Final converted gameMode for room ${roomData.name}:`, gameRoom.gameMode);
    
    return gameRoom;
  },

  async startGame(roomId: string): Promise<void> {
    console.log(`Starting game for room ${roomId}`);
    
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
  },

  async checkGhostRooms(): Promise<void> {
    console.log("Checking for ghost rooms...");
    
    try {
      // Simple implementation - this would be expanded based on your ghost room logic
      const cutoffTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      
      const { error } = await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'waiting')
        .lt('last_activity', cutoffTime.toISOString());

      if (error) {
        console.error("Error checking ghost rooms:", error);
        throw error;
      }

      console.log("Ghost rooms check completed");
    } catch (error) {
      console.error("Failed to check ghost rooms:", error);
      throw error;
    }
  }
};
