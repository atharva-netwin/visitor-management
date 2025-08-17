import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '@/services/MonitoringService';
import { logger } from '@/utils/logger';

// Extend Request interface to include monitoring data
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      route?: {
        path?: string;
      };
    }
  }
}

/**
 * Middleware to track HTTP request metrics
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Record start time
  req.startTime = Date.now();

  // Override res.end to capture metrics when response is sent
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
    try {
      const duration = req.startTime ? (Date.now() - req.startTime) / 1000 : 0;
      const route = getRoutePattern(req);
      
      // Record HTTP request metrics
      monitoringService.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration
      );

      // Log slow requests (> 2 seconds)
      if (duration > 2) {
        logger.warn('Slow request detected', {
          method: req.method,
          route,
          statusCode: res.statusCode,
          duration: `${duration}s`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      }

    } catch (error) {
      logger.error('Error recording request metrics:', error);
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * Get route pattern for metrics (removes dynamic parameters)
 */
function getRoutePattern(req: Request): string {
  // Try to get route from Express router
  if (req.route?.path) {
    return req.route.path;
  }

  // Fallback to URL path with parameter normalization
  let path = req.path;
  
  // Normalize common patterns
  path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id'); // UUIDs
  path = path.replace(/\/\d+/g, '/:id'); // Numeric IDs
  path = path.replace(/\/[0-9]{4}\/[0-9]{1,2}/g, '/:year/:month'); // Date patterns
  path = path.replace(/\/[0-9]{4}-[0-9]{2}-[0-9]{2}/g, '/:date'); // ISO date patterns
  
  return path;
}

/**
 * Middleware to track active connections
 */
export const connectionTrackingMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  // This is a simplified connection counter
  // In a real production environment, you might want to use more sophisticated tracking
  
  // Increment active connections (approximate)
  const currentConnections = parseInt(process.env['ACTIVE_CONNECTIONS'] || '0') + 1;
  process.env['ACTIVE_CONNECTIONS'] = currentConnections.toString();
  monitoringService.setActiveConnections(currentConnections);

  // Decrement when response finishes
  res.on('finish', () => {
    const updatedConnections = Math.max(0, parseInt(process.env['ACTIVE_CONNECTIONS'] || '0') - 1);
    process.env['ACTIVE_CONNECTIONS'] = updatedConnections.toString();
    monitoringService.setActiveConnections(updatedConnections);
  });

  next();
};

/**
 * Middleware to track errors
 */
export const errorTrackingMiddleware = (error: Error, req: Request, _res: Response, next: NextFunction): void => {
  const route = getRoutePattern(req);
  
  // Record error metrics
  monitoringService.recordError(error.name || 'UnknownError', route);
  
  // Log error details
  logger.error('Request error tracked', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    request: {
      method: req.method,
      route,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  next(error);
};

/**
 * Helper function to record authentication attempts
 */
export const recordAuthAttempt = (type: 'login' | 'register' | 'refresh', status: 'success' | 'failure'): void => {
  monitoringService.recordAuthAttempt(type, status);
};

/**
 * Helper function to record sync operations
 */
export const recordSyncOperation = (type: 'bulk_sync' | 'conflict_resolution', status: 'success' | 'failure'): void => {
  monitoringService.recordSyncOperation(type, status);
};