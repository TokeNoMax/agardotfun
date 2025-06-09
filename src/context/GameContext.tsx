import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  GameRoom,
  Player,
  GameMode,
  PlayerColor,
} from "@/types/game";
import { gameRoomService } from "@/services/gameRoomService";
import { playerService } from "@/services/player/playerService";
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { generateName } from "@/utils/nameGenerator";
import { generateColor } from "@/utils/colorGenerator";
import { usePlayerHeartbeat } from "@/hooks/usePlayerHeartbeat";

// Default phrases for the game
export const defaultPhrases = [
  "{playerName} s'est fait absorber ! 💀",
  "{playerName} a rejoint les légendes ! ⚰️",
  "RIP {playerName}, tu nous manqueras ! 😢",
  "{playerName} a été recyclé ! ♻️",
  "Au revoir {playerName} ! 👋",
  "{playerName} est maintenant de la nourriture ! 🍽️",
  "{playerName} a découvert la vraie DeFi ! 📉",
  "Liquidé : {playerName} ! 💸",
  "{playerName} a été rug pulled ! 🪜",
  "Diamond hands? Plus comme paper hands {playerName} ! 💎➡️📄"
];

interface GameContextType {
  player: Player | null;
  setPlayer: (player: Player | null) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
  customPhrases: string[];
  setCustomPhrases: (phrases: string[]) => void;
  rooms: GameRoom[];
  currentRoom: GameRoom | null;
  createRoom: (params: { name: string; maxPlayers: number; gameMode?: GameMode }) => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  setPlayerReady: (isReady: boolean) => Promise<void>;
  refreshRooms: () => Promise<void>;
  refreshCurrentRoom: () => Promise<void>;
  resetGame: () => void;
  setPlayerDetails: (name: string, color: PlayerColor) => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameContextProviderProps {
  children: React.ReactNode;
}

export const GameContextProvider: React.FC<GameContextProviderProps> = ({
  children,
}) => {
  const [player, setPlayer] = useLocalStorage<Player | null>(
    "blob-battle-player",
    null
  );
  const [playerName, setPlayerName] = useLocalStorage<string>(
    "blob-battle-player-name",
    ""
  );
  const [playerColor, setPlayerColor] = useLocalStorage<PlayerColor>(
    "blob-battle-player-color",
    "blue"
  );
  const [customPhrases, setCustomPhrases] = useLocalStorage<string[]>(
    "blob-battle-custom-phrases",
    defaultPhrases
  );
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useLocalStorage<GameRoom | null>(
    "blob-battle-current-room",
    null
  );
  const navigate = useNavigate();
  const { toast } = useToast();

  // Heartbeat effect
  const { sendManualHeartbeat } = usePlayerHeartbeat({
    roomId: currentRoom?.id,
    playerId: player?.id,
    intervalSeconds: 20,
    enableLogging: false,
  });

  useEffect(() => {
    if (player?.id && currentRoom?.id) {
      sendManualHeartbeat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, currentRoom?.id]);

  const resetGame = () => {
    setPlayer(null);
    setRooms([]);
    setCurrentRoom(null);
    localStorage.removeItem("blob-battle-player");
    localStorage.removeItem("blob-battle-current-room");
  };

  const setPlayerDetails = async (name: string, color: PlayerColor): Promise<void> => {
    setPlayerName(name);
    setPlayerColor(color);
    
    // Create or update player with wallet address and other details
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      walletAddress: crypto.randomUUID(), // This should be replaced with actual wallet address
      name,
      color,
      size: 30,
      x: 0,
      y: 0,
      isAlive: true,
      isReady: false,
      joinedAt: new Date().toISOString()
    };
    
    setPlayer(newPlayer);
  };

  const refreshRooms = useCallback(async () => {
    try {
      const fetchedRooms = await gameRoomService.getAllRooms();
      setRooms(fetchedRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast({
        title: "Error",
        description: "Failed to fetch rooms. Please try again.",
        variant: "destructive",
      });
    }
  }, [setRooms, toast]);

  const refreshCurrentRoom = useCallback(async () => {
    if (currentRoom && currentRoom.id) {
      try {
        const room = await gameRoomService.getRoom(currentRoom.id);
        if (room) {
          setCurrentRoom(room);
        } else {
          setCurrentRoom(null);
        }
      } catch (error) {
        console.error("Error fetching current room:", error);
        setCurrentRoom(null);
        toast({
          title: "Error",
          description: "Failed to refresh current room. You may have been disconnected.",
          variant: "destructive",
        });
      }
    }
  }, [currentRoom, setCurrentRoom, toast]);

  useEffect(() => {
    // Initial fetch of rooms on component mount
    refreshRooms();
  }, [refreshRooms]);

  useEffect(() => {
    // Refresh current room on component mount
    refreshCurrentRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playerName) {
      const newName = generateName();
      setPlayerName(newName);
    }
  }, [setPlayerName, playerName]);

  const createRoom = async (params: { name: string; maxPlayers: number; gameMode?: GameMode }): Promise<string> => {
    if (!player) {
      throw new Error("Player must be set before creating a room");
    }

    try {
      console.log("Creating room with params:", params);
      const newRoom = await gameRoomService.createRoom(params.name, params.maxPlayers, params.gameMode || 'classic');
      
      // Return the room ID, not the entire room object
      const roomId = newRoom.id;
      
      // Join the room after creating it
      await joinRoom(roomId);
      
      return roomId;
    } catch (error) {
      console.error("Error creating room:", error);
      throw error;
    }
  };

  const joinRoom = async (roomId: string): Promise<void> => {
    if (!player) {
      throw new Error("Player must be set before joining a room");
    }

    try {
      await gameRoomService.joinRoom(roomId, player.id);
      const room = await gameRoomService.getRoom(roomId);

      if (room) {
        setCurrentRoom(room);
        toast({
          title: "Joined Room",
          description: `Successfully joined room: ${room.name}`,
        });
        // Manually trigger navigation after joining the room
        navigate(`/lobby`);
      } else {
        throw new Error("Room not found after joining");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      toast({
        title: "Error",
        description: "Failed to join room. Please try again.",
        variant: "destructive",
      });
    }
  };

  const leaveRoom = async (): Promise<void> => {
    if (!player || !currentRoom) {
      console.log("No room to leave or player not set");
      return;
    }

    try {
      await gameRoomService.leaveRoom(currentRoom.id, player.id);
      setCurrentRoom(null);
      toast({
        title: "Left Room",
        description: `Successfully left room: ${currentRoom.name}`,
      });
      navigate("/lobby"); // Redirect to lobby after leaving
    } catch (error) {
      console.error("Error leaving room:", error);
      toast({
        title: "Error",
        description: "Failed to leave room. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startGame = async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentRoom) {
      return { success: false, error: "No current room" };
    }

    try {
      await gameRoomService.startGame(currentRoom.id);
      // Optimistically update the local state
      setCurrentRoom((prevRoom) => {
        if (prevRoom) {
          return { ...prevRoom, status: "playing" };
        }
        return prevRoom;
      });
      return { success: true };
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Error",
        description: "Failed to start game. Please try again.",
        variant: "destructive",
      });
      return { success: false, error: "Failed to start game" };
    }
  };

  const setPlayerReady = async (isReady: boolean): Promise<void> => {
    if (!player || !currentRoom) {
      console.warn("No player or current room to set ready status");
      return;
    }

    try {
      await gameRoomService.setPlayerReady(currentRoom.id, player.id, isReady);
      // Optimistically update the local state
      setCurrentRoom((prevRoom) => {
        if (prevRoom && prevRoom.players) {
          const updatedPlayers = prevRoom.players.map((p) =>
            p.id === player.id ? { ...p, isReady } : p
          );
          return { ...prevRoom, players: updatedPlayers };
        }
        return prevRoom;
      });
    } catch (error) {
      console.error("Error setting player ready:", error);
      toast({
        title: "Error",
        description: "Failed to set player ready status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const contextValue: GameContextType = {
    player,
    setPlayer,
    playerName,
    setPlayerName,
    playerColor,
    setPlayerColor,
    customPhrases,
    setCustomPhrases,
    rooms,
    currentRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    setPlayerReady,
    refreshRooms,
    refreshCurrentRoom,
    resetGame,
    setPlayerDetails,
  };

  return (
    <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
  );
};

// Export alias for compatibility
export const GameProvider = GameContextProvider;

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameContextProvider");
  }
  return context;
};
