import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '@/utils/logger';
import { db } from '@/database';
import { redis } from '@/cache';

class MonitoringService {
  private httpRequestsTotal: Counter<string>;
  private httpRequestDuration: Histogram<string>;
  private activeConnections: Gauge<string>;
  private databaseConnections: Gauge<string>;
  private redisConnections: Gauge<string>;
  private systemMemoryUsage: Gauge<string>;
  private systemUptime: Gauge<string>;
  private errorCounter: Counter<string>;
  private authAttempts: Counter<string>;
  private syncOperations: Counter<string>;

  constructor() {
    // Enable default metrics collection (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    // HTTP request metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [register]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [register]
    });

    // Connection metrics
    this.activeConnections = new Gauge({
      name: 'active_connections_total',
      help: 'Number of active connections',
      registers: [register]
    });

    this.databaseConnections = new Gauge({
      name: 'database_connections_total',
      help: 'Number of database connections',
      labelNames: ['state'],
      registers: [register]
    });

    this.redisConnections = new Gauge({
      name: 'redis_connections_total',
      help: 'Number of Redis connections',
      registers: [register]
    });

    // System metrics
    this.systemMemoryUsage = new Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes',
      labelNames: ['type'],
      registers: [register]
    });

    this.systemUptime = new Gauge({
      name: 'system_uptime_seconds',
      help: 'System uptime in seconds',
      registers: [register]
    });

    // Error metrics
    this.errorCounter = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'endpoint'],
      registers: [register]
    });

    // Business metrics
    this.authAttempts = new Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['type', 'status'],
      registers: [register]
    });

    this.syncOperations = new Counter({
      name: 'sync_operations_total',
      help: 'Total number of sync operations',
      labelNames: ['type', 'status'],
      registers: [register]
    });

    // Start collecting system metrics
    this.startSystemMetricsCollection();
  }

  // HTTP request tracking
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration);
  }

  // Connection tracking
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  updateDatabaseConnections(): void {
    try {
      const pool = db.connectionPool;
      this.databaseConnections.set({ state: 'total' }, pool.totalCount);
      this.databaseConnections.set({ state: 'idle' }, pool.idleCount);
      this.databaseConnections.set({ state: 'waiting' }, pool.waitingCount);
    } catch (error) {
      logger.error('Failed to update database connection metrics:', error);
    }
  }

  updateRedisConnections(): void {
    try {
      this.redisConnections.set(redis.isHealthy ? 1 : 0);
    } catch (error) {
      logger.error('Failed to update Redis connection metrics:', error);
    }
  }

  // Error tracking
  recordError(type: string, endpoint?: string): void {
    this.errorCounter.inc({ type, endpoint: endpoint || 'unknown' });
  }

  // Authentication tracking
  recordAuthAttempt(type: 'login' | 'register' | 'refresh', status: 'success' | 'failure'): void {
    this.authAttempts.inc({ type, status });
  }

  // Sync operation tracking
  recordSyncOperation(type: 'bulk_sync' | 'conflict_resolution', status: 'success' | 'failure'): void {
    this.syncOperations.inc({ type, status });
  }

  // System metrics collection
  private startSystemMetricsCollection(): void {
    // Update system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Initial collection
    this.collectSystemMetrics();
  }

  private collectSystemMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.systemMemoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.systemMemoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
      this.systemMemoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
      this.systemMemoryUsage.set({ type: 'external' }, memUsage.external);

      // System uptime
      this.systemUptime.set(process.uptime());

      // Update connection metrics
      this.updateDatabaseConnections();
      this.updateRedisConnections();

    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
    }
  }

  // Get metrics for Prometheus endpoint
  async getMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      throw error;
    }
  }

  // Get system health status
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    services: {
      database: any;
      redis: any;
    };
    metrics: {
      memory: {
        rss: number;
        heapUsed: number;
        heapTotal: number;
        external: number;
      };
      connections: {
        database: {
          total: number;
          idle: number;
          waiting: number;
        };
        redis: boolean;
      };
    };
  }> {
    try {
      const [dbHealth, redisHealth] = await Promise.all([
        db.healthCheck().catch(() => ({ status: 'unhealthy' as const, details: {} })),
        redis.healthCheck().catch(() => ({ status: 'unhealthy' as const, details: {} }))
      ]);

      const overallStatus = dbHealth.status === 'healthy' && redisHealth.status === 'healthy' 
        ? 'healthy' 
        : dbHealth.status === 'unhealthy' || redisHealth.status === 'unhealthy'
        ? 'unhealthy'
        : 'degraded';

      const memUsage = process.memoryUsage();
      
      // Safely get connection pool info
      let dbConnections = { total: 0, idle: 0, waiting: 0 };
      try {
        const pool = db.connectionPool;
        if (pool) {
          dbConnections = {
            total: pool.totalCount || 0,
            idle: pool.idleCount || 0,
            waiting: pool.waitingCount || 0
          };
        }
      } catch (error) {
        // Ignore connection pool errors in tests
      }

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env['npm_package_version'] || '1.0.0',
        services: {
          database: dbHealth,
          redis: redisHealth
        },
        metrics: {
          memory: {
            rss: memUsage.rss,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external
          },
          connections: {
            database: dbConnections,
            redis: redis.isHealthy || false
          }
        }
      };
    } catch (error) {
      logger.error('Failed to get system health:', error);
      throw error;
    }
  }

  // Clear all metrics (useful for testing)
  clearMetrics(): void {
    register.clear();
  }
}

// Create singleton instance
export const monitoringService = new MonitoringService();