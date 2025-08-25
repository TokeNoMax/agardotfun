import { EventEmitter } from 'events';
import { redisManager } from '../config/redis';
import { Redis } from 'ioredis';

export interface PerformanceMetrics {
  timestamp: number;
  serverId: string;
  
  // System metrics
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  
  // Game metrics
  activeRooms: number;
  totalPlayers: number;
  averagePlayersPerRoom: number;
  
  // Network metrics
  socketConnections: number;
  messagesPerSecond: number;
  averageLatency: number;
  
  // Performance metrics
  averageTickTime: number;
  maxTickTime: number;
  ticksPerSecond: number;
  
  // Redis metrics
  redisConnected: boolean;
  redisLatency: number;
  redisMemoryUsage: string;
  
  // Error metrics
  errorsInLastMinute: number;
  warningsInLastMinute: number;
}

export interface AlertConfig {
  cpuThreshold: number;
  memoryThreshold: number;
  latencyThreshold: number;
  errorRateThreshold: number;
  tickTimeThreshold: number;
}

export interface AlertEvent {
  type: 'cpu' | 'memory' | 'latency' | 'errors' | 'tick_time' | 'redis';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  serverId: string;
}

export class PerformanceMonitor extends EventEmitter {
  private serverId: string;
  private redis: Redis;
  private metrics: PerformanceMetrics[];
  private alertConfig: AlertConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsRetentionDays = 7;
  private maxMetricsInMemory = 1000;
  
  // Counters
  private messageCount = 0;
  private lastMessageCountReset = Date.now();
  private tickTimes: number[] = [];
  private latencyMeasurements: number[] = [];
  private errorCount = 0;
  private warningCount = 0;
  private lastErrorReset = Date.now();

  constructor(serverId: string, alertConfig: Partial<AlertConfig> = {}) {
    super();
    
    this.serverId = serverId;
    this.redis = redisManager.getRedis();
    this.metrics = [];
    
    this.alertConfig = {
      cpuThreshold: 80, // 80% CPU usage
      memoryThreshold: 85, // 85% memory usage
      latencyThreshold: 100, // 100ms average latency
      errorRateThreshold: 10, // 10 errors per minute
      tickTimeThreshold: 50, // 50ms average tick time
      ...alertConfig
    };

    this.startMonitoring();
  }

  /**
   * Record a game tick time
   */
  public recordTickTime(tickTime: number): void {
    this.tickTimes.push(tickTime);
    
    // Keep only last 100 tick times
    if (this.tickTimes.length > 100) {
      this.tickTimes.shift();
    }
  }

  /**
   * Record a network message
   */
  public recordMessage(): void {
    this.messageCount++;
  }

  /**
   * Record a latency measurement
   */
  public recordLatency(latency: number): void {
    this.latencyMeasurements.push(latency);
    
    // Keep only last 100 measurements
    if (this.latencyMeasurements.length > 100) {
      this.latencyMeasurements.shift();
    }
  }

  /**
   * Record an error
   */
  public recordError(): void {
    this.errorCount++;
  }

  /**
   * Record a warning
   */
  public recordWarning(): void {
    this.warningCount++;
  }

  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    
    // Calculate messages per second
    const timeSinceLastReset = now - this.lastMessageCountReset;
    const messagesPerSecond = timeSinceLastReset > 0 ? (this.messageCount * 1000) / timeSinceLastReset : 0;
    
    // Reset message counter
    this.messageCount = 0;
    this.lastMessageCountReset = now;
    
    // Calculate error rates
    const errorTimeSinceReset = now - this.lastErrorReset;
    const errorsInLastMinute = errorTimeSinceReset >= 60000 ? this.errorCount : (this.errorCount * 60000) / errorTimeSinceReset;
    const warningsInLastMinute = errorTimeSinceReset >= 60000 ? this.warningCount : (this.warningCount * 60000) / errorTimeSinceReset;
    
    if (errorTimeSinceReset >= 60000) {
      this.errorCount = 0;
      this.warningCount = 0;
      this.lastErrorReset = now;
    }
    
    // Calculate tick metrics
    const averageTickTime = this.tickTimes.length > 0 ? this.tickTimes.reduce((a, b) => a + b, 0) / this.tickTimes.length : 0;
    const maxTickTime = this.tickTimes.length > 0 ? Math.max(...this.tickTimes) : 0;
    const ticksPerSecond = this.tickTimes.length > 0 ? 1000 / averageTickTime : 0;
    
