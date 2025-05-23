import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { Player, PlayerColor, GameRoom } from "@/types/game";
import { useToast } from "@/hooks/use-toast";

// Default custom phrases
const defaultPhrases: string[] = [
  "{playerName} s'est fait éliminer !",
  "{playerName} a été mangé !",
  "{playerName} a rejoint le paradis des blobs !",
  "On ne verra plus {playerName} de sitôt !",
  "{playerName} a disparu de la carte !",
  "Adieu {playerName} !",
  "{playerName} n'était pas assez gros !",
  "{playerName} a servi de goûter !",
  "Le blob {playerName} est maintenant digéré !",
  "{playerName} est hors-jeu !"
];

interface GameContextType {
  player: Player | null;
  setPlayerDetails: (name: string, color: PlayerColor) => Promise<void>;
  rooms: GameRoom[];
  createRoom: (roomName: string, maxPlayers: number) => Promise<string>;
  joinRoom: (roomId: string) => Promise<void>;
  currentRoom: GameRoom | null;
  startGame: () => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  setPlayerReady: (ready: boolean) => Promise<void>;
  socket: Socket | null;
  refreshCurrentRoom: () => Promise<void>;
  // Simplified phrases property
  customPhrases: string[];
  setCustomPhrases: (phrases: string[] | ((prev: string[]) => string[])) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: React.ReactNode;
}

