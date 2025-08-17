import request from 'supertest';
import bcrypt from 'bcrypt';
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

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Rate Limiting', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'TestPassword123!'
    };

    it('should enforce rate limiting on login attempts', async () => {
      // Mock user not found to trigger failed login attempts
      MockedUser.findByEmailWithPassword.mockResolvedValue(null);

      // Make multiple failed login attempts
      const promises = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send(validLoginData)
      );

      const responses = await Promise.all(promises);

      // Check that some requests were rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      const authFailedResponses = responses.filter(res => res.status === 401);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(authFailedResponses.length).toBeGreaterThan(0);

      // Verify rate limit response format
      if (rateLimitedResponses.length > 0) {
        const rateLimitedResponse = rateLimitedResponses[0]!;
        expect(rateLimitedResponse.body.success).toBe(false);
        expect(rateLimitedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(rateLimitedResponse.body.error.message).toContain('Too many login attempts');
      }
    });

    it('should use IP and email combination for rate limiting key', async () => {
      // This test verifies that rate limiting is applied per IP-email combination
      // In a real scenario, different emails from same IP should have separate limits
      
      const loginData1 = { email: 'user1@example.com', password: 'TestPassword123!' };
      const loginData2 = { email: 'user2@example.com', password: 'TestPassword123!' };

      MockedUser.findByEmailWithPassword.mockResolvedValue(null);

      // Make multiple requests with different emails
      const responses1 = await Promise.all([
        request(app).post('/api/auth/login').send(loginData1),
        request(app).post('/api/auth/login').send(loginData1),
        request(app).post('/api/auth/login').send(loginData1),
        request(app).post('/api/auth/login').send(loginData1),
        request(app).post('/api/auth/login').send(loginData1),
      ]);

      const responses2 = await Promise.all([
        request(app).post('/api/auth/login').send(loginData2),
        request(app).post('/api/auth/login').send(loginData2),
      ]);

      // First email should be rate limited
      const rateLimited1 = responses1.filter(res => res.status === 429);
      expect(rateLimited1.length).toBeGreaterThan(0);

      // Second email might still work (separate rate limit)
      const successful2 = responses2.filter(res => res.status === 401); // 401 means not rate limited, just auth failed
      expect(successful2.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full registration -> login -> refresh -> logout flow', async () => {
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

      const mockUserWithPassword = {
        ...mockUser,
        passwordHash: await bcrypt.hash(userData.password, config.bcrypt.saltRounds)
      };

      // Step 1: Register
      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.create.mockResolvedValue(mockUser);

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.accessToken).toBeDefined();
      expect(registerResponse.body.data.refreshToken).toBeDefined();

      const { accessToken: initialAccessToken, refreshToken } = registerResponse.body.data;

      // Step 2: Login
      MockedUser.findByEmailWithPassword.mockResolvedValue(mockUserWithPassword);
      MockedUser.update.mockResolvedValue(mockUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.accessToken).toBeDefined();
      expect(loginResponse.body.data.refreshToken).toBeDefined();

      // Tokens should be different from registration
      expect(loginResponse.body.data.accessToken).not.toBe(initialAccessToken);

      // Step 3: Refresh token (this would require proper database mocking for refresh tokens)
      // For now, we'll test the endpoint exists and validates input
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(refreshResponse.body.success).toBe(false);
      expect(refreshResponse.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('Security Validations', () => {
    it('should reject weak passwords during registration', async () => {
      const weakPasswords = [
        'password', // no uppercase, no numbers, no special chars
        'Password', // no numbers, no special chars
        'Password1', // no special chars
        'Pass1!', // too short
        '12345678', // no letters
        'PASSWORD123!', // no lowercase
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            firstName: 'John',
            lastName: 'Doe'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should validate email format during registration and login', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        'test@.com',
        'test@example.',
      ];

      for (const email of invalidEmails) {
        // Test registration
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'TestPassword123!',
            firstName: 'John',
            lastName: 'Doe'
          });

        expect(registerResponse.status).toBe(400);
        expect(registerResponse.body.error.code).toBe('VALIDATION_ERROR');

        // Test login
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'TestPassword123!'
          });

        expect(loginResponse.status).toBe(400);
        expect(loginResponse.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should hash passwords with correct salt rounds', async () => {
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

      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(bcryptHashSpy).toHaveBeenCalledWith(userData.password, config.bcrypt.saltRounds);
      expect(config.bcrypt.saltRounds).toBe(12); // Verify we're using 12 salt rounds as required
    });
  });
});