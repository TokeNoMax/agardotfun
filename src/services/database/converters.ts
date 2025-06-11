
import { GameRoom, Player, GameMode } from "@/types/game";
import { DatabaseGameRoom, DatabaseGameRoomPlayer } from "./types";

export function convertDatabaseRoomToGameRoom(
  dbRoom: DatabaseGameRoom, 
  dbPlayers: DatabaseGameRoomPlayer[]
): GameRoom {
  // FIXED: Properly convert game_mode with debugging
  console.log(`Converting room ${dbRoom.name} - DB game_mode:`, dbRoom.game_mode);
  
  // Ensure game_mode is properly mapped and normalized
  let gameMode: GameMode = 'classic'; // default fallback
  
  if (dbRoom.game_mode) {
    const normalizedMode = dbRoom.game_mode.toLowerCase().trim();
    if (normalizedMode === 'battle_royale' || normalizedMode === 'classic') {
      gameMode = normalizedMode as GameMode;
    } else {
      console.warn(`Unknown game mode from DB: ${dbRoom.game_mode}, using classic as fallback`);
    }
  }
  
  console.log(`Final gameMode for room ${dbRoom.name}:`, gameMode);

  const players: Player[] = dbPlayers.map(dbPlayer => ({
    id: dbPlayer.player_id,
    walletAddress: '', // We don't store wallet address in game room players
    name: dbPlayer.player_name,
    color: dbPlayer.player_color as any,
    size: dbPlayer.size,
    x: dbPlayer.x,
    y: dbPlayer.y,
    isAlive: dbPlayer.is_alive,
    isReady: dbPlayer.is_ready,
    velocityX: dbPlayer.velocity_x || 0,
    velocityY: dbPlayer.velocity_y || 0,
    lastPositionUpdate: dbPlayer.last_position_update ? 
      (typeof dbPlayer.last_position_update === 'string' ? 
        dbPlayer.last_position_update : 
        dbPlayer.last_position_update.toISOString()) : 
      undefined
  }));

  return {
    id: dbRoom.id,
    name: dbRoom.name,
    maxPlayers: dbRoom.max_players,
    players,
    status: dbRoom.status as 'waiting' | 'playing' | 'finished',
    createdAt: dbRoom.created_at,
    lastActivity: dbRoom.last_activity,
    matchNumber: dbRoom.match_number,
    gameSeed: dbRoom.game_seed || undefined,
    gameState: dbRoom.game_state || undefined,
    gameMode // FIXED: Use the properly converted gameMode
  };
}
