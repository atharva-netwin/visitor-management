#!/usr/bin/env ts-node

// Temporary script to start server without Redis for testing
// This disables Redis-dependent features

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { config } from '@/config/config';
import { logger, logSystemEvent } from '@/utils/logger';
import { ensureLogsDirectory } from '@/utils/logSetup';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { securityMiddleware } from '@/middleware/security';
import { db } from '@/database';

// Import routes
import { authRoutes } from '@/routes/auth';
import { visitorRoutes } from '@/routes/visitors';
import { healthRouter } from '@/routes/health';

async function startServerWithoutRedis() {
  try {
    logSystemEvent('server_startup_initiated', {
      port: config.port,
      environment: config.nodeEnv,
      nodeVersion: process.version,
      processId: process.pid
    });

    // Ensure logs directory exists
    await ensureLogsDirectory();

    // Initialize database
    logSystemEvent('database_initialization_started');
    await db.connect();
    logSystemEvent('database_initialization_completed');

    // Create Express app
    const app = express();

    // Basic middleware
    app.use(compression());
    app.use(cors({
      origin: config.cors.origins,
      credentials: true
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security middleware
    app.use(securityMiddleware);

    // Request logging
    app.use(requestLogger);

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/visitors', visitorRoutes);
    app.use('/api', healthRouter);

    // Basic API info
    app.get('/api', (req, res) => {
      res.json({
        name: 'Visitor Management API',
        version: '1.0.0',
        status: 'running',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        redis: 'disabled'
      });
    });

    // Error handling
    app.use(errorHandler);

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on http://localhost:${config.port}`);
      logger.info(`📚 API Documentation: http://localhost:${config.port}/api`);
      logger.info(`🏥 Health Check: http://localhost:${config.port}/api/health`);
      logger.warn('⚠️  Redis is disabled - some features may not work');
      
      logSystemEvent('server_startup_completed', {
        port: config.port,
        environment: config.nodeEnv
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    logSystemEvent('server_startup_failed', { error: (error as Error).message });
    process.exit(1);
  }
}

startServerWithoutRedis();