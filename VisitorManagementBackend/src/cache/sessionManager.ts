/// <reference types="node" />

import { redis } from './redis';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface SessionData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  loginAt: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  createdAt: string;
  expiresAt: string;
}

class SessionManager {
  private readonly SESSION_PREFIX = 'session:';
  private readonly REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly SESSION_TTL = 15 * 60; // 15 minutes (matches JWT access token)
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days

  // Session management methods
  async createSession(sessionId: string, sessionData: SessionData): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      const data = JSON.stringify({
        ...sessionData,
        lastActivity: new Date().toISOString()
      });
      
      await redis.set(key, data, this.SESSION_TTL);
      
      // Track user sessions for multi-session management
      await this.addUserSession(sessionData.userId, sessionId);
      
      logger.debug(`Session created: ${sessionId}`, { userId: sessionData.userId });
    } catch (error) {
      logger.error(`Failed to create session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const key = this.getSessionKey(sessionId);
      const data = await redis.get(key);
      
      if (!data) {
        return null;
      }
      
      const sessionData: SessionData = JSON.parse(data);
      
      // Update last activity
      await this.updateSessionActivity(sessionId, sessionData);
      
      return sessionData;
    } catch (error) {
      logger.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  async updateSessionActivity(sessionId: string, sessionData: SessionData): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      const updatedData = {
        ...sessionData,
        lastActivity: new Date().toISOString()
      };
      
      await redis.set(key, JSON.stringify(updatedData), this.SESSION_TTL);
    } catch (error) {
      logger.error(`Failed to update session activity ${sessionId}:`, error);
      // Don't throw error for activity updates to avoid breaking requests
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionData = await this.getSession(sessionId);
      const key = this.getSessionKey(sessionId);
      
      await redis.del(key);
      
      if (sessionData) {
        await this.removeUserSession(sessionData.userId, sessionId);
      }
      
      logger.debug(`Session deleted: ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    try {
      const sessionIds = await this.getUserSessions(userId);
      
      // Delete all session data
      const deletePromises = sessionIds.map(sessionId => 
        redis.del(this.getSessionKey(sessionId))
      );
      
      await Promise.all(deletePromises);
      
      // Clear user sessions list
      await redis.del(this.getUserSessionsKey(userId));
      
      logger.debug(`All sessions deleted for user: ${userId}`, { count: sessionIds.length });
    } catch (error) {
      logger.error(`Failed to delete all sessions for user ${userId}:`, error);
      throw error;
    }
  }

  // Refresh token management methods
  async storeRefreshToken(tokenHash: string, tokenData: RefreshTokenData): Promise<void> {
    try {
      const key = this.getRefreshTokenKey(tokenHash);
      const data = JSON.stringify(tokenData);
      
      await redis.set(key, data, this.REFRESH_TOKEN_TTL);
      
      logger.debug(`Refresh token stored: ${tokenData.tokenId}`, { userId: tokenData.userId });
    } catch (error) {
      logger.error(`Failed to store refresh token:`, error);
      throw error;
    }
  }

  async getRefreshToken(tokenHash: string): Promise<RefreshTokenData | null> {
    try {
      const key = this.getRefreshTokenKey(tokenHash);
      const data = await redis.get(key);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Failed to get refresh token:`, error);
      return null;
    }
  }

  async deleteRefreshToken(tokenHash: string): Promise<void> {
    try {
      const key = this.getRefreshTokenKey(tokenHash);
      await redis.del(key);
      
      logger.debug(`Refresh token deleted`);
    } catch (error) {
      logger.error(`Failed to delete refresh token:`, error);
      throw error;
    }
  }

  async deleteAllUserRefreshTokens(userId: string): Promise<void> {
    try {
      // Get all refresh token keys for the user
      const pattern = `${this.REFRESH_TOKEN_PREFIX}*`;
      const keys = await this.getKeysByPattern(pattern);
      
      const deletePromises: Promise<void>[] = [];
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const tokenData: RefreshTokenData = JSON.parse(data);
          if (tokenData.userId === userId) {
            deletePromises.push(redis.del(key).then(() => {}));
          }
        }
      }
      
      await Promise.all(deletePromises);
      
      logger.debug(`All refresh tokens deleted for user: ${userId}`);
    } catch (error) {
      logger.error(`Failed to delete all refresh tokens for user ${userId}:`, error);
      throw error;
    }
  }

  // User session tracking methods
  private async addUserSession(userId: string, sessionId: string): Promise<void> {
    try {
      const key = this.getUserSessionsKey(userId);
      const sessions = await this.getUserSessions(userId);
      
      if (!sessions.includes(sessionId)) {
        sessions.push(sessionId);
        await redis.set(key, JSON.stringify(sessions), this.SESSION_TTL);
      }
    } catch (error) {
      logger.error(`Failed to add user session:`, error);
      // Don't throw to avoid breaking session creation
    }
  }

  private async removeUserSession(userId: string, sessionId: string): Promise<void> {
    try {
      const key = this.getUserSessionsKey(userId);
      const sessions = await this.getUserSessions(userId);
      
      const updatedSessions = sessions.filter(id => id !== sessionId);
      
      if (updatedSessions.length > 0) {
        await redis.set(key, JSON.stringify(updatedSessions), this.SESSION_TTL);
      } else {
        await redis.del(key);
      }
    } catch (error) {
      logger.error(`Failed to remove user session:`, error);
      // Don't throw to avoid breaking session deletion
    }
  }

  private async getUserSessions(userId: string): Promise<string[]> {
    try {
      const key = this.getUserSessionsKey(userId);
      const data = await redis.get(key);
      
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error(`Failed to get user sessions:`, error);
      return [];
    }
  }

  // Cache management methods
  async cacheData(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      const cacheKey = `cache:${key}`;
      const serializedData = JSON.stringify(data);
      
      await redis.set(cacheKey, serializedData, ttlSeconds);
      
      logger.debug(`Data cached: ${key}`, { ttl: ttlSeconds });
    } catch (error) {
      logger.error(`Failed to cache data for key ${key}:`, error);
      throw error;
    }
  }

  async getCachedData<T = any>(key: string): Promise<T | null> {
    try {
      const cacheKey = `cache:${key}`;
      const data = await redis.get(cacheKey);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Failed to get cached data for key ${key}:`, error);
      return null;
    }
  }

  async deleteCachedData(key: string): Promise<void> {
    try {
      const cacheKey = `cache:${key}`;
      await redis.del(cacheKey);
      
      logger.debug(`Cached data deleted: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete cached data for key ${key}:`, error);
      throw error;
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `cache:user:${userId}:*`;
      const keys = await this.getKeysByPattern(pattern);
      
      if (keys.length > 0) {
        const deletePromises = keys.map(key => redis.del(key));
        await Promise.all(deletePromises);
        
        logger.debug(`User cache invalidated: ${userId}`, { keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error(`Failed to invalidate user cache for ${userId}:`, error);
      throw error;
    }
  }

  // Utility methods
  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  private getRefreshTokenKey(tokenHash: string): string {
    return `${this.REFRESH_TOKEN_PREFIX}${tokenHash}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_PREFIX}${userId}`;
  }

  private async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      // Note: In production, you might want to use SCAN instead of KEYS for better performance
      const keys = await redis.nativeClient.keys(pattern);
      return keys;
    } catch (error) {
      logger.error(`Failed to get keys by pattern ${pattern}:`, error);
      return [];
    }
  }

  // Generate secure session ID
  generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Generate secure token ID
  generateTokenId(): string {
    return crypto.randomUUID();
  }

  // Hash token for storage
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export const sessionManager = new SessionManager();