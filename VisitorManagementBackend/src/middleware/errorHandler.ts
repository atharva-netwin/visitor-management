import { Request, Response, NextFunction } from 'express';
import { logWithCorrelation, logSecurityEvent } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = req.correlationId || uuidv4();
  
  // Default error values
  let statusCode = error.statusCode || 500;
  let code = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'Internal Server Error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'AUTHENTICATION_FAILED';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'AUTHENTICATION_FAILED';
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'AUTHENTICATION_FAILED';
    message = 'Token expired';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid ID format';
  } else if ((error as any).code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
  } else if ((error as any).code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Referenced resource does not exist';
  }

  // Sanitize request data for logging
  const sanitizedHeaders = { ...req.headers };
  if (sanitizedHeaders.authorization) {
    sanitizedHeaders.authorization = 'Bearer [REDACTED]';
  }

  const sanitizedBody = sanitizeErrorBody(req.body);

  // Enhanced error logging with correlation ID
  const errorContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code,
      statusCode,
      isOperational: error.isOperational || false,
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: sanitizedHeaders,
      body: sanitizedBody,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
    },
    user: (req as any).user ? {
      id: (req as any).user.id,
      email: (req as any).user.email,
    } : undefined,
    timestamp: new Date().toISOString(),
  };

  // Log based on error severity
  if (statusCode >= 500) {
    logWithCorrelation.error('Server error occurred', error, errorContext, correlationId);
  } else if (statusCode === 401 || statusCode === 403) {
    logSecurityEvent('authentication_authorization_error', {
      ...errorContext,
      securityLevel: 'medium',
    }, correlationId);
  } else if (statusCode >= 400) {
    logWithCorrelation.warn('Client error occurred', errorContext, correlationId);
  }

  // Log suspicious activity patterns
  if (shouldLogSecurityEvent(error, req)) {
    logSecurityEvent('suspicious_error_pattern', {
      errorCode: code,
      statusCode,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
    }, correlationId);
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      ...(process.env['NODE_ENV'] === 'development' && { 
        stack: error.stack,
        details: errorContext,
      }),
    },
  });
};

// Helper function to sanitize error body
function sanitizeErrorBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// Helper function to determine if error should trigger security logging
function shouldLogSecurityEvent(error: AppError, req: Request): boolean {
  const suspiciousPatterns = [
    // Multiple authentication failures
    error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError',
    // SQL injection attempts
    req.url.includes('UNION') || req.url.includes('SELECT') || req.url.includes('DROP'),
    // Path traversal attempts
    req.url.includes('../') || req.url.includes('..\\'),
    // XSS attempts
    req.url.includes('<script>') || req.url.includes('javascript:'),
  ];

  return suspiciousPatterns.some(pattern => pattern);
}

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};