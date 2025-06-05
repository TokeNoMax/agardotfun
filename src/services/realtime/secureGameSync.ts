
import { supabase } from "@/integrations/supabase/client";
import { PlayerColor } from "@/types/game";
import { positionUpdateLimiter, gameEventLimiter, connectionLimiter } from "@/services/security/rateLimiter";
import { PositionValidator } from "@/services/security/positionValidator";

export interface SecureGamePlayer {
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
  lastUpdate: number;
}

export interface SecureGameSyncEvent {
  type: 'collision' | 'elimination' | 'player_joined' | 'player_left' | 'game_start' | 'validated_move';
  playerId: string;
  data: any;
  timestamp: number;
  signature?: string;
}

export interface SecureGameSyncCallbacks {
  onPlayerPositionUpdate?: (playerId: string, position: { x: number; y: number; size: number; velocityX?: number; velocityY?: number }) => void;
  onPlayerCollision?: (eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => void;
  onPlayerEliminated?: (eliminatedId: string, eliminatorId: string) => void;
  onPlayerJoined?: (player: SecureGamePlayer) => void;
  onPlayerLeft?: (playerId: string) => void;
  onGameStart?: (gameData: any) => void;
  onSecurityViolation?: (violation: string, playerId: string) => void;
}

export class SecureGameSyncService {
  private roomId: string;
  private playerId: string;
  private playerName: string;
  private channel: any;
  private callbacks: SecureGameSyncCallbacks;
  private isConnected = false;
  private authToken: string | null = null;
  
  // Enhanced security tracking
  private lastPositionBroadcast = 0;
  private positionBroadcastThrottle = 50; // 20 FPS
  private lastDbUpdate = 0;
  private dbUpdateInterval = 1000;
  private playerPositions = new Map<string, { x: number; y: number; timestamp: number }>();
  
  private connectionAttempts = 0;
  private maxConnectionAttempts = 3;
  
  constructor(roomId: string, playerId: string, playerName: string, callbacks: SecureGameSyncCallbacks) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.playerName = playerName;
    this.callbacks = callbacks;
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`[SecureGameSync] 🔐 Connecting securely to room: ${this.roomId}`);
      
