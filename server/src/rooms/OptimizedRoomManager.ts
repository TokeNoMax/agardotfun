import { RoomState, Player } from '../types/game';
import { OptimizedGameEngine } from '../game/OptimizedGameEngine';
import { OptimizedSnapshotManager } from '../game/OptimizedSnapshotManager';

interface RoomMetrics {
  playerCount: number;
  avgTickTime: number;
  lastSnapshotSize: number;
  lastUpdate: number;
}

interface ClientConnection {
  playerId: string;
  lastPing: number;
  rtt: number;
  isActive: boolean;
}

export class OptimizedRoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private roomEngines: Map<string, OptimizedGameEngine> = new Map();
  private roomSnapshots: Map<string, OptimizedSnapshotManager> = new Map();
  private roomIntervals: Map<string, NodeJS.Timeout> = new Map();
  private roomMetrics: Map<string, RoomMetrics> = new Map();
  private clientConnections: Map<string, ClientConnection> = new Map();

  private readonly TICK_RATE = 20; // 50ms per tick
  private readonly TICK_INTERVAL = 1000 / this.TICK_RATE;
  private readonly SNAPSHOT_RATE = 15; // 66ms per snapshot
  private readonly SNAPSHOT_INTERVAL = 1000 / this.SNAPSHOT_RATE;
  private readonly MAX_PLAYERS_PER_ROOM = 20;
  private readonly HEARTBEAT_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_ROOMS_PER_PROCESS = 2;

  createRoom(roomId: string): RoomState {
    // Check room limit
    if (this.rooms.size >= this.MAX_ROOMS_PER_PROCESS) {
      throw new Error(`Maximum rooms per process (${this.MAX_ROOMS_PER_PROCESS}) exceeded`);
    }

    console.log(`[OptimizedRoomManager] Creating room: ${roomId}`);
    
    const engine = new OptimizedGameEngine();
    const snapshotManager = new OptimizedSnapshotManager();
    const roomState = engine.initializeRoom(roomId);

    this.rooms.set(roomId, roomState);
    this.roomEngines.set(roomId, engine);
    this.roomSnapshots.set(roomId, snapshotManager);
    
    // Initialize metrics
    this.roomMetrics.set(roomId, {
      playerCount: 0,
      avgTickTime: 0,
      lastSnapshotSize: 0,
      lastUpdate: Date.now()
    });

    // Start optimized game loop for this room
    this.startOptimizedGameLoop(roomId);

    return roomState;
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  addPlayerToRoom(roomId: string, playerId: string, name: string, color: string): Player | null {
    const roomState = this.rooms.get(roomId);
    const engine = this.roomEngines.get(roomId);

    if (!roomState || !engine) {
      console.log(`[OptimizedRoomManager] Room ${roomId} not found`);
      return null;
    }

    // Check player limit
    if (Object.keys(roomState.players).length >= this.MAX_PLAYERS_PER_ROOM) {
      console.log(`[OptimizedRoomManager] Room ${roomId} is full (${this.MAX_PLAYERS_PER_ROOM} players)`);
      return null;
    }

    console.log(`[OptimizedRoomManager] Adding player ${playerId} to room ${roomId}`);
    const player = engine.addPlayer(roomState, playerId, name, color);
    
    // Track client connection
    this.clientConnections.set(playerId, {
      playerId,
      lastPing: Date.now(),
      rtt: 0,
      isActive: true
    });

    // Update metrics
    const metrics = this.roomMetrics.get(roomId);
    if (metrics) {
      metrics.playerCount = Object.keys(roomState.players).length;
    }

    return player;
  }

  removePlayerFromRoom(roomId: string, playerId: string): void {
    const roomState = this.rooms.get(roomId);
    const engine = this.roomEngines.get(roomId);
    const snapshotManager = this.roomSnapshots.get(roomId);

    if (!roomState || !engine) return;

    console.log(`[OptimizedRoomManager] Removing player ${playerId} from room ${roomId}`);
    engine.removePlayer(roomState, playerId);
    
    // Clean up client connection and snapshot state
    this.clientConnections.delete(playerId);
    snapshotManager?.removeClient(playerId);

    // Update metrics
    const metrics = this.roomMetrics.get(roomId);
    if (metrics) {
      metrics.playerCount = Object.keys(roomState.players).length;
    }

    // If room is empty, clean it up after a delay
    if (Object.keys(roomState.players).length === 0) {
      setTimeout(() => {
        if (Object.keys(roomState.players).length === 0) {
          this.destroyRoom(roomId);
        }
      }, 10000); // 10 second grace period
    }
  }

  processPlayerInput(roomId: string, playerId: string, input: any): void {
    const roomState = this.rooms.get(roomId);
    const engine = this.roomEngines.get(roomId);

    if (!roomState || !engine) return;

    // Update client heartbeat
    const clientConnection = this.clientConnections.get(playerId);
    if (clientConnection) {
      clientConnection.lastPing = Date.now();
      clientConnection.isActive = true;
    }

    engine.processPlayerInput(roomState, playerId, input);
  }

  private startOptimizedGameLoop(roomId: string): void {
    let lastTickTime = Date.now();
    let lastSnapshotTime = Date.now();
    let snapshotCounter = 0;

    const gameLoop = () => {
      const currentTime = Date.now();
      const tickDeltaTime = (currentTime - lastTickTime) / 1000;
      lastTickTime = currentTime;

      const roomState = this.rooms.get(roomId);
      const engine = this.roomEngines.get(roomId);
      const snapshotManager = this.roomSnapshots.get(roomId);
      const metrics = this.roomMetrics.get(roomId);

      if (!roomState || !engine || !snapshotManager || !metrics) {
        console.log(`[OptimizedRoomManager] Stopping game loop for room ${roomId} - missing components`);
        return;
      }

      const tickStart = Date.now();

      // Update game state
      engine.update(roomState, tickDeltaTime);

      // Check for AFK players
      this.checkAFKPlayers(roomId);

      const tickTime = Date.now() - tickStart;
      metrics.avgTickTime = tickTime;
      metrics.lastUpdate = currentTime;

      // Send snapshots at lower frequency than ticks
      if (currentTime - lastSnapshotTime >= this.SNAPSHOT_INTERVAL) {
        this.broadcastOptimizedSnapshots(roomId, roomState, engine, snapshotManager);
        lastSnapshotTime = currentTime;
        snapshotCounter++;
      }

      // Log performance every 100 ticks
      if (roomState.tickCount % 100 === 0) {
        const engineDiagnostics = engine.getDiagnostics();
        console.log(`[OptimizedRoomManager] Room ${roomId} - Tick: ${roomState.tickCount}, AvgTickTime: ${tickTime}ms, Players: ${metrics.playerCount}, SnapshotSize: ${metrics.lastSnapshotSize}B`);
      }
    };

    const interval = setInterval(gameLoop, this.TICK_INTERVAL);
    this.roomIntervals.set(roomId, interval);

    console.log(`[OptimizedRoomManager] Started optimized game loop for room ${roomId} at ${this.TICK_RATE}Hz (snapshots at ${this.SNAPSHOT_RATE}Hz)`);
  }

  private broadcastOptimizedSnapshots(
    roomId: string, 
    roomState: RoomState, 
    engine: OptimizedGameEngine, 
    snapshotManager: OptimizedSnapshotManager
  ): void {
    const gameState = engine.getGameState(roomState);
    let totalSnapshotSize = 0;

    // Send personalized snapshots with AOI to each player
    for (const playerId of Object.keys(roomState.players)) {
      const aoi = engine.getPlayerAOI(playerId, roomState);
      const snapshot = snapshotManager.createClientSnapshot(playerId, gameState, aoi.players, aoi.foods);
      
      // Emit to specific player
      this.emitToPlayer(roomId, playerId, 'optimizedSnapshot', snapshot);
      
      totalSnapshotSize += snapshotManager.getSnapshotSize(snapshot);
    }

    // Update metrics
    const metrics = this.roomMetrics.get(roomId);
    if (metrics) {
      metrics.lastSnapshotSize = totalSnapshotSize;
    }
  }

  private checkAFKPlayers(roomId: string): void {
    const currentTime = Date.now();
    const playersToRemove: string[] = [];

    for (const [playerId, connection] of this.clientConnections.entries()) {
      if (currentTime - connection.lastPing > this.HEARTBEAT_TIMEOUT) {
        console.log(`[OptimizedRoomManager] Player ${playerId} AFK for ${currentTime - connection.lastPing}ms`);
        playersToRemove.push(playerId);
      }
    }

    // Remove AFK players
    for (const playerId of playersToRemove) {
      this.removePlayerFromRoom(roomId, playerId);
      this.emitToRoom(roomId, 'playerKicked', { playerId, reason: 'AFK' });
    }
  }

  private destroyRoom(roomId: string): void {
    console.log(`[OptimizedRoomManager] Destroying room: ${roomId}`);
    
    const interval = this.roomIntervals.get(roomId);
    if (interval) {
      clearInterval(interval);
      this.roomIntervals.delete(roomId);
    }

    // Clean up all room data
    this.rooms.delete(roomId);
    this.roomEngines.delete(roomId);
    this.roomSnapshots.delete(roomId);
    this.roomMetrics.delete(roomId);

    // Clean up client connections for this room
    const roomState = this.rooms.get(roomId);
    if (roomState) {
      for (const playerId of Object.keys(roomState.players)) {
        this.clientConnections.delete(playerId);
      }
    }
  }

  private emitToRoom(roomId: string, event: string, data: any): void {
    // This will be connected to SocketServer
    global.socketServer?.emitToRoom(roomId, event, data);
  }

  private emitToPlayer(roomId: string, playerId: string, event: string, data: any): void {
    // This will be connected to SocketServer for targeted emissions
    global.socketServer?.emitToPlayer?.(roomId, playerId, event, data);
  }

  // Ping/Pong system for RTT measurement
  handlePing(playerId: string, timestamp: number): void {
    const connection = this.clientConnections.get(playerId);
    if (connection) {
      connection.lastPing = Date.now();
      connection.rtt = Date.now() - timestamp;
      
      // Send pong back
      this.emitToPlayer('', playerId, 'pong', { timestamp, rtt: connection.rtt });
    }
  }

  // Room management and diagnostics
  getRoomList(): Array<{id: string, playerCount: number, avgTickTime: number, snapshotSize: number}> {
    return Array.from(this.rooms.entries()).map(([id, room]) => {
      const metrics = this.roomMetrics.get(id);
      return {
        id,
        playerCount: Object.keys(room.players).length,
        avgTickTime: metrics?.avgTickTime || 0,
        snapshotSize: metrics?.lastSnapshotSize || 0
      };
    });
  }

  getServerDiagnostics() {
    const totalPlayers = Array.from(this.rooms.values()).reduce((sum, room) => sum + Object.keys(room.players).length, 0);
    const totalRooms = this.rooms.size;
    const avgTickTime = Array.from(this.roomMetrics.values()).reduce((sum, metrics) => sum + metrics.avgTickTime, 0) / totalRooms;
    const totalSnapshotSize = Array.from(this.roomMetrics.values()).reduce((sum, metrics) => sum + metrics.lastSnapshotSize, 0);

    return {
      tickRate: this.TICK_RATE,
      snapshotRate: this.SNAPSHOT_RATE,
      totalRooms,
      totalPlayers,
      maxPlayersPerRoom: this.MAX_PLAYERS_PER_ROOM,
      maxRoomsPerProcess: this.MAX_ROOMS_PER_PROCESS,
      avgTickTime,
      totalSnapshotSize,
      activeConnections: this.clientConnections.size,
      uptime: process.uptime()
    };
  }

  // Load balancing helper
  canAcceptNewRoom(): boolean {
    return this.rooms.size < this.MAX_ROOMS_PER_PROCESS;
  }

  canAcceptNewPlayer(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return room ? Object.keys(room.players).length < this.MAX_PLAYERS_PER_ROOM : false;
  }
}