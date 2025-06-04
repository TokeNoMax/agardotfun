
import { GameRoom, Player } from "@/types/game";
import { DatabaseGameRoom, DatabaseGameRoomPlayer } from "./types";

export function convertToGameRoom(
  dbRoom: DatabaseGameRoom, 
  dbPlayers: DatabaseGameRoomPlayer[]
): GameRoom {
  const players: Player[] = dbPlayers.map(dbPlayer => ({
    id: dbPlayer.player_id,
    walletAddress: dbPlayer.player_id,
    name: dbPlayer.player_name,
    color: dbPlayer.player_color,
    size: dbPlayer.size,
    x: dbPlayer.x,
    y: dbPlayer.y,
    isAlive: dbPlayer.is_alive,
    isReady: dbPlayer.is_ready,
    velocityX: dbPlayer.velocity_x || 0,
    velocityY: dbPlayer.velocity_y || 0,
    lastPositionUpdate: dbPlayer.last_position_update || undefined
  }));

  return {
    id: dbRoom.id,
    name: dbRoom.name,
    maxPlayers: dbRoom.max_players,
    players,
    status: dbRoom.status as 'waiting' | 'playing' | 'finished',
    createdAt: dbRoom.created_at,
    lastActivity: dbRoom.last_activity,
    matchNumber: dbRoom.match_number, // Added match number conversion
    gameSeed: dbRoom.game_seed || undefined,
    gameState: dbRoom.game_state || undefined
  };
}
