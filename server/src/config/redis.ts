import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  enableOfflineQueue: boolean;
  connectTimeout: number;
  commandTimeout: number;
}

export const defaultRedisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'agario:',
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  connectTimeout: 10000,
  commandTimeout: 5000
};

export class RedisManager {
  private static instance: RedisManager;
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected = false;

  private constructor(config: RedisConfig = defaultRedisConfig) {
    // Main Redis connection
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      retryDelayOnFailover: config.retryDelayOnFailover,
      enableOfflineQueue: config.enableOfflineQueue,
      connectTimeout: config.connectTimeout,
      commandTimeout: config.commandTimeout,
      lazyConnect: true
    });

    // Dedicated connections for pub/sub
    this.subscriber = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      lazyConnect: true
    });

    this.publisher = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  public static getInstance(config?: RedisConfig): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager(config);
    }
    return RedisManager.instance;
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      console.log('✅ Redis main connection established');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis main connection error:', error);
      this.isConnected = false;
    });

    this.subscriber.on('connect', () => {
      console.log('✅ Redis subscriber connection established');
    });

    this.subscriber.on('error', (error) => {
      console.error('❌ Redis subscriber connection error:', error);
    });

    this.publisher.on('connect', () => {
      console.log('✅ Redis publisher connection established');
    });

    this.publisher.on('error', (error) => {
      console.error('❌ Redis publisher connection error:', error);
    });
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
      console.log('🔗 All Redis connections established successfully');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect()
      ]);
      console.log('🔌 All Redis connections closed');
      this.isConnected = false;
    } catch (error) {
      console.error('❌ Error disconnecting from Redis:', error);
      throw error;
    }
  }

  public getRedis(): Redis {
    return this.redis;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  public isRedisConnected(): boolean {
    return this.isConnected && this.redis.status === 'ready';
  }

  // Utility methods
  public async ping(): Promise<string> {
    return await this.redis.ping();
  }

  public async flushAll(): Promise<void> {
    await this.redis.flushall();
  }

  public async getInfo(): Promise<any> {
    const info = await this.redis.info();
    return info;
  }

  // Health check
  public async healthCheck(): Promise<{
    connected: boolean;
    latency: number;
    memory: string;
    connections: number;
  }> {
    try {
      const start = Date.now();
      await this.ping();
      const latency = Date.now() - start;

      const info = await this.getInfo();
      const memory = this.parseInfoValue(info, 'used_memory_human');
      const connections = parseInt(this.parseInfoValue(info, 'connected_clients') || '0');

      return {
        connected: this.isRedisConnected(),
        latency,
        memory,
        connections
      };
    } catch (error) {
      return {
        connected: false,
        latency: -1,
        memory: 'unknown',
        connections: 0
      };
    }
  }

  private parseInfoValue(info: string, key: string): string | null {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(key + ':')) {
        return line.split(':')[1];
      }
    }
    return null;
  }
}

// Global Redis instance
export const redisManager = RedisManager.getInstance();