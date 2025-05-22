
export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'orange' | 'cyan' | 'pink';

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  size: number;
  x: number;
  y: number;
  isAlive: boolean;
  ready?: boolean;
}

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

export interface GameRoom {
  id: string;
  name: string;
  maxPlayers: number;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
}
