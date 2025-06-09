
import { supabase } from "@/integrations/supabase/client";
import { PlayerColor } from "@/types/game";

export interface GamePlayer {
  id: string;
  name: string;
  walletAddress: string;
  color: PlayerColor;
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
  isAlive: boolean;
}

export interface GameSyncEvent {
  type: 'collision' | 'elimination' | 'player_joined' | 'player_left' | 'game_start';
  playerId: string;
  data: any;
  timestamp: number;
}

export interface GameSyncCallbacks {
  onPlayerPositionUpdate?: (playerId: string, position: { x: number; y: number; size: number; velocityX?: number; velocityY?: number }) => void;
  onPlayerCollision?: (eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => void;
  onPlayerEliminated?: (eliminatedId: string, eliminatorId: string) => void;
  onPlayerJoined?: (player: GamePlayer) => void;
  onPlayerLeft?: (playerId: string) => void;
  onGameStart?: (gameData: any) => void;
}

export class UnifiedGameSyncService {
  private roomId: string;
  private playerId: string;
  private playerName: string;
  private channel: any;
  private callbacks: GameSyncCallbacks;
  private isConnected = false;
  
  // Optimized for 50Hz synchronization
  private positionLoop: NodeJS.Timeout | null = null;
  private heartbeatLoop: NodeJS.Timeout | null = null;
  private dbUpdateLoop: NodeJS.Timeout | null = null;
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private channelName: string;
  
  // Position caching for 50Hz optimization
  private lastPosition: { x: number; y: number; size: number; velocityX?: number; velocityY?: number } | null = null;
  private positionUpdateCount = 0;
  private lastDbUpdate = 0;

  constructor(roomId: string, playerId: string, playerName: string, callbacks: GameSyncCallbacks) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.playerName = playerName;
    this.callbacks = callbacks;
    this.channelName = `game-${this.roomId}`;
    
    console.log(`[UnifiedGameSync] Initialized with 50Hz sync for room: ${this.roomId}, player: ${this.playerId}`);
  }

  async connect(): Promise<boolean> {
    try {
      this.connectionState = 'connecting';
      console.log(`[UnifiedGameSync] 🔄 Connecting to channel: ${this.channelName} with 50Hz sync`);

      // Verify player is in room
      const { data: playerInRoom, error: verifyError } = await supabase
        .from('game_room_players')
        .select('player_id')
        .eq('room_id', this.roomId)
        .eq('player_id', this.playerId)
        .single();

      if (verifyError || !playerInRoom) {
        console.error(`[UnifiedGameSync] ❌ Player not in room`);
        this.connectionState = 'disconnected';
        return false;
      }

      // Clean up existing channel
      if (this.channel) {
        await supabase.removeChannel(this.channel);
        this.channel = null;
      }

      // Create optimized channel for 50Hz
      this.channel = supabase.channel(this.channelName, {
        config: {
          broadcast: { 
            self: false,
            ack: false // Disable acknowledgments for faster transmission
          },
          presence: { key: this.playerId }
        }
      });

      // High-frequency position updates (50Hz)
      this.channel.on('broadcast', { event: 'position' }, ({ payload }: any) => {
        const { id, x, y, size, velocityX, velocityY } = payload;
        if (id !== this.playerId) {
          this.callbacks.onPlayerPositionUpdate?.(id, { x, y, size, velocityX, velocityY });
        }
      });

      // Game events listener
      this.channel.on('broadcast', { event: 'game_event' }, (payload: any) => {
        this.handleGameEvent(payload);
      });

      // Presence events
      this.channel.on('presence', { event: 'join' }, ({ newPresences }: any) => {
        const playerData = newPresences[0];
        if (playerData && playerData.playerId !== this.playerId) {
          this.handlePlayerJoin(playerData);
        }
      });

      this.channel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
        const playerData = leftPresences[0];
        if (playerData) {
          this.callbacks.onPlayerLeft?.(playerData.playerId);
        }
      });

