
import { supabase } from "@/integrations/supabase/client";

export interface RoomPlayer {
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

export interface RoomSyncEvent {
  type: 'player_move' | 'player_collision' | 'player_eliminated' | 'player_joined' | 'player_left' | 'game_start';
  playerId: string;
  data: any;
  timestamp: number;
}

export interface RoomSyncCallbacks {
  onPlayerMove?: (playerId: string, position: { x: number; y: number; size: number; velocityX?: number; velocityY?: number }) => void;
  onPlayerCollision?: (eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) => void;
  onPlayerEliminated?: (eliminatedId: string, eliminatorId: string) => void;
  onPlayerJoined?: (player: RoomPlayer) => void;
  onPlayerLeft?: (playerId: string) => void;
  onGameStart?: (gameData: any) => void;
}

export class RoomBroadcastSyncService {
  private roomId: string;
  private playerId: string;
  private playerName: string;
  private channel: any;
  private callbacks: RoomSyncCallbacks;
  private isConnected = false;
  private lastMoveSync = 0;
  private moveThrottle = 50; // 20fps pour les mouvements
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

  constructor(roomId: string, playerId: string, playerName: string, callbacks: RoomSyncCallbacks) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.playerName = playerName;
    this.callbacks = callbacks;
  }

  async connect(): Promise<boolean> {
    try {
      this.connectionState = 'connecting';
      console.log(`[RoomSync] Connecting to room broadcast: ${this.roomId}`);

      // Créer un channel unique pour cette room
      const channelName = `room-sync-${this.roomId}`;
      this.channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: false } // Ne pas recevoir ses propres messages
        }
      });

      // Écouter les événements de broadcast
      this.channel.on('broadcast', { event: 'room_event' }, (payload: any) => {
        this.handleRoomEvent(payload.payload);
      });

      // Écouter les événements de présence (joueurs qui rejoignent/quittent)
      this.channel.on('presence', { event: 'sync' }, () => {
        const presences = this.channel.presenceState();
        console.log('[RoomSync] Presence sync:', presences);
      });

      this.channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        console.log('[RoomSync] Player joined:', key, newPresences);
        const playerData = newPresences[0];
        if (playerData && playerData.playerId !== this.playerId) {
          this.callbacks.onPlayerJoined?.(playerData);
        }
      });

      this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
        console.log('[RoomSync] Player left:', key, leftPresences);
        const playerData = leftPresences[0];
        if (playerData) {
          this.callbacks.onPlayerLeft?.(playerData.playerId);
        }
      });

      // S'abonner au channel
      const status = await this.channel.subscribe(async (status: string) => {
        console.log(`[RoomSync] Channel status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.connectionState = 'connected';
          
          // Annoncer sa présence dans la room
          await this.announcePresence();
          
          // Démarrer le heartbeat simple
          this.startHeartbeat();
          
          console.log(`[RoomSync] Successfully connected to room: ${this.roomId}`);
        } else if (status === 'CHANNEL_ERROR') {
          this.connectionState = 'disconnected';
          console.error('[RoomSync] Channel error');
        }
      });

      return this.isConnected;
    } catch (error) {
      console.error('[RoomSync] Connection error:', error);
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
      console.log('[RoomSync] Presence announced');
    } catch (error) {
      console.error('[RoomSync] Error announcing presence:', error);
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Simple heartbeat qui vérifie juste la connexion
    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected) {
        console.log('[RoomSync] Heartbeat detected disconnection');
        this.connectionState = 'disconnected';
      }
    }, 10000); // Vérification toutes les 10 secondes
  }

  private handleRoomEvent(event: RoomSyncEvent) {
    // Ignorer ses propres événements
    if (event.playerId === this.playerId) return;

    console.log('[RoomSync] Received event:', event.type, event);

    switch (event.type) {
      case 'player_move':
        this.callbacks.onPlayerMove?.(event.playerId, event.data);
        break;
      case 'player_collision':
        this.callbacks.onPlayerCollision?.(
          event.data.eliminatedId,
          event.data.eliminatorId,
          event.data.eliminatedSize,
          event.data.eliminatorNewSize
        );
        break;
      case 'player_eliminated':
        this.callbacks.onPlayerEliminated?.(event.data.eliminatedId, event.data.eliminatorId);
        break;
      case 'game_start':
        this.callbacks.onGameStart?.(event.data);
        break;
    }
  }

  async broadcastPlayerMove(x: number, y: number, size: number, velocityX = 0, velocityY = 0) {
    const now = Date.now();
    if (now - this.lastMoveSync < this.moveThrottle) {
      return; // Throttle les mouvements
    }

    this.lastMoveSync = now;

    await this.broadcastEvent({
      type: 'player_move',
      playerId: this.playerId,
      data: { x, y, size, velocityX, velocityY },
      timestamp: now
    });
  }

  async broadcastPlayerCollision(eliminatedId: string, eliminatorId: string, eliminatedSize: number, eliminatorNewSize: number) {
    await this.broadcastEvent({
      type: 'player_collision',
      playerId: this.playerId,
      data: { eliminatedId, eliminatorId, eliminatedSize, eliminatorNewSize },
      timestamp: Date.now()
    });
  }

  async broadcastPlayerElimination(eliminatedId: string, eliminatorId: string) {
    await this.broadcastEvent({
      type: 'player_eliminated',
      playerId: this.playerId,
      data: { eliminatedId, eliminatorId },
      timestamp: Date.now()
    });
  }

  private async broadcastEvent(event: RoomSyncEvent) {
    if (!this.isConnected || !this.channel) {
      console.warn('[RoomSync] Cannot broadcast - not connected');
      return;
    }

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'room_event',
        payload: event
      });
    } catch (error) {
      console.error('[RoomSync] Broadcast error:', error);
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
    console.log('[RoomSync] Disconnecting from room:', this.roomId);
    
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
