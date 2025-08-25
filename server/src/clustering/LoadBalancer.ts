import { RedisGameStateManager, GameServerMetrics } from '../cache/RedisGameStateManager';
import { v4 as uuidv4 } from 'uuid';

export interface LoadBalancingConfig {
  maxPlayersPerRoom: number;
  maxRoomsPerServer: number;
  playerDistributionStrategy: 'round_robin' | 'least_loaded' | 'geographic';
  healthCheckInterval: number;
  rebalanceThreshold: number;
}

export interface RoomAssignment {
  roomId: string;
  serverId: string;
  playerCount: number;
  maxPlayers: number;
  canAcceptPlayers: boolean;
}

export class GameLoadBalancer {
  private redisStateManager: RedisGameStateManager;
  private config: LoadBalancingConfig;
  private serverId: string;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(serverId: string, config: Partial<LoadBalancingConfig> = {}) {
    this.serverId = serverId;
    this.redisStateManager = new RedisGameStateManager(serverId);
    
    this.config = {
      maxPlayersPerRoom: 20,
      maxRoomsPerServer: 50,
      playerDistributionStrategy: 'least_loaded',
      healthCheckInterval: 30000, // 30 seconds
      rebalanceThreshold: 0.8, // 80% load
      ...config
    };

    this.startHealthChecking();
  }

  /**
   * Find the best room for a new player
   */
  public async findOptimalRoom(gameMode: string = 'classic'): Promise<RoomAssignment | null> {
    try {
      const serverMetrics = await this.redisStateManager.getServerLoad();
      
      if (serverMetrics.length === 0) {
        // No other servers available, create room on current server
        return this.createNewRoom(gameMode);
      }

      // Find available rooms across all servers
      const availableRooms = await this.findAvailableRooms();
      
      if (availableRooms.length > 0) {
        // Select best room based on strategy
        return this.selectBestRoom(availableRooms, serverMetrics);
      } else {
        // No available rooms, find best server to create new room
        const bestServer = this.selectBestServer(serverMetrics);
        
        if (bestServer.serverId === this.serverId) {
          return this.createNewRoom(gameMode);
        } else {
          // Request room creation on best server
          return this.requestRoomCreation(bestServer.serverId, gameMode);
        }
      }
    } catch (error) {
      console.error('Error finding optimal room:', error);
      // Fallback to local server
      return this.createNewRoom(gameMode);
    }
  }

  /**
   * Create a new room on the current server
   */
  private async createNewRoom(gameMode: string): Promise<RoomAssignment> {
    const roomId = uuidv4();
    
    return {
      roomId,
      serverId: this.serverId,
      playerCount: 0,
      maxPlayers: this.config.maxPlayersPerRoom,
      canAcceptPlayers: true
    };
  }

  /**
   * Find available rooms across all servers
   */
  private async findAvailableRooms(): Promise<RoomAssignment[]> {
    // This would query Redis for rooms with available slots
    const availableRoom = await this.redisStateManager.findAvailableRoom();
    
    if (availableRoom) {
      const roomState = await this.redisStateManager.getRoomState(availableRoom);
      
      if (roomState && roomState.playerCount < this.config.maxPlayersPerRoom) {
        return [{
          roomId: availableRoom,
          serverId: roomState.serverInstance || this.serverId,
          playerCount: roomState.playerCount,
          maxPlayers: this.config.maxPlayersPerRoom,
          canAcceptPlayers: true
        }];
      }
    }
    
    return [];
  }

  /**
   * Select the best room based on distribution strategy
   */
  private selectBestRoom(rooms: RoomAssignment[], serverMetrics: GameServerMetrics[]): RoomAssignment {
    switch (this.config.playerDistributionStrategy) {
      case 'least_loaded':
        return this.selectLeastLoadedRoom(rooms, serverMetrics);
      case 'round_robin':
        return this.selectRoundRobinRoom(rooms);
      case 'geographic':
        return this.selectGeographicRoom(rooms);
      default:
        return rooms[0];
    }
  }

  private selectLeastLoadedRoom(rooms: RoomAssignment[], serverMetrics: GameServerMetrics[]): RoomAssignment {
    // Find room on server with lowest load
    let bestRoom = rooms[0];
    let lowestLoad = Infinity;

    for (const room of rooms) {
      const serverMetric = serverMetrics.find(m => m.serverId === room.serverId);
      
      if (serverMetric) {
        const serverLoad = serverMetric.totalPlayers / this.config.maxPlayersPerRoom;
        const roomLoad = room.playerCount / room.maxPlayers;
        const combinedLoad = serverLoad + roomLoad;
        
        if (combinedLoad < lowestLoad) {
          lowestLoad = combinedLoad;
          bestRoom = room;
        }
      }
    }

    return bestRoom;
  }

  private selectRoundRobinRoom(rooms: RoomAssignment[]): RoomAssignment {
    // Simple round-robin selection
    const timestamp = Date.now();
    const index = timestamp % rooms.length;
    return rooms[index];
  }

