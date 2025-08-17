import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '@/config/config';
import { User, CreateUserData } from '@/models/User';
import { db } from '@/database';
import { 
  RegisterRequest, 
  LoginRequest, 
  AuthResponse, 
  TokenResponse, 
  UserPayload, 
  UserProfile
} from '@/types';
import { logger } from '@/utils/logger';

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      // Check if email already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        return {
          success: false,
          error: 'Email address is already registered'
        };
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(userData.password, config.bcrypt.saltRounds);

      // Create user data
      const createUserData: CreateUserData = {
        email: userData.email.toLowerCase().trim(),
        passwordHash,
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim()
      };

      // Create the user
      const user = await User.create(createUserData);

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      logger.info('User registered successfully', { 
        userId: user.id, 
        email: user.email 
      });

      return {
        success: true,
        user,
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Registration failed', { 
        email: userData.email, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: 'Registration failed. Please try again.'
      };
    }
  }

  /**
   * Login user
   */
  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user with password
      const user = await User.findByEmailWithPassword(credentials.email);
      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      // Update last login time
      await User.update(user.id, { lastLoginAt: new Date() });

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Remove password hash from user object
      const { passwordHash, ...userProfile } = user;

      logger.info('User logged in successfully', { 
        userId: user.id, 
        email: user.email 
      });

      return {
        success: true,
        user: userProfile,
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Login failed', { 
        email: credentials.email, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: 'Login failed. Please try again.'
      };
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private static async generateTokens(user: UserProfile): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };

    // Generate access token
    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
      issuer: 'visitor-management-api',
      audience: 'visitor-management-app'
    } as jwt.SignOptions);

    // Generate refresh token
    const refreshTokenValue = uuidv4();
    const refreshToken = jwt.sign(
      { tokenId: refreshTokenValue, userId: user.id }, 
      config.jwt.refreshSecret, 
      {
        expiresIn: config.jwt.refreshExpiry,
        issuer: 'visitor-management-api',
        audience: 'visitor-management-app'
      } as jwt.SignOptions
    );

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshTokenValue);

    return { accessToken, refreshToken };
  }

  /**
   * Store refresh token in database
   */
  private static async storeRefreshToken(userId: string, tokenValue: string): Promise<void> {
    const tokenHash = await bcrypt.hash(tokenValue, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;

    await db.query(query, [userId, tokenHash, expiresAt]);
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
      
      if (!decoded.tokenId || !decoded.userId) {
        return {
          success: false,
          error: 'Invalid refresh token'
        };
      }

      // Check if refresh token exists and is valid
      const storedToken = await this.getRefreshToken(decoded.userId, decoded.tokenId);
      if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
        return {
          success: false,
          error: 'Refresh token expired or revoked'
        };
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Revoke old refresh token
      await this.revokeRefreshToken(storedToken.id);

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      logger.info('Token refreshed successfully', { userId: user.id });

      return {
        success: true,
        ...tokens
      };
    } catch (error) {
      logger.error('Token refresh failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        success: false,
        error: 'Token refresh failed'
      };
    }
  }

  /**
   * Get refresh token from database
   */
  private static async getRefreshToken(userId: string, tokenId: string): Promise<RefreshToken | null> {
    const query = `
      SELECT id, user_id as "userId", token_hash as "tokenHash", 
             expires_at as "expiresAt", created_at as "createdAt", 
             is_revoked as "isRevoked"
      FROM refresh_tokens 
      WHERE user_id = $1 AND is_revoked = false
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);
    const storedToken = result.rows[0];

    if (!storedToken) {
      return null;
    }

    // Verify token hash
    const isValid = await bcrypt.compare(tokenId, storedToken.tokenHash);
    return isValid ? storedToken : null;
  }

  /**
   * Revoke refresh token
   */
  private static async revokeRefreshToken(tokenId: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens 
      SET is_revoked = true 
      WHERE id = $1
    `;

    await db.query(query, [tokenId]);
  }

  /**
   * Logout user (revoke all refresh tokens)
   */
  static async logout(userId: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens 
      SET is_revoked = true 
      WHERE user_id = $1 AND is_revoked = false
    `;

    await db.query(query, [userId]);
    
    logger.info('User logged out successfully', { userId });
  }

  /**
   * Validate JWT access token
   */
  static async validateToken(token: string): Promise<UserPayload | null> {
    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as UserPayload;
      
      // Verify user still exists and is active
      const user = await User.findById(decoded.id);
      if (!user) {
        return null;
      }

      return decoded;
    } catch (error) {
      logger.debug('Token validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }
}