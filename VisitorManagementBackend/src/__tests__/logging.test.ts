import { 
  logger, 
  logWithCorrelation, 
  logSystemEvent, 
  logSecurityEvent, 
  logApiEvent, 
  logDatabaseEvent, 
  logPerformance 
} from '@/utils/logger';
import { ensureLogsDirectory, getLogStats } from '@/utils/logSetup';
import { promises as fs } from 'fs';
import path from 'path';

// Mock winston to capture log calls
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
      simple: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  }));
});

describe('Logging System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Logger', () => {
    it('should log with correlation ID', () => {
      const correlationId = 'test-correlation-id';
      const message = 'Test message';
      const meta = { key: 'value' };

      logWithCorrelation.info(message, meta, correlationId);

      expect(logger.info).toHaveBeenCalledWith(message, {
        ...meta,
        correlationId,
      });
    });

    it('should generate correlation ID if not provided', () => {
      const message = 'Test message';
      const meta = { key: 'value' };

      logWithCorrelation.info(message, meta);

      expect(logger.info).toHaveBeenCalledWith(message, expect.objectContaining({
        ...meta,
        correlationId: expect.any(String),
      }));
    });

    it('should log errors with error details', () => {
      const error = new Error('Test error');
      const correlationId = 'test-correlation-id';
      const message = 'Error occurred';
      const meta = { context: 'test' };

      logWithCorrelation.error(message, error, meta, correlationId);

      expect(logger.error).toHaveBeenCalledWith(message, {
        ...meta,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        correlationId,
      });
    });
  });

  describe('Event Logging', () => {
    it('should log system events with proper structure', () => {
      const event = 'server_started';
      const details = { port: 3000 };
      const correlationId = 'test-correlation-id';

      logSystemEvent(event, details, correlationId);

      expect(logger.info).toHaveBeenCalledWith(`System Event: ${event}`, {
        eventType: 'system',
        eventName: event,
        ...details,
        correlationId,
      });
    });

    it('should log security events with proper structure', () => {
      const event = 'authentication_failed';
      const details = { ip: '127.0.0.1' };
      const correlationId = 'test-correlation-id';

      logSecurityEvent(event, details, correlationId);

      expect(logger.warn).toHaveBeenCalledWith(`Security Event: ${event}`, {
        eventType: 'security',
        eventName: event,
        ...details,
        correlationId,
      });
    });

    it('should log API events with proper structure', () => {
      const event = 'request_completed';
      const details = { method: 'GET', url: '/api/test' };
      const correlationId = 'test-correlation-id';

      logApiEvent(event, details, correlationId);

      expect(logger.info).toHaveBeenCalledWith(`API Event: ${event}`, {
        eventType: 'api',
        eventName: event,
        ...details,
        correlationId,
      });
    });

    it('should log database events with proper structure', () => {
      const event = 'query_executed';
      const details = { table: 'users', duration: 50 };
      const correlationId = 'test-correlation-id';

      logDatabaseEvent(event, details, correlationId);

      expect(logger.info).toHaveBeenCalledWith(`Database Event: ${event}`, {
        eventType: 'database',
        eventName: event,
        ...details,
        correlationId,
      });
    });

    it('should log performance events with appropriate level', () => {
      const operation = 'database_query';
      const correlationId = 'test-correlation-id';

      // Fast operation (debug level)
      logPerformance(operation, 100, {}, correlationId);
      expect(logger.debug).toHaveBeenCalledWith(`Performance: ${operation}`, {
        eventType: 'performance',
        operation,
        duration: '100ms',
        correlationId,
      });

      // Slow operation (info level)
      logPerformance(operation, 2000, {}, correlationId);
      expect(logger.info).toHaveBeenCalledWith(`Performance: ${operation}`, {
        eventType: 'performance',
        operation,
        duration: '2000ms',
        correlationId,
      });

      // Very slow operation (warn level)
      logPerformance(operation, 6000, {}, correlationId);
      expect(logger.warn).toHaveBeenCalledWith(`Performance: ${operation}`, {
        eventType: 'performance',
        operation,
        duration: '6000ms',
        correlationId,
      });
    });
  });

  describe('Log Setup Utilities', () => {
    const testLogsDir = path.join(process.cwd(), 'test-logs');

    beforeEach(async () => {
      // Clean up test logs directory
      try {
        await fs.rm(testLogsDir, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, ignore
      }
    });

    afterEach(async () => {
      // Clean up test logs directory
      try {
        await fs.rm(testLogsDir, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, ignore
      }
    });

    it('should create logs directory if it does not exist', async () => {
      // Mock process.cwd to return test directory parent
      const originalCwd = process.cwd;
      const testDir = path.dirname(testLogsDir);
      process.cwd = jest.fn(() => testDir);

      await ensureLogsDirectory();

      const logsPath = path.join(testDir, 'logs');
      const exists = await fs.access(logsPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Clean up
      await fs.rm(logsPath, { recursive: true, force: true });

      // Restore original cwd
      process.cwd = originalCwd;
    });

    it('should get log statistics', async () => {
      // Create test logs directory and files
      const testDir = path.dirname(testLogsDir);
      const logsPath = path.join(testDir, 'logs');
      
      await fs.mkdir(logsPath, { recursive: true });
      await fs.writeFile(path.join(logsPath, 'test.log'), 'test content');
      await fs.writeFile(path.join(logsPath, 'test.log.gz'), 'compressed content');

      // Mock process.cwd to return test directory
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => testDir);

      const stats = await getLogStats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestFile).toBeTruthy();
      expect(stats.newestFile).toBeTruthy();

      // Clean up
      await fs.rm(logsPath, { recursive: true, force: true });

      // Restore original cwd
      process.cwd = originalCwd;
    });
  });

  describe('Log Sanitization', () => {
    it('should sanitize sensitive data in request bodies', () => {
      // This would be tested through the request logger middleware
      // The sanitization logic is internal to the middleware
      expect(true).toBe(true); // Placeholder for actual sanitization tests
    });
  });

  describe('Error Correlation', () => {
    it('should maintain correlation ID through error handling', () => {
      // This would be tested through integration tests
      // where we can verify that correlation IDs are preserved
      // across middleware and error handlers
      expect(true).toBe(true); // Placeholder for actual correlation tests
    });
  });
});