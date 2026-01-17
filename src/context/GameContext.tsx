import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Player, GameRoom, PlayerColor, GameMode } from '@/types/game';
import { generateName } from '@/utils/nameGenerator';
import { generateColor } from '@/utils/colorGenerator';
import { gameRoomService } from '@/services/gameRoomService';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface GameContextType {
  player: Player | null;
  currentRoom: GameRoom | null;
  rooms: GameRoom[];
  customPhrases: string[];
  debugMode: boolean;
  setCustomPhrases: (phrases: string[]) => void;
  setDebugMode: (enabled: boolean) => void;
  setPlayerDetails: (name: string, color: PlayerColor) => void;
  createRoom: (name: string, maxPlayers: number, gameMode?: GameMode) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  joinGame: () => void;
  leaveRoom: () => Promise<void>;
  refreshCurrentRoom: () => Promise<void>;
  refreshRooms: () => Promise<void>;
  setPlayerReady: (ready: boolean) => Promise<void>;
  startGame: () => Promise<void>;
}

interface GameContextProps {
  children: ReactNode;
}

const defaultPhrases = [
  "{playerName} s'est fait PLS !",
  "{playerName} a goûté au REKT !",
  "{playerName} est retourné au menu...",
  "RIP {playerName} 💀",
  "{playerName} est parti en PLS !",
  "{playerName} à mangé le RUG PULL !",
  "{playerName} à fait un ALL IN perdant !",
  "{playerName} s'est fait LIQUIDATED !",
  "{playerName} à raté le TAKE PROFIT !",
  "{playerName} est devenu un BAG HOLDER !"
];

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<GameContextProps> = ({ children }) => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [customPhrases, setCustomPhrases] = useState<string[]>([...defaultPhrases]);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const { toast } = useToast();
  const { publicKey } = useWallet();

  // Load saved player from localStorage on mount
  useEffect(() => {
    const savedPlayer = localStorage.getItem('agar3-fun-player');
    if (savedPlayer) {
      try {
        const parsedPlayer = JSON.parse(savedPlayer);
        setPlayer(parsedPlayer);
      } catch (error) {
        console.error('Error parsing saved player:', error);
        localStorage.removeItem('agar3-fun-player');
      }
    }

    const savedPhrases = localStorage.getItem('agar3-fun-custom-phrases');
    if (savedPhrases) {
      try {
        const parsedPhrases = JSON.parse(savedPhrases);
        setCustomPhrases(parsedPhrases);
      } catch (error) {
        console.error('Error parsing saved phrases:', error);
      }
    }

    const savedDebugMode = localStorage.getItem('agar3-fun-debug-mode');
    if (savedDebugMode) {
      try {
        setDebugMode(JSON.parse(savedDebugMode));
      } catch (error) {
        console.error('Error parsing saved debug mode:', error);
      }
    }

    const savedRoom = localStorage.getItem('agar3-fun-current-room');
    if (savedRoom) {
      try {
        const parsedRoom = JSON.parse(savedRoom);
        setCurrentRoom(parsedRoom);
      } catch (error) {
        console.error('Error parsing saved room:', error);
        localStorage.removeItem('agar3-fun-current-room');
      }
    }

    // Load available rooms on mount
    refreshRooms();
  }, []);

  // Save player to localStorage whenever it changes
  useEffect(() => {
    if (player) {
      localStorage.setItem('agar3-fun-player', JSON.stringify(player));
    } else {
      localStorage.removeItem('agar3-fun-player');
    }
  }, [player]);

  // Save custom phrases to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('agar3-fun-custom-phrases', JSON.stringify(customPhrases));
  }, [customPhrases]);

  // Save debug mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('agar3-fun-debug-mode', JSON.stringify(debugMode));
  }, [debugMode]);

  // Save current room to localStorage whenever it changes
  useEffect(() => {
    if (currentRoom) {
      localStorage.setItem('agar3-fun-current-room', JSON.stringify(currentRoom));
    } else {
      localStorage.removeItem('agar3-fun-current-room');
    }
  }, [currentRoom]);

  const setPlayerDetails = (name: string, color: PlayerColor) => {
    const walletAddress = publicKey?.toBase58() || '';
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      walletAddress,
      name,
      color,
      x: 50,
      y: 50,
      size: 20,
      isAlive: true,
      isReady: false
    };
    setPlayer(newPlayer);
  };

  const refreshRooms = async () => {
    try {
      const availableRooms = await gameRoomService.getAllRooms();
      setRooms(availableRooms);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      setRooms([]);
    }
  };

  const createRoom = async (name: string, maxPlayers: number, gameMode: GameMode = 'classic') => {
    try {
      const newRoom = await gameRoomService.createRoom(name, maxPlayers, gameMode);
      setCurrentRoom(newRoom);
      localStorage.setItem('agar3-fun-current-room', JSON.stringify(newRoom));
      await refreshRooms(); // Refresh rooms list
      toast({
        title: "Salle créée !",
        description: `La salle ${newRoom.name} a été créée avec succès.`,
      });
    } catch (error) {
      console.error("Error creating room:", error);
      toast({
        title: "Erreur de création",
        description: "Impossible de créer la salle. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const joinRoom = async (roomId: string) => {
    // Vérifier que le wallet est connecté
    if (!publicKey) {
      toast({
        title: "Wallet non connecté",
        description: "Veuillez connecter votre wallet Solana pour rejoindre une salle.",
        variant: "destructive",
      });
      return;
    }

    // Vérifier que le joueur est configuré
    if (!player) {
      toast({
        title: "Erreur de joueur",
        description: "Veuillez configurer votre joueur avant de rejoindre une salle.",
        variant: "destructive",
      });
      return;
    }

    // Assurer que le joueur a l'adresse wallet correcte
    const playerWithWallet = {
      ...player,
      walletAddress: publicKey.toBase58()
    };

    try {
      const joinedRoom = await gameRoomService.joinRoom(roomId, playerWithWallet);
      setCurrentRoom(joinedRoom);
      localStorage.setItem('agar3-fun-current-room', JSON.stringify(joinedRoom));
      await refreshRooms(); // Refresh rooms list
      toast({
        title: "Salle rejointe !",
        description: `Vous avez rejoint la salle ${joinedRoom.name}.`,
      });
    } catch (error: any) {
      console.error("Error joining room:", error);
      toast({
        title: "Erreur de connexion",
        description: error?.message || "Impossible de rejoindre la salle. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const joinGame = () => {
    if (currentRoom?.status === 'playing') {
      // Use window.location instead of navigate since we don't have access to it here
      if (currentRoom?.id) {
        window.location.href = `/game/${currentRoom.id}`;
      } else {
        window.location.href = '/game';
      }
    } else {
      toast({
        title: "PARTIE_NON_DISPONIBLE",
        description: "La partie n'a pas encore commencé",
        variant: "destructive"
      });
    }
  };

  const leaveRoom = async () => {
    if (!player || !currentRoom) {
      return;
    }

    try {
      // Utiliser l'adresse wallet comme ID principal pour leaveRoom (cohérence)
      const playerIdForLeave = player.walletAddress || player.id;
      console.log("CONTEXT - leaveRoom using player ID:", playerIdForLeave);
      console.log("CONTEXT - Player details:", {
        name: player.name,
        id: player.id,
        walletAddress: player.walletAddress
      });
      
      await gameRoomService.leaveRoom(currentRoom.id, playerIdForLeave);
      setCurrentRoom(null);
      localStorage.removeItem('agar3-fun-current-room');
      await refreshRooms(); // Refresh rooms list
      toast({
        title: "Salle quittée",
        description: "Vous avez quitté la salle.",
      });
    } catch (error) {
      console.error("CONTEXT - Error leaving room:", error);
      toast({
        title: "Erreur",
        description: "Impossible de quitter la salle. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const refreshCurrentRoom = async () => {
    if (!currentRoom) {
      return;
    }

    try {
      const refreshedRoom = await gameRoomService.getRoom(currentRoom.id);
      setCurrentRoom(refreshedRoom);
      localStorage.setItem('agar3-fun-current-room', JSON.stringify(refreshedRoom));
    } catch (error) {
      console.error("Error refreshing room:", error);
      localStorage.removeItem('agar3-fun-current-room');
      setCurrentRoom(null);
      toast({
        title: "Erreur de synchronisation",
        description: "Impossible de synchroniser la salle. Vous avez peut-être été déconnecté.",
        variant: "destructive",
      });
    }
  };

  const setPlayerReady = async (ready: boolean) => {
    if (!player || !currentRoom) {
      toast({
        title: "Erreur",
        description: "Impossible de changer l'état de préparation. Veuillez rejoindre une salle et configurer votre joueur.",
        variant: "destructive",
      });
      return;
    }

    console.log("CONTEXT - setPlayerReady called with ready:", ready);
    console.log("CONTEXT - Player details:", {
      name: player.name,
      id: player.id,
      walletAddress: player.walletAddress
    });
    console.log("CONTEXT - Current room:", currentRoom.id);

    try {
      // Utiliser l'adresse wallet comme ID principal pour setPlayerReady
      const playerIdForReady = player.walletAddress || player.id;
      console.log("CONTEXT - Using player ID for ready:", playerIdForReady);
      
      await gameRoomService.setPlayerReady(currentRoom.id, playerIdForReady, ready);
      
      console.log("CONTEXT - setPlayerReady API call successful");
      
      // Optimistically update the player's ready state
      setPlayer(prevPlayer => {
        if (prevPlayer) {
          const updatedPlayer = { ...prevPlayer, isReady: ready };
          console.log("CONTEXT - Updated local player ready state:", updatedPlayer);
          return updatedPlayer;
        }
        return prevPlayer;
      });
      
      // Refresh the room to get the updated player list
      await refreshCurrentRoom();
      await refreshRooms(); // Also refresh rooms list
      
      console.log("CONTEXT - Room refresh completed");
    } catch (error) {
      console.error("CONTEXT - Error setting player ready:", error);
      toast({
        title: "Erreur",
        description: "Impossible de changer l'état de préparation. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const startGame = async () => {
    if (!currentRoom) {
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la partie. Veuillez rejoindre une salle.",
        variant: "destructive",
      });
      return;
    }

    try {
      await gameRoomService.startGame(currentRoom.id);
      await refreshCurrentRoom(); // Refresh current room
      await refreshRooms(); // Refresh rooms list
      toast({
        title: "Partie lancée !",
        description: "La partie a été lancée avec succès.",
      });
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la partie. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const value: GameContextType = {
    player,
    currentRoom,
    rooms,
    customPhrases,
    debugMode,
    setCustomPhrases,
    setDebugMode,
    setPlayerDetails,
    createRoom,
    joinRoom,
    joinGame,
    leaveRoom,
    refreshCurrentRoom,
    refreshRooms,
    setPlayerReady,
    startGame
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export { defaultPhrases };
