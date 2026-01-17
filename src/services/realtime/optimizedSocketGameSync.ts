import { io, Socket } from 'socket.io-client';

// Optimized input format (compact)
export interface CompactPlayerInput {
  t: number;  // timestamp
  seq: number; // sequence
  dx: number;  // moveX (-1 to 1)
  dy: number;  // moveY (-1 to 1)
  act?: number; // actions bitmask (boost=1)
}

// Optimized snapshot format
export interface CompactSnapshot {
  t: number; // timestamp
  tick: number;
  you?: CompactPlayer; // Current player data
  ps?: Record<string, CompactPlayer>; // players
  fs?: Record<string, CompactFood>; // foods
  rm?: string[]; // removed entity IDs
  cols?: Array<{ e: string, r: string }>; // collisions
}

interface CompactPlayer {
  x: number;
  y: number;
  r: number; // radius (size)
  c?: string; // color
  n?: string; // name
  alive?: boolean;
}

interface CompactFood {
  x: number;
  y: number;
  r: number; // radius (size)
  t?: 'big' | 'normal'; // type
}

export interface OptimizedSocketGameSyncCallbacks {
  onSnapshot?: (snapshot: CompactSnapshot) => void;
  onPlayerJoined?: (player: any) => void;
  onPlayerLeft?: (playerId: string) => void;
  onRoomJoined?: (data: any) => void;
  onConnectionChange?: (connected: boolean) => void;
  onPing?: (rtt: number) => void;
}

interface ConnectionDiagnostics {
  connected: boolean;
  roomId: string | null;
  playerId: string | null;
  inputSequence: number;
  socketId?: string;
  rtt: number;
  lastPingTime: number;
  packetsSent: number;
  packetsReceived: number;
}

export class OptimizedSocketGameSyncService {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private roomId: string | null = null;
  private playerId: string | null = null;
  private inputSequence: number = 0;
  private callbacks: OptimizedSocketGameSyncCallbacks;
  
  // Performance tracking
  private rtt: number = 0;
  private lastPingTime: number = 0;
  private packetsSent: number = 0;
  private packetsReceived: number = 0;
  
  // Input throttling
  private lastInputTime: number = 0;
  private readonly INPUT_THROTTLE_MS = 25; // 40Hz max input rate
  private inputBuffer: CompactPlayerInput[] = [];
  
  // Ping system
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 1000; // 1 second
  
