import { monitoringService } from '../services/MonitoringService';
import { db } from '../database';
import { redis } from '../cache';

// Mock dependencies
jest.mock('../database', () => ({
  db: {
    connectionPool: { totalCount: 5, idleCount: 3, waitingCount: 0 },
    healthCheck: jest.fn()
  }
}));
jest.mock('../cache', () => ({
  redis: { isHealthy: true, healthCheck: jest.fn() }
}));
jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('MonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP request tracking', () => {
    it('should record HTTP request metrics', () => {
      expect(() => {
        monitoringService.recordHttpRequest('GET', '/api/visitors', 200, 150);
      }).not.toThrow();
    });
  });

  describe('Error tracking', () => {
    it('should record errors', () => {
      expect(() => {
        monitoringService.recordError('validation_error', '/api/auth/register');
      }).not.toThrow();
    });
  });

  describe('System health', () => {
    it('should return healthy status when services are healthy', async () => {
      mockDb.healthCheck.mockResolvedValue({ status: 'healthy', details: {} });
      mockRedis.healthCheck.mockResolvedValue({ status: 'healthy', details: {} });

      const health = await monitoringService.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.services.database.status).toBe('healthy');
      expect(health.services.redis.status).toBe('healthy');
    });

    it('should return unhealthy status when database fails', async () => {
      mockDb.healthCheck.mockResolvedValue({ status: 'unhealthy', details: {} });
      mockRedis.healthCheck.mockResolvedValue({ status: 'healthy', details: {} });

      const health = await monitoringService.getSystemHealth();

      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Metrics collection', () => {
    it('should return metrics in string format', async () => {
      const metrics = await monitoringService.getMetrics();
      expect(typeof metrics).toBe('string');
    });
  });
});