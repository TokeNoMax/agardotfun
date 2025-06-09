
import { GameRoom, Player, GameMode } from '@/types/game';

export const convertDatabaseRoomToGameRoom = (dbRoom: any): GameRoom => {
  return {
    id: dbRoom.id,
    name: dbRoom.name,
    maxPlayers: dbRoom.max_players,
    players: dbRoom.players || [],
    status: dbRoom.status,
    gameMode: dbRoom.game_mode as GameMode || 'classic',
    createdAt: dbRoom.created_at,
    updatedAt: dbRoom.updated_at,
    lastActivity: dbRoom.last_activity,
    gameState: dbRoom.game_state || {},
    gameSeed: dbRoom.game_seed,
    matchNumber: dbRoom.match_number
  };
};

export const convertDatabasePlayerToPlayer = (dbPlayer: any): Player => {
  return {
    id: dbPlayer.player_id,
    name: dbPlayer.player_name,
    color: dbPlayer.player_color,
    size: dbPlayer.size,
    x: dbPlayer.x,
    y: dbPlayer.y,
    isAlive: dbPlayer.is_alive,
    isReady: dbPlayer.is_ready,
    velocityX: dbPlayer.velocity_x,
    velocityY: dbPlayer.velocity_y,
    lastPositionUpdate: dbPlayer.last_position_update ? new Date(dbPlayer.last_position_update).toISOString() : new Date().toISOString(),
    joinedAt: dbPlayer.joined_at ? new Date(dbPlayer.joined_at).toISOString() : new Date().toISOString()
  };
};

export const convertPlayerToDatabase = (player: Player) => {
  return {
    player_id: player.id,
    player_name: player.name,
    player_color: player.color,
    size: player.size,
    x: player.x,
    y: player.y,
    is_alive: player.isAlive,
    is_ready: player.isReady,
    velocity_x: player.velocityX,
    velocity_y: player.velocityY,
    last_position_update: player.lastPositionUpdate,
    joined_at: player.joinedAt
  };
};

export const convertGameModeToDatabase = (gameMode: GameMode): string => {
  return gameMode;
};

export const convertDatabaseToGameMode = (dbGameMode: string): GameMode => {
  return dbGameMode as GameMode;
};
