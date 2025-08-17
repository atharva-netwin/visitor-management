import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { config } from '@/config/config';
import { logger, logSystemEvent, logSecurityEvent } from '@/utils/logger';
import { ensureLogsDirectory, cleanupOldLogs } from '@/utils/logSetup';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger, httpLogger } from '@/middleware/requestLogger';
import { 
  securityMiddleware, 
  sanitizeInput, 
  securityHeaders, 
  requestSizeLimiter,
  suspiciousActivityDetector 
} from '@/middleware/security';
import { 
  apiRateLimit, 
  authRateLimit, 
  syncRateLimit,
  progressiveDelay,
  ipBlockingMiddleware,
  rateLimitMonitoring
} from '@/middleware/rateLimiting';
import { 
  metricsMiddleware, 
  connectionTrackingMiddleware, 
  errorTrackingMiddleware 
} from '@/middleware/monitoring';
import { initializeDatabase, db } from '@/database';
import { initializeCache, redis } from '@/cache';

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(securityMiddleware);
app.use(securityHeaders);
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

// IP blocking and rate limit monitoring
app.use(ipBlockingMiddleware);
app.use(rateLimitMonitoring);

// Progressive delay for repeated requests
app.use(progressiveDelay);

// Monitoring middleware
app.use(metricsMiddleware);
app.use(connectionTrackingMiddleware);

// General API rate limiting
app.use('/api/', apiRateLimit);

// Request size limiting
app.use(requestSizeLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Request logging
app.use(requestLogger);
app.use(httpLogger);

// Input sanitization and suspicious activity detection
app.use(sanitizeInput);
app.use(suspiciousActivityDetector);

// API routes
import { authRoutes } from '@/routes/auth';
import { visitorRoutes } from '@/routes/visitors';
import { analyticsRouter } from '@/routes/analytics';
import { healthRouter } from '@/routes/health';

// Swagger documentation setup
import { setupSwagger } from '@/config/swagger';

// Setup Swagger documentation
setupSwagger(app);

// Health and monitoring routes (no rate limiting for health checks)
app.use('/api', healthRouter);

// Apply specific rate limiting to different route groups
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/visitors/bulk-sync', syncRateLimit); // Apply sync rate limit to bulk sync endpoint
app.use('/api/visitors', visitorRoutes);
app.use('/api/analytics', analyticsRouter);

// Error handling middleware (must be last)
app.use(errorTrackingMiddleware);
app.use(errorHandler);

const PORT = config.port || 3000;

async function startServer() {
  try {
    // Ensure logs directory exists
    await ensureLogsDirectory();

    // Log server startup
    logSystemEvent('server_startup_initiated', {
      port: PORT,
      environment: config.nodeEnv,
      nodeVersion: process.version,
      processId: process.pid,
    });

    // Clean up old logs on startup
    await cleanupOldLogs();

    // Initialize database connection and run migrations
    logSystemEvent('database_initialization_started');
    await initializeDatabase();
    logSystemEvent('database_initialization_completed');

    // Initialize Redis cache
    logSystemEvent('redis_initialization_started');
    await initializeCache();
    logSystemEvent('redis_initialization_completed');

    // Start the server
    app.listen(PORT, () => {
      logSystemEvent('server_started', {
        port: PORT,
        environment: config.nodeEnv,
        uptime: process.uptime(),
      });
    });

    // Schedule periodic log cleanup (every 24 hours)
    setInterval(async () => {
      await cleanupOldLogs();
    }, 24 * 60 * 60 * 1000);

  } catch (error) {
    logSystemEvent('server_startup_failed', { error: error instanceof Error ? error.message : String(error) });
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logSystemEvent('shutdown_initiated', { signal: 'SIGTERM' });
  try {
    await Promise.all([
      db.disconnect(),
      redis.disconnect()
    ]);
    logSystemEvent('shutdown_completed', { signal: 'SIGTERM' });
    process.exit(0);
  } catch (error) {
    logSystemEvent('shutdown_failed', { 
      signal: 'SIGTERM', 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logSystemEvent('shutdown_initiated', { signal: 'SIGINT' });
  try {
    await Promise.all([
      db.disconnect(),
      redis.disconnect()
    ]);
    logSystemEvent('shutdown_completed', { signal: 'SIGINT' });
    process.exit(0);
  } catch (error) {
    logSystemEvent('shutdown_failed', { 
      signal: 'SIGINT', 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  }
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logSecurityEvent('uncaught_exception', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    processId: process.pid,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logSecurityEvent('unhandled_rejection', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack,
    } : String(reason),
    promise: String(promise),
    processId: process.pid,
  });
});

startServer();

export default app;