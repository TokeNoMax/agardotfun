import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Player, GameRoom, PlayerColor } from '@/types/game';
import { playerService } from '@/services/player/playerService';
import { roomService } from '@/services/room/roomService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePlayerHeartbeat } from '@/hooks/usePlayerHeartbeat';

// Default phrases for meme toasts
export const defaultPhrases = [
  "{playerName} just got rekt! 💀",
  "{playerName} became someone's lunch! 🍽️",
  "RIP {playerName} - gone but not forgotten 😢",
  "{playerName} got absolutely destroyed! 💥",
  "Another one bites the dust: {playerName} 🎵",
  "{playerName} just rage quit... permanently! 😡",
  "Press F to pay respects to {playerName} 🫡",
  "{playerName} got sent to the shadow realm! 👻"
];

interface GameContextType {
  player: Player | null;
  currentRoom: GameRoom | null;
  rooms: GameRoom[];
  customPhrases: string[];
  createPlayer: (playerData: Omit<Player, 'id' | 'walletAddress'>) => Promise<void>;
  updatePlayer: (updates: Partial<Player>) => Promise<void>;
  setPlayerDetails: (name: string, color: string, nftImageUrl?: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  createRoom: (roomData: { name: string; maxPlayers: number }) => Promise<string>;
  refreshCurrentRoom: () => Promise<void>;
  toggleReady: () => Promise<void>;
  setPlayerReady: (ready: boolean) => Promise<void>;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  refreshRooms: () => Promise<void>;
  setCustomPhrases: (phrases: string[]) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameContextProvider');
  }
  return context;
};

interface GameContextProviderProps {
  children: ReactNode;
}

