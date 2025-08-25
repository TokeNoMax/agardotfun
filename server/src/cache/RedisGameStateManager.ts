import { Redis } from 'ioredis';
import { RoomState, Player, GameState } from '../types/game';
import { redisManager } from '../config/redis';

export interface CachedRoomState {
  id: string;
  playerCount: number;
  lastUpdate: number;
  gameState: GameState;
  players: Record<string, Player>;
  foods: Record<string, any>;
  status: 'waiting' | 'playing' | 'finished';
  serverInstance?: string;
}

export interface GameServerMetrics {
  serverId: string;
  roomCount: number;
  totalPlayers: number;
  cpuUsage: number;
  memoryUsage: number;
  lastHeartbeat: number;
}

export class RedisGameStateManager {
  private redis: Redis;
  private serverId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  // Cache TTL in seconds
  private readonly ROOM_TTL = 3600; // 1 hour
  private readonly PLAYER_TTL = 1800; // 30 minutes
  private readonly METRICS_TTL = 300; // 5 minutes
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor(serverId: string) {
    this.redis = redisManager.getRedis();
    this.serverId = serverId;
    this.startHeartbeat();
  }

  // Room State Management
  public async saveRoomState(roomState: RoomState): Promise<void> {
    const cached: CachedRoomState = {
      id: roomState.id,
      playerCount: Object.keys(roomState.players).length,
      lastUpdate: Date.now(),
      gameState: roomState.gameState,
      players: roomState.players,
      foods: roomState.foods,
      status: this.determineRoomStatus(roomState),
      serverInstance: this.serverId
    };

    const key = this.getRoomKey(roomState.id);
    await this.redis.setex(key, this.ROOM_TTL, JSON.stringify(cached));
    
    // Update room index
    await this.updateRoomIndex(roomState.id, cached.playerCount, cached.status);
  }

