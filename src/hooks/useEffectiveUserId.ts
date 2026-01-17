import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useGame } from '@/context/GameContext';

export const useEffectiveUserId = () => {
  const { player } = useGame();
  const { publicKey } = useWallet();

  const effectiveUserId = useMemo(() => {
    // Priorité 1: Wallet connecté actuellement (source de vérité)
    if (publicKey) {
      return publicKey.toBase58();
    }
    // Priorité 2: walletAddress sauvegardé dans le player
    if (player?.walletAddress) {
      return player.walletAddress;
    }
    // Priorité 3: ID local (fallback)
    return player?.id || null;
  }, [publicKey, player?.walletAddress, player?.id]);

  // Source pour debug
  const source = useMemo(() => {
    if (publicKey) return 'wallet';
    if (player?.walletAddress) return 'savedWallet';
    return 'localId';
  }, [publicKey, player?.walletAddress]);

  return {
    effectiveUserId,
    source
  };
};
