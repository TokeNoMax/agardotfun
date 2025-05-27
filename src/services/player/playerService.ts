
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/types/game";
import { verificationService } from "../room/verificationService";
import { activityService } from "../room/activityService";

export const playerService = {
  async joinRoom(roomId: string, player: Player): Promise<void> {
    console.log(`Player ${player.name} joining room ${roomId}`);
    
    // Vérifier d'abord si le joueur est déjà dans cette salle
    const isPlayerAlreadyInRoom = await verificationService.verifyPlayerInRoom(roomId, player.walletAddress);
    if (isPlayerAlreadyInRoom) {
      console.log(`Player ${player.walletAddress} is already in room ${roomId}`);
      await activityService.updateRoomActivity(roomId);
      return;
    }
    
    // Vérifier si le joueur existe dans la table players
    const { data: existingPlayer, error: playerCheckError } = await supabase
      .from('players')
      .select('id')
      .eq('id', player.walletAddress)
      .single();

    if (playerCheckError || !existingPlayer) {
      // Créer le joueur s'il n'existe pas
      const { error: createPlayerError } = await supabase
        .from('players')
        .insert({
          id: player.walletAddress,
          name: player.name,
          color: player.color
        });

      if (createPlayerError) {
        console.error("Error creating player:", createPlayerError);
        throw createPlayerError;
      }
    }

    // Ajouter le joueur à la salle
    const { error } = await supabase
      .from('game_room_players')
      .insert({
        room_id: roomId,
        player_id: player.walletAddress,
        player_name: player.name,
        player_color: player.color,
        size: player.size,
        x: player.x,
        y: player.y,
        is_alive: player.isAlive,
        is_ready: false
      });

    if (error) {
      console.error("Error joining room:", error);
      throw error;
    }

    await activityService.updateRoomActivity(roomId);
    console.log("Player joined room successfully");
  },

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    console.log(`Player ${playerId} leaving room ${roomId}`);
    
    const { error } = await supabase
      .from('game_room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('player_id', playerId);

    if (error) {
      console.error("Error leaving room:", error);
      throw error;
    }

    await activityService.updateRoomActivity(roomId);
    console.log("Player left room successfully - room kept available for rejoining");
  },

  async setPlayerReady(roomId: string, playerId: string, ready: boolean): Promise<void> {
    console.log(`Setting player ${playerId} ready status to ${ready} in room ${roomId}`);
    
    const { error } = await supabase
      .from('game_room_players')
      .update({ is_ready: ready })
      .eq('room_id', roomId)
      .eq('player_id', playerId);

    if (error) {
      console.error("Error updating player ready status:", error);
      throw error;
    }

    await activityService.updateRoomActivity(roomId);
    console.log("Player ready status updated successfully");
  }
};
