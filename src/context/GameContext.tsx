import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { Player, PlayerColor, GameRoom } from "@/types/game";
import { useToast } from "@/hooks/use-toast";
import { gameRoomService } from "@/services/gameRoomService";
import { useGameRoomSubscriptions } from "@/hooks/useGameRoomSubscriptions";
import { useWallet } from "@solana/wallet-adapter-react";

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
  setPlayerDetails: (name: string, color: PlayerColor, nftImageUrl?: string) => Promise<void>;
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
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { publicKey, connected } = useWallet();
  const isUnmountedRef = useRef(false);

  // Vérifier et corriger le joueur si l'adresse wallet est manquante
  useEffect(() => {
    if (player && (!player.walletAddress || player.walletAddress.trim() === '')) {
      console.log("Player has empty wallet address, clearing player data");
      setPlayer(null);
      localStorage.removeItem("blob-battle-player");
      if (!isLeavingRoom) {
        toast({
          title: "Configuration invalide",
          description: "Veuillez reconnecter votre wallet et reconfigurer votre joueur",
          variant: "destructive"
        });
      }
    }
  }, [player, toast, isLeavingRoom]);

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
      if (!player || !currentRoom || sessionVerified || isLeavingRoom) {
        setSessionVerified(true);
        return;
      }

      console.log("Verifying session for player", player.walletAddress, "in room", currentRoom.id);

      try {
        // Vérifier si la salle existe encore
        const roomExists = await gameRoomService.verifyRoomExists(currentRoom.id);
        if (!roomExists) {
          console.log("Room no longer exists, clearing local state");
          clearLocalState();
          if (!isLeavingRoom) {
            toast({
              title: "Session expirée",
              description: "La salle que vous avez rejointe n'existe plus",
              variant: "destructive"
            });
          }
          setSessionVerified(true);
          return;
        }

        // Vérifier si le joueur est toujours dans la salle
        const playerInRoom = await gameRoomService.verifyPlayerInRoom(currentRoom.id, player.walletAddress);
        if (!playerInRoom) {
          console.log("Player no longer in room, clearing local state");
          clearLocalState();
          if (!isLeavingRoom) {
            toast({
              title: "Session expirée",
              description: "Vous avez été déconnecté de la salle",
              variant: "destructive"
            });
          }
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
  }, [player, currentRoom, sessionVerified, clearLocalState, toast, isLeavingRoom]);

  // Save custom phrases to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("blob-battle-custom-phrases", JSON.stringify(customPhrases));
  }, [customPhrases]);

  // Callbacks pour les subscriptions temps réel
  const handleRoomsUpdate = useCallback((updatedRooms: GameRoom[]) => {
    if (isUnmountedRef.current || isLeavingRoom) return;
    console.log("Rooms updated from Supabase:", updatedRooms.length);
    setRooms(updatedRooms);
  }, [isLeavingRoom]);

  const handleRoomUpdate = useCallback((room: GameRoom) => {
    if (isUnmountedRef.current || isLeavingRoom) return;
    console.log("Current room updated:", room.id);
    setCurrentRoom(room);
    localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
    localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
  }, [isLeavingRoom]);

  const handleGameStarted = useCallback((room: GameRoom) => {
    if (isUnmountedRef.current || isLeavingRoom) return;
    console.log("Game started in room:", room.id);
    localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
    
    if (!window.location.href.includes('local=true')) {
      navigate("/game");
    }
  }, [navigate, isLeavingRoom]);

  // Utiliser les subscriptions temps réel
  const { refreshRooms, refreshCurrentRoom, cleanupSubscriptions } = useGameRoomSubscriptions({
    onRoomsUpdate: handleRoomsUpdate,
    onRoomUpdate: handleRoomUpdate,
    onGameStarted: handleGameStarted,
    currentRoomId: currentRoom?.id
  });

  const setPlayerDetails = useCallback(
    async (name: string, color: PlayerColor, nftImageUrl?: string) => {
      console.log("Setting player details - wallet connected:", connected, "publicKey:", publicKey?.toString());
      
      if (!connected || !publicKey) {
        console.error("Wallet not connected when setting player details");
        toast({
          title: "Erreur de connexion",
          description: "Votre wallet doit être connecté pour configurer votre joueur. Veuillez reconnecter votre wallet.",
          variant: "destructive"
        });
        throw new Error("Wallet not connected");
      }

      const walletAddress = publicKey.toString();
      
      if (!walletAddress || walletAddress.trim() === '') {
        console.error("Invalid wallet address when setting player details:", walletAddress);
        toast({
          title: "Erreur d'adresse",
          description: "Adresse wallet invalide. Veuillez reconnecter votre wallet.",
          variant: "destructive"
        });
        throw new Error("Invalid wallet address");
      }

      const newPlayer: Player = {
        id: walletAddress,
        walletAddress: walletAddress,
        name: name.trim(),
        color: color,
        size: 20,
        x: 0,
        y: 0,
        isAlive: true,
        nftImageUrl: nftImageUrl?.trim() || undefined
      };

      console.log("Creating player with validated wallet address:", {
        name: newPlayer.name,
        walletAddress: newPlayer.walletAddress,
        connected,
        publicKeyExists: !!publicKey
      });
      
      setPlayer(newPlayer);
      localStorage.setItem("blob-battle-player", JSON.stringify(newPlayer));
      
      console.log("Player details set successfully with wallet:", newPlayer.walletAddress);
      
      toast({
        title: "Joueur configuré",
        description: `Votre blob "${name}" a été configuré avec succès !`
      });
    },
    [connected, publicKey, toast]
  );

  const createRoom = useCallback(
    async (roomName: string, maxPlayers: number) => {
      if (!player) {
        console.error("Player not initialized");
        toast({
          title: "Erreur",
          description: "Veuillez d'abord configurer votre joueur",
          variant: "destructive"
        });
        throw new Error("Player not initialized");
      }

      if (!connected || !publicKey) {
        console.error("Wallet not connected");
        toast({
          title: "Erreur",
          description: "Votre wallet doit être connecté pour créer une salle",
          variant: "destructive"
        });
        throw new Error("Wallet not connected");
      }

      try {
        const adjustedMaxPlayers = Math.max(2, maxPlayers);
        console.log("Creating room:", roomName, "with max players:", adjustedMaxPlayers, "by player:", player.name);
        
        const roomId = await gameRoomService.createRoom(roomName, adjustedMaxPlayers);
        console.log("Room created with ID:", roomId);
        
        await refreshRooms();
        
        toast({
          title: "Salle créée",
          description: `La salle "${roomName}" a été créée avec succès`
        });
        
        return roomId;
      } catch (error) {
        console.error("Error creating room:", error);
        toast({
          title: "Erreur de création",
          description: error instanceof Error ? error.message : "Impossible de créer la salle",
          variant: "destructive"
        });
        throw error;
      }
    },
    [player, refreshRooms, connected, publicKey, toast]
  );

  const joinRoom = useCallback(
    async (roomId: string) => {
      console.log("Attempting to join room with player:", {
        playerExists: !!player,
        walletConnected: connected,
        publicKeyExists: !!publicKey,
        playerWalletAddress: player?.walletAddress
      });

      if (!player) {
        console.error("Player not initialized when joining room");
        toast({
          title: "Erreur de configuration",
          description: "Veuillez d'abord configurer votre joueur",
          variant: "destructive"
        });
        throw new Error("Player not initialized");
      }

      if (!connected || !publicKey) {
        console.error("Wallet not connected when joining room");
        toast({
          title: "Erreur de connexion",
          description: "Votre wallet doit être connecté pour rejoindre une salle. Veuillez reconnecter votre wallet.",
          variant: "destructive"
        });
        throw new Error("Wallet not connected");
      }

      if (!player.walletAddress || player.walletAddress.trim() === '') {
        console.error("Player has empty wallet address when joining room");
        toast({
          title: "Configuration invalide",
          description: "Votre configuration de joueur est invalide. Veuillez reconfigurer votre joueur.",
          variant: "destructive"
        });
        
        setPlayer(null);
        localStorage.removeItem("blob-battle-player");
        throw new Error("Invalid player configuration");
      }

      const currentWalletAddress = publicKey.toString();
      if (player.walletAddress !== currentWalletAddress) {
        console.error("Player wallet address mismatch:", {
          playerWallet: player.walletAddress,
          connectedWallet: currentWalletAddress
        });
        toast({
          title: "Adresse wallet différente",
          description: "L'adresse de votre wallet a changé. Veuillez reconfigurer votre joueur.",
          variant: "destructive"
        });
        
        setPlayer(null);
        localStorage.removeItem("blob-battle-player");
        throw new Error("Wallet address mismatch");
      }

      try {
        console.log(`Attempting to join room: ${roomId} with validated player:`, {
          name: player.name,
          walletAddress: player.walletAddress,
          id: player.id
        });
        
        await gameRoomService.joinRoom(roomId, player);
        console.log("Successfully joined room:", roomId);
        
        const room = await gameRoomService.getRoom(roomId);
        if (room) {
          setCurrentRoom(room);
          localStorage.setItem("blob-battle-current-room", JSON.stringify(room));
          localStorage.setItem('blob-battle-game-state', JSON.stringify(room));
          
          toast({
            title: "Salle rejointe",
            description: `Vous avez rejoint la salle "${room.name}"`
          });
          
          console.log("Room joined successfully, current players:", room.players?.length);
        } else {
          throw new Error("Impossible de récupérer les détails de la salle");
        }
      } catch (error) {
        console.error("Error joining room:", error);
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de rejoindre la salle",
          variant: "destructive"
        });
        throw error;
      }
    },
    [player, toast, connected, publicKey]
  );

  // Fonction startGame optimisée avec meilleure vérification
  const startGame = useCallback(async () => {
    if (!currentRoom) {
      console.error("No current room");
      return false;
    }
    
    try {
      console.log("Starting game for room:", currentRoom.id);
      await gameRoomService.startGame(currentRoom.id);
      
      // Mettre à jour l'état local immédiatement
      const updatedRoom = { ...currentRoom, status: 'playing' as const };
      setCurrentRoom(updatedRoom);
      localStorage.setItem("blob-battle-current-room", JSON.stringify(updatedRoom));
      localStorage.setItem('blob-battle-game-state', JSON.stringify(updatedRoom));
      
      console.log("Game started successfully, local state updated");
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
    
    setIsLeavingRoom(true);
    
    try {
      console.log("Leaving room:", currentRoom.id);
      
      cleanupSubscriptions();
      
      setCurrentRoom(null);
      localStorage.removeItem("blob-battle-current-room");
      localStorage.removeItem('blob-battle-game-state');
      
      await gameRoomService.leaveRoom(currentRoom.id, player.walletAddress);
      
      console.log("Room left successfully");
    } catch (error) {
      console.error("Error leaving room:", error);
    } finally {
      setIsLeavingRoom(false);
    }
  }, [player, currentRoom, cleanupSubscriptions]);

  const setPlayerReady = useCallback(
    async (ready: boolean) => {
      if (!player || !currentRoom) {
        console.error("Player or currentRoom not initialized");
        return;
      }

      try {
        console.log(`Setting player ready status to ${ready}`);
        await gameRoomService.setPlayerReady(currentRoom.id, player.walletAddress, ready);
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

  // Cleanup sur unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

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
