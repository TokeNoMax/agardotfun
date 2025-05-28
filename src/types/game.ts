
// Types pour le jeu Blob Battle

// Types pour les joueurs
export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'orange' | 'cyan' | 'pink';

export interface Player {
  id: string; // This will be the wallet address
  walletAddress: string; // Solana wallet address
  name: string;
  color: PlayerColor;
  size: number;
  x: number;
  y: number;
  isAlive: boolean;
  ready?: boolean;
  nftImageUrl?: string; // URL of the NFT image to display on the blob
}

// Simple interface for NFT selection
export interface PlayerNFT {
  id: string;
  name: string;
  imageUrl: string;
  walletAddress: string;
}

// Types pour la nourriture
export interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
}

// Types pour les obstacles/rugs
export interface Rug {
  id: string;
  x: number;
  y: number;
  size: number;
}

// Types pour la zone safe
export interface SafeZone {
  x: number;
  y: number;
  currentRadius: number;
  maxRadius: number;
  nextShrinkTime: number;
  isActive: boolean;
  shrinkInterval: number; // milliseconds
  damagePerSecond: number;
  shrinkPercentage: number; // 0.2 = 20%
}

// Types pour les salles de jeu
export interface GameRoom {
  id: string;
  name: string;
  maxPlayers: number;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  createdAt: string; // Timestamp au format ISO
  updatedAt?: string; // Timestamp au format ISO, optionnel
}
