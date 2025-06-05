
import { supabase } from "@/integrations/supabase/client";
import { Player } from "@/types/game";
import { verificationService } from "../room/verificationService";
import { activityService } from "../room/activityService";

export const playerService = {
  async joinRoom(roomId: string, player: Player): Promise<void> {
    console.log(`Player joining room - Details:`, {
      playerName: player.name,
      walletAddress: player.walletAddress,
      roomId: roomId,
      playerObject: player
    });
    
    // Vérifications essentielles
    if (!player.walletAddress || player.walletAddress.trim() === '') {
      console.error("CRITICAL: Player wallet address is missing or empty");
      throw new Error("L'adresse wallet du joueur est requise pour rejoindre une salle.");
    }

    if (!player.name || player.name.trim() === '') {
      console.error("CRITICAL: Player name is missing or empty");
      throw new Error("Le nom du joueur est requis pour rejoindre une salle");
    }

    if (!roomId || roomId.trim() === '') {
      console.error("CRITICAL: Room ID is missing or empty");
      throw new Error("L'ID de la salle est requis");
    }

    console.log("✅ Initial validation passed for player:", player.walletAddress);
    
    try {
      // Vérifier si la salle existe et obtenir ses informations
      console.log("Checking room capacity and status...");
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .select('max_players, status')
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error("Error getting room info:", roomError);
        throw new Error("Cette salle n'existe pas ou n'est plus disponible");
      }

      if (roomData.status !== 'waiting') {
        throw new Error("Cette salle n'accepte plus de nouveaux joueurs");
      }

      // Vérifier le nombre de joueurs actuels (sauf le joueur courant)
      const { data: currentPlayers, error: playersError } = await supabase
        .from('game_room_players')
        .select('player_id')
        .eq('room_id', roomId)
        .neq('player_id', player.walletAddress);

      if (playersError) {
        console.error("Error getting current players:", playersError);
        throw new Error("Impossible de vérifier le nombre de joueurs actuels");
      }

      if (currentPlayers && currentPlayers.length >= (roomData?.max_players || 4)) {
        console.error("Room is full");
        throw new Error("Cette salle est complète");
      }

      // S'assurer que le joueur existe dans la table players
      console.log("Ensuring player exists in players table...");
      const { error: upsertPlayerError } = await supabase
        .from('players')
        .upsert({
          id: player.walletAddress,
          name: player.name.trim(),
          color: player.color
        }, {
          onConflict: 'id'
        });

      if (upsertPlayerError) {
        console.error("Error upserting player:", upsertPlayerError);
        throw new Error(`Impossible de créer/mettre à jour le joueur: ${upsertPlayerError.message}`);
      }

      console.log("Adding/updating player in room...");
      // CORRECTION 1: Ajouter logs d'erreur visibles et utiliser upsert avec onConflict
      const { error: joinError } = await supabase
        .from('game_room_players')
        .upsert({
          room_id: roomId,
          player_id: player.walletAddress,
          player_name: player.name.trim(),
          player_color: player.color,
          size: player.size || 30,
          x: player.x || 0,
          y: player.y || 0,
          is_alive: player.isAlive !== false,
          is_ready: false,
          last_position_update: new Date().toISOString()
        }, {
          onConflict: 'room_id,player_id'
        });

      if (joinError) {
        console.error("[JOIN game_room_players] failed:", joinError);
        // Log d'erreur visible en production
        alert(`join err: ${joinError.message}`);
        throw new Error(`Impossible de rejoindre la salle: ${joinError.message}`);
      }

      console.log("✅ [JOIN game_room_players] succeeded for player:", player.walletAddress);
      await activityService.updateRoomActivity(roomId);
      console.log("✅ Player joined/rejoined room successfully");
    } catch (error) {
      console.error("Error in joinRoom:", error);
      throw error;
    }
  },

  async leaveRoom(roomId: string, playerId: string): Promise<void> {
    console.log(`Player ${playerId} leaving room ${roomId}`);
    
    if (!playerId || playerId.trim() === '') {
      console.error("Player ID is missing or empty");
      throw new Error("L'ID du joueur est requis pour quitter une salle");
    }

    if (!roomId || roomId.trim() === '') {
      console.error("Room ID is missing or empty");
      throw new Error("L'ID de la salle est requis");
    }
    
    try {
      // AMÉLIORATION: Marquer le joueur comme non-vivant avant de le supprimer
      await supabase
        .from('game_room_players')
        .update({ is_alive: false })
        .eq('room_id', roomId)
        .eq('player_id', playerId);

      // Supprimer le joueur de la salle
      const { error } = await supabase
        .from('game_room_players')
        .delete()
        .eq('room_id', roomId)
        .eq('player_id', playerId);

      if (error) {
        console.error("Error leaving room:", error);
        throw new Error(`Impossible de quitter la salle: ${error.message}`);
      }

      await activityService.updateRoomActivity(roomId);
      console.log("Player left room successfully");
    } catch (error) {
      console.error("Error in leaveRoom:", error);
      throw error;
    }
  },

  async setPlayerReady(roomId: string, playerId: string, ready: boolean): Promise<void> {
    console.log(`Setting player ${playerId} ready status to ${ready} in room ${roomId}`);
    
    if (!playerId || playerId.trim() === '') {
      console.error("Player ID is missing or empty");
      throw new Error("L'ID du joueur est requis pour changer le statut");
    }

    if (!roomId || roomId.trim() === '') {
      console.error("Room ID is missing or empty");
      throw new Error("L'ID de la salle est requis");
    }
    
    try {
      const { error } = await supabase
        .from('game_room_players')
        .update({ is_ready: ready })
        .eq('room_id', roomId)
        .eq('player_id', playerId);

      if (error) {
        console.error("Error updating player ready status:", error);
        throw new Error(`Impossible de changer le statut: ${error.message}`);
      }

      await activityService.updateRoomActivity(roomId);
      console.log("Player ready status updated successfully");
    } catch (error) {
      console.error("Error in setPlayerReady:", error);
      throw error;
    }
  },

  // NOUVEAU: Fonction pour marquer un joueur comme déconnecté (soft-dead)
  async markPlayerDisconnected(roomId: string, playerId: string): Promise<void> {
    console.log(`Marking player ${playerId} as disconnected in room ${roomId}`);
    
    try {
      const { error } = await supabase
        .from('game_room_players')
        .update({ 
          is_alive: false,
          last_position_update: new Date().toISOString()
        })
        .eq('room_id', roomId)
        .eq('player_id', playerId);

      if (error) {
        console.error("Error marking player as disconnected:", error);
        throw new Error(`Impossible de marquer le joueur comme déconnecté: ${error.message}`);
      }

      console.log("Player marked as disconnected successfully");
    } catch (error) {
      console.error("Error in markPlayerDisconnected:", error);
      throw error;
    }
  }
};
