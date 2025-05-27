
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { Player, PlayerColor, GameRoom } from "@/types/game";
import { useToast } from "@/hooks/use-toast";
import { gameRoomService } from "@/services/gameRoomService";
import { useGameRoomSubscriptions } from "@/hooks/useGameRoomSubscriptions";

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
  socket: null; // Maintenu pour compatibilité mais toujours null
  refreshCurrentRoom: () => Promise<void>;
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
  const [customPhrases, setCustomPhrases] = useState<string[]>(() => {
    const storedPhrases = localStorage.getItem("blob-battle-custom-phrases");
    return storedPhrases ? JSON.parse(storedPhrases) : defaultPhrases;
  });
  const [sessionVerified, setSessionVerified] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fonction pour nettoyer l'état local
  const clearLocalState = useCallback(() => {
    console.log("Clearing local state due to session mismatch");
    setCurrentRoom(null);
    localStorage.removeItem("blob-battle-current-room");
    localStorage.removeItem('blob-battle-game-state');
  }, []);

  // Vérification de session au démarrage
  useEffect(() => {
    const verifySession = async () => {
      if (!player || !currentRoom || sessionVerified) {
        setSessionVerified(true);
        return;
      }

      console.log("Verifying session for player", player.id, "in room", currentRoom.id);

      try {
        // Vérifier si la salle existe encore
        const roomExists = await gameRoomService.verifyRoomExists(currentRoom.id);
        if (!roomExists) {
          console.log("Room no longer exists, clearing local state");
          clearLocalState();
          toast({
            title: "Session expirée",
            description: "La salle que vous avez rejointe n'existe plus",
            variant: "destructive"
          });
          setSessionVerified(true);
          return;
        }

        // Vérifier si le joueur est toujours dans la salle
        const playerInRoom = await gameRoomService.verifyPlayerInRoom(currentRoom.id, player.id);
        if (!playerInRoom) {
          console.log("Player no longer in room, clearing local state");
          clearLocalState();
          toast({
            title: "Session expirée",
            description: "Vous avez été déconnecté de la salle",
            variant: "destructive"
          });
        } else {
          console.log("Session verified successfully");
        }
      } catch (error) {
        console.error("Error verifying session:", error);
        // En cas d'erreur, on garde l'état local mais on log l'erreur
      } finally {
        setSessionVerified(true);
      }
    };

    verifySession();
  }, [player, currentRoom, sessionVerified, clearLocalState, toast]);

  // Save custom phrases to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("blob-battle-custom-phrases", JSON.stringify(customPhrases));
  }, [customPhrases]);

  // Callbacks pour les subscriptions temps réel
  const handleRoomsUpdate = useCallback((updatedRooms: GameRoom[]) => {
    console.log("Rooms updated from Supabase:", updatedRooms.length);
    setRooms(updatedRooms);
  }, []);

  const handleRoomUpdate = useCallback((room: GameRoom) => {
    console.log("Current room updated:", room.id);
    setCurrentRoom(room);
    localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
    localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
  }, []);

  const handleGameStarted = useCallback((room: GameRoom) => {
    console.log("Game started in room:", room.id);
    localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
    
    if (!window.location.href.includes('local=true')) {
      navigate("/game?join=true");
    }
  }, [navigate]);

  // Utiliser les subscriptions temps réel
  const { refreshRooms, refreshCurrentRoom } = useGameRoomSubscriptions({
    onRoomsUpdate: handleRoomsUpdate,
    onRoomUpdate: handleRoomUpdate,
    onGameStarted: handleGameStarted,
    currentRoomId: currentRoom?.id
  });

  const setPlayerDetails = useCallback(
    async (name: string, color: PlayerColor) => {
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
      
      console.log("Player details set:", newPlayer);
    },
    []
  );

  const createRoom = useCallback(
    async (roomName: string, maxPlayers: number) => {
      if (!player) {
        console.error("Player not initialized");
        return "";
      }

      try {
        const adjustedMaxPlayers = Math.max(2, maxPlayers);
        console.log("Creating room:", roomName, "with max players:", adjustedMaxPlayers);
        
        const roomId = await gameRoomService.createRoom(roomName, adjustedMaxPlayers);
        
        // Actualiser la liste des salles
        await refreshRooms();
        
        return roomId;
      } catch (error) {
        console.error("Error creating room:", error);
        throw error;
      }
    },
    [player, refreshRooms]
  );

  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!player) {
        console.error("Player not initialized");
        return;
      }

      try {
        console.log(`Joining room: ${roomId}`);
        await gameRoomService.joinRoom(roomId, player);
        
        // Récupérer les détails de la salle mise à jour
        const room = await gameRoomService.getRoom(roomId);
        if (room) {
          setCurrentRoom(room);
          localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
          localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
          
          toast({
            title: "Salle rejointe",
            description: `Vous avez rejoint la salle "${room.name}"`
          });
        }
      } catch (error) {
        console.error("Error joining room:", error);
        toast({
          title: "Erreur",
          description: "Impossible de rejoindre la salle",
          variant: "destructive"
        });
        throw error;
      }
    },
    [player, toast]
  );

  const startGame = useCallback(async () => {
    if (!currentRoom) {
      console.error("No current room");
      return false;
    }
    
    try {
      console.log("Starting game for room:", currentRoom.id);
      await gameRoomService.startGame(currentRoom.id);
      return true;
    } catch (error) {
      console.error("Error starting game:", error);
      return false;
    }
  }, [currentRoom]);

  const leaveRoom = useCallback(async () => {
    if (!player || !currentRoom) {
      console.error("Player or currentRoom not initialized");
      return;
    }
    
    try {
      console.log("Leaving room:", currentRoom.id);
      await gameRoomService.leaveRoom(currentRoom.id, player.id);
      
      setCurrentRoom(null);
      localStorage.removeItem("blob-battle-current-room");
      localStorage.removeItem('blob-battle-game-state');
      
      toast({
        title: "Salle quittée",
        description: "Vous avez quitté la salle"
      });
    } catch (error) {
      console.error("Error leaving room:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la sortie de la salle",
        variant: "destructive"
      });
    }
  }, [player, currentRoom, toast]);

  const setPlayerReady = useCallback(
    async (ready: boolean) => {
      if (!player || !currentRoom) {
        console.error("Player or currentRoom not initialized");
        return;
      }

      try {
        console.log(`Setting player ready status to ${ready}`);
        await gameRoomService.setPlayerReady(currentRoom.id, player.id, ready);
      } catch (error) {
        console.error("Error setting player ready:", error);
        toast({
          title: "Erreur",
          description: "Impossible de mettre à jour le statut",
          variant: "destructive"
        });
      }
    },
    [player, currentRoom, toast]
  );

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
        socket: null, // Maintenu pour compatibilité
        refreshCurrentRoom,
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
