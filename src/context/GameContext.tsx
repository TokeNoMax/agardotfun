
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Player, GameRoom } from '@/types/game';
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

  // Utiliser le heartbeat pour maintenir la connexion active
  usePlayerHeartbeat({
    roomId: currentRoom?.id,
    playerId: player?.id,
    intervalSeconds: 30,
    enableLogging: false
  });

  const createPlayer = async (playerData: Omit<Player, 'id' | 'walletAddress'>) => {
    try {
      const walletAddress = localStorage.getItem('walletAddress');
      if (!walletAddress) {
        throw new Error('Wallet address not found');
      }

      const newPlayer = await playerService.createPlayer({
        ...playerData,
        walletAddress
      });

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
        description: "Impossible de créer le joueur.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updatePlayer = async (updates: Partial<Player>) => {
    if (!player) return;

    try {
      const updatedPlayer = await playerService.updatePlayer(player.id, updates);
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
    const walletAddress = localStorage.getItem('walletAddress');
    if (!walletAddress) {
      throw new Error('Wallet address not found');
    }

    const playerData = {
      name,
      color: color as any,
      size: 30,
      x: 0,
      y: 0,
      isAlive: true,
      nftImageUrl
    };

    if (player) {
      await updatePlayer(playerData);
    } else {
      await createPlayer(playerData);
    }
  };

  const joinRoom = async (roomId: string) => {
    if (!player) {
      throw new Error('Player not found');
    }

    try {
      await roomService.joinRoom(roomId, player.id);
      await refreshCurrentRoom();
      
      toast({
        title: "ROOM_JOINED",
        description: "Connexion à la salle établie !",
      });
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: "CONNECTION_ERROR",
        description: "Impossible de rejoindre la salle.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const leaveRoom = async () => {
    if (!player || !currentRoom) return;

    try {
      await roomService.leaveRoom(currentRoom.id, player.id);
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
      const roomId = await roomService.createRoom({
        ...roomData,
        createdBy: player.id
      });

      await joinRoom(roomId);
      return roomId;
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: "CREATION_ERROR",
        description: "Impossible de créer la salle.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const refreshCurrentRoom = async () => {
    if (!player) return;

    try {
      const room = await roomService.getCurrentRoom(player.id);
      setCurrentRoom(room);
      
      if (room) {
        localStorage.setItem('blob-battle-current-room', JSON.stringify(room));
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
      await roomService.togglePlayerReady(currentRoom.id, player.id);
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
      await roomService.setPlayerReady(currentRoom.id, player.id, ready);
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

  // Load saved data on mount
  useEffect(() => {
    const savedPlayer = localStorage.getItem('blob-battle-player');
    const savedRoom = localStorage.getItem('blob-battle-current-room');
    
    if (savedPlayer) {
      try {
        setPlayer(JSON.parse(savedPlayer));
      } catch (error) {
        console.error('Error parsing saved player:', error);
        localStorage.removeItem('blob-battle-player');
      }
    }
    
    if (savedRoom) {
      try {
        setCurrentRoom(JSON.parse(savedRoom));
      } catch (error) {
        console.error('Error parsing saved room:', error);
        localStorage.removeItem('blob-battle-current-room');
      }
    }

    // Load rooms initially
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
          table: 'room_players',
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
