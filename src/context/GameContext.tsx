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
      
      // Assurons-nous de traiter les salles uniquement si c'est un tableau valide
      if (Array.isArray(updatedRooms)) {
        // Log les détails des salles à des fins de débogage
        updatedRooms.forEach(room => {
          console.log(`Room: ${room.id} - ${room.name} - Status: ${room.status} - Players: ${room.players?.length || 0}/${room.maxPlayers}`);
        });
        
        setRooms(updatedRooms);
      } else {
        console.error("Received invalid rooms data:", updatedRooms);
      }
    });

    newSocket.on("roomJoined", (room: GameRoom) => {
      console.log("Room joined:", room);
      setCurrentRoom(room);
      localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
      
      // Store the game state in local storage
      localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
    });
    
    newSocket.on("roomLeft", () => {
      console.log("Room left");
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
        console.error("Socket ou player non initialisé");
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
        createdAt: new Date().toISOString(),
      };

      console.log("Création d'une nouvelle salle:", JSON.stringify(newRoom, null, 2));
      
      return new Promise<string>((resolve) => {
        // Définir un timeout pour la résolution après 5 secondes si pas de réponse du serveur
        const timeoutId = setTimeout(() => {
          console.warn("Timeout lors de la création de salle après 5 secondes, on renvoie l'ID quand même");
          resolve(roomId);
        }, 5000);
        
        // Emit event to create room on the server
        socket.emit("createGameRoom", newRoom, (success: boolean) => {
          clearTimeout(timeoutId); // Annuler le timeout
        
          if (success) {
            console.log("Salle créée avec succès sur le serveur:", roomId);
            
            // Demander immédiatement une mise à jour des salles
            socket.emit("getGameRooms", (allRooms: GameRoom[]) => {
              if (allRooms && Array.isArray(allRooms)) {
                console.log("Salles actualisées après création:", allRooms.length);
                setRooms(allRooms);
              }
            });
            
            resolve(roomId);
          } else {
            console.error("Échec de la création de salle sur le serveur");
            resolve(""); // Retourner une chaîne vide en cas d'échec
          }
        });
      });
    },
    [socket, player]
  );

  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!socket || !player) {
        console.error("Socket ou player non initialisé");
        return;
      }

      console.log(`Tentative de rejoindre la salle: ${roomId}`);
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
      console.warn("Socket non initialisé, rafraîchissement ignoré");
      return;
    }
    
    console.log("Début du rafraîchissement des salles");
    
    return new Promise<void>((resolve) => {
      // Définir un timeout si le serveur ne répond pas après 4 secondes
      const timeoutId = setTimeout(() => {
        console.warn("Timeout lors du rafraîchissement des salles");
        resolve();
      }, 4000);
      
      // Demander la liste de toutes les salles disponibles avec un callback
      socket.emit("getGameRooms", (allRooms: GameRoom[]) => {
        clearTimeout(timeoutId); // Annuler le timeout
        
        if (allRooms && Array.isArray(allRooms)) {
          console.log("Salles rafraîchies:", allRooms.length, 
            "IDs:", allRooms.map(r => `${r.id.substring(0, 6)}... (${r.name})`).join(', '));
          
          setRooms(allRooms);
          
          // Si nous sommes dans une salle, vérifier si elle existe toujours dans la liste
          if (currentRoom) {
            const updatedCurrentRoom = allRooms.find(r => r.id === currentRoom.id);
            
            if (updatedCurrentRoom) {
              console.log("Salle actuelle trouvée dans les salles rafraîchies:", updatedCurrentRoom.id);
              setCurrentRoom(updatedCurrentRoom);
              localStorage.setItem("blob-battle-current-room", JSON.stringify(updatedCurrentRoom));
              localStorage.setItem('blob-battle-game-state', JSON.stringify(updatedCurrentRoom));
            } else {
              console.warn("Salle actuelle non trouvée dans les salles rafraîchies");
              // On ne nettoie pas automatiquement l'état, peut-être encore valide
            }
          }
        } else {
          console.warn("Données de salles invalides pendant le rafraîchissement:", allRooms);
        }
        
        resolve();
      });
    });
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