  private selectGeographicRoom(rooms: RoomAssignment[]): RoomAssignment {
    // For geographic distribution, we'd need to know player location
    // For now, just select the first available room
    return rooms[0];
  }

  /**
   * Select the best server for creating a new room
   */
  private selectBestServer(serverMetrics: GameServerMetrics[]): GameServerMetrics {
    if (serverMetrics.length === 0) {
      // Return current server as fallback
      return {
        serverId: this.serverId,
        roomCount: 0,
        totalPlayers: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        lastHeartbeat: Date.now()
      };
    }

    // Find server with lowest combined load
    let bestServer = serverMetrics[0];
    let lowestScore = Infinity;

    for (const server of serverMetrics) {
      // Calculate load score (lower is better)
      const roomLoadRatio = server.roomCount / this.config.maxRoomsPerServer;
      const playerLoadRatio = server.totalPlayers / (this.config.maxPlayersPerRoom * this.config.maxRoomsPerServer);
      const cpuLoadRatio = server.cpuUsage / 100; // Assuming CPU usage is in percentage
      const memoryLoadRatio = server.memoryUsage / 1024; // Assuming 1GB memory limit

      const loadScore = (roomLoadRatio * 0.3) + (playerLoadRatio * 0.4) + (cpuLoadRatio * 0.2) + (memoryLoadRatio * 0.1);

      if (loadScore < lowestScore && loadScore < this.config.rebalanceThreshold) {
        lowestScore = loadScore;
        bestServer = server;
      }
    }

    return bestServer;
  }

  /**
   * Request room creation on another server
   */
  private async requestRoomCreation(serverId: string, gameMode: string): Promise<RoomAssignment> {
    // This would send a message to the target server to create a room
    // For now, we'll simulate the response
    const roomId = uuidv4();
    
    // Broadcast room creation request
    await this.redisStateManager.broadcastToRoom('server:' + serverId, 'create_room', {
      roomId,
      gameMode,
      requestingServer: this.serverId
    });

    return {
      roomId,
      serverId,
      playerCount: 0,
      maxPlayers: this.config.maxPlayersPerRoom,
      canAcceptPlayers: true
    };
  }

  /**
   * Check server health and trigger rebalancing if needed
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const serverMetrics = await this.redisStateManager.getServerLoad();
      
      // Check for overloaded servers
      for (const server of serverMetrics) {
        const roomLoadRatio = server.roomCount / this.config.maxRoomsPerServer;
        const playerLoadRatio = server.totalPlayers / (this.config.maxPlayersPerRoom * this.config.maxRoomsPerServer);
        
        if (roomLoadRatio > this.config.rebalanceThreshold || playerLoadRatio > this.config.rebalanceThreshold) {
          console.warn(`Server ${server.serverId} is overloaded. Room load: ${roomLoadRatio.toFixed(2)}, Player load: ${playerLoadRatio.toFixed(2)}`);
          
          // Trigger rebalancing (implementation would depend on requirements)
          await this.triggerRebalancing(server);
        }
      }
    } catch (error) {
      console.error('Error during health check:', error);
    }
  }

  private async triggerRebalancing(overloadedServer: GameServerMetrics): Promise<void> {
    console.log(`Triggering rebalancing for overloaded server: ${overloadedServer.serverId}`);
    
    // Implementation would move some rooms/players to other servers
    // This is a complex operation that would require:
    // 1. Identifying rooms that can be migrated
    // 2. Finding target servers with capacity
    // 3. Coordinating the migration with minimal disruption
    // 4. Updating all relevant caches and connections
    
    // For now, just log the need for rebalancing
    await this.redisStateManager.broadcastToRoom('admin', 'rebalance_needed', {
      serverId: overloadedServer.serverId,
      metrics: overloadedServer,
      timestamp: Date.now()
    });
  }

  /**
   * Get load balancing statistics
   */
  public async getLoadBalancingStats(): Promise<{
    currentServer: string;
    totalServers: number;
    totalRooms: number;
    totalPlayers: number;
    averageLoad: number;
    config: LoadBalancingConfig;
  }> {
    const serverMetrics = await this.redisStateManager.getServerLoad();
    
    const totalRooms = serverMetrics.reduce((sum, server) => sum + server.roomCount, 0);
    const totalPlayers = serverMetrics.reduce((sum, server) => sum + server.totalPlayers, 0);
    const averageLoad = serverMetrics.length > 0 ? totalPlayers / (serverMetrics.length * this.config.maxPlayersPerRoom * this.config.maxRoomsPerServer) : 0;

    return {
      currentServer: this.serverId,
      totalServers: serverMetrics.length,
      totalRooms,
      totalPlayers,
      averageLoad,
      config: this.config
    };
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('Health check failed:', error);
      });
    }, this.config.healthCheckInterval);
  }

  public stopHealthChecking(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  public async cleanup(): Promise<void> {
    this.stopHealthChecking();
    await this.redisStateManager.cleanup();
  }
}

export default GameLoadBalancer;