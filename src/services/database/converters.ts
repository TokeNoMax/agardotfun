
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
    color: dbPlayer.player_color as any,
    size: dbPlayer.size,
    x: dbPlayer.x,
    y: dbPlayer.y,
    isAlive: dbPlayer.is_alive,
    ready: dbPlayer.is_ready
  }));

  return {
    id: dbRoom.id,
    name: dbRoom.name,
    maxPlayers: dbRoom.max_players,
    players,
    status: dbRoom.status as 'waiting' | 'playing' | 'finished',
    createdAt: dbRoom.created_at,
    updatedAt: dbRoom.updated_at
  };
}
