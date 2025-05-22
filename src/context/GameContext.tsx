import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Player, Food, Rug, GameRoom, PlayerColor } from "@/types/game";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GameContextType {
  rooms: GameRoom[];
  currentRoom: GameRoom | null;
  player: Player | null;
  createRoom: (name: string, maxPlayers: number) => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  setPlayerDetails: (name: string, color: PlayerColor) => Promise<void>;
  startGame: () => Promise<void>;
  setPlayerReady: (isReady: boolean) => Promise<void>;
  refreshCurrentRoom: () => Promise<void>;
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
  
  const { toast } = useToast();

  // Fetch rooms and subscribe to changes
  useEffect(() => {
    fetchRooms();
    
    // Subscribe to room changes
    const roomsChannel = supabase
      .channel('public:rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' }, 
        () => {
          fetchRooms();
        }
      )
      .subscribe();

    // Subscribe to room_players changes
    const roomPlayersChannel = supabase
      .channel('public:room_players')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'room_players' }, 
        () => {
          if (currentRoom) {
            fetchRoomDetails(currentRoom.id);
          }
          // Also refresh the rooms list to update player counts
          fetchRooms();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(roomPlayersChannel);
    };
  }, []);

  // Fetch current room details when it changes or on interval
  useEffect(() => {
    if (currentRoom) {
      fetchRoomDetails(currentRoom.id);
      
      // Set up interval to refresh room details
      const refreshInterval = setInterval(() => {
        fetchRoomDetails(currentRoom.id);
      }, 5000); // Every 5 seconds
      
      return () => clearInterval(refreshInterval);
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
        players: formattedPlayers,
      };

      // Check if current player is still in the room
      if (player && !formattedPlayers.some(p => p.id === player.id)) {
        // Player is no longer in room, but room data exists in localStorage
        // This indicates the player refreshed the page while in a room
        // Let's attempt to rejoin the room automatically
        try {
          await supabase
            .from('room_players')
            .insert({
              room_id: roomId,
              player_id: player.id,
              is_ready: false
            });
            
          toast({
            title: "Reconnexion",
            description: "Vous avez été reconnecté à la salle"
          });
          
          // Update room data after rejoining
          await fetchRoomDetails(roomId);
          return;
        } catch (error) {
          console.error('Error rejoining room:', error);
        }
      }

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

  const joinRoom = async (roomId: string) => {
    if (roomId === "") {
      setCurrentRoom(null);
      return;
    }
    
    if (!player) {
      toast({
        title: "Erreur",
        description: "Veuillez personnaliser votre blob avant de rejoindre une salle",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if player is already in room
      const { data: existingPlayer, error: checkError } = await supabase
        .from('room_players')
        .select('id')
        .eq('room_id', roomId)
        .eq('player_id', player.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking player in room:', checkError);
        return;
      }

      if (!existingPlayer) {
        // Add player to room
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
          return;
        }
      }

      // Get room details to update current room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error('Error fetching room details:', roomError);
        return;
      }

      const room: GameRoom = {
        id: roomData.id,
        name: roomData.name,
        maxPlayers: roomData.max_players,
        status: roomData.status as 'waiting' | 'playing' | 'finished',
        players: [], // Players will be fetched in useEffect
      };

      setCurrentRoom(room);
      
      toast({
        title: "Salle rejointe",
        description: `Vous avez rejoint "${room.name}"`
      });

    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  const leaveRoom = async () => {
    if (!currentRoom || !player) return;

    try {
      // Remove player from room
      const { error } = await supabase
        .from('room_players')
        .delete()
        .eq('room_id', currentRoom.id)
        .eq('player_id', player.id);

      if (error) {
        console.error('Error leaving room:', error);
        return;
      }

      setCurrentRoom(null);
      toast({
        title: "Salle quittée",
        description: "Vous avez quitté la salle"
      });

    } catch (error) {
      console.error('Error leaving room:', error);
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

  const startGame = async () => {
    if (!currentRoom) return;
    
    try {
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
      
      toast({
        title: "Partie commencée !",
        description: "Que la bataille commence !"
      });
    } catch (error) {
      console.error('Error starting game:', error);
      throw error;
    }
  };

  const refreshCurrentRoom = async () => {
    if (currentRoom) {
      await fetchRoomDetails(currentRoom.id);
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
    refreshCurrentRoom
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
