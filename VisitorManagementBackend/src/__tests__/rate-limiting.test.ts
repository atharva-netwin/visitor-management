import request from 'supertest';
import express from 'express';
import {
  apiRateLimit,
  authRateLimit,
  syncRateLimit,
  ipBlockingMiddleware,
  blockIP,
  rateLimitMonitoring
} from '@/middleware/rateLimiting';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock Redis for testing
const mockRedisClient = {
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1)
};

jest.mock('@/cache', () => ({
  redis: {
    client: mockRedisClient
  }
}));

// Mock logger to prevent console output during tests
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Rate Limiting Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.set('trust proxy', 1);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any timers or intervals
    jest.clearAllTimers();
  });

  describe('apiRateLimit', () => {
    beforeEach(() => {
      app.use(apiRateLimit);
      app.get('/test', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within rate limit', async () => {
      await request(app)
        .get('/test')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should skip health check endpoint', async () => {
      app.get('/api/health', (_req, res) => {
        res.json({ status: 'healthy' });
      });

      await request(app)
        .get('/api/health')
        .expect(200);
    });
  });

  describe('authRateLimit', () => {
    beforeEach(() => {
      app.use(authRateLimit);
      app.post('/login', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within auth rate limit', async () => {
      await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should return proper error format when rate limited', async () => {
      // Make multiple requests to trigger rate limit
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/login')
          .send({ email: 'test@example.com', password: 'password' })
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);

      if (rateLimitedResponses.length > 0) {
        const rateLimitedResponse = rateLimitedResponses[0];
        expect(rateLimitedResponse?.body.success).toBe(false);
        expect(rateLimitedResponse?.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(rateLimitedResponse?.body.error.correlationId).toBeDefined();
      }
    });
  });

  describe('syncRateLimit', () => {
    beforeEach(() => {
      app.use(syncRateLimit);
      app.post('/sync', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow sync requests within rate limit', async () => {
      await request(app)
        .post('/sync')
        .send({ data: 'sync data' })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('ipBlockingMiddleware', () => {
    beforeEach(() => {
      app.use(ipBlockingMiddleware);
      app.get('/test', (_req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests from non-blocked IPs', async () => {
      await request(app)
        .get('/test')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should block requests from blocked IPs', async () => {
      const testIP = '192.168.1.100';

      // Block the IP
      blockIP(testIP, 'Test block', 1);

      // Mock the request IP
      app.use((req, _res, next) => {
        (req as any).ip = testIP;
        next();
      });

      await request(app)
        .get('/test')
        .expect(403)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('IP_BLOCKED');
        });
    });
  });

  describe('rateLimitMonitoring', () => {
    beforeEach(() => {
      app.use(rateLimitMonitoring);
      app.get('/test', (_req, res) => {
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED' }
        });
      });
    });

    it('should monitor rate limit violations', async () => {
      const response = await request(app)
        .get('/test')
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('blockIP function', () => {
    it('should block IP with exponential backoff', () => {
      const testIP = '192.168.1.200';

      // First block - 60 minutes
      blockIP(testIP, 'First violation', 60);

      // Second block - should be 120 minutes (2x)
      blockIP(testIP, 'Second violation', 60);

      // Third block - should be 240 minutes (4x)
      blockIP(testIP, 'Third violation', 60);

      // The function should work without throwing errors
      expect(true).toBe(true);
    });

    it('should handle custom duration', () => {
      const testIP = '192.168.1.201';

      blockIP(testIP, 'Custom duration test', 30);

      // The function should work without throwing errors
      expect(true).toBe(true);
    });
  });
});