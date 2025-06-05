
import { supabase } from "@/integrations/supabase/client";

export interface GamePlayer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
  velocityX?: number;
  velocityY?: number;
  isAlive: boolean;
}

export interface GameSyncEvent {
  type: 'position' | 'collision' | 'elimination' | 'player_joined' | 'player_left' | 'game_start';
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
  
  // Optimisation des fréquences selon les recommandations
  private lastPositionBroadcast = 0;
  private positionBroadcastThrottle = 50; // 20 FPS pour fluidité temps réel
  private lastDbUpdate = 0;
  private dbUpdateInterval = 1000; // 1 seconde pour persistance
  
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

  constructor(roomId: string, playerId: string, playerName: string, callbacks: GameSyncCallbacks) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.playerName = playerName;
    this.callbacks = callbacks;
  }

  async connect(): Promise<boolean> {
    try {
      this.connectionState = 'connecting';
      console.log(`[UnifiedGameSync] Connecting to unified game sync: ${this.roomId}`);

      // Channel unique par room comme recommandé
      const channelName = `game-${this.roomId}`;
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false } // Ne pas recevoir ses propres messages
        }
      });

      // Écouter tous les événements de broadcast
      this.channel.on('broadcast', { event: 'game_event' }, (payload: any) => {
        this.handleGameEvent(payload.payload);
      });

      // Gestion de la présence (joueurs qui rejoignent/quittent)
      this.channel.on('presence', { event: 'sync' }, () => {
        const presences = this.channel.presenceState();
        console.log('[UnifiedGameSync] Presence sync:', presences);
      });

      this.channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        console.log('[UnifiedGameSync] Player joined:', key, newPresences);
        const playerData = newPresences[0];
        if (playerData && playerData.playerId !== this.playerId) {
          this.callbacks.onPlayerJoined?.(playerData);
        }
      });

      this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
        console.log('[UnifiedGameSync] Player left:', key, leftPresences);
        const playerData = leftPresences[0];
        if (playerData) {
          this.callbacks.onPlayerLeft?.(playerData.playerId);
          
          // Programmer la déconnection retardée
          import('@/services/room/disconnectionService').then(({ disconnectionService }) => {
            disconnectionService.scheduleDisconnection(this.roomId, playerData.playerId);
          });
        }
      });

      // S'abonner au channel
      const status = await this.channel.subscribe(async (status: string) => {
        console.log(`[UnifiedGameSync] Channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.connectionState = 'connected';
          
          // Annoncer sa présence
          await this.announcePresence();
          
          // Démarrer le heartbeat
          this.startHeartbeat();
          
          console.log(`[UnifiedGameSync] Successfully connected to room: ${this.roomId}`);
        } else if (status === 'CHANNEL_ERROR') {
          this.connectionState = 'disconnected';
          console.error('[UnifiedGameSync] Channel error');
        }
      });

      return this.isConnected;
    } catch (error) {
      console.error('[UnifiedGameSync] Connection error:', error);
      this.connectionState = 'disconnected';
      return false;
    }
  }

  private async announcePresence() {
    try {
      const playerData = {
        playerId: this.playerId,
        name: this.playerName,
        joinedAt: Date.now()
      };

      await this.channel.track(playerData);
      console.log('[UnifiedGameSync] Presence announced');
      
      // Annuler toute déconnection programmée
      import('@/services/room/disconnectionService').then(({ disconnectionService }) => {
        disconnectionService.cancelDisconnection(this.playerId);
      });
    } catch (error) {
      console.error('[UnifiedGameSync] Error announcing presence:', error);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('[UnifiedGameSync] Heartbeat detected disconnection');
        this.connectionState = 'disconnected';
      }
    }, 10000);
  }

  private handleGameEvent(event: GameSyncEvent) {
    // Ignorer ses propres événements
    if (event.playerId === this.playerId) return;

    console.log('[UnifiedGameSync] Received event:', event.type, event);

    switch (event.type) {
      case 'position':
        this.callbacks.onPlayerPositionUpdate?.(event.playerId, event.data);
        break;
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

  // Broadcast position avec throttling optimisé
  async broadcastPlayerPosition(x: number, y: number, size: number, velocityX = 0, velocityY = 0) {
    const now = Date.now();
    
    // Broadcast temps réel (50ms = 20 FPS)
    if (now - this.lastPositionBroadcast >= this.positionBroadcastThrottle) {
      this.lastPositionBroadcast = now;
      
      await this.broadcastEvent({
        type: 'position',
        playerId: this.playerId,
        data: { x, y, size, velocityX, velocityY },
        timestamp: now
      });
    }

    // Update DB pour persistance (1 seconde)
    if (now - this.lastDbUpdate >= this.dbUpdateInterval) {
      this.lastDbUpdate = now;
      
      try {
        await supabase
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
      } catch (error) {
        console.error('[UnifiedGameSync] Error updating position in DB:', error);
      }
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
      console.warn('[UnifiedGameSync] Cannot broadcast - not connected');
      return;
    }

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'game_event',
        payload: event
      });
    } catch (error) {
      console.error('[UnifiedGameSync] Broadcast error:', error);
    }
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      state: this.connectionState,
      roomId: this.roomId
    };
  }

  disconnect() {
    console.log('[UnifiedGameSync] Disconnecting from room:', this.roomId);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.isConnected = false;
    this.connectionState = 'disconnected';
  }
}
