
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/types/game";
import { playerService } from "./playerService";
import { v4 as uuidv4 } from "uuid";

export interface MatchmakingResult {
  roomId: string;
  isNewRoom: boolean;
  playerCount: number;
}

export const matchmakingService = {
  async findOrCreateRoom(player: Player): Promise<MatchmakingResult> {
    console.log('[Matchmaking] Starting automatic matchmaking for player:', player.name);
    
    try {
      // 1. Chercher une salle en attente avec de la place
      const { data: availableRooms, error: searchError } = await supabase
        .from('game_rooms')
        .select(`
          id,
          name,
          max_players,
          game_room_players(player_id)
        `)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true }); // Plus ancienne en premier

      if (searchError) {
        console.error('[Matchmaking] Error searching for rooms:', searchError);
        throw new Error('Erreur lors de la recherche de salles disponibles');
      }

      // Trouver une salle avec de la place
      for (const room of availableRooms || []) {
        const currentPlayerCount = room.game_room_players?.length || 0;
        const maxPlayers = room.max_players || 4;
        
        if (currentPlayerCount < maxPlayers) {
          console.log(`[Matchmaking] Found available room: ${room.id} (${currentPlayerCount}/${maxPlayers})`);
          
          // Rejoindre cette salle
          await playerService.joinRoom(room.id, player);
          
          return {
            roomId: room.id,
            isNewRoom: false,
            playerCount: currentPlayerCount + 1
          };
        }
      }

      // 2. Aucune salle disponible, en créer une nouvelle
      console.log('[Matchmaking] No available room found, creating new room');
      
      const newRoomId = uuidv4();
      const roomName = `Match auto ${Math.floor(Math.random() * 1000)}`;
      
      const { error: createError } = await supabase
        .from('game_rooms')
        .insert({
          id: newRoomId,
          name: roomName,
          max_players: 4,
          status: 'waiting'
        });

      if (createError) {
        console.error('[Matchmaking] Error creating room:', createError);
        throw new Error('Impossible de créer une nouvelle salle');
      }

      // Rejoindre la nouvelle salle
      await playerService.joinRoom(newRoomId, player);

      console.log(`[Matchmaking] Created and joined new room: ${newRoomId}`);
      
      return {
        roomId: newRoomId,
        isNewRoom: true,
        playerCount: 1
      };

    } catch (error) {
      console.error('[Matchmaking] Matchmaking failed:', error);
      throw error;
    }
  },

  async quickPlay(player: Player): Promise<string> {
    const result = await this.findOrCreateRoom(player);
    return result.roomId;
  }
};
