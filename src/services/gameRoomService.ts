
import { GameRoom, Player, GameMode } from "@/types/game";
import { roomService } from "./room/roomService";
import { playerService } from "./player/playerService";
import { verificationService } from "./room/verificationService";
import { activityService } from "./room/activityService";

// Re-export types for backward compatibility
export type { DatabaseGameRoom, DatabaseGameRoomPlayer } from "./database/types";

export const gameRoomService = {
  // Activity management
  updateRoomActivity: activityService.updateRoomActivity,

  // Verification methods
  verifyPlayerInRoom: verificationService.verifyPlayerInRoom,
  verifyRoomExists: verificationService.verifyRoomExists,

  // Room management
  getAllRooms: roomService.getAllRooms,
  createRoom: async (name: string, maxPlayers: number, gameMode: GameMode = 'classic'): Promise<GameRoom> => {
    return await roomService.createRoom(name, maxPlayers, gameMode);
  },
  startGame: roomService.startGame,
  getRoom: roomService.getRoom,
  checkGhostRooms: roomService.checkGhostRooms,

  // Player management
  joinRoom: async (roomId: string, player: Player): Promise<GameRoom> => {
    return await playerService.joinRoom(roomId, player);
  },
  leaveRoom: playerService.leaveRoom,
  setPlayerReady: playerService.setPlayerReady
};
