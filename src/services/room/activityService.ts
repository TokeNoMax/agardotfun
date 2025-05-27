
import { supabase } from "@/integrations/supabase/client";

export const activityService = {
  async updateRoomActivity(roomId: string): Promise<void> {
    console.log(`Updating room activity for ${roomId}`);
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', roomId);

    if (error) {
      console.error("Error updating room activity:", error);
    }
  }
};
