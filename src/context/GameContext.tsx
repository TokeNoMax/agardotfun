import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Player, GameRoom, PlayerColor } from '@/types/game';
import { generateName } from '@/utils/nameGenerator';
import { generateColor } from '@/utils/colorGenerator';
import { gameRoomService } from '@/services/gameRoomService';
import { useToast } from '@/hooks/use-toast';

interface GameContextType {
  player: Player | null;
  currentRoom: GameRoom | null;
  customPhrases: string[];
  setCustomPhrases: (phrases: string[]) => void;
  setPlayerDetails: (name: string, color: PlayerColor) => void;
  createRoom: (name: string, maxPlayers: number) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  refreshCurrentRoom: () => Promise<void>;
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
  const [customPhrases, setCustomPhrases] = useState<string[]>([...defaultPhrases]);
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

  const createRoom = async (name: string, maxPlayers: number) => {
    try {
      const newRoom = await gameRoomService.createRoom(name, maxPlayers);
      setCurrentRoom(newRoom);
      localStorage.setItem('agar3-fun-current-room', JSON.stringify(newRoom));
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

  const leaveRoom = async () => {
    if (!player || !currentRoom) {
      return;
    }

    try {
      await gameRoomService.leaveRoom(currentRoom.id, player.id);
      setCurrentRoom(null);
      localStorage.removeItem('agar3-fun-current-room');
      toast({
        title: "Salle quittée",
        description: "Vous avez quitté la salle.",
      });
    } catch (error) {
      console.error("Error leaving room:", error);
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

    try {
      await gameRoomService.setPlayerReady(currentRoom.id, player.id, ready);
      // Optimistically update the player's ready state
      setPlayer(prevPlayer => {
        if (prevPlayer) {
          return { ...prevPlayer, isReady: ready };
        }
        return prevPlayer;
      });
      // Refresh the room to get the updated player list
      await refreshCurrentRoom();
    } catch (error) {
      console.error("Error setting player ready:", error);
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
    customPhrases,
    setCustomPhrases,
    setPlayerDetails,
    createRoom,
    joinRoom,
    leaveRoom,
    refreshCurrentRoom,
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