    // Calculate latency
    const averageLatency = this.latencyMeasurements.length > 0 
      ? this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length 
      : 0;
    
    // Get Redis health
    const redisHealth = await redisManager.healthCheck();
    
    // Get process metrics
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    return {
      timestamp: now,
      serverId: this.serverId,
      cpuUsage,
      memoryUsage,
      uptime: process.uptime(),
      activeRooms: 0, // Will be set by external systems
      totalPlayers: 0, // Will be set by external systems
      averagePlayersPerRoom: 0, // Will be set by external systems
      socketConnections: 0, // Will be set by external systems
      messagesPerSecond,
      averageLatency,
      averageTickTime,
      maxTickTime,
      ticksPerSecond,
      redisConnected: redisHealth.connected,
      redisLatency: redisHealth.latency,
      redisMemoryUsage: redisHealth.memory,
      errorsInLastMinute,
      warningsInLastMinute
    };
  }

  /**
   * Update game-specific metrics
   */
  public updateGameMetrics(activeRooms: number, totalPlayers: number, socketConnections: number): void {
    if (this.metrics.length > 0) {
      const latestMetrics = this.metrics[this.metrics.length - 1];
      latestMetrics.activeRooms = activeRooms;
      latestMetrics.totalPlayers = totalPlayers;
      latestMetrics.socketConnections = socketConnections;
      latestMetrics.averagePlayersPerRoom = activeRooms > 0 ? totalPlayers / activeRooms : 0;
    }
  }

  /**
   * Check for alerts based on current metrics
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    // CPU alert
    const cpuPercent = (metrics.cpuUsage.user + metrics.cpuUsage.system) / 1000000; // Convert to seconds
    if (cpuPercent > this.alertConfig.cpuThreshold) {
      this.emitAlert({
        type: 'cpu',
        severity: cpuPercent > this.alertConfig.cpuThreshold * 1.2 ? 'critical' : 'warning',
        message: `High CPU usage: ${cpuPercent.toFixed(2)}%`,
        value: cpuPercent,
        threshold: this.alertConfig.cpuThreshold,
        timestamp: metrics.timestamp,
        serverId: this.serverId
      });
    }

    // Memory alert
    const memoryPercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryPercent > this.alertConfig.memoryThreshold) {
      this.emitAlert({
        type: 'memory',
        severity: memoryPercent > this.alertConfig.memoryThreshold * 1.1 ? 'critical' : 'warning',
        message: `High memory usage: ${memoryPercent.toFixed(2)}%`,
        value: memoryPercent,
        threshold: this.alertConfig.memoryThreshold,
        timestamp: metrics.timestamp,
        serverId: this.serverId
      });
    }

    // Latency alert
    if (metrics.averageLatency > this.alertConfig.latencyThreshold) {
      this.emitAlert({
        type: 'latency',
        severity: metrics.averageLatency > this.alertConfig.latencyThreshold * 2 ? 'critical' : 'warning',
        message: `High latency: ${metrics.averageLatency.toFixed(2)}ms`,
        value: metrics.averageLatency,
        threshold: this.alertConfig.latencyThreshold,
        timestamp: metrics.timestamp,
        serverId: this.serverId
      });
    }

    // Error rate alert
    if (metrics.errorsInLastMinute > this.alertConfig.errorRateThreshold) {
      this.emitAlert({
        type: 'errors',
        severity: metrics.errorsInLastMinute > this.alertConfig.errorRateThreshold * 2 ? 'critical' : 'warning',
        message: `High error rate: ${metrics.errorsInLastMinute.toFixed(2)} errors/min`,
        value: metrics.errorsInLastMinute,
        threshold: this.alertConfig.errorRateThreshold,
        timestamp: metrics.timestamp,
        serverId: this.serverId
      });
    }

    // Tick time alert
    if (metrics.averageTickTime > this.alertConfig.tickTimeThreshold) {
      this.emitAlert({
        type: 'tick_time',
        severity: metrics.averageTickTime > this.alertConfig.tickTimeThreshold * 2 ? 'critical' : 'warning',
        message: `Slow game ticks: ${metrics.averageTickTime.toFixed(2)}ms`,
        value: metrics.averageTickTime,
        threshold: this.alertConfig.tickTimeThreshold,
        timestamp: metrics.timestamp,
        serverId: this.serverId
      });
    }

    // Redis connectivity alert
    if (!metrics.redisConnected) {
      this.emitAlert({
        type: 'redis',
        severity: 'critical',
        message: 'Redis connection lost',
        value: 0,
        threshold: 1,
        timestamp: metrics.timestamp,
        serverId: this.serverId
      });
    }
  }

  private emitAlert(alert: AlertEvent): void {
    console.warn(`🚨 Performance Alert [${alert.severity.toUpperCase()}]:`, alert.message);
    this.emit('alert', alert);
    
    // Store alert in Redis for monitoring dashboard
    this.storeAlert(alert).catch(error => {
      console.error('Error storing alert:', error);
    });
  }

  private async storeAlert(alert: AlertEvent): Promise<void> {
    try {
      const key = `alerts:${this.serverId}:${alert.timestamp}`;
      await this.redis.setex(key, 86400, JSON.stringify(alert)); // Store for 24 hours
      
      // Add to alerts index
      await this.redis.zadd(`alerts:index:${this.serverId}`, alert.timestamp, key);
      
      // Keep only last 100 alerts in index
      await this.redis.zremrangebyrank(`alerts:index:${this.serverId}`, 0, -101);
    } catch (error) {
      console.error('Error storing alert in Redis:', error);
    }
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        
        // Store metrics in memory
        this.metrics.push(metrics);
        
        // Keep only recent metrics in memory
        if (this.metrics.length > this.maxMetricsInMemory) {
          this.metrics.shift();
        }
        
        // Store metrics in Redis
        await this.storeMetrics(metrics);
        
        // Check for alerts
        this.checkAlerts(metrics);
        
        // Emit metrics event
        this.emit('metrics', metrics);
        
      } catch (error) {
        console.error('Error collecting performance metrics:', error);
        this.recordError();
      }
    }, 10000); // Collect metrics every 10 seconds
  }

  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const key = `metrics:${this.serverId}:${metrics.timestamp}`;
      await this.redis.setex(key, this.metricsRetentionDays * 86400, JSON.stringify(metrics));
      
      // Add to metrics index
      await this.redis.zadd(`metrics:index:${this.serverId}`, metrics.timestamp, key);
      
      // Clean up old metrics
      const cutoff = Date.now() - (this.metricsRetentionDays * 86400 * 1000);
      await this.redis.zremrangebyscore(`metrics:index:${this.serverId}`, 0, cutoff);
      
    } catch (error) {
      console.error('Error storing metrics in Redis:', error);
    }
  }

  /**
   * Get historical metrics
   */
  public async getHistoricalMetrics(fromTimestamp: number, toTimestamp: number): Promise<PerformanceMetrics[]> {
    try {
      const keys = await this.redis.zrangebyscore(
        `metrics:index:${this.serverId}`,
        fromTimestamp,
        toTimestamp
      );
      
      const metrics: PerformanceMetrics[] = [];
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          try {
            metrics.push(JSON.parse(data));
          } catch (error) {
            console.error('Error parsing historical metrics:', error);
          }
        }
      }
      
      return metrics.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error retrieving historical metrics:', error);
      return [];
    }
  }

  /**
   * Get current performance summary
   */
  public getCurrentSummary(): {
    metrics: PerformanceMetrics | null;
    trends: any;
    alerts: number;
  } {
    const latestMetrics = this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
    
    // Calculate trends (last 10 metrics)
    const recentMetrics = this.metrics.slice(-10);
    const trends = this.calculateTrends(recentMetrics);
    
    return {
      metrics: latestMetrics,
      trends,
      alerts: this.errorCount + this.warningCount
    };
  }

  private calculateTrends(metrics: PerformanceMetrics[]): any {
    if (metrics.length < 2) return {};
    
    const latest = metrics[metrics.length - 1];
    const previous = metrics[0];
    
    return {
      cpuTrend: this.calculateTrend(previous.cpuUsage.user, latest.cpuUsage.user),
      memoryTrend: this.calculateTrend(previous.memoryUsage.heapUsed, latest.memoryUsage.heapUsed),
      latencyTrend: this.calculateTrend(previous.averageLatency, latest.averageLatency),
      playersTrend: this.calculateTrend(previous.totalPlayers, latest.totalPlayers)
    };
  }

  private calculateTrend(previous: number, current: number): 'up' | 'down' | 'stable' {
    const change = Math.abs(current - previous) / previous;
    
    if (change < 0.05) return 'stable'; // Less than 5% change
    return current > previous ? 'up' : 'down';
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

export default PerformanceMonitor;
