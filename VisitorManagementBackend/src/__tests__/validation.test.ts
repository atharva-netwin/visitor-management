import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { describe } from 'node:test';
import {
  registerSchema,
  loginSchema,
  createVisitorSchema,
  validateVisitorData,
  validateRequest
} from '../utils/validation';

describe('Validation Utilities', () => {
  describe('registerSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    it('should validate correct registration data', () => {
      const { error } = registerSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should require email field', () => {
      const { error } = registerSchema.validate({ ...validData, email: undefined });
      expect(error).toBeDefined();
    });

    it('should validate email format', () => {
      const { error } = registerSchema.validate({ ...validData, email: 'invalid-email' });
      expect(error).toBeDefined();
    });

    it('should validate password requirements', () => {
      const { error } = registerSchema.validate({ ...validData, password: 'weak' });
      expect(error).toBeDefined();
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const { error } = loginSchema.validate({
        email: 'test@example.com',
        password: 'password123'
      });
      expect(error).toBeUndefined();
    });

    it('should require email and password', () => {
      const { error } = loginSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe('createVisitorSchema', () => {
    const validData = {
      name: 'John Doe',
      company: 'Tech Corp',
      interests: ['tech'],
      captureMethod: 'business_card',
      capturedAt: '2024-01-15T10:00:00Z'
    };

    it('should validate correct visitor data', () => {
      const { error } = createVisitorSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should require name and company', () => {
      const { error } = createVisitorSchema.validate({});
      expect(error).toBeDefined();
    });

    it('should validate capture method', () => {
      const { error } = createVisitorSchema.validate({
        ...validData,
        captureMethod: 'invalid_method'
      });
      expect(error).toBeDefined();
    });
  });

  describe('validateVisitorData helper', () => {
    it('should return valid result for correct data', () => {
      const result = validateVisitorData({
        name: 'John Doe',
        company: 'Tech Corp',
        interests: [],
        captureMethod: 'business_card',
        capturedAt: '2024-01-15T10:00:00Z'
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return invalid result for incorrect data', () => {
      const result = validateVisitorData({});
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateRequest middleware', () => {
    const mockReq = { body: {}, correlationId: 'test-id' };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const mockNext = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call next() for valid data', () => {
      const middleware = validateRequest(loginSchema);
      mockReq.body = { email: 'test@example.com', password: 'password123' };

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 400 for invalid data', () => {
      const middleware = validateRequest(loginSchema);
      mockReq.body = { email: 'invalid-email' };

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});