      // Subscribe and start loops
      return new Promise((resolve) => {
        this.channel.subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            this.isConnected = true;
            this.connectionState = 'connected';
            
            // Announce presence
            await this.announcePresence();
            
            // Start optimized 50Hz position broadcasting
            this.startPositionBroadcasting();
            
            // Heartbeat présence (10s - no need to change)
            this.heartbeatLoop = setInterval(() => {
              if (this.channel && this.isConnected) {
                this.channel.track({ ts: Date.now() });
              }
            }, 10000);
            
            // Database updates at lower frequency (every 200ms / 5Hz)
            this.dbUpdateLoop = setInterval(() => {
              this.flushToDatabase();
            }, 200);
            
            console.log(`[UnifiedGameSync] ✅ Connected with 50Hz synchronization`);
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this.connectionState = 'disconnected';
            this.isConnected = false;
            resolve(false);
          }
        });
      });

    } catch (error) {
      console.error('[UnifiedGameSync] ❌ Connection error:', error);
      this.connectionState = 'disconnected';
      this.isConnected = false;
      return false;
    }
  }

  private startPositionBroadcasting() {
    if (this.positionLoop) {
      clearInterval(this.positionLoop);
    }

    // 50Hz position broadcasting (every 20ms)
    this.positionLoop = setInterval(() => {
      if (this.channel && this.isConnected && this.lastPosition) {
        this.channel.send({
          type: 'broadcast',
          event: 'position',
          payload: { 
            id: this.playerId, 
            ...this.lastPosition,
            timestamp: Date.now()
          }
        });
        this.positionUpdateCount++;
      }
    }, 20); // 50Hz = 20ms interval
  }

  private async flushToDatabase() {
    if (!this.lastPosition || Date.now() - this.lastDbUpdate < 180) return;

    try {
      await supabase
        .from('game_room_players')
        .update({ 
          x: this.lastPosition.x, 
          y: this.lastPosition.y, 
          size: this.lastPosition.size,
          velocity_x: this.lastPosition.velocityX || 0,
          velocity_y: this.lastPosition.velocityY || 0,
          last_position_update: new Date().toISOString()
        })
        .eq('room_id', this.roomId)
        .eq('player_id', this.playerId);
      
      this.lastDbUpdate = Date.now();
    } catch (error) {
      // Silent fail for DB updates to maintain performance
      console.warn('[UnifiedGameSync] DB update failed:', error);
    }
  }

  private async handlePlayerJoin(playerData: any) {
    try {
      const position = await this.loadPlayerPosition(playerData.playerId);
      
      const joinedPlayer: GamePlayer = {
        id: playerData.playerId,
        name: playerData.name,
        walletAddress: playerData.walletAddress || playerData.playerId,
        color: 'blue' as PlayerColor,
        x: position?.x || 1500,
        y: position?.y || 1500,
        size: position?.size || 15,
        isAlive: true
      };
      
      this.callbacks.onPlayerJoined?.(joinedPlayer);
    } catch (error) {
      console.error('[UnifiedGameSync] ❌ Error handling player join:', error);
    }
  }

  private async loadPlayerPosition(playerId: string): Promise<{x: number, y: number, size: number} | null> {
    try {
      const { data, error } = await supabase
        .from('game_room_players')
        .select('x, y, size')
        .eq('room_id', this.roomId)
        .eq('player_id', playerId)
        .single();

      return error ? null : { x: data.x, y: data.y, size: data.size };
    } catch (error) {
      return null;
    }
  }

  private async announcePresence() {
    try {
      const playerData = {
        playerId: this.playerId,
        name: this.playerName,
        walletAddress: this.playerId,
        joinedAt: Date.now()
      };

      await this.channel.track(playerData);
    } catch (error) {
      console.error('[UnifiedGameSync] ❌ Error announcing presence:', error);
    }
  }

  private handleGameEvent(event: GameSyncEvent) {
    switch (event.type) {
      case 'collision':
        this.callbacks.onPlayerCollision?.(
          event.data.eliminatedId,
          event.data.eliminatorId,
          event.data.eliminatedSize,
          event.data.eliminatorNewSize
        );
        break;
        
      case 'elimination':
        this.callbacks.onPlayerEliminated?.(event.data.eliminatedId, event.data.eliminatorId);
        break;
        
      case 'game_start':
        this.callbacks.onGameStart?.(event.data);
        break;
    }
  }

  // Updated to cache position for 50Hz broadcasting
  async broadcastPlayerPosition(x: number, y: number, size: number, velocityX = 0, velocityY = 0) {
    if (!this.isConnected) {
      return;
    }

    // Cache the latest position for high-frequency broadcasting
    this.lastPosition = { x, y, size, velocityX, velocityY };

    // Position loop handles the actual broadcasting at 50Hz
    if (!this.positionLoop) {
      this.startPositionBroadcasting();
    }
  }

  async broadcastPlayerCollision(eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) {
    await this.broadcastEvent({
      type: 'collision',
      playerId: this.playerId,
      data: { eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize },
      timestamp: Date.now()
    });
  }

  async broadcastPlayerElimination(eliminatedId: string, eliminatorId: string) {
    await this.broadcastEvent({
      type: 'elimination',
      playerId: this.playerId,
      data: { eliminatedId, eliminatorId },
      timestamp: Date.now()
    });
  }

  private async broadcastEvent(event: GameSyncEvent) {
    if (!this.isConnected || !this.channel) {
      return;
    }

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event
      });
    } catch (error) {
      console.error(`[UnifiedGameSync] ❌ Broadcast error:`, error);
    }
  }

  getDiagnostics() {
    return {
      isConnected: this.isConnected,
      connectionState: this.connectionState,
      channelName: this.channelName,
      roomId: this.roomId,
      playerId: this.playerId,
      positionUpdateCount: this.positionUpdateCount,
      syncFrequency: '50Hz',
      lastDbUpdate: this.lastDbUpdate
    };
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      state: this.connectionState,
      roomId: this.roomId,
      diagnostics: {
        positionUpdates: this.positionUpdateCount,
        frequency: '50Hz'
      }
    };
  }

  disconnect() {
    console.log(`[UnifiedGameSync] 🔌 Disconnecting 50Hz sync from room: ${this.roomId}`);
    
    if (this.positionLoop) {
      clearInterval(this.positionLoop);
      this.positionLoop = null;
    }

    if (this.heartbeatLoop) {
      clearInterval(this.heartbeatLoop);
      this.heartbeatLoop = null;
    }

    if (this.dbUpdateLoop) {
      clearInterval(this.dbUpdateLoop);
      this.dbUpdateLoop = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.isConnected = false;
    this.connectionState = 'disconnected';
    this.lastPosition = null;
    this.positionUpdateCount = 0;
  }
}
