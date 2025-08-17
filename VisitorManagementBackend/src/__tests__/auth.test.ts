import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../index';
import { User } from '@/models/User';
import { AuthService } from '@/services/AuthService';
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

describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset rate limiter between tests
    jest.clearAllTimers();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.create.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual(mockUser);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(MockedUser.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(MockedUser.create).toHaveBeenCalled();
    });

    it('should return error if email already exists', async () => {
      const existingUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmail.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_RESOURCE');
      expect(response.body.error.message).toContain('already registered');
    });

    it('should validate email format', async () => {
      const invalidData = {
        ...validRegistrationData,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Please provide a valid email address'
          })
        ])
      );
    });

    it('should validate password requirements', async () => {
      const invalidData = {
        ...validRegistrationData,
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password'
          })
        ])
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveLength(4); // email, password, firstName, lastName
    });

    it('should trim and normalize input data', async () => {
      const dataWithSpaces = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'TestPassword123!',
        firstName: '  John  ',
        lastName: '  Doe  '
      };

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.create.mockResolvedValue(mockUser);

      await request(app)
        .post('/api/auth/register')
        .send(dataWithSpaces)
        .expect(201);

      expect(MockedUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        })
      );
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'TestPassword123!'
    };

    it('should login user successfully', async () => {
      const mockUserWithPassword = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('TestPassword123!', 12),
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
      MockedUser.update.mockResolvedValue(mockUserWithPassword);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined(); // Should not include password hash
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should return error for invalid email', async () => {
      MockedUser.findByEmailWithPassword.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should return error for invalid password', async () => {
      const mockUserWithPassword = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('DifferentPassword123!', 12),
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmailWithPassword.mockResolvedValue(mockUserWithPassword);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should validate login input', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('AuthService', () => {
    describe('register', () => {
      it('should hash password with correct salt rounds', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'John',
          lastName: 'Doe'
        };

        const mockUser = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        };

        MockedUser.findByEmail.mockResolvedValue(null);
        MockedUser.create.mockResolvedValue(mockUser);

        const bcryptHashSpy = jest.spyOn(bcrypt, 'hash');

        await AuthService.register(userData);

        expect(bcryptHashSpy).toHaveBeenCalledWith(userData.password, config.bcrypt.saltRounds);
      });

      it('should generate valid JWT tokens', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'John',
          lastName: 'Doe'
        };

        const mockUser = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        };

        MockedUser.findByEmail.mockResolvedValue(null);
        MockedUser.create.mockResolvedValue(mockUser);

        const result = await AuthService.register(userData);

        expect(result.success).toBe(true);
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();

        // Verify access token
        const accessTokenPayload = jwt.verify(result.accessToken!, config.jwt.accessSecret) as any;
        expect(accessTokenPayload.id).toBe(mockUser.id);
        expect(accessTokenPayload.email).toBe(mockUser.email);

        // Verify refresh token
        const refreshTokenPayload = jwt.verify(result.refreshToken!, config.jwt.refreshSecret) as any;
        expect(refreshTokenPayload.userId).toBe(mockUser.id);
        expect(refreshTokenPayload.tokenId).toBeDefined();
      });
    });

    describe('validateToken', () => {
      it('should validate valid access token', async () => {
        const mockUser = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        };

        const payload = {
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        };

        const token = jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '15m' });

        MockedUser.findById.mockResolvedValue(mockUser);

        const result = await AuthService.validateToken(token);

        expect(result).toEqual(expect.objectContaining(payload));
      });

      it('should return null for invalid token', async () => {
        const result = await AuthService.validateToken('invalid-token');
        expect(result).toBeNull();
      });

      it('should return null if user not found', async () => {
        const payload = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        };

        const token = jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '15m' });

        MockedUser.findById.mockResolvedValue(null);

        const result = await AuthService.validateToken(token);
        expect(result).toBeNull();
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to auth endpoints', async () => {
      // Make multiple requests to exceed rate limit
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'TestPassword123!',
            firstName: 'John',
            lastName: 'Doe'
          })
      );

      const responses = await Promise.all(requests);

      // At least one request should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      if (rateLimitedResponses.length > 0) {
        const rateLimitedResponse = rateLimitedResponses[0]!;
        expect(rateLimitedResponse.body.success).toBe(false);
        expect(rateLimitedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });
  });
});
  descr
