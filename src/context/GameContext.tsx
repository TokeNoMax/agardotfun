
import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Player, Food, Rug, GameRoom, PlayerColor } from "@/types/game";
import { useToast } from "@/components/ui/use-toast";

interface GameContextType {
  rooms: GameRoom[];
  currentRoom: GameRoom | null;
  player: Player | null;
  createRoom: (name: string, maxPlayers: number) => string;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  setPlayerDetails: (name: string, color: PlayerColor) => void;
  startGame: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

// Local storage keys for game state
const ROOMS_STORAGE_KEY = 'blob-battle-rooms';
const CURRENT_ROOM_STORAGE_KEY = 'blob-battle-current-room';
const PLAYER_STORAGE_KEY = 'blob-battle-player';

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<GameRoom[]>(() => {
    const storedRooms = localStorage.getItem(ROOMS_STORAGE_KEY);
    return storedRooms ? JSON.parse(storedRooms) : [];
  });
  
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(() => {
    const storedRoom = localStorage.getItem(CURRENT_ROOM_STORAGE_KEY);
    return storedRoom ? JSON.parse(storedRoom) : null;
  });
  
  const [player, setPlayer] = useState<Player | null>(() => {
    const storedPlayer = localStorage.getItem(PLAYER_STORAGE_KEY);
    return storedPlayer ? JSON.parse(storedPlayer) : null;
  });
  
  const { toast } = useToast();

  // Effect to handle storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ROOMS_STORAGE_KEY && e.newValue) {
        setRooms(JSON.parse(e.newValue));
      } else if (e.key === CURRENT_ROOM_STORAGE_KEY) {
        setCurrentRoom(e.newValue ? JSON.parse(e.newValue) : null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update localStorage when state changes
  useEffect(() => {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    if (currentRoom) {
      localStorage.setItem(CURRENT_ROOM_STORAGE_KEY, JSON.stringify(currentRoom));
    } else {
      localStorage.removeItem(CURRENT_ROOM_STORAGE_KEY);
    }
  }, [currentRoom]);

  useEffect(() => {
    if (player) {
      localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    } else {
      localStorage.removeItem(PLAYER_STORAGE_KEY);
    }
  }, [player]);

  const createRoom = (name: string, maxPlayers: number) => {
    const roomId = Math.random().toString(36).substring(2, 9);
    const newRoom: GameRoom = {
      id: roomId,
      name,
      maxPlayers,
      players: [],
      status: 'waiting'
    };
    setRooms(prevRooms => {
      const updatedRooms = [...prevRooms, newRoom];
      return updatedRooms;
    });
    toast({
      title: "Room created",
      description: `Room "${name}" has been created`
    });
    return roomId;
  };

  const joinRoom = (roomId: string) => {
    if (!player) {
      toast({
        title: "Error",
        description: "Please set your name and color before joining a room",
        variant: "destructive"
      });
      return;
    }

    const room = rooms.find(r => r.id === roomId);
    if (!room) {
      toast({
        title: "Error",
        description: "Room not found",
        variant: "destructive"
      });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      toast({
        title: "Error",
        description: "Room is full",
        variant: "destructive"
      });
      return;
    }

    // Check if player is already in room
    if (room.players.some(p => p.id === player.id)) {
      setCurrentRoom(room);
      toast({
        title: "Rejoined room",
        description: `You have rejoined "${room.name}"`
      });
      return;
    }

    // Add player to room
    const updatedRoom = {
      ...room,
      players: [...room.players, player]
    };

    setRooms(prevRooms => 
      prevRooms.map(r => r.id === roomId ? updatedRoom : r)
    );
    setCurrentRoom(updatedRoom);
    
    toast({
      title: "Joined room",
      description: `You have joined "${room.name}"`
    });

    // Check if room is full to start the game
    if (updatedRoom.players.length === updatedRoom.maxPlayers) {
      setTimeout(() => startGame(), 500);
    }
  };

  const leaveRoom = () => {
    if (!currentRoom || !player) return;

    const updatedRoom = {
      ...currentRoom,
      players: currentRoom.players.filter(p => p.id !== player.id)
    };

    setRooms(prevRooms => 
      prevRooms.map(r => r.id === currentRoom.id ? updatedRoom : r)
    );
    setCurrentRoom(null);
    toast({
      title: "Left room",
      description: "You have left the room"
    });
  };

  const setPlayerDetails = (name: string, color: PlayerColor) => {
    const newPlayer: Player = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      color,
      size: 30,
      x: 0,
      y: 0,
      isAlive: true
    };
    setPlayer(newPlayer);
    toast({
      title: "Player setup",
      description: "Your player has been customized"
    });
  };

  const startGame = () => {
    if (!currentRoom) return;
    
    const updatedRoom = {
      ...currentRoom,
      status: 'playing' as const
    };
    
    setRooms(prevRooms => 
      prevRooms.map(r => r.id === currentRoom.id ? updatedRoom : r)
    );
    setCurrentRoom(updatedRoom);
    
    toast({
      title: "Game started!",
      description: "The battle begins now!"
    });
  };

  const value = {
    rooms,
    currentRoom,
    player,
    createRoom,
    joinRoom,
    leaveRoom,
    setPlayerDetails,
    startGame
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