      // Get authentication token
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        console.error('[SecureGameSync] ❌ No valid session found');
        return false;
      }
      
      this.authToken = session.access_token;
      
      // Verify player is authenticated and in room
      const { data: playerData, error: verifyError } = await supabase
        .from('game_room_players')
        .select('*')
        .eq('room_id', this.roomId)
        .eq('player_id', this.playerId)
        .single();

      if (verifyError || !playerData) {
        console.error('[SecureGameSync] ❌ Player verification failed:', verifyError);
        return false;
      }

      // Rate limit connection attempts
      if (!connectionLimiter.isAllowed(this.playerId)) {
        console.error('[SecureGameSync] ❌ Connection rate limit exceeded');
        this.callbacks.onSecurityViolation?.('connection_rate_limit', this.playerId);
        return false;
      }

      // Clean up existing channel
      if (this.channel) {
        await supabase.removeChannel(this.channel);
        this.channel = null;
      }

      // Create authenticated channel
      const channelName = `secure-game-${this.roomId}`;
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: this.playerId }
        }
      });

      // Set up secure event listeners
      this.setupSecureEventListeners();

      // Subscribe with authentication verification
      return new Promise((resolve) => {
        this.channel.subscribe(async (status: string) => {
          console.log(`[SecureGameSync] 📊 Channel status: ${status}`);
          
          if (status === 'SUBSCRIBED') {
            this.isConnected = true;
            console.log(`[SecureGameSync] ✅ Secure connection established`);
            
            // Announce authenticated presence
            await this.announceSecurePresence();
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            this.isConnected = false;
            console.error(`[SecureGameSync] ❌ Connection failed: ${status}`);
            resolve(false);
          }
        });
      });

    } catch (error) {
      console.error('[SecureGameSync] ❌ Connection error:', error);
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        this.callbacks.onSecurityViolation?.('max_connection_attempts', this.playerId);
      }
      
      return false;
    }
  }

  private setupSecureEventListeners() {
    // Secure position updates with validation
    this.channel.on('broadcast', { event: 'secure_position' }, (payload: any) => {
      if (!this.validatePlayerMessage(payload)) {
        this.callbacks.onSecurityViolation?.('invalid_position_message', payload.playerId || 'unknown');
        return;
      }

      const { playerId, x, y, size, velocityX, velocityY, timestamp } = payload;
      
      // Validate position data
      const lastPos = this.playerPositions.get(playerId);
      const validation = PositionValidator.validatePosition(
        x, y, size, 
        lastPos?.x || x, lastPos?.y || y, 
        lastPos?.timestamp || timestamp, timestamp
      );

      if (!validation.isValid) {
        console.warn(`[SecureGameSync] ⚠️ Invalid position from ${playerId}: ${validation.reason}`);
        this.callbacks.onSecurityViolation?.(`invalid_position: ${validation.reason}`, playerId);
        
        // Use corrected position if available
        if (validation.correctedPosition) {
          this.callbacks.onPlayerPositionUpdate?.(playerId, {
            x: validation.correctedPosition.x,
            y: validation.correctedPosition.y,
            size, velocityX, velocityY
          });
        }
        return;
      }

      // Update position tracking
      this.playerPositions.set(playerId, { x, y, timestamp });
      
      this.callbacks.onPlayerPositionUpdate?.(playerId, {
        x, y, size, velocityX, velocityY
      });
    });

    // Secure game events with authentication
    this.channel.on('broadcast', { event: 'secure_game_event' }, (payload: any) => {
      if (!this.validatePlayerMessage(payload)) {
        this.callbacks.onSecurityViolation?.('invalid_game_event', payload.playerId || 'unknown');
        return;
      }

      this.handleSecureGameEvent(payload);
    });

    // Authenticated presence events
    this.channel.on('presence', { event: 'sync' }, () => {
      const presences = this.channel.presenceState();
      console.log(`[SecureGameSync] 🔄 Secure presence sync:`, Object.keys(presences).length);
    });

    this.channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
      console.log(`[SecureGameSync] ✅ Authenticated player joined:`, key);
      const playerData = newPresences[0];
      if (playerData && this.validatePresenceData(playerData)) {
        this.handleSecurePlayerJoin(playerData);
      }
    });

    this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
      console.log(`[SecureGameSync] ❌ Player left:`, key);
      const playerData = leftPresences[0];
      if (playerData) {
        this.callbacks.onPlayerLeft?.(playerData.playerId);
      }
    });
  }

  private validatePlayerMessage(payload: any): boolean {
    if (!payload || typeof payload !== 'object') return false;
    if (!payload.playerId || typeof payload.playerId !== 'string') return false;
    if (!payload.timestamp || typeof payload.timestamp !== 'number') return false;
    
    // Check timestamp is recent (within 10 seconds)
    const now = Date.now();
    if (Math.abs(now - payload.timestamp) > 10000) {
      console.warn(`[SecureGameSync] ⚠️ Message timestamp too old/future: ${payload.timestamp} vs ${now}`);
      return false;
    }
    
    return true;
  }

  private validatePresenceData(data: any): boolean {
    return data && 
           typeof data.playerId === 'string' && 
           typeof data.name === 'string' &&
           typeof data.joinedAt === 'number';
  }

  private async announceSecurePresence() {
    try {
      const presenceData = {
        playerId: this.playerId,
        name: this.playerName,
        walletAddress: this.playerId,
        joinedAt: Date.now(),
        authToken: this.authToken?.substring(0, 10) // Partial token for verification
      };

      await this.channel.track(presenceData);
      console.log('[SecureGameSync] 📢 Secure presence announced');
    } catch (error) {
      console.error('[SecureGameSync] ❌ Error announcing presence:', error);
    }
  }

  async broadcastSecurePosition(x: number, y: number, size: number, velocityX = 0, velocityY = 0) {
    const now = Date.now();
    
    // Rate limiting
    if (!positionUpdateLimiter.isAllowed(this.playerId)) {
      console.warn('[SecureGameSync] ⚠️ Position update rate limit exceeded');
      return;
    }
    
    if (now - this.lastPositionBroadcast >= this.positionBroadcastThrottle && this.isConnected) {
      this.lastPositionBroadcast = now;
      
      // Sanitize data
      const sanitizedData = PositionValidator.sanitizePlayerData({
        x, y, size, velocityX, velocityY
      });
      
      try {
        // Validate with server-side function
        const { data: validation } = await supabase.functions.invoke('validate-game-action', {
          body: {
            action: 'move',
            playerId: this.playerId,
            roomId: this.roomId,
            data: sanitizedData,
            timestamp: now
          }
        });

        if (validation?.success) {
          await this.channel.send({
            type: 'broadcast',
            event: 'secure_position',
            payload: {
              playerId: this.playerId,
              ...sanitizedData,
              timestamp: now
            }
          });
        } else {
          console.warn('[SecureGameSync] ⚠️ Server rejected position:', validation?.reason);
        }
      } catch (error) {
        console.error('[SecureGameSync] ❌ Error validating position:', error);
      }
    }

    // Database persistence with authentication
    if (now - this.lastDbUpdate >= this.dbUpdateInterval) {
      this.lastDbUpdate = now;
      await this.updateSecurePosition(x, y, size, velocityX, velocityY);
    }
  }

  private async updateSecurePosition(x: number, y: number, size: number, velocityX: number, velocityY: number) {
    try {
      const { error } = await supabase
        .from('game_room_players')
        .update({
          x, y, size,
          velocity_x: velocityX,
          velocity_y: velocityY,
          last_position_update: new Date().toISOString()
        })
        .eq('room_id', this.roomId)
        .eq('player_id', this.playerId);

      if (error) {
        console.error('[SecureGameSync] ❌ Secure position update failed:', error);
        this.callbacks.onSecurityViolation?.('db_update_failed', this.playerId);
      }
    } catch (error) {
      console.error('[SecureGameSync] ❌ Error updating secure position:', error);
    }
  }

  private async handleSecureGameEvent(event: SecureGameSyncEvent) {
    // Rate limiting for game events
    if (!gameEventLimiter.isAllowed(event.playerId)) {
      console.warn('[SecureGameSync] ⚠️ Game event rate limit exceeded for player:', event.playerId);
      this.callbacks.onSecurityViolation?.('game_event_rate_limit', event.playerId);
      return;
    }

    console.log(`[SecureGameSync] 🎯 Processing secure game event: ${event.type}`);

    switch (event.type) {
      case 'collision':
        // Server-side validation for collision
        try {
          const { data: validation } = await supabase.functions.invoke('validate-game-action', {
            body: {
              action: 'collision',
              playerId: event.playerId,
              roomId: this.roomId,
              data: event.data,
              timestamp: event.timestamp
            }
          });

          if (validation?.success) {
            this.callbacks.onPlayerCollision?.(
              event.data.eliminatedId,
              event.data.eliminatorId,
              event.data.eliminatedSize,
              event.data.eliminatorNewSize
            );
          } else {
            console.warn('[SecureGameSync] ⚠️ Invalid collision rejected:', validation?.reason);
            this.callbacks.onSecurityViolation?.('invalid_collision', event.playerId);
          }
        } catch (error) {
          console.error('[SecureGameSync] ❌ Error validating collision:', error);
        }
        break;
        
      case 'elimination':
        this.callbacks.onPlayerEliminated?.(event.data.eliminatedId, event.data.eliminatorId);
        break;
        
      case 'game_start':
        this.callbacks.onGameStart?.(event.data);
        break;
    }
  }

  private async handleSecurePlayerJoin(playerData: any) {
    try {
      // Load authenticated player data from database
      const { data: dbPlayer, error } = await supabase
        .from('game_room_players')
        .select('*')
        .eq('room_id', this.roomId)
        .eq('player_id', playerData.playerId)
        .single();

      if (error || !dbPlayer) {
        console.warn('[SecureGameSync] ⚠️ Could not verify joined player');
        return;
      }

      const securePlayer: SecureGamePlayer = {
        id: dbPlayer.player_id,
        name: dbPlayer.player_name,
        walletAddress: dbPlayer.player_id,
        color: 'blue' as PlayerColor,
        x: dbPlayer.x,
        y: dbPlayer.y,
        size: dbPlayer.size,
        isAlive: dbPlayer.is_alive,
        lastUpdate: Date.now()
      };

      this.callbacks.onPlayerJoined?.(securePlayer);
    } catch (error) {
      console.error('[SecureGameSync] ❌ Error handling secure player join:', error);
    }
  }

  async broadcastSecureCollision(eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) {
    if (!gameEventLimiter.isAllowed(this.playerId)) {
      console.warn('[SecureGameSync] ⚠️ Collision broadcast rate limited');
      return;
    }

    try {
      const event: SecureGameSyncEvent = {
        type: 'collision',
        playerId: this.playerId,
        data: { eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize },
        timestamp: Date.now()
      };

      await this.channel.send({
        type: 'broadcast',
        event: 'secure_game_event',
        payload: event
      });

      console.log('[SecureGameSync] 💥 Secure collision broadcasted');
    } catch (error) {
      console.error('[SecureGameSync] ❌ Error broadcasting secure collision:', error);
    }
  }

  getDiagnostics() {
    return {
      isConnected: this.isConnected,
      roomId: this.roomId,
      playerId: this.playerId,
      authToken: this.authToken ? 'present' : 'missing',
      connectionAttempts: this.connectionAttempts,
      rateLimits: {
        positionUpdates: positionUpdateLimiter.getRemainingRequests(this.playerId),
        gameEvents: gameEventLimiter.getRemainingRequests(this.playerId)
      }
    };
  }

  disconnect() {
    console.log('[SecureGameSync] 🔌 Disconnecting secure connection');
    
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.isConnected = false;
    this.authToken = null;
    this.playerPositions.clear();
  }
}
