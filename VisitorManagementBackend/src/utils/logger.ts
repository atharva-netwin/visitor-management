import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';

const logLevel = process.env['LOG_LEVEL'] || 'info';

// Enhanced structured log format with correlation ID support
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, correlationId, service = 'visitor-management-backend', ...meta }) => {
    const logEntry: any = {
      timestamp,
      level: level.toUpperCase(),
      service,
      correlationId: correlationId || 'system',
      message,
      ...meta,
    };

    // Add environment and process info for system events
    if (level === 'error' || level === 'warn') {
      logEntry.environment = config.nodeEnv;
      logEntry.processId = process.pid;
      logEntry.nodeVersion = process.version;
    }

    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const corrId = correlationId && typeof correlationId === 'string' ? ` [${correlationId.slice(0, 8)}]` : '';
    return `${timestamp} ${level}${corrId}: ${message}${metaStr}`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.nodeEnv === 'production' ? structuredFormat : consoleFormat,
  }),
];

// Add rotating file transports for production and development
if (config.nodeEnv === 'production' || config.nodeEnv === 'development') {
  // Error log with daily rotation
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: structuredFormat,
      maxSize: '20m',
      maxFiles: '30d', // Keep logs for 30 days
      auditFile: 'logs/.audit-error.json',
      zippedArchive: true,
    })
  );

  // Combined log with daily rotation
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: structuredFormat,
      maxSize: '20m',
      maxFiles: '14d', // Keep logs for 14 days
      auditFile: 'logs/.audit-combined.json',
      zippedArchive: true,
    })
  );

  // Separate audit log for security events
  transports.push(
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      format: structuredFormat,
      maxSize: '10m',
      maxFiles: '90d', // Keep audit logs for 90 days
      auditFile: 'logs/.audit-security.json',
      zippedArchive: true,
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: structuredFormat,
  transports,
  exitOnError: false,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    ...(config.nodeEnv === 'production' ? [
      new DailyRotateFile({
        filename: 'logs/exceptions-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: structuredFormat,
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
      })
    ] : [])
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    ...(config.nodeEnv === 'production' ? [
      new DailyRotateFile({
        filename: 'logs/rejections-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        format: structuredFormat,
        maxSize: '20m',
        maxFiles: '30d',
        zippedArchive: true,
      })
    ] : [])
  ],
});

// Enhanced logging methods with correlation ID support
export const logWithCorrelation = {
  info: (message: string, meta: any = {}, correlationId?: string) => {
    logger.info(message, { ...meta, correlationId: correlationId || uuidv4() });
  },
  warn: (message: string, meta: any = {}, correlationId?: string) => {
    logger.warn(message, { ...meta, correlationId: correlationId || uuidv4() });
  },
  error: (message: string, error?: Error | any, meta: any = {}, correlationId?: string) => {
    const errorMeta = error instanceof Error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } : { error };
    
    logger.error(message, { 
      ...meta, 
      ...errorMeta, 
      correlationId: correlationId || uuidv4() 
    });
  },
  debug: (message: string, meta: any = {}, correlationId?: string) => {
    logger.debug(message, { ...meta, correlationId: correlationId || uuidv4() });
  },
};

// System event logging
export const logSystemEvent = (event: string, details: any = {}, correlationId?: string) => {
  logger.info(`System Event: ${event}`, {
    eventType: 'system',
    eventName: event,
    ...details,
    correlationId: correlationId || uuidv4(),
  });
};

// Security event logging
export const logSecurityEvent = (event: string, details: any = {}, correlationId?: string) => {
  logger.warn(`Security Event: ${event}`, {
    eventType: 'security',
    eventName: event,
    ...details,
    correlationId: correlationId || uuidv4(),
  });
};

// API event logging
export const logApiEvent = (event: string, details: any = {}, correlationId?: string) => {
  logger.info(`API Event: ${event}`, {
    eventType: 'api',
    eventName: event,
    ...details,
    correlationId: correlationId || uuidv4(),
  });
};

// Database event logging
export const logDatabaseEvent = (event: string, details: any = {}, correlationId?: string) => {
  logger.info(`Database Event: ${event}`, {
    eventType: 'database',
    eventName: event,
    ...details,
    correlationId: correlationId || uuidv4(),
  });
};

// Performance logging
export const logPerformance = (operation: string, duration: number, details: any = {}, correlationId?: string) => {
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
  logger[level](`Performance: ${operation}`, {
    eventType: 'performance',
    operation,
    duration: `${duration}ms`,
    ...details,
    correlationId: correlationId || uuidv4(),
  });
};

// Create a stream object for Morgan HTTP request logging
export const loggerStream = {
  write: (message: string): void => {
    logger.info(message.trim(), { eventType: 'http' });
  },
};

// Log rotation event handlers
transports.forEach(transport => {
  if (transport instanceof DailyRotateFile) {
    transport.on('rotate', (oldFilename, newFilename) => {
      logSystemEvent('log_rotation', {
        oldFile: oldFilename,
        newFile: newFilename,
        transport: transport.constructor.name,
      });
    });

    transport.on('archive', (zipFilename) => {
      logSystemEvent('log_archive', {
        archivedFile: zipFilename,
        transport: transport.constructor.name,
      });
    });

    transport.on('logRemoved', (removedFilename) => {
      logSystemEvent('log_cleanup', {
        removedFile: removedFilename,
        transport: transport.constructor.name,
      });
    });
  }
});

// Log startup information
logSystemEvent('logger_initialized', {
  logLevel,
  environment: config.nodeEnv,
  transports: transports.map(t => t.constructor.name),
});