  public async getRoomState(roomId: string): Promise<CachedRoomState | null> {
    const key = this.getRoomKey(roomId);
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data) as CachedRoomState;
    } catch (error) {
      console.error('Error parsing room state from Redis:', error);
      return null;
    }
  }

  public async deleteRoomState(roomId: string): Promise<void> {
    const key = this.getRoomKey(roomId);
    await this.redis.del(key);
    await this.removeFromRoomIndex(roomId);
  }

  // Player Management
  public async savePlayerState(roomId: string, playerId: string, player: Player): Promise<void> {
    const key = this.getPlayerKey(roomId, playerId);
    const playerData = {
      ...player,
      lastUpdate: Date.now(),
      serverId: this.serverId
    };
    
    await this.redis.setex(key, this.PLAYER_TTL, JSON.stringify(playerData));
  }

  public async getPlayerState(roomId: string, playerId: string): Promise<Player | null> {
    const key = this.getPlayerKey(roomId, playerId);
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    try {
      const playerData = JSON.parse(data);
      delete playerData.lastUpdate;
      delete playerData.serverId;
      return playerData as Player;
    } catch (error) {
      console.error('Error parsing player state from Redis:', error);
      return null;
    }
  }

  public async removePlayerState(roomId: string, playerId: string): Promise<void> {
    const key = this.getPlayerKey(roomId, playerId);
    await this.redis.del(key);
  }

  // Room Discovery and Load Balancing
  public async findAvailableRoom(): Promise<string | null> {
    const roomsKey = this.getRoomIndexKey();
    
    // Get rooms with available slots (less than max players)
    const availableRooms = await this.redis.zrangebyscore(
      roomsKey, 
      0, 
      19, // Max 20 players per room
      'WITHSCORES'
    );

    if (availableRooms.length === 0) return null;

    // Find room with least players
    let selectedRoom = null;
    let minPlayers = Infinity;

    for (let i = 0; i < availableRooms.length; i += 2) {
      const roomId = availableRooms[i];
      const playerCount = parseInt(availableRooms[i + 1]);

      if (playerCount < minPlayers) {
        minPlayers = playerCount;
        selectedRoom = roomId;
      }
    }

    return selectedRoom;
  }

  public async getServerLoad(): Promise<GameServerMetrics[]> {
    const serversKey = this.getServersKey();
    const serverIds = await this.redis.smembers(serversKey);
    
    const metrics: GameServerMetrics[] = [];
    
    for (const serverId of serverIds) {
      const metricsKey = this.getServerMetricsKey(serverId);
      const data = await this.redis.get(metricsKey);
      
      if (data) {
        try {
          metrics.push(JSON.parse(data) as GameServerMetrics);
        } catch (error) {
          console.error(`Error parsing metrics for server ${serverId}:`, error);
        }
      }
    }
    
    return metrics.filter(m => Date.now() - m.lastHeartbeat < 60000); // Only active servers
  }

  public async assignRoomToServer(roomId: string): Promise<string> {
    const servers = await this.getServerLoad();
    
    if (servers.length === 0) {
      return this.serverId; // Fallback to current server
    }

    // Find server with lowest load
    const bestServer = servers.reduce((prev, current) => {
      const prevLoad = prev.totalPlayers / (prev.roomCount || 1);
      const currentLoad = current.totalPlayers / (current.roomCount || 1);
      return currentLoad < prevLoad ? current : prev;
    });

    return bestServer.serverId;
  }

  // Room Broadcasting
  public async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
    const channel = this.getRoomChannelKey(roomId);
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    
    await redisManager.getPublisher().publish(channel, message);
  }

  public async subscribeToRoom(roomId: string, callback: (event: string, data: any) => void): Promise<void> {
    const channel = this.getRoomChannelKey(roomId);
    const subscriber = redisManager.getSubscriber();
    
    await subscriber.subscribe(channel);
    
    subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const { event, data } = JSON.parse(message);
          callback(event, data);
        } catch (error) {
          console.error('Error parsing room broadcast message:', error);
        }
      }
    });
  }

  // Server Metrics and Heartbeat
  private async updateServerMetrics(): Promise<void> {
    const roomsKey = this.getRoomIndexKey();
    const roomCount = await this.redis.zcard(roomsKey);
    
    // Calculate total players across all rooms on this server
    const rooms = await this.redis.zrange(roomsKey, 0, -1, 'WITHSCORES');
    let totalPlayers = 0;
    
    for (let i = 1; i < rooms.length; i += 2) {
      totalPlayers += parseInt(rooms[i]);
    }

    const metrics: GameServerMetrics = {
      serverId: this.serverId,
      roomCount,
      totalPlayers,
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // Convert to MB
      lastHeartbeat: Date.now()
    };

    const metricsKey = this.getServerMetricsKey(this.serverId);
    await this.redis.setex(metricsKey, this.METRICS_TTL, JSON.stringify(metrics));
    
    // Add server to servers set
    const serversKey = this.getServersKey();
    await this.redis.sadd(serversKey, this.serverId);
    await this.redis.expire(serversKey, this.METRICS_TTL);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updateServerMetrics();
      } catch (error) {
        console.error('Error updating server metrics:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Utility Methods
  private async updateRoomIndex(roomId: string, playerCount: number, status: string): Promise<void> {
    const roomsKey = this.getRoomIndexKey();
    
    if (status === 'finished') {
      await this.redis.zrem(roomsKey, roomId);
    } else {
      await this.redis.zadd(roomsKey, playerCount, roomId);
    }
  }

  private async removeFromRoomIndex(roomId: string): Promise<void> {
    const roomsKey = this.getRoomIndexKey();
    await this.redis.zrem(roomsKey, roomId);
  }

  private determineRoomStatus(roomState: RoomState): 'waiting' | 'playing' | 'finished' {
    const alivePlayers = Object.values(roomState.players).filter(p => p.isAlive);
    
    if (alivePlayers.length <= 1 && Object.keys(roomState.players).length > 1) {
      return 'finished';
    } else if (Object.keys(roomState.players).length > 1) {
      return 'playing';
    } else {
      return 'waiting';
    }
  }

  // Key Generation
  private getRoomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  private getPlayerKey(roomId: string, playerId: string): string {
    return `player:${roomId}:${playerId}`;
  }

  private getRoomIndexKey(): string {
    return `rooms:index:${this.serverId}`;
  }

  private getRoomChannelKey(roomId: string): string {
    return `channel:room:${roomId}`;
  }

  private getServerMetricsKey(serverId: string): string {
    return `metrics:server:${serverId}`;
  }

  private getServersKey(): string {
    return 'servers:active';
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    this.stopHeartbeat();
    
    // Remove server from active servers
    const serversKey = this.getServersKey();
    await this.redis.srem(serversKey, this.serverId);
    
    // Clean up server metrics
    const metricsKey = this.getServerMetricsKey(this.serverId);
    await this.redis.del(metricsKey);
  }
}

export default RedisGameStateManager;