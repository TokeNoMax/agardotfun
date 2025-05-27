import { supabase } from "@/integrations/supabase/client";
import { GameRoom, Player } from "@/types/game";

export interface DatabaseGameRoom {
  id: string;
  name: string;
  max_players: number;
  status: string; // Changé de 'waiting' | 'playing' | 'finished' à string
  created_at: string;
  updated_at: string;
}

export interface DatabaseGameRoomPlayer {
  id: string;
  room_id: string;
  player_id: string;
  player_name: string;
  player_color: string;
  size: number;
  x: number;
  y: number;
  is_alive: boolean;
  is_ready: boolean;
  joined_at: string;
}

// Convertir les données de la base vers le format GameRoom
function convertToGameRoom(
  dbRoom: DatabaseGameRoom, 
  dbPlayers: DatabaseGameRoomPlayer[]
): GameRoom {
  const players: Player[] = dbPlayers.map(dbPlayer => ({
    id: dbPlayer.player_id,
    name: dbPlayer.player_name,
    color: dbPlayer.player_color as any,
    size: dbPlayer.size,
    x: dbPlayer.x,
    y: dbPlayer.y,
    isAlive: dbPlayer.is_alive,
    ready: dbPlayer.is_ready
  }));

  return {
    id: dbRoom.id,
    name: dbRoom.name,
    maxPlayers: dbRoom.max_players,
    players,
    status: dbRoom.status as 'waiting' | 'playing' | 'finished', // Type assertion sécurisée
    createdAt: dbRoom.created_at,
    updatedAt: dbRoom.updated_at
  };
}

export const gameRoomService = {
  // Vérifier si un joueur est réellement dans une salle côté serveur
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

  // Vérifier si une salle existe encore
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
  },

  // Récupérer toutes les salles avec leurs joueurs
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

    // Récupérer tous les joueurs pour toutes les salles
    const { data: players, error: playersError } = await supabase
      .from('game_room_players')
      .select('*')
      .in('room_id', rooms.map(r => r.id));

    if (playersError) {
      console.error("Error fetching players:", playersError);
      throw playersError;
    }

    // Convertir et associer les joueurs aux salles
    const gameRooms = rooms.map(room => {
      const roomPlayers = players?.filter(p => p.room_id === room.id) || [];
      return convertToGameRoom(room, roomPlayers);
    });

    console.log(`Found ${gameRooms.length} rooms`);
    return gameRooms;
  },

  // Créer une nouvelle salle
  async createRoom(name: string, maxPlayers: number): Promise<string> {
    console.log(`Creating room: ${name} with max ${maxPlayers} players`);
    
    const { data, error } = await supabase
      .from('game_rooms')
      .insert({
        name,
        max_players: maxPlayers,
        status: 'waiting'
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

  // Rejoindre une salle
  async joinRoom(roomId: string, player: Player): Promise<void> {
    console.log(`Player ${player.name} joining room ${roomId}`);
    
    // D'abord, vérifier si le joueur existe dans la table players
    const { data: existingPlayer, error: playerCheckError } = await supabase
      .from('players')
      .select('id')
      .eq('id', player.id)
      .single();

    if (playerCheckError || !existingPlayer) {
      // Créer le joueur s'il n'existe pas
      const { error: createPlayerError } = await supabase
        .from('players')
        .insert({
          id: player.id,
          name: player.name,
          color: player.color
        });

      if (createPlayerError) {
        console.error("Error creating player:", createPlayerError);
        throw createPlayerError;
      }
    }

    // Ensuite, ajouter le joueur à la salle
    const { error } = await supabase
      .from('game_room_players')
      .insert({
        room_id: roomId,
        player_id: player.id,
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

    console.log("Player joined room successfully");
  },

  // Quitter une salle
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

    // Vérifier s'il reste des joueurs dans la salle
    const { data: remainingPlayers, error: checkError } = await supabase
      .from('game_room_players')
      .select('id')
      .eq('room_id', roomId);

    if (checkError) {
      console.error("Error checking remaining players:", checkError);
      return;
    }

    // Si aucun joueur ne reste, supprimer la salle
    if (!remainingPlayers || remainingPlayers.length === 0) {
      console.log("No players left, deleting room");
      const { error: deleteError } = await supabase
        .from('game_rooms')
        .delete()
        .eq('id', roomId);

      if (deleteError) {
        console.error("Error deleting empty room:", deleteError);
      }
    }

    console.log("Player left room successfully");
  },

  // Mettre à jour le statut "prêt" d'un joueur
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

    console.log("Player ready status updated successfully");
  },

  // Démarrer une partie
  async startGame(roomId: string): Promise<void> {
    console.log(`Starting game in room ${roomId}`);
    
    const { error } = await supabase
      .from('game_rooms')
      .update({ status: 'playing' })
      .eq('id', roomId);

    if (error) {
      console.error("Error starting game:", error);
      throw error;
    }

    console.log("Game started successfully");
  },

  // Récupérer une salle spécifique
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
