import { Request, Response } from 'express';
import { AuthService } from '@/services/AuthService';
import { RegisterRequest, LoginRequest, ErrorCodes } from '@/types';
import { logger } from '@/utils/logger';
import { recordAuthAttempt } from '@/middleware/monitoring';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const userData: RegisterRequest = req.body;
      const result = await AuthService.register(userData);

      if (!result.success) {
        recordAuthAttempt('register', 'failure');
        res.status(400).json({
          success: false,
          error: {
            code: result.error?.includes('already registered') ? ErrorCodes.DUPLICATE_RESOURCE : ErrorCodes.VALIDATION_ERROR,
            message: result.error || 'Registration failed',
            correlationId: req.correlationId || 'unknown'
          }
        });
        return;
      }

      recordAuthAttempt('register', 'success');
      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      logger.error('Registration controller error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId 
      });

      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId || 'unknown'
        }
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const credentials: LoginRequest = req.body;
      const result = await AuthService.login(credentials);

      if (!result.success) {
        recordAuthAttempt('login', 'failure');
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: result.error || 'Authentication failed',
            correlationId: req.correlationId || 'unknown'
          }
        });
        return;
      }

      recordAuthAttempt('login', 'success');
      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      logger.error('Login controller error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId 
      });

      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId || 'unknown'
        }
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Refresh token is required',
            correlationId: req.correlationId || 'unknown'
          }
        });
        return;
      }

      const result = await AuthService.refreshToken(refreshToken);

      if (!result.success) {
        recordAuthAttempt('refresh', 'failure');
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: result.error || 'Token refresh failed',
            correlationId: req.correlationId || 'unknown'
          }
        });
        return;
      }

      recordAuthAttempt('refresh', 'success');
      res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
    } catch (error) {
      logger.error('Token refresh controller error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId 
      });

      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId || 'unknown'
        }
      });
    }
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
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

      await AuthService.logout(userId);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout controller error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId 
      });

      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId || 'unknown'
        }
      });
    }
  }

  /**
   * Get current user profile
   */
  static async me(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
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

      // User data is already available from the auth middleware
      res.status(200).json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      logger.error('Get user profile controller error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: req.correlationId 
      });

      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId: req.correlationId || 'unknown'
        }
      });
    }
  }
}