export function GameContextProvider({ children }: GameContextProviderProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [customPhrases, setCustomPhrases] = useState<string[]>(defaultPhrases);
  const { toast } = useToast();
  
  // Integrate Solana wallet
  const { connected, publicKey } = useWallet();

  // Use heartbeat for maintaining active connection
  usePlayerHeartbeat({
    roomId: currentRoom?.id,
    playerId: player?.id,
    intervalSeconds: 20, // More frequent heartbeat
    enableLogging: false
  });

  // Enhanced broadcast for critical events
  const broadcastPlayerDeparture = async (roomId: string, playerId: string) => {
    try {
      const channel = supabase.channel(`room-${roomId}-departures`);
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'player_left',
        payload: { 
          playerId, 
          timestamp: new Date().toISOString(),
          action: 'force_refresh'
        }
      });
      
      // Clean up channel after broadcast
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 1000);
    } catch (error) {
      console.error("Error broadcasting player departure:", error);
    }
  };

  const createPlayer = async (playerData: Omit<Player, 'id' | 'walletAddress'>) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }

      const walletAddress = publicKey.toString();
      console.log('Creating player with wallet address:', walletAddress);

      // First check if player already exists
      const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('*')
        .eq('id', walletAddress)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing player:', checkError);
        throw checkError;
      }

      let playerResult;

      if (existingPlayer) {
        console.log('Player exists, updating...');
        // Update existing player
        const { data, error } = await supabase
          .from('players')
          .update({
            name: playerData.name,
            color: playerData.color
          })
          .eq('id', walletAddress)
          .select()
          .single();

        if (error) {
          console.error('Error updating existing player:', error);
          throw error;
        }
        playerResult = data;
      } else {
        console.log('Creating new player...');
        // Create new player
        const { data, error } = await supabase
          .from('players')
          .insert({
            id: walletAddress,
            name: playerData.name,
            color: playerData.color
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating new player:', error);
          throw error;
        }
        playerResult = data;
      }

      const newPlayer: Player = {
        id: walletAddress,
        walletAddress,
        name: playerResult.name,
        color: playerResult.color as PlayerColor,
        size: playerData.size || 30,
        x: playerData.x || 0,
        y: playerData.y || 0,
        isAlive: playerData.isAlive !== false,
        nftImageUrl: playerData.nftImageUrl
      };

      setPlayer(newPlayer);
      localStorage.setItem('blob-battle-player', JSON.stringify(newPlayer));

      toast({
        title: "BLOB_PROTOCOL_ACTIVATED",
        description: `Joueur ${newPlayer.name} créé avec succès !`,
      });
    } catch (error) {
      console.error('Error creating player:', error);
      toast({
        title: "PROTOCOL_ERROR",
        description: "Impossible de créer le joueur. Vérifiez votre connexion.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updatePlayer = async (updates: Partial<Player>) => {
    if (!player || !connected || !publicKey) return;

    try {
      console.log('Updating player:', player.id, updates);

      const { data, error } = await supabase
        .from('players')
        .update({
          name: updates.name,
          color: updates.color
        })
        .eq('id', player.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating player:', error);
        throw error;
      }

      const updatedPlayer = { ...player, ...updates };
      setPlayer(updatedPlayer);
      localStorage.setItem('blob-battle-player', JSON.stringify(updatedPlayer));

      toast({
        title: "BLOB_UPDATED",
        description: "Configuration mise à jour !",
      });
    } catch (error) {
      console.error('Error updating player:', error);
      toast({
        title: "UPDATE_ERROR",
        description: "Impossible de mettre à jour le joueur.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const setPlayerDetails = async (name: string, color: string, nftImageUrl?: string) => {
    if (!connected || !publicKey) {
      throw new Error('Wallet not connected');
    }

    const walletAddress = publicKey.toString();
    console.log('Setting player details for wallet:', walletAddress);

    try {
      // Check if player already exists in database
      const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('*')
        .eq('id', walletAddress)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing player:', checkError);
        throw checkError;
      }

      const playerData = {
        name,
        color: color as PlayerColor,
        size: 30,
        x: 0,
        y: 0,
        isAlive: true,
        nftImageUrl
      };

      if (existingPlayer) {
        console.log('Player exists, updating...');
        await updatePlayer(playerData);
      } else {
        console.log('Player does not exist, creating...');
        await createPlayer(playerData);
      }
    } catch (error) {
      console.error('Error in setPlayerDetails:', error);
      throw error;
    }
  };

  const joinRoom = async (roomId: string) => {
    if (!player) {
      throw new Error('Player not found');
    }

    try {
      console.log('Joining room with player:', player);
      await playerService.joinRoom(roomId, player);
      
      // Wait a bit for the database to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await refreshCurrentRoom();
      
      toast({
        title: "ROOM_JOINED",
        description: "Connexion à la salle établie !",
      });
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "CONNECTION_ERROR",
        description: "Impossible de rejoindre la salle. Réessayez.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const leaveRoom = async () => {
    if (!player || !currentRoom) return;

    try {
      console.log(`Player ${player.id} leaving room ${currentRoom.id}`);
      
      // Broadcast departure immediately to other players
      await broadcastPlayerDeparture(currentRoom.id, player.id);
      
      await playerService.leaveRoom(currentRoom.id, player.id);
      setCurrentRoom(null);
      localStorage.removeItem('blob-battle-current-room');
      
      toast({
        title: "DISCONNECTED",
        description: "Vous avez quitté la salle.",
      });
    } catch (error) {
      console.error('Error leaving room:', error);
      toast({
        title: "DISCONNECTION_ERROR", 
        description: "Erreur lors de la déconnexion.",
        variant: "destructive"
      });
    }
  };

  const createRoom = async (roomData: { name: string; maxPlayers: number }): Promise<string> => {
    if (!player) {
      throw new Error('Player not found');
    }

    try {
      console.log('Creating room:', roomData, 'with player:', player);
      const roomId = await roomService.createRoom(roomData.name, roomData.maxPlayers);
      
      // Wait a bit for the room to be created
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Room created, joining:', roomId);
      await joinRoom(roomId);
      
      return roomId;
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "CREATION_ERROR",
        description: "Impossible de créer la salle. Réessayez.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const refreshCurrentRoom = async () => {
    if (!player) return;

    try {
      // Get current room by checking which room the player is in
      const { data: playerInRoom, error } = await supabase
        .from('game_room_players')
        .select('room_id')
        .eq('player_id', player.id)
        .single();

      if (error || !playerInRoom) {
        setCurrentRoom(null);
        localStorage.removeItem('blob-battle-current-room');
        return;
      }

      const room = await roomService.getRoom(playerInRoom.room_id);
      setCurrentRoom(room);
      
      if (room) {
        localStorage.setItem('blob-battle-current-room', JSON.stringify(room));
        
        // Check for ghost room condition
        if (room.status === 'playing' && room.players && room.players.length <= 1) {
          console.log("Ghost room detected during refresh:", room.id);
        }
      } else {
        localStorage.removeItem('blob-battle-current-room');
      }
    } catch (error) {
      console.error('Error refreshing current room:', error);
      setCurrentRoom(null);
      localStorage.removeItem('blob-battle-current-room');
    }
  };

  const refreshRooms = async () => {
    try {
      const allRooms = await roomService.getAllRooms();
      setRooms(allRooms);
    } catch (error) {
      console.error('Error refreshing rooms:', error);
    }
  };

  const toggleReady = async () => {
    if (!player || !currentRoom) return;

    try {
      const currentPlayer = currentRoom.players && currentRoom.players.find(p => p.id === player.id);
      const newReadyStatus = !currentPlayer?.ready;
      await playerService.setPlayerReady(currentRoom.id, player.id, newReadyStatus);
      await refreshCurrentRoom();
    } catch (error) {
      console.error('Error toggling ready:', error);
      toast({
        title: "STATUS_ERROR",
        description: "Impossible de changer le statut.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const setPlayerReady = async (ready: boolean) => {
    if (!player || !currentRoom) return;

    try {
      await playerService.setPlayerReady(currentRoom.id, player.id, ready);
      await refreshCurrentRoom();
    } catch (error) {
      console.error('Error setting player ready:', error);
      toast({
        title: "STATUS_ERROR",
        description: "Impossible de changer le statut.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const startGame = async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentRoom) return { success: false, error: 'No current room' };

    try {
      console.log('Starting game for room:', currentRoom.id);
      
      await roomService.startGame(currentRoom.id);
      await refreshCurrentRoom();
      
      toast({
        title: "GAME_LAUNCHED",
        description: "Redirection vers le jeu...",
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error starting game:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start game';
      toast({
        title: "LAUNCH_ERROR",
        description: "Impossible de démarrer la partie.",
        variant: "destructive"
      });
      return { success: false, error: errorMessage };
    }
  };

  // Enhanced subscription to listen for departure broadcasts
  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase
      .channel(`room-${currentRoom.id}-departures`)
      .on('broadcast', { event: 'player_left' }, (payload) => {
        console.log('Player departure broadcast received:', payload);
        // Force immediate refresh when another player leaves
        setTimeout(() => {
          refreshCurrentRoom();
          refreshRooms();
        }, 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom?.id]);

  // Effect to handle wallet connection changes
  useEffect(() => {
    if (!connected || !publicKey) {
      console.log('Wallet disconnected, clearing player state');
      setPlayer(null);
      setCurrentRoom(null);
      localStorage.removeItem('blob-battle-player');
      localStorage.removeItem('blob-battle-current-room');
      return;
    }

    const walletAddress = publicKey.toString();
    console.log('Wallet connected:', walletAddress);

    // Load player from database when wallet connects
    const loadPlayer = async () => {
      try {
        const { data: dbPlayer, error } = await supabase
          .from('players')
          .select('*')
          .eq('id', walletAddress)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading player from database:', error);
          return;
        }

        if (dbPlayer) {
          const loadedPlayer: Player = {
            id: dbPlayer.id,
            walletAddress: dbPlayer.id,
            name: dbPlayer.name,
            color: dbPlayer.color as PlayerColor,
            size: 30,
            x: 0,
            y: 0,
            isAlive: true
          };
          
          console.log('Loaded player from database:', loadedPlayer);
          setPlayer(loadedPlayer);
          localStorage.setItem('blob-battle-player', JSON.stringify(loadedPlayer));
        } else {
          console.log('No existing player found for wallet:', walletAddress);
        }
      } catch (error) {
        console.error('Error in loadPlayer:', error);
      }
    };

    loadPlayer();
  }, [connected, publicKey]);

  // Load initial data
  useEffect(() => {
    refreshRooms();
  }, []);

  // Subscribe to room updates
  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase
      .channel(`room-${currentRoom.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${currentRoom.id}`
        },
        () => {
          refreshCurrentRoom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_room_players',
          filter: `room_id=eq.${currentRoom.id}`
        },
        () => {
          refreshCurrentRoom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom?.id]);

  const value: GameContextType = {
    player,
    currentRoom,
    rooms,
    customPhrases,
    createPlayer,
    updatePlayer,
    setPlayerDetails,
    joinRoom,
    leaveRoom,
    createRoom,
    refreshCurrentRoom,
    toggleReady,
    setPlayerReady,
    startGame,
    refreshRooms,
    setCustomPhrases
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// Export the provider with the correct name for App.tsx
export const GameProvider = GameContextProvider;
