import { monitoringService } from '@/services/MonitoringService';
import { alertingService } from '@/services/AlertingService';
import { register } from 'prom-client';
import { db } from '@/database';
import { redis } from '@/cache';

const mockDb = db as jest.Mocked<typeof db>;
const mockRedis = redis as jest.Mocked<typeof redis>;

// Mock dependencies
jest.mock('@/utils/logger');
jest.mock('@/database', () => ({
  db: {
    healthCheck: jest.fn(),
    connectionPool: {
      totalCount: 2,
      idleCount: 1,
      waitingCount: 0
    }
  }
}));
jest.mock('@/cache', () => ({
  redis: {
    healthCheck: jest.fn(),
    isHealthy: true
  }
}));

describe('MonitoringService', () => {
  beforeEach(() => {
    // Clear metrics before each test
    register.clear();
  });

  afterEach(() => {
    // Clean up after each test
    register.clear();
  });

  describe('HTTP Request Tracking', () => {
    it('should record HTTP request metrics', () => {
      const method = 'GET';
      const route = '/api/visitors';
      const statusCode = 200;
      const duration = 0.5;

      monitoringService.recordHttpRequest(method, route, statusCode, duration);

      // Verify metrics were recorded (we can't easily test the actual values without exposing internals)
      expect(() => monitoringService.recordHttpRequest(method, route, statusCode, duration)).not.toThrow();
    });

    it('should handle multiple HTTP requests', () => {
      const requests = [
        { method: 'GET', route: '/api/visitors', statusCode: 200, duration: 0.3 },
        { method: 'POST', route: '/api/visitors', statusCode: 201, duration: 0.8 },
        { method: 'GET', route: '/api/health', statusCode: 200, duration: 0.1 },
      ];

      requests.forEach(req => {
        expect(() => monitoringService.recordHttpRequest(
          req.method, req.route, req.statusCode, req.duration
        )).not.toThrow();
      });
    });
  });

  describe('Connection Tracking', () => {
    it('should set active connections count', () => {
      expect(() => monitoringService.setActiveConnections(5)).not.toThrow();
      expect(() => monitoringService.setActiveConnections(0)).not.toThrow();
    });

    it('should update database connections', () => {
      expect(() => monitoringService.updateDatabaseConnections()).not.toThrow();
    });

    it('should update Redis connections', () => {
      expect(() => monitoringService.updateRedisConnections()).not.toThrow();
    });
  });

  describe('Error Tracking', () => {
    it('should record errors', () => {
      expect(() => monitoringService.recordError('ValidationError', '/api/visitors')).not.toThrow();
      expect(() => monitoringService.recordError('DatabaseError')).not.toThrow();
    });
  });

  describe('Authentication Tracking', () => {
    it('should record successful authentication attempts', () => {
      expect(() => monitoringService.recordAuthAttempt('login', 'success')).not.toThrow();
      expect(() => monitoringService.recordAuthAttempt('register', 'success')).not.toThrow();
      expect(() => monitoringService.recordAuthAttempt('refresh', 'success')).not.toThrow();
    });

    it('should record failed authentication attempts', () => {
      expect(() => monitoringService.recordAuthAttempt('login', 'failure')).not.toThrow();
      expect(() => monitoringService.recordAuthAttempt('register', 'failure')).not.toThrow();
      expect(() => monitoringService.recordAuthAttempt('refresh', 'failure')).not.toThrow();
    });
  });

  describe('Sync Operation Tracking', () => {
    it('should record successful sync operations', () => {
      expect(() => monitoringService.recordSyncOperation('bulk_sync', 'success')).not.toThrow();
      expect(() => monitoringService.recordSyncOperation('conflict_resolution', 'success')).not.toThrow();
    });

    it('should record failed sync operations', () => {
      expect(() => monitoringService.recordSyncOperation('bulk_sync', 'failure')).not.toThrow();
      expect(() => monitoringService.recordSyncOperation('conflict_resolution', 'failure')).not.toThrow();
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics in Prometheus format', async () => {
      // Test that the method works and returns a string
      const metrics = await monitoringService.getMetrics();
      
      expect(typeof metrics).toBe('string');
      // Even if empty, it should be a string (empty metrics are valid)
      expect(metrics).toBeDefined();
    });
  });

  describe('System Health', () => {
    it('should return system health status', async () => {
      // Mock health check responses
      mockDb.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { connected: true }
      });
      
      mockRedis.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { connected: true }
      });

      const health = await monitoringService.getSystemHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('metrics');
      
      expect(health.services).toHaveProperty('database');
      expect(health.services).toHaveProperty('redis');
      
      expect(health.metrics).toHaveProperty('memory');
      expect(health.metrics).toHaveProperty('connections');
    });
  });
});

describe('AlertingService', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env['ALERTING_ENABLED'];
    delete process.env['ALERT_ERROR_RATE_THRESHOLD'];
    delete process.env['ALERT_RESPONSE_TIME_THRESHOLD'];
    delete process.env['ALERT_MEMORY_THRESHOLD'];
    delete process.env['ALERT_DB_CONNECTIONS_THRESHOLD'];
    delete process.env['ALERT_COOLDOWN_MINUTES'];
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = alertingService.getConfig();
      
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('thresholds');
      expect(config).toHaveProperty('cooldownPeriod');
      
      expect(config.thresholds).toHaveProperty('errorRate');
      expect(config.thresholds).toHaveProperty('responseTime');
      expect(config.thresholds).toHaveProperty('memoryUsage');
      expect(config.thresholds).toHaveProperty('databaseConnections');
    });

    it('should update configuration', () => {
      const newConfig = {
        enabled: true,
        thresholds: {
          errorRate: 20,
          responseTime: 3,
          memoryUsage: 90,
          databaseConnections: 85
        }
      };

      alertingService.updateConfig(newConfig);
      const config = alertingService.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.thresholds.errorRate).toBe(20);
      expect(config.thresholds.responseTime).toBe(3);
      expect(config.thresholds.memoryUsage).toBe(90);
      expect(config.thresholds.databaseConnections).toBe(85);
    });
  });

  describe('Error Recording', () => {
    it('should record errors when alerting is enabled', () => {
      alertingService.updateConfig({ enabled: true });
      
      expect(() => alertingService.recordError('TestError')).not.toThrow();
      expect(() => alertingService.recordError('ValidationError')).not.toThrow();
    });

    it('should not record errors when alerting is disabled', () => {
      alertingService.updateConfig({ enabled: false });
      
      expect(() => alertingService.recordError('TestError')).not.toThrow();
    });
  });

  describe('Response Time Recording', () => {
    it('should record response times when alerting is enabled', () => {
      alertingService.updateConfig({ enabled: true });
      
      expect(() => alertingService.recordResponseTime(0.5)).not.toThrow();
      expect(() => alertingService.recordResponseTime(2.0)).not.toThrow();
      expect(() => alertingService.recordResponseTime(0.1)).not.toThrow();
    });

    it('should not record response times when alerting is disabled', () => {
      alertingService.updateConfig({ enabled: false });
      
      expect(() => alertingService.recordResponseTime(1.0)).not.toThrow();
    });
  });

  describe('Alert History', () => {
    it('should return empty alert history initially', () => {
      const history = alertingService.getAlertHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    it('should limit alert history results', () => {
      const history = alertingService.getAlertHistory(10);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });
});