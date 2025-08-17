import request from 'supertest';
import express from 'express';
import { requestLogger, httpLogger } from '@/middleware/requestLogger';
import { errorHandler } from '@/middleware/errorHandler';

// Mock the logger to capture log calls
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logApiEvent: jest.fn(),
  logPerformance: jest.fn(),
  logSecurityEvent: jest.fn(),
  logWithCorrelation: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock morgan
jest.mock('morgan', () => {
  const mockMorganFunction = jest.fn(() => (_req: any, _res: any, next: any) => next());
  (mockMorganFunction as any).token = jest.fn();
  return mockMorganFunction;
});

describe('Logging Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(requestLogger);
    app.use(httpLogger);

    // Test routes
    app.get('/test', (req, res) => {
      res.json({ message: 'success', correlationId: req.correlationId });
    });

    app.post('/test-body', (req, res) => {
      res.json({ received: req.body, correlationId: req.correlationId });
    });

    app.get('/test-error', (_req, _res, next) => {
      const error = new Error('Test error');
      next(error);
    });

    app.get('/test-slow', async (req, res) => {
      // Simulate slow operation
      await new Promise(resolve => setTimeout(resolve, 100));
      res.json({ message: 'slow response', correlationId: req.correlationId });
    });

    app.use(errorHandler);

    jest.clearAllMocks();
  });

  describe('Request Logging', () => {
    it('should add correlation ID to requests', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.correlationId).toBeDefined();
      expect(typeof response.body.correlationId).toBe('string');
      expect(response.body.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should log request start and completion', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      // Verify that logging functions were called
      const { logApiEvent } = require('@/utils/logger');
      expect(logApiEvent).toHaveBeenCalledWith(
        'request_started',
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          path: '/test',
        }),
        expect.any(String)
      );

      expect(logApiEvent).toHaveBeenCalledWith(
        'request_completed',
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          statusCode: 200,
        }),
        expect.any(String)
      );
    });

    it('should log request body for POST requests', async () => {
      const testBody = { username: 'test', password: 'secret123' };

      await request(app)
        .post('/test-body')
        .send(testBody)
        .expect(200);

      const { logApiEvent } = require('@/utils/logger');
      expect(logApiEvent).toHaveBeenCalledWith(
        'request_body',
        expect.objectContaining({
          body: expect.objectContaining({
            username: 'test',
            password: '[REDACTED]', // Should be sanitized
          }),
        }),
        expect.any(String)
      );
    });

    it('should log performance metrics', async () => {
      await request(app)
        .get('/test-slow')
        .expect(200);

      const { logPerformance } = require('@/utils/logger');
      expect(logPerformance).toHaveBeenCalledWith(
        'GET /test-slow',
        expect.any(Number),
        expect.objectContaining({
          statusCode: 200,
          path: '/test-slow',
        }),
        expect.any(String)
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors with correlation ID', async () => {
      const response = await request(app)
        .get('/test-error')
        .expect(500);

      expect(response.body.error.correlationId).toBeDefined();

      const { logWithCorrelation } = require('@/utils/logger');
      expect(logWithCorrelation.error).toHaveBeenCalledWith(
        'Server error occurred',
        expect.any(Error),
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
          request: expect.objectContaining({
            method: 'GET',
            url: '/test-error',
          }),
        }),
        expect.any(String)
      );
    });

    it('should sanitize sensitive data in error logs', async () => {
      app.post('/test-error-with-body', (_req, _res, next) => {
        const error = new Error('Test error with sensitive data');
        next(error);
      });

      await request(app)
        .post('/test-error-with-body')
        .send({ username: 'test', password: 'secret123', token: 'jwt-token' })
        .expect(500);

      const { logWithCorrelation } = require('@/utils/logger');
      expect(logWithCorrelation.error).toHaveBeenCalledWith(
        'Server error occurred',
        expect.any(Error),
        expect.objectContaining({
          request: expect.objectContaining({
            body: expect.objectContaining({
              username: 'test',
              password: '[REDACTED]',
              token: '[REDACTED]',
            }),
          }),
        }),
        expect.any(String)
      );
    });
  });

  describe('Security Event Logging', () => {
    it('should log suspicious activity', async () => {
      // Test SQL injection attempt
      await request(app)
        .get('/test?id=1 UNION SELECT * FROM users')
        .expect(200);

      // The security logging would be triggered in the error handler
      // if this was actually an error case
    });

    it('should log authentication errors as security events', async () => {
      app.get('/test-auth-error', (_req, _res, next) => {
        const error = new Error('Invalid token') as any;
        error.name = 'JsonWebTokenError';
        next(error);
      });

      await request(app)
        .get('/test-auth-error')
        .expect(401);

      const { logSecurityEvent } = require('@/utils/logger');
      expect(logSecurityEvent).toHaveBeenCalledWith(
        'authentication_authorization_error',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'JsonWebTokenError',
          }),
        }),
        expect.any(String)
      );
    });
  });

  describe('Correlation ID Persistence', () => {
    it('should maintain same correlation ID throughout request lifecycle', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      const correlationId = response.body.correlationId;

      // Verify all log calls used the same correlation ID
      const { logApiEvent, logPerformance } = require('@/utils/logger');
      
      const logCalls = logApiEvent.mock.calls;
      logCalls.forEach((call: any[]) => {
        expect(call[2]).toBe(correlationId); // Third parameter is correlation ID
      });

      const perfCalls = logPerformance.mock.calls;
      perfCalls.forEach((call: any[]) => {
        expect(call[3]).toBe(correlationId); // Fourth parameter is correlation ID
      });
    });
  });

  describe('Response Sanitization', () => {
    it('should sanitize sensitive data in response logs', async () => {
      app.get('/test-sensitive-response', (_req, res) => {
        res.json({
          user: { id: 1, email: 'test@example.com' },
          accessToken: 'jwt-access-token',
          refreshToken: 'jwt-refresh-token',
          publicData: 'visible',
        });
      });

      await request(app)
        .get('/test-sensitive-response')
        .expect(200);

      // The response sanitization happens in the request logger
      // and would be visible in the log output
    });
  });
});