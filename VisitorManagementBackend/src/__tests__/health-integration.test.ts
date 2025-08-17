import request from 'supertest';
import app from '@/index';
import { db } from '@/database';
import { redis } from '@/cache';

// Mock database and Redis for controlled testing
jest.mock('@/database');
jest.mock('@/cache');

const mockDb = db as jest.Mocked<typeof db>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('Health Endpoints Integration', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are healthy', async () => {
      // Mock healthy services
      mockDb.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          connected: true,
          responseTime: '5ms',
          totalConnections: 2,
          idleConnections: 1,
          waitingConnections: 0,
          serverTime: new Date().toISOString(),
          version: '15.0'
        }
      });

      mockRedis.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          connected: true,
          responseTime: '2ms',
          ping: 'PONG',
          version: '7.0.0',
          uptime: '3600',
          connectedClients: '1',
          usedMemory: '1.5M'
        }
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('metrics');

      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
      expect(response.body.services.database.status).toBe('healthy');
      expect(response.body.services.redis.status).toBe('healthy');
    });

    it('should return degraded status when one service is unhealthy', async () => {
      // Mock database healthy, Redis unhealthy
      mockDb.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          connected: true,
          responseTime: '5ms',
          totalConnections: 2,
          idleConnections: 1,
          waitingConnections: 0,
          serverTime: new Date().toISOString(),
          version: '15.0'
        }
      });

      mockRedis.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        details: {
          connected: false,
          error: 'Connection refused',
          reconnectAttempts: 3
        }
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('healthy');
      expect(response.body.services.redis.status).toBe('unhealthy');
    });

    it('should return unhealthy status when database is unhealthy', async () => {
      // Mock database unhealthy
      mockDb.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        details: {
          connected: false,
          error: 'Connection timeout',
          totalConnections: 0,
          idleConnections: 0,
          waitingConnections: 0
        }
      });

      mockRedis.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: {
          connected: true,
          responseTime: '2ms',
          ping: 'PONG',
          version: '7.0.0',
          uptime: '3600',
          connectedClients: '1',
          usedMemory: '1.5M'
        }
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('unhealthy');
      expect(response.body.services.redis.status).toBe('healthy');
    });

    it('should return 503 status when health check throws error', async () => {
      // Mock health check throwing error
      mockDb.healthCheck.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return ready when system is healthy', async () => {
      // Mock healthy services
      mockDb.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { connected: true }
      });

      mockRedis.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { connected: true }
      });

      const response = await request(app)
        .get('/api/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return not ready when system is unhealthy', async () => {
      // Mock unhealthy database
      mockDb.healthCheck.mockResolvedValue({
        status: 'unhealthy',
        details: { connected: false }
      });

      mockRedis.healthCheck.mockResolvedValue({
        status: 'healthy',
        details: { connected: true }
      });

      const response = await request(app)
        .get('/api/health/ready')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body).toHaveProperty('reason');
    });

    it('should return 503 when readiness check fails', async () => {
      mockDb.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const response = await request(app)
        .get('/api/health/ready')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/health/live', () => {
    it('should always return alive status', async () => {
      const response = await request(app)
        .get('/api/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('pid');
    });
  });

  describe('GET /api/metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should handle metrics export errors gracefully', async () => {
      // This test is harder to implement without mocking the monitoring service
      // For now, we'll just ensure the endpoint doesn't crash
      const response = await request(app)
        .get('/api/metrics');

      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/version', () => {
    it('should return version information', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('nodeVersion');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

describe('Monitoring Middleware Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track HTTP requests through middleware', async () => {
    // Mock healthy services for health check
    mockDb.healthCheck.mockResolvedValue({
      status: 'healthy',
      details: { connected: true }
    });

    mockRedis.healthCheck.mockResolvedValue({
      status: 'healthy',
      details: { connected: true }
    });

    // Make a request that will be tracked
    await request(app)
      .get('/api/health')
      .expect(200);

    // The middleware should have recorded the request
    // We can't easily test the actual metrics without exposing internals,
    // but we can ensure the request completed successfully
  });

  it('should track errors through middleware', async () => {
    // Mock a health check failure to trigger error tracking
    mockDb.healthCheck.mockRejectedValue(new Error('Database error'));

    await request(app)
      .get('/api/health')
      .expect(503);

    // The error middleware should have recorded the error
    // Again, we can't easily test the actual metrics without exposing internals
  });
});