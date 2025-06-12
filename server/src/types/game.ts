
export interface Player {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
  velocityX: number;
  velocityY: number;
  isAlive: boolean;
  lastInputSeq: number;
  inputBuffer: PlayerInput[];
}

export interface PlayerInput {
  seq: number;
  timestamp: number;
  moveX: number;
  moveY: number;
  boost?: boolean;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
  type: 'normal' | 'big';
}

export interface GameState {
  tick: number;
  timestamp: number;
  players: Record<string, Player>;
  foods: Record<string, Food>;
  collisions: Array<{
    eliminatedId: string;
    eliminatorId: string;
    timestamp: number;
  }>;
}

export interface GameSnapshot {
  tick: number;
  timestamp: number;
  delta: {
    players: Record<string, Partial<Player>>;
    foods: {
      added: Record<string, Food>;
      removed: string[];
    };
    collisions: Array<{
      eliminatedId: string;
      eliminatorId: string;
    }>;
  };
}

export interface RoomState {
  id: string;
  players: Record<string, Player>;
  foods: Record<string, Food>;
  gameState: GameState;
  lastSnapshot: GameSnapshot | null;
  tickCount: number;
}
