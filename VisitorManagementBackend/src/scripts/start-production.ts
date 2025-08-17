#!/usr/bin/env node

/**
 * Production Startup Script
 * Handles database migrations, health checks, and graceful startup
 */

import { logger } from '../utils/logger';
import { db } from '../database';
import { redis } from '../cache';

async function startProduction(): Promise<void> {
  try {
    logger.info('Starting production server...');
    
    // 1. Test database connection
    logger.info('Testing database connection...');
    await db.connect();
    
    const dbHealth = await db.healthCheck();
    if (dbHealth.status !== 'healthy') {
      throw new Error(`Database health check failed: ${JSON.stringify(dbHealth.details)}`);
    }
    logger.info('✅ Database connection healthy');
    
    // 2. Test Redis connection (if configured)
    if (process.env['REDIS_HOST']) {
      try {
        logger.info('Testing Redis connection...');
        await redis.connect();
        const healthCheck = await redis.healthCheck();
        if (healthCheck.status === 'healthy') {
          logger.info('✅ Redis connection healthy');
        } else {
          logger.warn('⚠️  Redis health check failed, continuing without cache:', healthCheck.details);
        }
      } catch (error) {
        logger.warn('⚠️  Redis connection failed, continuing without cache:', error);
      }
    } else {
      logger.info('Redis not configured, skipping cache initialization');
    }
    
    // 3. Run database migrations (if needed)
    try {
      logger.info('Checking database migrations...');
      const { migrator } = await import('../database/migrator');
      await migrator.runMigrations();
      logger.info('✅ Database migrations completed');
    } catch (error) {
      logger.error('Database migration failed:', error);
      throw error;
    }
    
    // 4. Start the Express server
    logger.info('Starting Express server...');
    await import('../index');
    
    logger.info('🚀 Production server started successfully');
    
    // 5. Setup graceful shutdown
    setupGracefulShutdown();
    
  } catch (error) {
    logger.error('Failed to start production server:', error);
    process.exit(1);
  }
}

function setupGracefulShutdown(): void {
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Close database connections
      await db.disconnect();
      logger.info('Database connections closed');
      
      // Close Redis connections
      if (process.env['REDIS_HOST']) {
        await redis.disconnect();
        logger.info('Redis connections closed');
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };
  
  // Handle different termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

// Run if this script is executed directly
if (require.main === module) {
  startProduction();
}

export { startProduction };