ibe('POST /api/auth/refresh', () => {
    it('should refresh access token successfully', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      // Create a valid refresh token
      const refreshToken = jwt.sign(
        { tokenId: 'test-token-id', userId: mockUser.id },
        config.jwt.refreshSecret,
        { expiresIn: '7d' }
      );

      // Mock database queries for refresh token validation
      const mockDbQuery = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: 'refresh-token-id',
            userId: mockUser.id,
            tokenHash: await bcrypt.hash('test-token-id', 10),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            isRevoked: false
          }],
          rowCount: 1
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // For revoke old token
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // For store new token

      jest.doMock('@/database', () => ({
        db: {
          query: mockDbQuery,
          healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
        },
        initializeDatabase: jest.fn()
      }));

      MockedUser.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should return error for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should return error when refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Refresh token is required');
    });
  });

  describe('JWT Token Generation and Validation', () => {
    it('should generate tokens with correct expiry times', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.create.mockResolvedValue(mockUser);

      const result = await AuthService.register(userData);

      expect(result.success).toBe(true);

      // Verify access token expiry (15 minutes)
      const accessTokenPayload = jwt.verify(result.accessToken!, config.jwt.accessSecret) as any;
      const accessTokenExpiry = accessTokenPayload.exp - accessTokenPayload.iat;
      expect(accessTokenExpiry).toBe(15 * 60); // 15 minutes in seconds

      // Verify refresh token expiry (7 days)
      const refreshTokenPayload = jwt.verify(result.refreshToken!, config.jwt.refreshSecret) as any;
      const refreshTokenExpiry = refreshTokenPayload.exp - refreshTokenPayload.iat;
      expect(refreshTokenExpiry).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });

    it('should include correct issuer and audience in tokens', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.create.mockResolvedValue(mockUser);

      const result = await AuthService.register(userData);

      // Verify access token claims
      const accessTokenPayload = jwt.verify(result.accessToken!, config.jwt.accessSecret) as any;
      expect(accessTokenPayload.iss).toBe('visitor-management-api');
      expect(accessTokenPayload.aud).toBe('visitor-management-app');

      // Verify refresh token claims
      const refreshTokenPayload = jwt.verify(result.refreshToken!, config.jwt.refreshSecret) as any;
      expect(refreshTokenPayload.iss).toBe('visitor-management-api');
      expect(refreshTokenPayload.aud).toBe('visitor-management-app');
    });
  });

  describe('Token Rotation Security', () => {
    it('should revoke old refresh token when generating new tokens', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      // Create a valid refresh token
      const refreshToken = jwt.sign(
        { tokenId: 'test-token-id', userId: mockUser.id },
        config.jwt.refreshSecret,
        { expiresIn: '7d' }
      );

      // Mock database queries
      const mockDbQuery = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: 'refresh-token-id',
            userId: mockUser.id,
            tokenHash: await bcrypt.hash('test-token-id', 10),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            isRevoked: false
          }],
          rowCount: 1
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // For revoke old token
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // For store new token

      jest.doMock('@/database', () => ({
        db: {
          query: mockDbQuery,
          healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
        },
        initializeDatabase: jest.fn()
      }));

      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await AuthService.refreshToken(refreshToken);

      expect(result.success).toBe(true);
      
      // Verify that the old token was revoked (UPDATE query called)
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        expect.any(Array)
      );
    });

    it('should store refresh token hash in database', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.create.mockResolvedValue(mockUser);

      const mockDbQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
      jest.doMock('@/database', () => ({
        db: {
          query: mockDbQuery,
          healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
        },
        initializeDatabase: jest.fn()
      }));

      await AuthService.register(userData);

      // Verify that refresh token was stored in database
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining([
          mockUser.id,
          expect.any(String), // token hash
          expect.any(Date) // expires at
        ])
      );
    });
  });
});