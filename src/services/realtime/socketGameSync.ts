
import { io, Socket } from 'socket.io-client';

export interface ClientPlayerInput {
  seq: number;
  timestamp: number;
  moveX: number;
  moveY: number;
  boost?: boolean;
}

export interface GameSnapshot {
  tick: number;
  timestamp: number;
  delta: {
    players: Record<string, any>;
    foods: {
      added: Record<string, any>;
      removed: string[];
    };
    collisions: Array<{
      eliminatedId: string;
      eliminatorId: string;
    }>;
  };
}

export interface SocketGameSyncCallbacks {
  onSnapshot?: (snapshot: GameSnapshot) => void;
  onPlayerJoined?: (player: any) => void;
  onPlayerLeft?: (playerId: string) => void;
  onRoomJoined?: (data: any) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class SocketGameSyncService {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private inputSequence: number = 0;
  private callbacks: SocketGameSyncCallbacks;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(callbacks: SocketGameSyncCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(serverUrl: string = 'http://localhost:3001'): Promise<boolean> {
    console.log(`[SocketGameSync] Connecting to ${serverUrl}...`);

    try {
      this.socket = io(serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      this.setupEventHandlers();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('[SocketGameSync] Connection timeout');
          resolve(false);
        }, 10000);

        this.socket!.on('connected', (data) => {
          clearTimeout(timeout);
          console.log('[SocketGameSync] Connected successfully:', data);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.callbacks.onConnectionChange?.(true);
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('[SocketGameSync] Connection error:', error);
          this.connected = false;
          this.callbacks.onConnectionChange?.(false);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('[SocketGameSync] Failed to create socket:', error);
      return false;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[SocketGameSync] Socket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.callbacks.onConnectionChange?.(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[SocketGameSync] Socket disconnected: ${reason}`);
      this.connected = false;
      this.callbacks.onConnectionChange?.(false);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[SocketGameSync] Reconnected after ${attemptNumber} attempts`);
      this.connected = true;
      this.callbacks.onConnectionChange?.(true);
      
      // Rejoin room if we were in one
      if (this.roomId && this.playerId) {
        this.joinRoom(this.roomId, this.playerId, 'Reconnected Player', 'blue');
      }
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketGameSync] Failed to reconnect after maximum attempts');
      this.connected = false;
      this.callbacks.onConnectionChange?.(false);
    });

    // Game events
    this.socket.on('gameSnapshot', (snapshot: GameSnapshot) => {
      this.callbacks.onSnapshot?.(snapshot);
    });

    this.socket.on('playerJoined', (data) => {
      console.log('[SocketGameSync] Player joined:', data);
      this.callbacks.onPlayerJoined?.(data.player);
    });

    this.socket.on('playerLeft', (data) => {
      console.log('[SocketGameSync] Player left:', data);
      this.callbacks.onPlayerLeft?.(data.playerId);
    });

    this.socket.on('roomJoined', (data) => {
      console.log('[SocketGameSync] Room joined:', data);
      this.callbacks.onRoomJoined?.(data);
    });

    this.socket.on('joinError', (error) => {
      console.error('[SocketGameSync] Join error:', error);
    });
  }

  joinRoom(roomId: string, playerId: string, playerName: string, playerColor: string): void {
    if (!this.socket || !this.connected) {
      console.warn('[SocketGameSync] Cannot join room - not connected');
      return;
    }

    console.log(`[SocketGameSync] Joining room ${roomId} as ${playerId}`);
    
    this.roomId = roomId;
    this.playerId = playerId;
    
    this.socket.emit('joinRoom', {
      roomId,
      playerId,
      playerName,
      playerColor
    });
  }

  leaveRoom(): void {
    if (!this.socket) return;

    console.log('[SocketGameSync] Leaving room');
    this.socket.emit('leaveRoom');
    this.roomId = null;
    this.playerId = null;
  }

  sendPlayerInput(moveX: number, moveY: number, boost: boolean = false): void {
    if (!this.socket || !this.connected || !this.roomId) return;

    const input: ClientPlayerInput = {
      seq: ++this.inputSequence,
      timestamp: Date.now(),
      moveX,
      moveY,
      boost
    };

    this.socket.emit('playerInput', input);
  }

  disconnect(): void {
    if (this.socket) {
      console.log('[SocketGameSync] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.roomId = null;
      this.playerId = null;
      this.callbacks.onConnectionChange?.(false);
    }
  }

  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  getConnectionInfo() {
    return {
      connected: this.connected,
      roomId: this.roomId,
      playerId: this.playerId,
      inputSequence: this.inputSequence,
      socketId: this.socket?.id
    };
  }
}
