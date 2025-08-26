export interface PlayerInput {
  seq: number;         // séquence client (anti duplication)
  timestamp: number;   // ms client
  dx: number;          // [-1..1]
  dy: number;          // [-1..1]
  act?: number;        // bitmask (split/shoot plus tard)
}

export interface Player {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  r: number;           // rayon
  vx: number;
  vy: number;
  alive: boolean;
  lastSeq: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface RoomState {
  id: string;
  status: "waiting" | "playing" | "finished";
  maxPlayers: number;
  players: Record<string, Player>;
  foods: Record<string, Food>;
  startedAt: number | null;
}
