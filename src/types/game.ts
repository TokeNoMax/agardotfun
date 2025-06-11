export interface Player {
  id: string;
  walletAddress: string;
  name: string;
  color: PlayerColor;
  size: number;
  x: number;
  y: number;
  isAlive: boolean;
  isReady?: boolean;
  velocityX?: number;
  velocityY?: number;
  lastPositionUpdate?: string;
  nftImageUrl?: string;
}

export type GameMode = 'classic' | 'battle_royale';

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  classic: 'CLASSIC_MODE',
  battle_royale: 'BATTLE_ROYALE'
};

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  classic: 'Mode classique sans contraintes temporelles',
  battle_royale: 'Zone de combat qui rétrécit toutes les 2 minutes'
};

export interface GameRoom {
  id: string;
  name: string;
  maxPlayers: number;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  createdAt: string;
  lastActivity: string;
  matchNumber: number;
  gameSeed?: string;
  gameState?: any;
  gameMode?: GameMode;
}

export interface SafeZone {
  x: number;
  y: number;
  radius: number;
  currentRadius: number;
  maxRadius: number;
  nextShrinkTime: number;
  shrinkDuration: number;
  isActive: boolean;
  shrinkInterval: number;
  damagePerSecond: number;
  shrinkPercentage: number;
}

export interface GameFood {
  id: string;
  x: number;
  y: number;
  type: 'normal' | 'big';
  value: number;
}

export interface GameObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: 'rug';
}

export interface GameMap {
  width: number;
  height: number;
  food: GameFood[];
  obstacles: GameObstacle[];
  safeZone?: SafeZone;
}

// Additional types used in components
export interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
}

export interface Rug {
  id: string;
  x: number;
  y: number;
  size: number;
}

export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'orange' | 'cyan' | 'pink';
