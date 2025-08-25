import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { redisManager } from './config/redis';
import RedisGameStateManager from './cache/RedisGameStateManager';
import GameLoadBalancer from './clustering/LoadBalancer';
import PerformanceMonitor from './monitoring/PerformanceMonitor';
import { OptimizedRoomManager } from './rooms/OptimizedRoomManager';

export class ScalableSocketServer {
  private server: any;
  private io: SocketIOServer;
  private roomManager: OptimizedRoomManager;
  private redisStateManager: RedisGameStateManager | null = null;
  private loadBalancer: GameLoadBalancer | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private serverId: string;
  private enableRedis: boolean;

  constructor(port: number) {
    this.serverId = process.env.SERVER_ID || `server-${uuidv4().slice(0, 8)}`;
    this.enableRedis = process.env.ENABLE_REDIS === 'true';
    
    // Create HTTP server
    this.server = createServer();
    
    // Create Socket.IO server
    this.io = new SocketIOServer(this.server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      transports: ['websocket', 'polling']
    });

    this.roomManager = new OptimizedRoomManager();
    
    this.initializeScaling();
    this.setupSocketHandlers();
    this.startGameLoop();
    
    this.server.listen(port, () => {
      console.log(`🚀 Scalable game server ${this.serverId} running on port ${port}`);
      console.log(`📊 Redis scaling: ${this.enableRedis ? 'ENABLED' : 'DISABLED'}`);
    });
  }

  private async initializeScaling() {
    if (!this.enableRedis) return;

    try {
      await redisManager.connect();
      this.redisStateManager = new RedisGameStateManager(this.serverId);
      this.loadBalancer = new GameLoadBalancer(this.serverId, {
        maxPlayersPerRoom: 20,
        maxRoomsPerServer: 50
      });
      this.performanceMonitor = new PerformanceMonitor(this.serverId);
      
      console.log('✅ Redis scaling components initialized');
    } catch (error) {
      console.error('❌ Redis scaling failed, using single-server mode');
    }
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('joinRoom', async (data) => {
        const { roomId, playerId, playerName, playerColor } = data;
        
        // Use load balancer if available
        let targetRoomId = roomId;
        if (this.loadBalancer && !roomId) {
          const assignment = await this.loadBalancer.findOptimalRoom();
          if (assignment) {
            targetRoomId = assignment.roomId;
            if (assignment.serverId !== this.serverId) {
              socket.emit('redirect', { serverId: assignment.serverId, roomId: targetRoomId });
              return;
            }
          }
        }

        const result = this.roomManager.joinRoom(targetRoomId || 'auto', playerId, playerName, playerColor);
        if (result.success) {
          socket.join(result.roomId!);
          socket.data.roomId = result.roomId;
          socket.data.playerId = playerId;
          
          // Save to Redis
          if (this.redisStateManager) {
            const roomState = this.roomManager.getRoomState(result.roomId!);
            if (roomState) {
              await this.redisStateManager.saveRoomState(roomState);
            }
          }
          
          socket.emit('roomJoined', { roomId: result.roomId, playerId });
        }
      });

      socket.on('playerInput', (inputData) => {
        const { roomId, playerId } = socket.data;
        if (roomId && playerId) {
          this.roomManager.handlePlayerInput(roomId, playerId, inputData);
          if (this.performanceMonitor) this.performanceMonitor.recordMessage();
        }
      });
    });
  }

  private startGameLoop() {
    setInterval(() => {
      const rooms = this.roomManager.getAllRooms();
      for (const [roomId, roomState] of rooms) {
        if (Object.keys(roomState.players).length > 0) {
          const snapshot = this.roomManager.createOptimizedSnapshot(roomId);
          if (snapshot) {
            this.io.to(roomId).emit('optimizedSnapshot', snapshot);
          }
        }
      }
    }, 50); // 20Hz
  }
}