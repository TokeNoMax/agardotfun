
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
    
    // Vérifications essentielles avec des messages d'erreur plus détaillés
    if (!player.walletAddress || player.walletAddress.trim() === '') {
      console.error("CRITICAL: Player wallet address is missing or empty", {
        walletAddress: player.walletAddress,
        player: player
      });
      throw new Error("L'adresse wallet du joueur est requise pour rejoindre une salle. Veuillez reconnecter votre wallet et reconfigurer votre joueur.");
    }

    if (!player.name || player.name.trim() === '') {
      console.error("CRITICAL: Player name is missing or empty", {
        playerName: player.name,
        player: player
      });
      throw new Error("Le nom du joueur est requis pour rejoindre une salle");
    }

    if (!roomId || roomId.trim() === '') {
      console.error("CRITICAL: Room ID is missing or empty", {
        roomId: roomId
      });
      throw new Error("L'ID de la salle est requis");
    }

    console.log("✅ Initial validation passed for player:", player.walletAddress);
    
    // Vérifier d'abord si le joueur est déjà dans cette salle
    const isPlayerAlreadyInRoom = await verificationService.verifyPlayerInRoom(roomId, player.walletAddress);
    if (isPlayerAlreadyInRoom) {
      console.log(`Player ${player.walletAddress} is already in room ${roomId}`);
      await activityService.updateRoomActivity(roomId);
      return;
    }
    
    try {
      // Vérifier si la salle existe
      const roomExists = await verificationService.verifyRoomExists(roomId);
      if (!roomExists) {
        console.error(`Room ${roomId} does not exist`);
        throw new Error("Cette salle n'existe pas ou n'est plus disponible");
      }

      // Vérifier si le joueur existe dans la table players
      console.log("Checking if player exists in database...");
      const { data: existingPlayer, error: playerCheckError } = await supabase
        .from('players')
        .select('id')
        .eq('id', player.walletAddress)
        .single();

      if (playerCheckError && playerCheckError.code !== 'PGRST116') {
        console.error("Error checking player:", playerCheckError);
        throw new Error(`Erreur lors de la vérification du joueur: ${playerCheckError.message}`);
      }

      if (!existingPlayer) {
        console.log("Creating new player in database...");
        // Créer le joueur s'il n'existe pas
        const { error: createPlayerError } = await supabase
          .from('players')
          .insert({
            id: player.walletAddress,
            name: player.name.trim(),
            color: player.color
          });

        if (createPlayerError) {
          console.error("Error creating player:", createPlayerError);
          throw new Error(`Impossible de créer le joueur: ${createPlayerError.message}`);
        }
        console.log("Player created successfully in database");
      } else {
        console.log("Player already exists in database");
      }

      // Vérifier si la salle est pleine
      console.log("Checking room capacity...");
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .select('max_players')
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error("Error getting room info:", roomError);
        throw new Error("Impossible de vérifier les informations de la salle");
      }

      const { data: currentPlayers, error: playersError } = await supabase
        .from('game_room_players')
        .select('player_id')
        .eq('room_id', roomId);

      if (playersError) {
        console.error("Error getting current players:", playersError);
        throw new Error("Impossible de vérifier le nombre de joueurs actuels");
      }

      if (currentPlayers && currentPlayers.length >= (roomData?.max_players || 4)) {
        console.error("Room is full");
        throw new Error("Cette salle est complète");
      }

      console.log("Adding player to room...");
      // Ajouter le joueur à la salle
      const { error: joinError } = await supabase
        .from('game_room_players')
        .insert({
          room_id: roomId,
          player_id: player.walletAddress,
          player_name: player.name.trim(),
          player_color: player.color,
          size: player.size || 30,
          x: player.x || 0,
          y: player.y || 0,
          is_alive: player.isAlive !== false,
          is_ready: false
        });

      if (joinError) {
        console.error("Error joining room:", joinError);
        if (joinError.code === '23505') {
          throw new Error("Vous êtes déjà dans cette salle");
        }
        throw new Error(`Impossible de rejoindre la salle: ${joinError.message}`);
      }

      await activityService.updateRoomActivity(roomId);
      console.log("✅ Player joined room successfully");
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
  }
};
