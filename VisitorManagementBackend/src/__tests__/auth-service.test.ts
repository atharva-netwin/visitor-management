import { AuthService } from '../services/AuthService';
import { User } from '../models/User';
import { db } from '../database';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock dependencies
jest.mock('../models/User');
jest.mock('../database', () => ({
  db: { query: jest.fn() }
}));
jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() }
}));

const MockedUser = User as jest.Mocked<typeof User>;
const mockDb = db as jest.Mocked<typeof db>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  describe('register', () => {
    it('should register new user successfully', async () => {
      MockedUser.findByEmail.mockResolvedValue(null);
      MockedUser.create.mockResolvedValue(mockUser);
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await AuthService.register({
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      MockedUser.findByEmail.mockResolvedValue(mockUser);

      const result = await AuthService.register({
        email: 'test@example.com',
        password: 'TestPassword123!',
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email address is already registered');
    });
  });

  describe('validateToken', () => {
    it('should return null for invalid token', async () => {
      const result = await AuthService.validateToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should revoke refresh tokens', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await AuthService.logout('user-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens'),
        ['user-123']
      );
    });
  });
});