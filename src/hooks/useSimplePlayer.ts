
import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { generateColor } from '@/utils/colorGenerator';
import { PlayerColor } from '@/types/game';

interface SimplePlayer {
  name: string;
  color: PlayerColor;
  walletAddress?: string;
}

export const useSimplePlayer = () => {
  const { publicKey } = useWallet();
  const [player, setPlayer] = useState<SimplePlayer | null>(null);

  useEffect(() => {
    // Load player from localStorage
    const savedPlayer = localStorage.getItem('agar-player');
    if (savedPlayer) {
      try {
        const parsed = JSON.parse(savedPlayer);
        setPlayer(parsed);
      } catch (error) {
        console.error('Error parsing saved player:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Create or update player when wallet connects
    if (publicKey) {
      const walletAddress = publicKey.toString();
      
      if (!player || player.walletAddress !== walletAddress) {
        const newPlayer: SimplePlayer = {
          name: player?.name || `Player_${walletAddress.slice(0, 4)}`,
          color: player?.color || generateColor(),
          walletAddress
        };
        setPlayer(newPlayer);
      }
    }
  }, [publicKey, player]);

  useEffect(() => {
    // Save player to localStorage whenever it changes
    if (player) {
      localStorage.setItem('agar-player', JSON.stringify(player));
    }
  }, [player]);

  const updatePlayer = (updates: Partial<SimplePlayer>) => {
    if (player) {
      const updatedPlayer = { ...player, ...updates };
      setPlayer(updatedPlayer);
    }
  };

  const createGuestPlayer = () => {
    const guestPlayer: SimplePlayer = {
      name: `Guest_${Math.random().toString(36).substr(2, 4)}`,
      color: generateColor()
    };
    setPlayer(guestPlayer);
    return guestPlayer;
  };

  return {
    player,
    updatePlayer,
    createGuestPlayer,
    hasWallet: !!publicKey,
    isConnected: !!publicKey
  };
};
