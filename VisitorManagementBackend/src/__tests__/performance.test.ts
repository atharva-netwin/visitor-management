import request from 'supertest';
import express from 'express';
import { healthRouter } from '../routes/health';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../database', () => ({
  db: {
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
  }
}));

jest.mock('../cache', () => ({
  redis: {
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
  }
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() }
}));

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', healthRouter);
  return app;
};

describe('Performance Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('Response Times', () => {
    it('should respond to health check within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle multiple sequential requests efficiently', async () => {
      const requestCount = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < requestCount; i++) {
        await request(app).get('/api/health');
      }
      
      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / requestCount;
      
      expect(averageTime).toBeLessThan(100); // Average should be under 100ms
    });
  });

  describe('Memory Usage', () => {
    it('should not have significant memory leaks during multiple requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make multiple requests
      for (let i = 0; i < 20; i++) {
        await request(app).get('/api/health');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB for simple requests)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Payload Handling', () => {
    it('should handle reasonable payload sizes', async () => {
      const largePayload = {
        data: 'A'.repeat(1000) // 1KB payload
      };

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/health') // This will 404 but still processes the payload
        .send(largePayload);

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(500); // Should handle quickly
      expect(response.status).toBe(404); // Expected since POST to health isn't supported
    });
  });
});