

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import ExpressBrute from 'express-brute';
import { config } from '@/config/config';
import { logger } from '@/utils/logger';

/**
 * Redis store for express-brute
 */
let bruteStore: any;

try {
  // Use memory store for now to avoid Redis client access issues
  bruteStore = new ExpressBrute.MemoryStore();
  logger.info('Using memory store for brute force protection');
} catch (error) {
  logger.warn('Failed to initialize brute force store, using memory store', { error });
  bruteStore = new ExpressBrute.MemoryStore();
}

/**
 * Brute force protection for authentication endpoints
 */
export const authBruteForce = new ExpressBrute(bruteStore, {
  freeRetries: 3, // Allow 3 free attempts
  minWait: 5 * 60 * 1000, // 5 minutes
  maxWait: 60 * 60 * 1000, // 1 hour
  lifetime: 24 * 60 * 60, // 24 hours
  failCallback: (req: Request, res: Response, _next: NextFunction, nextValidRequestDate: Date) => {
    logger.warn('Brute force attack detected', {
      correlationId: req.correlationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      nextValidRequestDate,
      url: req.url
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many failed attempts. Please try again later.',
        retryAfter: nextValidRequestDate,
        correlationId: req.correlationId
      }
    });
  },
  handleStoreError: (error: Error) => {
    logger.error('Brute force store error', { error: error.message });
    throw error;
  }
});

/**
 * Rate limiter for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      correlationId: req.correlationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        correlationId: req.correlationId
      }
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.url === '/api/health';
  }
});

/**
 * Rate limiter for general API endpoints
 */
export const apiRateLimit = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('API rate limit exceeded', {
      correlationId: req.correlationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        correlationId: req.correlationId
      }
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.url === '/api/health';
  }
});

/**
 * Rate limiter for sync endpoints
 */
export const syncRateLimit = rateLimit({
  windowMs: config.rateLimit.sync.windowMs,
  max: config.rateLimit.sync.max,
  message: {
    success: false,
    error: {
      code: 'SYNC_RATE_LIMIT_EXCEEDED',
      message: 'Too many sync requests. Please try again later.',
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Sync rate limit exceeded', {
      correlationId: req.correlationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'SYNC_RATE_LIMIT_EXCEEDED',
        message: 'Too many sync requests. Please try again later.',
        correlationId: req.correlationId
      }
    });
  }
});

/**
 * Progressive delay middleware for repeated requests
 */
export const progressiveDelay: any = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: () => 500, // Add 500ms delay per request after delayAfter (new v2 format)
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

/**
 * IP-based blocking middleware for suspicious activity
 */
interface BlockedIP {
  ip: string;
  blockedUntil: Date;
  reason: string;
  attempts: number;
}

const blockedIPs = new Map<string, BlockedIP>();

export const ipBlockingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIP = req.ip || 'unknown';
  const blocked = blockedIPs.get(clientIP);
  
  if (blocked && blocked.blockedUntil > new Date()) {
    logger.warn('Blocked IP attempted access', {
      correlationId: req.correlationId,
      ip: clientIP,
      reason: blocked.reason,
      blockedUntil: blocked.blockedUntil,
      attempts: blocked.attempts
    });
    
    res.status(403).json({
      success: false,
      error: {
        code: 'IP_BLOCKED',
        message: 'Access denied. IP address is temporarily blocked.',
        correlationId: req.correlationId
      }
    });
    return;
  }
  
  // Clean up expired blocks
  if (blocked && blocked.blockedUntil <= new Date()) {
    blockedIPs.delete(clientIP);
  }
  
  next();
};

/**
 * Function to block an IP address
 */
export const blockIP = (ip: string, reason: string, durationMinutes: number = 60): void => {
  const existing = blockedIPs.get(ip);
  const attempts = existing ? existing.attempts + 1 : 1;
  
  // Exponential backoff: double the duration for each subsequent block
  const actualDuration = durationMinutes * Math.pow(2, attempts - 1);
  const blockedUntil = new Date(Date.now() + actualDuration * 60 * 1000);
  
  blockedIPs.set(ip, {
    ip,
    blockedUntil,
    reason,
    attempts
  });
  
  logger.warn('IP address blocked', {
    ip,
    reason,
    blockedUntil,
    attempts,
    durationMinutes: actualDuration
  });
};

/**
 * Rate limit monitoring middleware
 */
export const rateLimitMonitoring = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(this: Response, body: any) {
    // Check if this is a rate limit response
    if (res.statusCode === 429) {
      const clientIP = req.ip || 'unknown';
      
      // Track rate limit violations
      logger.warn('Rate limit violation', {
        correlationId: req.correlationId,
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        statusCode: res.statusCode
      });
      
      // Use in-memory tracking for rate limit violations
      try {
        // Simple in-memory tracking (in production, use Redis)
        const violationKey = `violations_${clientIP}`;
        const existingViolations = (global as any)[violationKey] || 0;
        const newViolations = existingViolations + 1;
        (global as any)[violationKey] = newViolations;
        
        // Clean up after 1 hour
        setTimeout(() => {
          delete (global as any)[violationKey];
        }, 3600000);
        
        if (newViolations >= 10) { // Block after 10 rate limit violations
          blockIP(clientIP, 'Multiple rate limit violations', 30);
        }
      } catch (error) {
        logger.error('Error in rate limit monitoring', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

/**
 * Cleanup function to remove expired blocks
 */
export const cleanupExpiredBlocks = (): void => {
  const now = new Date();
  for (const [ip, blocked] of blockedIPs.entries()) {
    if (blocked.blockedUntil <= now) {
      blockedIPs.delete(ip);
    }
  }
};

// Run cleanup every 5 minutes
const cleanupInterval: NodeJS.Timeout = setInterval(cleanupExpiredBlocks, 5 * 60 * 1000);

// Export cleanup interval for testing purposes
export { cleanupInterval };