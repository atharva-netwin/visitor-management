import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/AuthService';
import { ErrorCodes } from '@/types';
import { logger } from '@/utils/logger';

/**
 * JWT Authentication Middleware
 * Validates JWT access tokens and attaches user information to request
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTHENTICATION_FAILED,
          message: 'Access token is required',
          correlationId: req.correlationId || 'unknown'
        }
      });
      return;
    }

    // Validate the token (this also checks if user exists and is active)
    const userPayload = await AuthService.validateToken(token);
    if (!userPayload) {
      res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTHENTICATION_FAILED,
          message: 'Invalid or expired access token',
          correlationId: req.correlationId || 'unknown'
        }
      });
      return;
    }

    // Attach user information to request
    req.user = {
      id: userPayload.id,
      email: userPayload.email,
      firstName: userPayload.firstName,
      lastName: userPayload.lastName
    };

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId
    });

    res.status(500).json({
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Authentication error',
        correlationId: req.correlationId || 'unknown'
      }
    });
  }
};

/**
 * Optional Authentication Middleware
 * Similar to authenticateToken but doesn't fail if no token is provided
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      // No token provided, continue without user info
      next();
      return;
    }

    // Validate the token
    const userPayload = await AuthService.validateToken(token);
    if (!userPayload) {
      // Invalid token, continue without user info
      next();
      return;
    }

    // Attach user information to request
    req.user = {
      id: userPayload.id,
      email: userPayload.email,
      firstName: userPayload.firstName,
      lastName: userPayload.lastName
    };

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId
    });

    // For optional auth, we don't fail on errors, just continue without user info
    next();
  }
};

/**
 * Role-based Authorization Middleware Factory
 * Creates middleware that checks if user has required role/permission
 * Note: This is a placeholder for future role-based access control
 */
export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: ErrorCodes.AUTHENTICATION_FAILED,
          message: 'Authentication required',
          correlationId: req.correlationId || 'unknown'
        }
      });
      return;
    }

    // For now, all authenticated users have access
    // In the future, this would check user roles/permissions
    logger.debug('Role check requested', { 
      userId: req.user.id, 
      requiredRole: role,
      correlationId: req.correlationId 
    });

    next();
  };
};