  // Reconnection
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(callbacks: OptimizedSocketGameSyncCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(serverUrl: string = import.meta.env.VITE_WS_URL || 'http://localhost:3001'): Promise<boolean> {
    console.log(`[OptimizedSocketGameSync] Connecting to ${serverUrl}...`);

    try {
      this.socket = io(serverUrl, {
        transports: ['websocket'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: true
      });

      this.setupEventHandlers();

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('[OptimizedSocketGameSync] Connection timeout');
          resolve(false);
        }, 10000);

        this.socket!.on('connected', (data) => {
          clearTimeout(timeout);
          console.log('[OptimizedSocketGameSync] Connected successfully:', data);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startPingSystem();
          this.callbacks.onConnectionChange?.(true);
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.error('[OptimizedSocketGameSync] Connection error:', error);
          this.connected = false;
          this.callbacks.onConnectionChange?.(false);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('[OptimizedSocketGameSync] Failed to create socket:', error);
      return false;
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[OptimizedSocketGameSync] Socket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.startPingSystem();
      this.callbacks.onConnectionChange?.(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[OptimizedSocketGameSync] Socket disconnected: ${reason}`);
      this.connected = false;
      this.stopPingSystem();
      this.callbacks.onConnectionChange?.(false);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[OptimizedSocketGameSync] Reconnected after ${attemptNumber} attempts`);
      this.connected = true;
      this.startPingSystem();
      this.callbacks.onConnectionChange?.(true);
      
      // Rejoin room if we were in one
      if (this.roomId && this.playerId) {
        this.joinRoom(this.roomId, this.playerId, 'Reconnected Player', 'blue');
      }
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[OptimizedSocketGameSync] Failed to reconnect after maximum attempts');
      this.connected = false;
      this.stopPingSystem();
      this.callbacks.onConnectionChange?.(false);
    });

    // Optimized game events
    this.socket.on('optimizedSnapshot', (snapshot: CompactSnapshot) => {
      this.packetsReceived++;
      this.callbacks.onSnapshot?.(snapshot);
    });

    // Legacy support for regular snapshots
    this.socket.on('gameSnapshot', (snapshot: any) => {
      this.packetsReceived++;
      this.callbacks.onSnapshot?.(snapshot);
    });

    this.socket.on('playerJoined', (data) => {
      console.log('[OptimizedSocketGameSync] Player joined:', data);
      this.callbacks.onPlayerJoined?.(data.player);
    });

    this.socket.on('playerLeft', (data) => {
      console.log('[OptimizedSocketGameSync] Player left:', data);
      this.callbacks.onPlayerLeft?.(data.playerId);
    });

    this.socket.on('roomJoined', (data) => {
      console.log('[OptimizedSocketGameSync] Room joined:', data);
      this.callbacks.onRoomJoined?.(data);
    });

    this.socket.on('joinError', (error) => {
      console.error('[OptimizedSocketGameSync] Join error:', error);
    });

    // Ping/Pong system
    this.socket.on('pong', (data: { timestamp: number, serverTimestamp: number, rtt?: number }) => {
      const now = Date.now();
      this.rtt = now - data.timestamp;
      this.lastPingTime = now;
      this.callbacks.onPing?.(this.rtt);
    });
  }

  private startPingSystem(): void {
    this.stopPingSystem();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
      }
    }, this.PING_INTERVAL);
  }

  private stopPingSystem(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  joinRoom(roomId: string, playerId: string, playerName: string, playerColor: string): void {
    if (!this.socket || !this.connected) {
      console.warn('[OptimizedSocketGameSync] Cannot join room - not connected');
      return;
    }

    console.log(`[OptimizedSocketGameSync] Joining room ${roomId} as ${playerId}`);
    
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

    console.log('[OptimizedSocketGameSync] Leaving room');
    this.socket.emit('leaveRoom');
    this.roomId = null;
    this.playerId = null;
  }

  // Optimized input sending with throttling
  sendPlayerInput(moveX: number, moveY: number, boost: boolean = false): void {
    if (!this.socket || !this.connected || !this.roomId) return;

    const now = Date.now();
    
    // Throttle inputs to max 40Hz
    if (now - this.lastInputTime < this.INPUT_THROTTLE_MS) return;
    this.lastInputTime = now;

    // Clamp movement values
    const clampedMoveX = Math.max(-1, Math.min(1, moveX));
    const clampedMoveY = Math.max(-1, Math.min(1, moveY));

    // Create compact input
    const input: CompactPlayerInput = {
      t: now,
      seq: ++this.inputSequence,
      dx: clampedMoveX,
      dy: clampedMoveY,
    };

    // Add actions bitmask if needed
    if (boost) {
      input.act = 1; // boost = bit 1
    }

    this.socket.emit('playerInput', input);
    this.packetsSent++;
  }

  // Batch input sending (for high-frequency inputs)
  sendBatchedInputs(): void {
    if (!this.socket || !this.connected || this.inputBuffer.length === 0) return;

    this.socket.emit('batchedInputs', this.inputBuffer);
    this.packetsSent += this.inputBuffer.length;
    this.inputBuffer = [];
  }

  disconnect(): void {
    if (this.socket) {
      console.log('[OptimizedSocketGameSync] Disconnecting...');
      this.stopPingSystem();
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

  getDiagnostics(): ConnectionDiagnostics {
    return {
      connected: this.connected,
      roomId: this.roomId,
      playerId: this.playerId,
      inputSequence: this.inputSequence,
      socketId: this.socket?.id,
      rtt: this.rtt,
      lastPingTime: this.lastPingTime,
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived
    };
  }

  // Network quality assessment
  getNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (this.rtt < 50) return 'excellent';
    if (this.rtt < 100) return 'good';
    if (this.rtt < 200) return 'fair';
    return 'poor';
  }

  // Manual RTT measurement
  measureRTT(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket || !this.connected) {
        resolve(-1);
        return;
      }

      const startTime = Date.now();
      const timeout = setTimeout(() => resolve(-1), 5000);

      this.socket.once('pong', () => {
        clearTimeout(timeout);
        resolve(Date.now() - startTime);
      });

      this.socket.emit('ping', { timestamp: startTime });
    });
  }
}