const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [player, setPlayer] = useState<Player | null>(() => {
    const storedPlayer = localStorage.getItem("blob-battle-player");
    return storedPlayer ? JSON.parse(storedPlayer) : null;
  });
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(() => {
    const storedRoom = localStorage.getItem("blob-battle-current-room");
    return storedRoom ? JSON.parse(storedRoom) : null;
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  // Simplified phrases state
  const [customPhrases, setCustomPhrases] = useState<string[]>(() => {
    const storedPhrases = localStorage.getItem("blob-battle-custom-phrases");
    return storedPhrases ? JSON.parse(storedPhrases) : defaultPhrases;
  });
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const backendURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  // Save custom phrases to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("blob-battle-custom-phrases", JSON.stringify(customPhrases));
  }, [customPhrases]);

  useEffect(() => {
    const newSocket = io(backendURL);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    newSocket.on("gameRoomsUpdate", (updatedRooms: GameRoom[]) => {
      console.log("Rooms updated from server:", updatedRooms.length);
      setRooms(updatedRooms);
    });

    newSocket.on("roomJoined", (room: GameRoom) => {
      setCurrentRoom(room);
      localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
      
      // Store the game state in local storage
      localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
    });
    
    newSocket.on("roomLeft", () => {
      setCurrentRoom(null);
      localStorage.removeItem("blob-battle-current-room");
      localStorage.removeItem('blob-battle-game-state');
    });

    newSocket.on("gameStarted", (room: GameRoom) => {
      console.log("Game started in room:", room.id);
      
      // Store the game state in local storage
      localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
      
      // Navigate to the game page only if not in local mode
      if (!window.location.href.includes('local=true')) {
        navigate("/game?join=true");
      }
    });
    
    newSocket.on("playerReadyStatus", (room: GameRoom) => {
      console.log("Player ready status updated in room:", room.id);
      setCurrentRoom(room);
      localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
      
      // Store the game state in local storage
      localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
    });
    
    newSocket.on("roomUpdate", (room: GameRoom) => {
      console.log("Room updated:", room.id);
      setCurrentRoom(room);
      localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
      
      // Store the game state in local storage
      localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    return () => {
      newSocket.off("connect");
      newSocket.off("gameRoomsUpdate");
      newSocket.off("roomJoined");
      newSocket.off("roomLeft");
      newSocket.off("gameStarted");
      newSocket.off("playerReadyStatus");
      newSocket.off("roomUpdate");
      newSocket.off("disconnect");
      newSocket.disconnect();
    };
  }, [navigate, backendURL]);

  const setPlayerDetails = useCallback(
    async (name: string, color: PlayerColor) => {
      if (!socket) {
        console.error("Socket not initialized");
        return;
      }

      const newPlayer: Player = {
        id: uuidv4(),
        name: name,
        color: color,
        size: 20,
        x: 0,
        y: 0,
        isAlive: true,
      };

      setPlayer(newPlayer);
      localStorage.setItem("blob-battle-player", JSON.stringify(newPlayer));

      // Emit event to create player on the server
      socket.emit("createPlayer", newPlayer);
    },
    [socket]
  );

  const createRoom = useCallback(
    async (roomName: string, maxPlayers: number) => {
      if (!socket || !player) {
        console.error("Socket or player not initialized");
        return "";
      }

      const roomId = uuidv4();
      
      // Ensure maxPlayers is at least 2
      const adjustedMaxPlayers = Math.max(2, maxPlayers);

      const newRoom: GameRoom = {
        id: roomId,
        name: roomName,
        maxPlayers: adjustedMaxPlayers,
        status: 'waiting',
        players: [],
        createdAt: new Date().toISOString(), // Ajout de la propriété manquante
      };

      // Emit event to create room on the server
      socket.emit("createGameRoom", newRoom);
      return roomId;
    },
    [socket, player]
  );

  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!socket || !player) {
        console.error("Socket or player not initialized");
        return;
      }

      socket.emit("joinGameRoom", { roomId, player });
    },
    [socket, player]
  );

  const startGame = useCallback(async () => {
    if (!socket || !currentRoom) {
      console.error("Socket or currentRoom not initialized");
      return false;
    }
    
    return new Promise<boolean>((resolve) => {
      socket.emit("startGame", currentRoom.id, (success: boolean) => {
        if (success) {
          console.log("Game started successfully on server");
          
          // Optimistically update local state
          setCurrentRoom(prevRoom => {
            if (prevRoom) {
              return { ...prevRoom, status: 'playing' };
            }
            return prevRoom;
          });
          
          resolve(true);
        } else {
          console.error("Failed to start game on server");
          resolve(false);
        }
      });
    });
  }, [socket, currentRoom]);

  const leaveRoom = useCallback(async () => {
    if (!socket || !player || !currentRoom) {
      console.error("Socket, player, or currentRoom not initialized");
      return;
    }
    
    socket.emit("leaveGameRoom", { roomId: currentRoom.id, playerId: player.id });
  }, [socket, player, currentRoom]);

  const setPlayerReady = useCallback(
    async (ready: boolean) => {
      if (!socket || !player || !currentRoom) {
        console.error("Socket, player, or currentRoom not initialized");
        return;
      }

      socket.emit("setPlayerReady", {
        roomId: currentRoom.id,
        playerId: player.id,
        ready: ready,
      });
    },
    [socket, player, currentRoom]
  );
  
  const refreshCurrentRoom = useCallback(async () => {
    if (!socket) {
      console.warn("Socket not initialized, skipping refresh");
      return;
    }
    
    // Demander la liste de toutes les salles disponibles
    socket.emit("getGameRooms", (allRooms: GameRoom[]) => {
      if (allRooms && Array.isArray(allRooms)) {
        console.log("Refreshed all rooms:", allRooms.length);
        setRooms(allRooms);
      }
    });
    
    // Si nous sommes dans une salle, obtenir également les détails de cette salle
    if (currentRoom) {
      socket.emit("getGameRoom", currentRoom.id, (updatedRoom: GameRoom | null) => {
        if (updatedRoom) {
          console.log("Refreshed current room:", updatedRoom.id);
          setCurrentRoom(updatedRoom);
          localStorage.setItem("blob-battle-current-room", JSON.stringify(updatedRoom));
          
          // Store the game state in local storage
          localStorage.setItem('blob-battle-game-state', JSON.stringify(updatedRoom));
        } else {
          console.warn("Room not found, clearing current room");
          setCurrentRoom(null);
          localStorage.removeItem("blob-battle-current-room");
          localStorage.removeItem('blob-battle-game-state');
        }
      });
    }
  }, [socket, currentRoom]);

  return (
    <GameContext.Provider
      value={{
        player,
        setPlayerDetails,
        rooms,
        createRoom,
        joinRoom,
        currentRoom,
        startGame,
        leaveRoom,
        setPlayerReady,
        socket,
        refreshCurrentRoom,
        // Simplified phrases properties
        customPhrases,
        setCustomPhrases,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

export { GameProvider, useGame, defaultPhrases };
