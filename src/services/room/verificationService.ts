
import { supabase } from "@/integrations/supabase/client";

export const verificationService = {
  async verifyPlayerInRoom(roomId: string, playerId: string): Promise<boolean> {
    console.log(`Verifying player ${playerId} in room ${roomId}`);
    
    try {
      const { data, error } = await supabase
        .from('game_room_players')
        .select('id')
        .eq('room_id', roomId)
        .eq('player_id', playerId)
        .single();

      if (error) {
        console.log("Player not found in room:", error.message);
        return false;
      }

      console.log("Player verified in room:", !!data);
      return !!data;
    } catch (error) {
      console.error("Error verifying player in room:", error);
      return false;
    }
  },

  async verifyRoomExists(roomId: string): Promise<boolean> {
    console.log(`Verifying room exists: ${roomId}`);
    
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('id', roomId)
        .single();

      if (error) {
        console.log("Room not found:", error.message);
        return false;
      }

      console.log("Room verified:", !!data);
      return !!data;
    } catch (error) {
      console.error("Error verifying room:", error);
      return false;
    }
  }
};
