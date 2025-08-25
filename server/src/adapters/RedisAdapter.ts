import { Adapter } from '@socket.io/adapter-protocol';
import { Redis } from 'ioredis';
import { redisManager } from '../config/redis';

export interface RedisAdapterOptions {
  serverId: string;
  roomPrefix?: string;
  enableClustering?: boolean;
  heartbeatInterval?: number;
}

export class RedisSocketAdapter extends Adapter {
  private redis: Redis;
  private publisher: Redis;
  private subscriber: Redis;
  private serverId: string;
  private roomPrefix: string;
  private enableClustering: boolean;
  private heartbeatInterval: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(nsp: any, options: RedisAdapterOptions) {
    super(nsp);
    
    this.redis = redisManager.getRedis();
    this.publisher = redisManager.getPublisher();
    this.subscriber = redisManager.getSubscriber();
    this.serverId = options.serverId;
    this.roomPrefix = options.roomPrefix || 'socket.io';
    this.enableClustering = options.enableClustering !== false;
    this.heartbeatInterval = options.heartbeatInterval || 30000;

    this.setupSubscriber();
    this.startHeartbeat();
  }

  private setupSubscriber(): void {
    // Subscribe to adapter events
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });

    // Subscribe to general adapter channel
    const adapterChannel = this.getAdapterChannel();
    this.subscriber.subscribe(adapterChannel);
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      
      // Skip messages from the same server
      if (data.serverId === this.serverId) return;

      switch (data.type) {
        case 'broadcast':
          this.handleBroadcast(data);
          break;
        case 'join':
          this.handleJoin(data);
          break;
        case 'leave':
          this.handleLeave(data);
          break;
        case 'disconnect':
          this.handleDisconnect(data);
          break;
        default:
          console.warn('Unknown adapter message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling adapter message:', error);
    }
  }

  private handleBroadcast(data: any): void {
    const { rooms, except, packet } = data;
    
    // Broadcast to local sockets
    super.broadcast(packet, {
      rooms: new Set(rooms),
      except: new Set(except)
    });
  }

  private handleJoin(data: any): void {
    const { socketId, room } = data;
    
    // Update local room mapping if the socket is on this server
    if (this.nsp.sockets.has(socketId)) {
      super.addAll(socketId, new Set([room]));
    }
  }

  private handleLeave(data: any): void {
    const { socketId, room } = data;
    
    // Update local room mapping if the socket is on this server
    if (this.nsp.sockets.has(socketId)) {
      super.del(socketId, room);
    }
  }

  private handleDisconnect(data: any): void {
    const { socketId } = data;
    
    // Clean up local socket if it exists
    if (this.nsp.sockets.has(socketId)) {
      super.delAll(socketId);
    }
  }

  // Override adapter methods for Redis clustering
  public async addAll(id: string, rooms: Set<string>): Promise<void> {
    await super.addAll(id, rooms);
    
    if (this.enableClustering) {
      // Broadcast join events to other servers
      for (const room of rooms) {
        await this.publishMessage({
          type: 'join',
          serverId: this.serverId,
          socketId: id,
          room
        });
      }
    }
  }

  public async del(id: string, room: string): Promise<void> {
    await super.del(id, room);
    
    if (this.enableClustering) {
      // Broadcast leave event to other servers
      await this.publishMessage({
        type: 'leave',
        serverId: this.serverId,
        socketId: id,
        room
      });
    }
  }

  public async delAll(id: string): Promise<void> {
    await super.delAll(id);
    
    if (this.enableClustering) {
      // Broadcast disconnect event to other servers
      await this.publishMessage({
        type: 'disconnect',
        serverId: this.serverId,
        socketId: id
      });
    }
  }

  public async broadcast(packet: any, opts: any): Promise<void> {
    // Broadcast locally first
    await super.broadcast(packet, opts);
    
    if (this.enableClustering) {
      // Broadcast to other servers
      await this.publishMessage({
        type: 'broadcast',
        serverId: this.serverId,
        packet,
        rooms: Array.from(opts.rooms || []),
        except: Array.from(opts.except || [])
      });
    }
  }

  // Redis-specific methods
  private async publishMessage(message: any): Promise<void> {
    try {
      const channel = this.getAdapterChannel();
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Error publishing adapter message:', error);
    }
  }

  private getAdapterChannel(): string {
    return `${this.roomPrefix}:adapter`;
  }

  private getRoomKey(room: string): string {
    return `${this.roomPrefix}:room:${room}`;
  }

  private getSocketKey(socketId: string): string {
    return `${this.roomPrefix}:socket:${socketId}`;
  }

  // Room management with Redis
  public async getRoomSockets(room: string): Promise<Set<string>> {
    const localSockets = super.socketRooms.get(room) || new Set();
    
    if (!this.enableClustering) {
      return localSockets;
    }

    try {
      const roomKey = this.getRoomKey(room);
      const remoteSockets = await this.redis.smembers(roomKey);
      
      // Combine local and remote sockets
      const allSockets = new Set([...localSockets, ...remoteSockets]);
      return allSockets;
    } catch (error) {
      console.error('Error getting room sockets from Redis:', error);
      return localSockets;
    }
  }

  public async getRoomCount(room: string): Promise<number> {
    const sockets = await this.getRoomSockets(room);
    return sockets.size;
  }

  // Server health monitoring
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.updateServerHeartbeat();
      } catch (error) {
        console.error('Error updating server heartbeat:', error);
      }
    }, this.heartbeatInterval);
  }

  private async updateServerHeartbeat(): Promise<void> {
    const heartbeatKey = `${this.roomPrefix}:server:${this.serverId}:heartbeat`;
    await this.redis.setex(heartbeatKey, Math.ceil(this.heartbeatInterval * 2 / 1000), Date.now().toString());
  }

  public async getActiveServers(): Promise<string[]> {
    const pattern = `${this.roomPrefix}:server:*:heartbeat`;
    const keys = await this.redis.keys(pattern);
    
    const servers: string[] = [];
    for (const key of keys) {
      const serverId = key.split(':')[2]; // Extract server ID from key
      if (serverId && serverId !== this.serverId) {
        servers.push(serverId);
      }
    }
    
    return servers;
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Remove server heartbeat
    const heartbeatKey = `${this.roomPrefix}:server:${this.serverId}:heartbeat`;
    await this.redis.del(heartbeatKey);

    // Unsubscribe from channels
    const adapterChannel = this.getAdapterChannel();
    await this.subscriber.unsubscribe(adapterChannel);
  }

  // Statistics
  public async getAdapterStats(): Promise<{
    serverId: string;
    localRooms: number;
    localSockets: number;
    totalServers: number;
    clusteringEnabled: boolean;
  }> {
    const activeServers = await this.getActiveServers();
    
    return {
      serverId: this.serverId,
      localRooms: this.rooms.size,
      localSockets: this.sids.size,
      totalServers: activeServers.length + 1, // +1 for current server
      clusteringEnabled: this.enableClustering
    };
  }
}

export default RedisSocketAdapter;