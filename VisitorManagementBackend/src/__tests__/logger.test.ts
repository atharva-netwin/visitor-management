import {
  logger,
  logWithCorrelation,
  logSystemEvent,
  logSecurityEvent,
  logPerformance,
  loggerStream
} from '../utils/logger';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('winston-daily-rotate-file', () => jest.fn(() => ({ on: jest.fn() })));
jest.mock('../config/config', () => ({ config: { nodeEnv: 'test' } }));

describe('Logger Utilities', () => {
  describe('logger instance', () => {
    it('should have required log methods', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('logWithCorrelation', () => {
    it('should log info with correlation ID', () => {
      logWithCorrelation.info('Test message', { userId: '123' }, 'test-id');
      expect(logger.info).toHaveBeenCalledWith('Test message', {
        userId: '123',
        correlationId: 'test-id'
      });
    });

    it('should generate correlation ID when not provided', () => {
      logWithCorrelation.info('Test message');
      expect(logger.info).toHaveBeenCalledWith('Test message', {
        correlationId: expect.any(String)
      });
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error');
      logWithCorrelation.error('Error occurred', error, {}, 'test-id');
      expect(logger.error).toHaveBeenCalledWith('Error occurred', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        correlationId: 'test-id'
      });
    });
  });

  describe('logSystemEvent', () => {
    it('should log system events', () => {
      logSystemEvent('server_started', { port: 3000 }, 'test-id');
      expect(logger.info).toHaveBeenCalledWith('System Event: server_started', {
        eventType: 'system',
        eventName: 'server_started',
        port: 3000,
        correlationId: 'test-id'
      });
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security events with warning level', () => {
      logSecurityEvent('failed_login', { ip: '192.168.1.1' }, 'test-id');
      expect(logger.warn).toHaveBeenCalledWith('Security Event: failed_login', {
        eventType: 'security',
        eventName: 'failed_login',
        ip: '192.168.1.1',
        correlationId: 'test-id'
      });
    });
  });

  describe('logPerformance', () => {
    it('should log performance with appropriate level', () => {
      logPerformance('db_query', 50, { query: 'SELECT *' }, 'test-id');
      expect(logger.debug).toHaveBeenCalledWith('Performance: db_query', {
        eventType: 'performance',
        operation: 'db_query',
        duration: '50ms',
        query: 'SELECT *',
        correlationId: 'test-id'
      });
    });

    it('should use warn level for slow operations', () => {
      logPerformance('slow_query', 6000, {}, 'test-id');
      expect(logger.warn).toHaveBeenCalledWith('Performance: slow_query', {
        eventType: 'performance',
        operation: 'slow_query',
        duration: '6000ms',
        correlationId: 'test-id'
      });
    });
  });

  describe('loggerStream', () => {
    it('should have write method for HTTP logging', () => {
      expect(typeof loggerStream.write).toBe('function');
    });

    it('should log HTTP messages', () => {
      loggerStream.write('GET /api/visitors 200 150ms\n');
      expect(logger.info).toHaveBeenCalledWith('GET /api/visitors 200 150ms', {
        eventType: 'http'
      });
    });
  });
});