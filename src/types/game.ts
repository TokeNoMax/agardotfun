
export interface Player {
  id: string;
  walletAddress: string;
  name: string;
  color: string;
  size: number;
  x: number;
  y: number;
  isAlive: boolean;
  isReady?: boolean;
  velocityX?: number;
  velocityY?: number;
  lastPositionUpdate?: string;
}

export interface GameRoom {
  id: string;
  name: string;
  maxPlayers: number;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  createdAt: string;
  lastActivity: string;
  matchNumber: number; // Added match number
  gameSeed?: string;
  gameState?: any;
}

export interface SafeZone {
  x: number;
  y: number;
  radius: number;
  nextShrinkTime: number;
  shrinkDuration: number;
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
