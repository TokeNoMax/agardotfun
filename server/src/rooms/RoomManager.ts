
import { RoomState, Player } from '../types/game';
import { GameEngine } from '../game/GameEngine';
import { SnapshotManager } from '../game/SnapshotManager';

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private roomEngines: Map<string, GameEngine> = new Map();
  private roomSnapshots: Map<string, SnapshotManager> = new Map();
  private roomIntervals: Map<string, NodeJS.Timeout> = new Map();

  private readonly TICK_RATE = 15; // 66ms
  private readonly TICK_INTERVAL = 1000 / this.TICK_RATE;

  createRoom(roomId: string): RoomState {
    console.log(`Creating room: ${roomId}`);
    
    const engine = new GameEngine();
    const snapshotManager = new SnapshotManager();
    const roomState = engine.initializeRoom(roomId);

    this.rooms.set(roomId, roomState);
    this.roomEngines.set(roomId, engine);
    this.roomSnapshots.set(roomId, snapshotManager);

    // Start game loop for this room
    this.startGameLoop(roomId);

    return roomState;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  addPlayerToRoom(roomId: string, playerId: string, name: string, color: string): Player | null {
    const roomState = this.rooms.get(roomId);
    const engine = this.roomEngines.get(roomId);

    if (!roomState || !engine) {
      console.log(`Room ${roomId} not found`);
      return null;
    }

    console.log(`Adding player ${playerId} to room ${roomId}`);
    return engine.addPlayer(roomState, playerId, name, color);
  }

  removePlayerFromRoom(roomId: string, playerId: string): void {
    const roomState = this.rooms.get(roomId);
    const engine = this.roomEngines.get(roomId);

    if (!roomState || !engine) return;

    console.log(`Removing player ${playerId} from room ${roomId}`);
    engine.removePlayer(roomState, playerId);

    // If room is empty, clean it up
    if (Object.keys(roomState.players).length === 0) {
      this.destroyRoom(roomId);
    }
  }

  processPlayerInput(roomId: string, playerId: string, input: any): void {
    const roomState = this.rooms.get(roomId);
    const engine = this.roomEngines.get(roomId);

    if (!roomState || !engine) return;

    engine.processPlayerInput(roomState, playerId, input);
  }

  private startGameLoop(roomId: string): void {
    let lastTime = Date.now();

    const gameLoop = () => {
      const currentTime = Date.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      const roomState = this.rooms.get(roomId);
      const engine = this.roomEngines.get(roomId);
      const snapshotManager = this.roomSnapshots.get(roomId);

      if (!roomState || !engine || !snapshotManager) {
        console.log(`Stopping game loop for room ${roomId} - missing components`);
        return;
      }

      // Update game state
      engine.update(roomState, deltaTime);

      // Create and emit snapshot
      const gameState = engine.getGameState(roomState);
      const snapshot = snapshotManager.createSnapshot(gameState);

      // Emit to all players in room (will be handled by SocketServer)
      this.emitToRoom(roomId, 'gameSnapshot', snapshot);
    };

    const interval = setInterval(gameLoop, this.TICK_INTERVAL);
    this.roomIntervals.set(roomId, interval);

    console.log(`Started game loop for room ${roomId} at ${this.TICK_RATE}Hz`);
  }

  private destroyRoom(roomId: string): void {
    console.log(`Destroying room: ${roomId}`);
    
    const interval = this.roomIntervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.roomIntervals.delete(roomId);
    }

    this.rooms.delete(roomId);
    this.roomEngines.delete(roomId);
    this.roomSnapshots.delete(roomId);
  }

  private emitToRoom(roomId: string, event: string, data: any): void {
    // This will be connected to SocketServer
    global.socketServer?.emitToRoom(roomId, event, data);
  }

  getRoomList(): Array<{id: string, playerCount: number}> {
    return Array.from(this.rooms.entries()).map(([id, room]) => ({
      id,
      playerCount: Object.keys(room.players).length
    }));
  }
}
