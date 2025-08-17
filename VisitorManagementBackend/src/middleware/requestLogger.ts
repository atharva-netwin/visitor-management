import { Request, Response, NextFunction } from 'express';
import { logger, logApiEvent, logPerformance, logSecurityEvent } from '../utils/logger';
import { config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import morgan from 'morgan';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

// Custom Morgan token for correlation ID (only if morgan.token exists)
if (typeof morgan.token === 'function') {
  morgan.token('correlationId', (req: Request) => req.correlationId || 'unknown');
}

// Custom Morgan format for structured logging
const morganFormat = config.nodeEnv === 'production' 
  ? ':method :url :status :res[content-length] - :response-time ms :correlationId'
  : ':method :url :status :res[content-length] - :response-time ms [:correlationId]';

export const httpLogger = morgan(morganFormat, {
  stream: {
    write: (message: string) => {
      // Parse Morgan message to extract structured data
      const parts = message.trim().split(' ');
      if (parts.length >= 6) {
        const [method, url, status, contentLength, , responseTime] = parts;
        const correlationId = parts[parts.length - 1]?.replace(/[\[\]]/g, '') || 'unknown';
        
        logApiEvent('http_request_completed', {
          method: method || 'UNKNOWN',
          url: url || '/',
          statusCode: status ? parseInt(status) : 0,
          contentLength: contentLength && contentLength !== '-' ? parseInt(contentLength) : 0,
          responseTime: responseTime ? parseFloat(responseTime) : 0,
        }, correlationId);
      } else {
        logger.info(message.trim(), { eventType: 'http' });
      }
    }
  },
  skip: (req: Request) => {
    // Skip logging for health check endpoints to reduce noise
    return req.url === '/api/health' && req.method === 'GET';
  }
});

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  
  req.correlationId = correlationId;
  req.startTime = startTime;

  // Enhanced request logging with more context
  const requestData = {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    origin: req.get('Origin'),
    authorization: req.get('Authorization') ? 'Bearer [REDACTED]' : undefined,
  };

  logApiEvent('request_started', requestData, correlationId);

  // Log request body for non-GET requests (with sensitive data filtering)
  if (req.method !== 'GET' && req.body) {
    const sanitizedBody = sanitizeRequestBody(req.body);
    if (Object.keys(sanitizedBody).length > 0) {
      logApiEvent('request_body', { body: sanitizedBody }, correlationId);
    }
  }

  // Track response details
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;

  let responseLogged = false;

  const logResponse = (body?: any) => {
    if (responseLogged) return;
    responseLogged = true;

    const duration = Date.now() - startTime;
    const responseData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration,
      contentType: res.get('Content-Type'),
      contentLength: res.get('Content-Length'),
    };

    // Log performance metrics
    logPerformance(`${req.method} ${req.url}`, duration, {
      statusCode: res.statusCode,
      path: req.path,
    }, correlationId);

    // Log response based on status code
    if (res.statusCode >= 500) {
      logger.error('Server error response', { 
        ...responseData,
        correlationId,
        eventType: 'api',
      });
    } else if (res.statusCode >= 400) {
      logSecurityEvent('client_error_response', responseData, correlationId);
    } else {
      logApiEvent('request_completed', responseData, correlationId);
    }

    // Log response body for errors (with sensitive data filtering)
    if (res.statusCode >= 400 && body) {
      const sanitizedResponse = sanitizeResponseBody(body);
      if (sanitizedResponse) {
        logApiEvent('error_response_body', { 
          body: sanitizedResponse,
          statusCode: res.statusCode,
        }, correlationId);
      }
    }
  };

  // Override response methods to capture response data
  res.json = function(body: any) {
    logResponse(body);
    return originalJson.call(this, body);
  };

  res.send = function(body: any) {
    logResponse(body);
    return originalSend.call(this, body);
  };

  res.end = function(chunk?: any, encoding?: any) {
    logResponse(chunk);
    return originalEnd.call(this, chunk, encoding);
  };

  // Handle response timeout
  const timeout = setTimeout(() => {
    if (!responseLogged) {
      logSecurityEvent('request_timeout', {
        method: req.method,
        url: req.url,
        duration: Date.now() - startTime,
      }, correlationId);
    }
  }, 30000); // 30 second timeout

  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
};

// Sanitize request body to remove sensitive information
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') return {};

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'auth'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeRequestBody(sanitized[key]);
    }
  }

  return sanitized;
}

// Sanitize response body to remove sensitive information
function sanitizeResponseBody(body: any): any {
  if (!body) return null;

  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    if (typeof parsed !== 'object') return null;

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'accessToken', 'refreshToken'];
    const sanitized = { ...parsed };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  } catch {
    return null;
  }
}