
import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { RoomManager } from './rooms/RoomManager';
import { PlayerInput } from './types/game';

export class SocketServer {
  private app: express.Application;
  private server: any;
  private io: Server;
  private roomManager: RoomManager;
  private playerRooms: Map<string, string> = new Map(); // socketId -> roomId

  constructor(port: number = 3001) {
    this.app = express();
    this.server = createServer(this.app);
    this.roomManager = new RoomManager();

    // Setup CORS
    this.app.use(cors({
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true
    }));

    // Setup Socket.IO
    this.io = new Server(this.server, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket'], // WebSocket only for performance
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupSocketHandlers();
    this.setupRoutes();

    // Make this available globally for RoomManager
    (global as any).socketServer = this;

    this.server.listen(port, () => {
      console.log(`🚀 Realtime server started on port ${port}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${port}`);
    });
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        rooms: this.roomManager.getRoomList()
      });
    });

    this.app.get('/rooms', (req, res) => {
      res.json(this.roomManager.getRoomList());
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      socket.on('joinRoom', (data: { roomId: string, playerId: string, playerName: string, playerColor: string }) => {
        this.handleJoinRoom(socket, data);
      });

      socket.on('leaveRoom', () => {
        this.handleLeaveRoom(socket);
      });

      socket.on('playerInput', (input: PlayerInput) => {
        this.handlePlayerInput(socket, input);
      });

      socket.on('disconnect', (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
        this.handleLeaveRoom(socket);
      });

      // Handle ping for RTT measurement
      socket.on('ping', (data) => {
        socket.emit('pong', { ...data, serverTimestamp: Date.now() });
      });

      // Send initial connection confirmation
      socket.emit('connected', { 
        socketId: socket.id, 
        timestamp: Date.now(),
        serverInfo: {
          tickRate: 20, // Updated to 20Hz
          snapshotRate: 15,
          version: '2.0.0-optimized',
          features: ['aoi', 'compactSnapshots', 'clientPrediction']
        }
      });
    });
  }

  private handleJoinRoom(socket: Socket, data: { roomId: string, playerId: string, playerName: string, playerColor: string }): void {
    const { roomId, playerId, playerName, playerColor } = data;
    
    console.log(`🏠 Player ${playerId} joining room ${roomId}`);

    // Leave current room if any
    this.handleLeaveRoom(socket);

    // Get or create room
    let room = this.roomManager.getRoom(roomId);
    if (!room) {
      room = this.roomManager.createRoom(roomId);
    }

    // Add player to room
    const player = this.roomManager.addPlayerToRoom(roomId, playerId, playerName, playerColor);
    
    if (player) {
      // Join socket room
      socket.join(roomId);
      this.playerRooms.set(socket.id, roomId);

      // Send room state to player
      socket.emit('roomJoined', {
        roomId,
        player,
        roomState: room,
        timestamp: Date.now()
      });

      // Notify other players
      socket.to(roomId).emit('playerJoined', {
        player,
        timestamp: Date.now()
      });

      console.log(`✅ Player ${playerId} successfully joined room ${roomId}`);
    } else {
      socket.emit('joinError', { message: 'Failed to join room' });
    }
  }

  private handleLeaveRoom(socket: Socket): void {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const playerId = socket.id; // Using socket.id as player identifier
    
    console.log(`🚪 Player ${playerId} leaving room ${roomId}`);

    // Remove from room manager
    this.roomManager.removePlayerFromRoom(roomId, playerId);

    // Leave socket room
    socket.leave(roomId);
    this.playerRooms.delete(socket.id);

    // Notify other players
    socket.to(roomId).emit('playerLeft', {
      playerId,
      timestamp: Date.now()
    });
  }

  private handlePlayerInput(socket: Socket, input: PlayerInput): void {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const playerId = socket.id; // Using socket.id as player identifier
    this.roomManager.processPlayerInput(roomId, playerId, input);
  }

  public emitToRoom(roomId: string, event: string, data: any): void {
    this.io.to(roomId).emit(event, data);
  }

  public emitToPlayer(roomId: string, playerId: string, event: string, data: any): void {
    // Find socket by player ID and emit directly
    for (const [socketId, mappedRoomId] of this.playerRooms.entries()) {
      if (mappedRoomId === roomId && socketId === playerId) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(event, data);
        }
        break;
      }
    }
  }

  public getConnectedClients(): number {
    return this.io.engine.clientsCount;
  }

  public getRoomClients(roomId: string): number {
    const room = this.io.sockets.adapter.rooms.get(roomId);
    return room ? room.size : 0;
  }
}
