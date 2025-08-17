import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { logger } from '@/utils/logger';

/**
 * Enhanced security middleware with comprehensive protection
 */
export const securityMiddleware = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // API doesn't need this
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Frameguard
  frameguard: { action: 'deny' },
  
  // Hide Powered-By header
  hidePoweredBy: true,
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: false,
  
  // Referrer Policy
  referrerPolicy: { policy: "no-referrer" },
  
  // X-XSS-Protection
  xssFilter: true,
});

/**
 * Input sanitization middleware to prevent injection attacks
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize all string inputs in body, query, and params
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters and scripts
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers with quotes
        .replace(/on\w+\s*=\s*[^"'\s>]+/gi, '') // Remove event handlers without quotes
        .replace(/<[^>]*>/g, '') // Remove all HTML tags
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Input sanitization error', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      url: req.url,
      method: req.method
    });
    
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid input detected',
        correlationId: req.correlationId
      }
    });
  }
};

/**
 * Security headers middleware for API responses
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Additional security headers for API
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

/**
 * Request size limiting middleware
 */
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = req.get('content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    logger.warn('Request size limit exceeded', {
      correlationId: req.correlationId,
      contentLength,
      maxSize,
      ip: req.ip,
      url: req.url
    });
    
    res.status(413).json({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request entity too large',
        correlationId: req.correlationId
      }
    });
    return;
  }
  
  next();
};

/**
 * Suspicious activity detection middleware
 */
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
    /(union\s+select|drop\s+table|insert\s+into)/i, // SQL injection
    /(<script|javascript:|vbscript:|onload=|onerror=)/i, // XSS
    /(cmd\.exe|powershell|bash|sh\s|rm\s+-rf)/i, // Command injection
  ];
  
  const checkString = (str: string): boolean => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  
  const checkObject = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return checkString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkObject);
    }
    
    return false;
  };
  
  const suspicious = 
    checkString(req.url) ||
    checkObject(req.query) ||
    checkObject(req.body) ||
    checkObject(req.params);
  
  if (suspicious) {
    logger.warn('Suspicious activity detected', {
      correlationId: req.correlationId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params
    });
    
    res.status(400).json({
      success: false,
      error: {
        code: 'SUSPICIOUS_ACTIVITY',
        message: 'Suspicious activity detected',
        correlationId: req.correlationId
      }
    });
    return;
  }
  
  next();
};