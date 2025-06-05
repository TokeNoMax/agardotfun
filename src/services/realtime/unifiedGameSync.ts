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
  type: 'position' | 'collision' | 'elimination' | 'player_joined' | 'player_left' | 'game_start' | 'ping' | 'pong';
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
  
  // Optimized frequencies
  private lastPositionBroadcast = 0;
  private positionBroadcastThrottle = 50; // 20 FPS
  private lastDbUpdate = 0;
  private dbUpdateInterval = 1000; // 1 second
  
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private channelName: string;

  // Diagnostic counters
  private diagnostics = {
    eventsReceived: 0,
    eventsSent: 0,
    positionsReceived: 0,
    positionsSent: 0,
    pingsSent: 0,
    pongsReceived: 0
  };

  constructor(roomId: string, playerId: string, playerName: string, callbacks: GameSyncCallbacks) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.playerName = playerName;
    this.callbacks = callbacks;
    this.channelName = `game-${this.roomId}`;
    
    console.log(`[UnifiedGameSync] Initialized for room: ${this.roomId}, player: ${this.playerId}, channel: ${this.channelName}`);
  }

  async connect(): Promise<boolean> {
    try {
      this.connectionState = 'connecting';
      console.log(`[UnifiedGameSync] 🔄 Connecting to channel: ${this.channelName}`);

      // CORRECTION 4: Vérifier que le joueur est bien dans la room avant d'ouvrir le channel
      console.log(`[UnifiedGameSync] 🔍 Verifying player presence in room...`);
      const { data: playerInRoom, error: verifyError } = await supabase
        .from('game_room_players')
        .select('player_id')
        .eq('room_id', this.roomId)
        .eq('player_id', this.playerId)
        .single();

      if (verifyError) {
        if (verifyError.code === 'PGRST116') {
          console.error(`[UnifiedGameSync] ❌ Player ${this.playerId} not found in room ${this.roomId}`);
          this.connectionState = 'disconnected';
          return false;
        }
        console.error(`[UnifiedGameSync] ❌ Error verifying player in room:`, verifyError);
        this.connectionState = 'disconnected';
        return false;
      }

      if (!playerInRoom) {
        console.error(`[UnifiedGameSync] ❌ Player not in room, aborting connection`);
        this.connectionState = 'disconnected';
        return false;
      }

      console.log(`[UnifiedGameSync] ✅ Player verified in room, proceeding with channel connection`);

      // Clean up any existing channel first
      if (this.channel) {
        console.log(`[UnifiedGameSync] 🧹 Cleaning up existing channel`);
        await supabase.removeChannel(this.channel);
        this.channel = null;
      }

      // Create channel with detailed logging
      this.channel = supabase.channel(this.channelName, {
        config: {
          broadcast: { self: false }, // Don't receive our own messages
          presence: { key: this.playerId }
        }
      });

      console.log(`[UnifiedGameSync] 📡 Channel created with name: ${this.channel.topic}`);

      // Enhanced event listeners with detailed logging
      this.channel.on('broadcast', { event: 'game_event' }, (payload: any) => {
        this.diagnostics.eventsReceived++;
        console.log(`[UnifiedGameSync] 📥 Event received (#${this.diagnostics.eventsReceived}):`, payload.type, payload);
        this.handleGameEvent(payload);
      });

      // Presence sync - when all presence states sync
      this.channel.on('presence', { event: 'sync' }, () => {
        const presences = this.channel.presenceState();
        console.log(`[UnifiedGameSync] 🔄 Presence sync - total players:`, Object.keys(presences).length, presences);
        this.syncPlayersFromPresence(presences);
      });

      // Player joins
      this.channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        console.log(`[UnifiedGameSync] ✅ Player joined:`, key, newPresences);
        const playerData = newPresences[0];
        if (playerData && playerData.playerId !== this.playerId) {
          this.handlePlayerJoin(playerData);
        }
      });

      // Player leaves
      this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
        console.log(`[UnifiedGameSync] ❌ Player left:`, key, leftPresences);
        const playerData = leftPresences[0];
        if (playerData) {
          this.callbacks.onPlayerLeft?.(playerData.playerId);
          
          // Schedule disconnection cleanup
          import('@/services/room/disconnectionService').then(({ disconnectionService }) => {
            disconnectionService.scheduleDisconnection(this.roomId, playerData.playerId);
          });
        }
      });

      // Subscribe with detailed status tracking and enhanced verification
      return new Promise((resolve) => {
        this.channel.subscribe(async (status: string) => {
          console.log(`[UnifiedGameSync] 📊 Channel status changed to: ${status}`);
          
          switch (status) {
            case 'SUBSCRIBED':
              // CORRECTION 5: Vérification du statut du channel avec logs détaillés
              console.log(`[UnifiedGameSync] ✅ [STATUS] SUBSCRIBED - Channel fully connected`);
              
              // Vérifier que le channel est vraiment prêt
              if (this.channel && this.channel.state === 'joined') {
                this.isConnected = true;
                this.connectionState = 'connected';
                console.log(`[UnifiedGameSync] ✅ Channel state confirmed as 'joined'`);
                
                // Announce presence
                await this.announcePresence();
                
                // Start heartbeat and ping system
                this.startHeartbeat();
                this.startPingSystem();
                
                console.log(`[UnifiedGameSync] 🎯 Connection fully established and ready`);
                resolve(true);
              } else {
                console.warn(`[UnifiedGameSync] ⚠️ Channel subscribed but state is not 'joined':`, this.channel?.state);
                resolve(false);
              }
              break;
              
            case 'CHANNEL_ERROR':
            case 'TIMED_OUT':
            case 'CLOSED':
              this.connectionState = 'disconnected';
              this.isConnected = false;
              console.error(`[UnifiedGameSync] ❌ Channel error/timeout/closed: ${status}`);
              resolve(false);
              break;
              
            default:
              console.log(`[UnifiedGameSync] ⏳ Channel status: ${status}`);
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

  private async handlePlayerJoin(playerData: any) {
    try {
      // Load position from database
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
      
      console.log(`[UnifiedGameSync] 🆕 Adding joined player:`, joinedPlayer);
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

      if (error) {
        console.log(`[UnifiedGameSync] ⚠️ No position found for player: ${playerId}`);
        return null;
      }

      console.log(`[UnifiedGameSync] 📍 Loaded position for ${playerId}:`, data);
      return { x: data.x, y: data.y, size: data.size };
    } catch (error) {
      console.error('[UnifiedGameSync] ❌ Error loading player position:', error);
      return null;
    }
  }

  private syncPlayersFromPresence(presences: any) {
    console.log('[UnifiedGameSync] 🔄 Syncing players from presence state');
    for (const [key, playerPresences] of Object.entries(presences)) {
      if (Array.isArray(playerPresences) && playerPresences.length > 0) {
        const playerData = playerPresences[0] as any;
        if (playerData.playerId !== this.playerId) {
          console.log(`[UnifiedGameSync] 🔄 Syncing existing player: ${playerData.playerId}`);
          this.loadPlayerPosition(playerData.playerId).then(position => {
            if (position) {
              this.callbacks.onPlayerPositionUpdate?.(playerData.playerId, position);
            }
          });
        }
      }
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
      console.log('[UnifiedGameSync] 📢 Presence announced:', playerData);
      
      // Cancel any scheduled disconnection
      import('@/services/room/disconnectionService').then(({ disconnectionService }) => {
        disconnectionService.cancelDisconnection(this.playerId);
      });
    } catch (error) {
      console.error('[UnifiedGameSync] ❌ Error announcing presence:', error);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('[UnifiedGameSync] 💔 Heartbeat detected disconnection');
        this.connectionState = 'disconnected';
      }
    }, 10000);
  }

  private startPingSystem() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Send ping every 5 seconds to test connectivity
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
      }
    }, 5000);
  }

  private async sendPing() {
    try {
      this.diagnostics.pingsSent++;
      await this.broadcastEvent({
        type: 'ping',
        playerId: this.playerId,
        data: { timestamp: Date.now(), counter: this.diagnostics.pingsSent },
        timestamp: Date.now()
      });
      console.log(`[UnifiedGameSync] 🏓 Ping sent (#${this.diagnostics.pingsSent})`);
    } catch (error) {
      console.error('[UnifiedGameSync] ❌ Error sending ping:', error);
    }
  }

  private async sendPong(originalPlayerId: string, pingData: any) {
    try {
      await this.broadcastEvent({
        type: 'pong',
        playerId: this.playerId,
        data: { originalPlayerId, pingData, timestamp: Date.now() },
        timestamp: Date.now()
      });
      console.log(`[UnifiedGameSync] 🏓 Pong sent to ${originalPlayerId}`);
    } catch (error) {
      console.error('[UnifiedGameSync] ❌ Error sending pong:', error);
    }
  }

  private handleGameEvent(event: GameSyncEvent) {
    // Don't process our own events
    if (event.playerId === this.playerId) {
      console.log(`[UnifiedGameSync] ⏭️ Ignoring own event: ${event.type}`);
      return;
    }

    console.log(`[UnifiedGameSync] 🎯 Processing event: ${event.type} from ${event.playerId}`);

    switch (event.type) {
      case 'position':
        this.diagnostics.positionsReceived++;
        console.log(`[UnifiedGameSync] 📍 Position update (#${this.diagnostics.positionsReceived}):`, event.data);
        this.callbacks.onPlayerPositionUpdate?.(event.playerId, event.data);
        break;
        
      case 'collision':
        console.log(`[UnifiedGameSync] 💥 Collision event:`, event.data);
        this.callbacks.onPlayerCollision?.(
          event.data.eliminatedId,
          event.data.eliminatorId,
          event.data.eliminatedSize,
          event.data.eliminatorNewSize
        );
        break;
        
      case 'elimination':
        console.log(`[UnifiedGameSync] ☠️ Elimination event:`, event.data);
        this.callbacks.onPlayerEliminated?.(event.data.eliminatedId, event.data.eliminatorId);
        break;
        
      case 'game_start':
        console.log(`[UnifiedGameSync] 🚀 Game start event:`, event.data);
        this.callbacks.onGameStart?.(event.data);
        break;
        
      case 'ping':
        console.log(`[UnifiedGameSync] 🏓 Ping received from ${event.playerId}, sending pong`);
        this.sendPong(event.playerId, event.data);
        break;
        
      case 'pong':
        if (event.data.originalPlayerId === this.playerId) {
          this.diagnostics.pongsReceived++;
          const latency = Date.now() - event.data.pingData.timestamp;
          console.log(`[UnifiedGameSync] 🏓 Pong received (#${this.diagnostics.pongsReceived}) - latency: ${latency}ms`);
        }
        break;
        
      default:
        console.warn(`[UnifiedGameSync] ⚠️ Unknown event type: ${event.type}`);
    }
  }

  // Enhanced position broadcasting with better logging
  async broadcastPlayerPosition(x: number, y: number, size: number, velocityX = 0, velocityY = 0) {
    const now = Date.now();
    
    // Real-time broadcast (20 FPS)
    if (now - this.lastPositionBroadcast >= this.positionBroadcastThrottle) {
      this.lastPositionBroadcast = now;
      this.diagnostics.positionsSent++;
      
      await this.broadcastEvent({
        type: 'position',
        playerId: this.playerId,
        data: { x, y, size, velocityX, velocityY },
        timestamp: now
      });
      
      if (this.diagnostics.positionsSent % 20 === 0) { // Log every second
        console.log(`[UnifiedGameSync] 📤 Position sent (#${this.diagnostics.positionsSent}):`, { x, y, size });
      }
    }

    // Database persistence (1 second interval)
    if (now - this.lastDbUpdate >= this.dbUpdateInterval) {
      this.lastDbUpdate = now;
      
      try {
        const { error } = await supabase
          .from('game_room_players')
          .update({
            x,
            y,
            size,
            velocity_x: velocityX,
            velocity_y: velocityY,
            last_position_update: new Date().toISOString()
          })
          .eq('room_id', this.roomId)
          .eq('player_id', this.playerId);

        if (error) {
          console.error('[UnifiedGameSync] ❌ DB position update error:', error);
        }
      } catch (error) {
        console.error('[UnifiedGameSync] ❌ Error updating position in DB:', error);
      }
    }
  }

  async broadcastPlayerCollision(eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) {
    console.log(`[UnifiedGameSync] 💥 Broadcasting collision: ${eliminatedId} eliminated by ${eliminatorId}`);
    await this.broadcastEvent({
      type: 'collision',
      playerId: this.playerId,
      data: { eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize },
      timestamp: Date.now()
    });
  }

  async broadcastPlayerElimination(eliminatedId: string, eliminatorId: string) {
    console.log(`[UnifiedGameSync] ☠️ Broadcasting elimination: ${eliminatedId} by ${eliminatorId}`);
    await this.broadcastEvent({
      type: 'elimination',
      playerId: this.playerId,
      data: { eliminatedId, eliminatorId },
      timestamp: Date.now()
    });
  }

  private async broadcastEvent(event: GameSyncEvent) {
    if (!this.isConnected || !this.channel) {
      console.warn(`[UnifiedGameSync] ⚠️ Cannot broadcast ${event.type} - not connected (state: ${this.connectionState})`);
      return;
    }

    try {
      this.diagnostics.eventsSent++;
      await this.channel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event
      });
      
      if (event.type !== 'position') { // Don't spam logs for position events
        console.log(`[UnifiedGameSync] 📤 Event sent (#${this.diagnostics.eventsSent}): ${event.type}`);
      }
    } catch (error) {
      console.error(`[UnifiedGameSync] ❌ Broadcast error for ${event.type}:`, error);
    }
  }

  getDiagnostics() {
    return {
      ...this.diagnostics,
      isConnected: this.isConnected,
      connectionState: this.connectionState,
      channelName: this.channelName,
      roomId: this.roomId,
      playerId: this.playerId
    };
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      state: this.connectionState,
      roomId: this.roomId,
      diagnostics: this.diagnostics
    };
  }

  disconnect() {
    console.log(`[UnifiedGameSync] 🔌 Disconnecting from room: ${this.roomId}`);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.isConnected = false;
    this.connectionState = 'disconnected';
    
    console.log(`[UnifiedGameSync] 📊 Final diagnostics:`, this.diagnostics);
  }
}
