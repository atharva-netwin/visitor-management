import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { User } from '@/models/User';
import { config } from '@/config/config';

// Mock the database and models
jest.mock('@/models/User');
jest.mock('@/database', () => ({
  db: {
    query: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
  },
  initializeDatabase: jest.fn()
}));

jest.mock('@/cache', () => ({
  redis: {
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
  },
  initializeCache: jest.fn()
}));

const MockedUser = User as jest.Mocked<typeof User>;

describe('Authentication Middleware', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const token = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      MockedUser.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName
      });
    });

    it('should return 401 when no token provided', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Access token is required');
    });

    it('should return 401 when invalid token provided', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid or expired access token');
    });

    it('should return 401 when expired token provided', async () => {
      const expiredToken = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        },
        config.jwt.accessSecret,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid or expired access token');
    });

    it('should return 401 when user not found in database', async () => {
      const token = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      MockedUser.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid or expired access token');
    });

    it('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Access token is required');
    });

    it('should handle Authorization header without Bearer prefix', async () => {
      const token = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token) // Missing "Bearer " prefix
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Access token is required');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully with valid token', async () => {
      const token = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      MockedUser.findById.mockResolvedValue(mockUser);

      // Mock database query for logout (revoking refresh tokens)
      const mockDbQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
      jest.doMock('@/database', () => ({
        db: {
          query: mockDbQuery,
          healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
        },
        initializeDatabase: jest.fn()
      }));

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should return 401 when no token provided for logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Access token is required');
    });

    it('should return 401 when invalid token provided for logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid or expired access token');
    });
  });

  describe('Token Validation Edge Cases', () => {
    it('should handle token signed with wrong secret', async () => {
      const wrongToken = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        },
        'wrong-secret',
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${wrongToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid or expired access token');
    });

    it('should handle token with missing required claims', async () => {
      const incompleteToken = jwt.sign(
        { id: mockUser.id }, // Missing email, firstName, lastName
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      MockedUser.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .expect(200);

      // Should still work as long as user ID is valid and user exists in database
      expect(response.body.success).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const token = jwt.sign(
        {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      MockedUser.findById.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid or expired access token');
    });
  });

  describe('Correlation ID Handling', () => {
    it('should include correlation ID in error responses', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error.correlationId).toBeDefined();
      expect(typeof response.body.error.correlationId).toBe('string');
      expect(response.body.error.correlationId).not.toBe('unknown');
    });

    it('should handle missing correlation ID gracefully', async () => {
      // This test ensures the middleware doesn't crash when correlationId is missing
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error.correlationId).toBeDefined();
    });
  });
});