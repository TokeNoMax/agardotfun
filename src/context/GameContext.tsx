
import React, { createContext, useContext, useState, ReactNode } from "react";
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

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const { toast } = useToast();

  const createRoom = (name: string, maxPlayers: number) => {
    const roomId = Math.random().toString(36).substring(2, 9);
    const newRoom: GameRoom = {
      id: roomId,
      name,
      maxPlayers,
      players: [],
      status: 'waiting'
    };
    setRooms([...rooms, newRoom]);
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

    // Add player to room
    const updatedRoom = {
      ...room,
      players: [...room.players, player]
    };

    setRooms(rooms.map(r => r.id === roomId ? updatedRoom : r));
    setCurrentRoom(updatedRoom);
    toast({
      title: "Joined room",
      description: `You have joined "${room.name}"`
    });

    // Check if room is full to start the game
    if (updatedRoom.players.length === updatedRoom.maxPlayers) {
      startGame();
    }
  };

  const leaveRoom = () => {
    if (!currentRoom || !player) return;

    const updatedRoom = {
      ...currentRoom,
      players: currentRoom.players.filter(p => p.id !== player.id)
    };

    setRooms(rooms.map(r => r.id === currentRoom.id ? updatedRoom : r));
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
    
    setRooms(rooms.map(r => r.id === currentRoom.id ? updatedRoom : r));
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
