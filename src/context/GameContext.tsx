import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { Player, Food, Rug, GameRoom, PlayerColor } from "@/types/game";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GameContextType {
  rooms: GameRoom[];
  currentRoom: GameRoom | null;
  player: Player | null;
  createRoom: (name: string, maxPlayers: number) => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setPlayerDetails: (name: string, color: PlayerColor) => Promise<void>;
  startGame: () => Promise<boolean>;
  setPlayerReady: (isReady: boolean) => Promise<void>;
  refreshCurrentRoom: () => Promise<void>;
  cleanupInactiveRooms: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

// Local storage key for player
const PLAYER_STORAGE_KEY = 'blob-battle-player';
const CURRENT_ROOM_KEY = 'blob-battle-current-room';

// Temps d'inactivité maximal (en minutes) avant de supprimer une salle
const MAX_ROOM_INACTIVITY_MINUTES = 30;

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(() => {
    const storedRoom = localStorage.getItem(CURRENT_ROOM_KEY);
    return storedRoom ? JSON.parse(storedRoom) : null;
  });
  const [player, setPlayer] = useState<Player | null>(() => {
    const storedPlayer = localStorage.getItem(PLAYER_STORAGE_KEY);
    return storedPlayer ? JSON.parse(storedPlayer) : null;
  });
  
  // Ajout d'un état pour suivre les requêtes en cours et éviter les appels simultanés
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  
  const { toast } = useToast();

  // Fetch rooms and subscribe to changes
  useEffect(() => {
    fetchRooms();
    
    // Subscribe to room changes with improved error handling
    const roomsChannel = supabase
      .channel('public:rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' }, 
        () => {
          fetchRooms().catch(err => console.error("Error fetching rooms:", err));
        }
      )
      .subscribe();

    // Subscribe to room_players changes with improved error handling
    const roomPlayersChannel = supabase
      .channel('public:room_players')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'room_players' }, 
        () => {
          if (currentRoom) {
            fetchRoomDetails(currentRoom.id).catch(err => console.error("Error fetching room details:", err));
          }
          fetchRooms().catch(err => console.error("Error fetching rooms:", err));
        }
      )
      .subscribe();
      
    // Nettoyage automatique des salles inactives toutes les minutes
    const cleanupInterval = setInterval(() => {
      cleanupInactiveRooms().catch(err => 
        console.error("Error cleaning up inactive rooms:", err)
      );
    }, 60000); // Vérifier chaque minute
    
    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(roomPlayersChannel);
      clearInterval(cleanupInterval);
    };
  }, []);

  // Fetch current room details when it changes - remove interval
  useEffect(() => {
    if (currentRoom) {
      fetchRoomDetails(currentRoom.id);
    }
  }, [currentRoom?.id]);

  // Update localStorage when player changes
  useEffect(() => {
    if (player) {
      localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    } else {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
    }
  }, [player]);
  
  // Update localStorage when currentRoom changes
  useEffect(() => {
    if (currentRoom) {
      localStorage.setItem(CURRENT_ROOM_KEY, JSON.stringify({ id: currentRoom.id, name: currentRoom.name }));
    } else {
      localStorage.removeItem(CURRENT_ROOM_KEY);
    }
  }, [currentRoom]);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          id, 
          name, 
          max_players, 
          status, 
          created_at,
          room_players (
            player_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching rooms:', error);
        return;
      }

      const formattedRooms: GameRoom[] = data.map(room => ({
        id: room.id,
        name: room.name,
        maxPlayers: room.max_players,
        status: room.status as 'waiting' | 'playing' | 'finished',
        createdAt: room.created_at,
        updatedAt: room.created_at, // Utiliser created_at comme fallback si updated_at n'existe pas encore
        players: room.room_players.map((rp: any) => ({ id: rp.player_id })) as Player[],
      }));

      setRooms(formattedRooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchRoomDetails = async (roomId: string) => {
    try {
      // Get room details
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select(`
          id, 
          name, 
          max_players, 
          status, 
          created_at
        `)
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error('Error fetching room details:', roomError);
        return;
      }

      // Get players in room
      const { data: playersData, error: playersError } = await supabase
        .from('room_players')
        .select(`
          id, 
          size, 
          x, 
          y, 
          is_alive,
          is_ready,
          players (
            id, 
            name, 
            color
          )
        `)
        .eq('room_id', roomId);

      if (playersError) {
        console.error('Error fetching room players:', playersError);
        return;
      }

      // Format room data with players
      const formattedPlayers: Player[] = playersData.map((rp: any) => ({
        id: rp.players.id,
        name: rp.players.name,
        color: rp.players.color as PlayerColor,
        size: rp.size,
        x: rp.x,
        y: rp.y,
        isAlive: rp.is_alive,
        ready: rp.is_ready || false,
      }));

      const formattedRoom: GameRoom = {
        id: roomData.id,
        name: roomData.name,
        maxPlayers: roomData.max_players,
        status: roomData.status as 'waiting' | 'playing' | 'finished',
        createdAt: roomData.created_at,
        updatedAt: roomData.created_at, // Fallback to created_at si updated_at n'existe pas encore
        players: formattedPlayers,
      };

      // Update current room if we're looking at it
      if (currentRoom?.id === roomId) {
        setCurrentRoom(formattedRoom);
      }

      // Update room in rooms list
      setRooms(prevRooms => 
        prevRooms.map(r => r.id === roomId ? formattedRoom : r)
      );

    } catch (error) {
      console.error('Error fetching room details:', error);
    }
  };

  const cleanupInactiveRooms = async () => {
    try {
      // Calculer la date limite basée sur MAX_ROOM_INACTIVITY_MINUTES
      const cutoffDate = new Date();
      cutoffDate.setMinutes(cutoffDate.getMinutes() - MAX_ROOM_INACTIVITY_MINUTES);
      const cutoffString = cutoffDate.toISOString();
      
      console.log(`Cleaning up rooms inactive since ${cutoffString}`);
      
      // Récupérer les salles inactives en attente
      const { data: inactiveRooms, error: fetchError } = await supabase
        .from('rooms')
        .select('id')
        .eq('status', 'waiting')
        .lt('created_at', cutoffString);
        
      if (fetchError) {
        console.error('Error fetching inactive rooms:', fetchError);
        return;
      }
      
      if (!inactiveRooms || inactiveRooms.length === 0) {
        console.log('No inactive rooms to clean up');
        return;
      }
      
      console.log(`Found ${inactiveRooms.length} inactive rooms to clean up`);
      
      // Récupérer les IDs des salles inactives
      const inactiveRoomIds = inactiveRooms.map(room => room.id);
      
      // Supprimer d'abord les joueurs des salles
      const { error: playersError } = await supabase
        .from('room_players')
        .delete()
        .in('room_id', inactiveRoomIds);
        
      if (playersError) {
        console.error('Error removing players from inactive rooms:', playersError);
        return;
      }
      
      // Ensuite supprimer les salles
      const { error: roomsError } = await supabase
        .from('rooms')
        .delete()
        .in('id', inactiveRoomIds);
        
      if (roomsError) {
        console.error('Error deleting inactive rooms:', roomsError);
        return;
      }
      
      console.log(`Successfully cleaned up ${inactiveRoomIds.length} inactive rooms`);
      
      // Si l'utilisateur actuel était dans une de ces salles, le sortir
      if (currentRoom && inactiveRoomIds.includes(currentRoom.id)) {
        toast({
          title: "Salle expirée",
          description: "La salle a été supprimée car elle était inactive depuis trop longtemps.",
          variant: "default"
        });
        setCurrentRoom(null);
      }
      
      // Rafraîchir la liste des salles
      fetchRooms();
      
    } catch (error) {
      console.error('Error cleaning up inactive rooms:', error);
    }
  };

  const createRoom = async (name: string, maxPlayers: number) => {
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez personnaliser votre blob avant de créer une salle",
        variant: "destructive"
      });
      throw new Error("Player not set");
    }

    try {
      // First, check if player is already in any room
      const { data: existingRooms, error: roomCheckError } = await supabase
        .from('room_players')
        .select('room_id')
        .eq('player_id', player.id);
        
      if (roomCheckError) {
        console.error('Error checking player rooms:', roomCheckError);
        throw roomCheckError;
      }
      
      // If player is already in a room, make them leave first
      if (existingRooms && existingRooms.length > 0) {
        // Force leave all rooms the player is in
        await Promise.all(existingRooms.map(async (room) => {
          await supabase
            .from('room_players')
            .delete()
            .eq('room_id', room.room_id)
            .eq('player_id', player.id);
        }));
        
        toast({
          title: "Changement de salle",
          description: "Vous avez quitté votre salle précédente"
        });
      }

      // Create room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({ name, max_players: maxPlayers })
        .select('id')
        .single();

      if (roomError) {
        console.error('Error creating room:', roomError);
        toast({
          title: "Erreur",
          description: "Impossible de créer la salle",
          variant: "destructive"
        });
        throw roomError;
      }

      toast({
        title: "Salle créée",
        description: `La salle "${name}" a été créée`
      });
      
      return roomData.id;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  };

  // Version améliorée de joinRoom pour éviter les cycles d'entrée/sortie
  const joinRoom = async (roomId: string) => {
    // Ne rien faire si une opération de jointure ou de départ est déjà en cours
    if (isJoiningRoom || isLeavingRoom) {
      console.log('Room operation already in progress, skipping joinRoom');
      return;
    }
    
    // Si on demande de vider la salle courante
    if (roomId === "") {
      setCurrentRoom(null);
      return;
    }
    
    // Vérifier que le joueur existe
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez personnaliser votre blob avant de rejoindre une salle",
        variant: "destructive"
      });
      return;
    }

    try {
      // Marquer le début de l'opération de jointure
      setIsJoiningRoom(true);
      
      // Vérifier que le joueur n'est pas déjà dans une salle
      const { data: existingRooms, error: roomCheckError } = await supabase
        .from('room_players')
        .select('room_id')
        .eq('player_id', player.id);
        
      if (roomCheckError) {
        console.error('Error checking player rooms:', roomCheckError);
        setIsJoiningRoom(false);
        return;
      }
      
      // Si le joueur est déjà dans cette salle spécifique, ne rien faire d'autre que mettre à jour l'état
      if (existingRooms && existingRooms.some(room => room.room_id === roomId)) {
        console.log('Player already in this room, just updating state');
        await fetchRoomDetails(roomId);
        setIsJoiningRoom(false);
        return;
      }
      
      // Si le joueur est dans d'autres salles, les quitter d'abord
      if (existingRooms && existingRooms.length > 0) {
        // Quitter toutes les salles existantes
        await Promise.all(existingRooms.map(async (room) => {
          await supabase
            .from('room_players')
            .delete()
            .eq('room_id', room.room_id)
            .eq('player_id', player.id);
        }));
        
        // Notification unique pour éviter le spam
        if (currentRoom) {
          toast({
            title: "Changement de salle",
            description: "Vous avez quitté votre salle précédente"
          });
        }
      }

      // Maintenant ajouter le joueur à la nouvelle salle
      const { error: joinError } = await supabase
        .from('room_players')
        .insert({
          room_id: roomId,
          player_id: player.id,
          is_ready: false
        });

      if (joinError) {
        console.error('Error joining room:', joinError);
        toast({
          title: "Erreur",
          description: "Impossible de rejoindre la salle",
          variant: "destructive"
        });
        setIsJoiningRoom(false);
        return;
      }

      // Récupérer les détails de la salle pour mettre à jour la salle courante
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error('Error fetching room details:', roomError);
        setIsJoiningRoom(false);
        return;
      }

      const room: GameRoom = {
        id: roomData.id,
        name: roomData.name,
        maxPlayers: roomData.max_players,
        status: roomData.status as 'waiting' | 'playing' | 'finished',
        players: [], // Les joueurs seront récupérés dans useEffect
      };

      setCurrentRoom(room);
      
      toast({
        title: "Salle rejointe",
        description: `Vous avez rejoint "${room.name}"`
      });

    } catch (error) {
      console.error('Error joining room:', error);
    } finally {
      // Marquer la fin de l'opération de jointure
      setIsJoiningRoom(false);
    }
  };

  // Version améliorée de leaveRoom pour éviter les conflits
  const leaveRoom = async () => {
    // Ne rien faire si aucune salle n'est sélectionnée ou si le joueur n'existe pas
    if (!currentRoom || !player) return;
    
    // Ne rien faire si une opération de jointure ou de départ est déjà en cours
    if (isJoiningRoom || isLeavingRoom) {
      console.log('Room operation already in progress, skipping leaveRoom');
      return;
    }

    try {
      // Marquer le début de l'opération de départ
      setIsLeavingRoom(true);
      
      // Supprimer le joueur de la salle
      const { error } = await supabase
        .from('room_players')
        .delete()
        .eq('room_id', currentRoom.id)
        .eq('player_id', player.id);

      if (error) {
        console.error('Error leaving room:', error);
        setIsLeavingRoom(false);
        return;
      }

      // Effacer explicitement toutes les données liées à la salle dans le stockage local
      localStorage.removeItem(CURRENT_ROOM_KEY);
      
      // Effacer l'état de la salle courante
      setCurrentRoom(null);
      
      toast({
        title: "Salle quittée",
        description: "Vous avez quitté la salle"
      });
      
      // Forcer une actualisation des salles disponibles
      await fetchRooms();

    } catch (error) {
      console.error('Error leaving room:', error);
    } finally {
      // Marquer la fin de l'opération de départ
      setIsLeavingRoom(false);
    }
  };

  const setPlayerReady = async (isReady: boolean) => {
    if (!currentRoom || !player) return;

    try {
      // Update player ready status - fixed property name
      const { error } = await supabase
        .from('room_players')
        .update({ is_ready: isReady })
        .eq('room_id', currentRoom.id)
        .eq('player_id', player.id);

      if (error) {
        console.error('Error updating player ready status:', error);
        return;
      }

      // Update local state immediately for better UX
      setCurrentRoom(prev => {
        if (!prev) return null;
        
        return {
          ...prev,
          players: prev.players.map(p => 
            p.id === player.id ? { ...p, ready: isReady } : p
          )
        };
      });

    } catch (error) {
      console.error('Error setting player ready status:', error);
    }
  };

  const setPlayerDetails = async (name: string, color: PlayerColor) => {
    try {
      // Check if player already exists
      if (player) {
        // Update existing player
        const { error } = await supabase
          .from('players')
          .update({ name, color })
          .eq('id', player.id);

        if (error) {
          console.error('Error updating player:', error);
          return;
        }

        setPlayer({ ...player, name, color });

      } else {
        // Create new player
        const { data, error } = await supabase
          .from('players')
          .insert({ name, color })
          .select()
          .single();

        if (error) {
          console.error('Error creating player:', error);
          return;
        }

        const newPlayer: Player = {
          id: data.id,
          name: data.name,
          color: data.color as PlayerColor,
          size: 30,
          x: 0,
          y: 0,
          isAlive: true
        };
        
        setPlayer(newPlayer);
      }

      toast({
        title: "Personnalisation terminée",
        description: "Votre blob a été personnalisé"
      });
    } catch (error) {
      console.error('Error setting player details:', error);
    }
  };

  // Amélioration de la fonction startGame pour être plus robuste
  const startGame = async () => {
    if (!currentRoom) return false; // Return false if no room
    
    try {
      // Vérifier que tous les joueurs sont prêts
      const allPlayersReady = currentRoom.players.every(p => p.ready === true);
      
      if (!allPlayersReady) {
        // En mode test (1 joueur), on force le démarrage
        const isSinglePlayer = currentRoom.maxPlayers === 1 && currentRoom.players.length === 1;
        if (!isSinglePlayer) {
          throw new Error("Tous les joueurs ne sont pas prêts");
        }
      }
      
      // Mettre à jour le statut de la salle à 'playing'
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'playing' })
        .eq('id', currentRoom.id);

      if (error) {
        console.error('Error starting game:', error);
        throw error;
      }
      
      // Mise à jour immédiate de l'état local pour une meilleure UX
      setCurrentRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'playing'
        };
      });
      
      // Attendre un court instant pour s'assurer que la mise à jour est propagée
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Rafraîchir les données de la salle une dernière fois
      await refreshCurrentRoom();
      
      return true;
    } catch (error) {
      console.error('Error starting game:', error);
      throw error;
    }
  };

  const refreshCurrentRoom = async () => {
    if (currentRoom) {
      try {
        await fetchRoomDetails(currentRoom.id);
      } catch (error) {
        console.error('Error refreshing current room:', error);
        throw error; // Propager l'erreur pour la traiter en amont
      }
    }
  };

  const value = {
    rooms,
    currentRoom,
    player,
    createRoom,
    joinRoom,
    leaveRoom,
    setPlayerDetails,
    startGame,
    setPlayerReady,
    refreshCurrentRoom,
    cleanupInactiveRooms
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
