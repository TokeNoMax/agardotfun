
export interface DatabaseGameRoom {
  id: string;
  name: string;
  max_players: number;
  status: string;
  created_at: string;
  updated_at: string;
  last_activity: string;
  match_number: number;
  game_seed?: string;
  game_state?: any;
  game_mode?: string;
}

export interface DatabaseGameRoomPlayer {
  id: string;
  room_id: string;
  player_id: string;
  player_name: string;
  player_color: string;
  size: number;
  x: number;
  y: number;
  is_alive: boolean;
  is_ready: boolean;
  joined_at: string;
  velocity_x?: number;
  velocity_y?: number;
  last_position_update?: string;
  nft_image_url?: string;
}
