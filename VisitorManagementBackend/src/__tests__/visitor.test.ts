import { Pool } from 'pg';
import { VisitorService } from '../services/VisitorService';
import { Visitor } from '../models/Visitor';
import { CreateVisitorRequest, UpdateVisitorRequest, VisitorProfile } from '../types';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock the validation functions
jest.mock('../utils/validation', () => ({
  validateVisitorData: jest.fn(() => ({ isValid: true, errors: [] })),
  validateVisitorUpdate: jest.fn(() => ({ isValid: true, errors: [] }))
}));

describe('VisitorService', () => {
  let visitorService: VisitorService;
  let mockPool: jest.Mocked<Pool>;
  let mockVisitorModel: jest.Mocked<Visitor>;

  const mockUserId = 'user-123';
  const mockVisitorId = 'visitor-123';
  
  const mockVisitorData: CreateVisitorRequest = {
    name: 'John Doe',
    title: 'Software Engineer',
    company: 'Tech Corp',
    phone: '+1234567890',
    email: 'john@techcorp.com',
    website: 'https://techcorp.com',
    interests: ['technology', 'software'],
    notes: 'Met at tech conference',
    captureMethod: 'business_card',
    capturedAt: '2024-01-15T10:00:00Z',
    localId: 'local-123'
  };

  const mockVisitorProfile: VisitorProfile = {
    id: mockVisitorId,
    userId: mockUserId,
    name: 'John Doe',
    title: 'Software Engineer',
    company: 'Tech Corp',
    phone: '+1234567890',
    email: 'john@techcorp.com',
    website: 'https://techcorp.com',
    interests: ['technology', 'software'],
    notes: 'Met at tech conference',
    captureMethod: 'business_card',
    capturedAt: '2024-01-15T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    localId: 'local-123',
    syncVersion: 1
  };

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0
    } as any;

    visitorService = new VisitorService(mockPool);
    
    // Mock the visitor model methods
    mockVisitorModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    // Replace the internal visitor model with our mock
    (visitorService as any).visitorModel = mockVisitorModel;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createVisitor', () => {
    it('should create a visitor successfully', async () => {
      mockVisitorModel.create.mockResolvedValue(mockVisitorProfile);

      const result = await visitorService.createVisitor(mockUserId, mockVisitorData);

      expect(result.success).toBe(true);
      expect(result.visitor).toEqual(mockVisitorProfile);
      expect(mockVisitorModel.create).toHaveBeenCalledWith(mockUserId, mockVisitorData);
    });

    it('should handle validation errors', async () => {
      const { validateVisitorData } = require('../utils/validation');
      validateVisitorData.mockReturnValue({
        isValid: false,
        errors: ['Name is required', 'Company is required']
      });

      const result = await visitorService.createVisitor(mockUserId, mockVisitorData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(mockVisitorModel.create).not.toHaveBeenCalled();
    });

    it('should handle unique constraint violations', async () => {
      // Reset validation mock to return valid for this test
      const { validateVisitorData } = require('../utils/validation');
      validateVisitorData.mockReturnValue({ isValid: true, errors: [] });
      
      const uniqueError = new Error('Duplicate key') as any;
      uniqueError.code = '23505';
      mockVisitorModel.create.mockRejectedValue(uniqueError);

      const result = await visitorService.createVisitor(mockUserId, mockVisitorData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('A visitor with this information already exists');
    });

    it('should handle database errors', async () => {
      // Reset validation mock to return valid for this test
      const { validateVisitorData } = require('../utils/validation');
      validateVisitorData.mockReturnValue({ isValid: true, errors: [] });
      
      mockVisitorModel.create.mockRejectedValue(new Error('Database connection failed'));

      const result = await visitorService.createVisitor(mockUserId, mockVisitorData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create visitor');
    });
  });

  describe('getVisitorById', () => {
    it('should retrieve a visitor successfully', async () => {
      mockVisitorModel.findById.mockResolvedValue(mockVisitorProfile);

      const result = await visitorService.getVisitorById(mockVisitorId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.visitor).toEqual(mockVisitorProfile);
      expect(mockVisitorModel.findById).toHaveBeenCalledWith(mockVisitorId, mockUserId);
    });

    it('should handle visitor not found', async () => {
      mockVisitorModel.findById.mockResolvedValue(null);

      const result = await visitorService.getVisitorById(mockVisitorId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Visitor not found');
    });

    it('should handle database errors', async () => {
      mockVisitorModel.findById.mockRejectedValue(new Error('Database error'));

      const result = await visitorService.getVisitorById(mockVisitorId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve visitor');
    });
  });

  describe('getVisitorsByUser', () => {
    it('should retrieve visitors with pagination', async () => {
      const mockVisitors = [mockVisitorProfile];
      const mockTotal = 1;
      
      mockVisitorModel.findByUserId.mockResolvedValue({
        visitors: mockVisitors,
        total: mockTotal
      });

      const filters = { page: 1, limit: 20 };
      const result = await visitorService.getVisitorsByUser(mockUserId, filters);

      expect(result.success).toBe(true);
      expect(result.visitors).toEqual(mockVisitors);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });
      expect(mockVisitorModel.findByUserId).toHaveBeenCalledWith(mockUserId, filters);
    });

    it('should use default pagination values', async () => {
      mockVisitorModel.findByUserId.mockResolvedValue({
        visitors: [],
        total: 0
      });

      const result = await visitorService.getVisitorsByUser(mockUserId);

      expect(result.success).toBe(true);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      });
    });

    it('should handle database errors', async () => {
      mockVisitorModel.findByUserId.mockRejectedValue(new Error('Database error'));

      const result = await visitorService.getVisitorsByUser(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve visitors');
    });
  });

  describe('updateVisitor', () => {
    const updateData: UpdateVisitorRequest = {
      name: 'Jane Doe',
      title: 'Senior Engineer'
    };

    const updatedVisitor: VisitorProfile = {
      ...mockVisitorProfile,
      name: 'Jane Doe',
      title: 'Senior Engineer'
    };

    it('should update a visitor successfully', async () => {
      mockVisitorModel.update.mockResolvedValue(updatedVisitor);

      const result = await visitorService.updateVisitor(mockVisitorId, mockUserId, updateData);

      expect(result.success).toBe(true);
      expect(result.visitor).toEqual(updatedVisitor);
      expect(mockVisitorModel.update).toHaveBeenCalledWith(mockVisitorId, mockUserId, updateData);
    });

    it('should handle validation errors', async () => {
      const { validateVisitorUpdate } = require('../utils/validation');
      validateVisitorUpdate.mockReturnValue({
        isValid: false,
        errors: ['Invalid email format']
      });

      const result = await visitorService.updateVisitor(mockVisitorId, mockUserId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
      expect(mockVisitorModel.update).not.toHaveBeenCalled();
    });

    it('should handle visitor not found', async () => {
      // Reset validation mock to return valid for this test
      const { validateVisitorUpdate } = require('../utils/validation');
      validateVisitorUpdate.mockReturnValue({ isValid: true, errors: [] });
      
      mockVisitorModel.update.mockResolvedValue(null);

      const result = await visitorService.updateVisitor(mockVisitorId, mockUserId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Visitor not found');
    });

    it('should handle database errors', async () => {
      // Reset validation mock to return valid for this test
      const { validateVisitorUpdate } = require('../utils/validation');
      validateVisitorUpdate.mockReturnValue({ isValid: true, errors: [] });
      
      mockVisitorModel.update.mockRejectedValue(new Error('Database error'));

      const result = await visitorService.updateVisitor(mockVisitorId, mockUserId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update visitor');
    });
  });

  describe('deleteVisitor', () => {
    it('should delete a visitor successfully', async () => {
      mockVisitorModel.delete.mockResolvedValue(true);

      const result = await visitorService.deleteVisitor(mockVisitorId, mockUserId);

      expect(result.success).toBe(true);
      expect(mockVisitorModel.delete).toHaveBeenCalledWith(mockVisitorId, mockUserId);
    });

    it('should handle visitor not found', async () => {
      mockVisitorModel.delete.mockResolvedValue(false);

      const result = await visitorService.deleteVisitor(mockVisitorId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Visitor not found');
    });

    it('should handle database errors', async () => {
      mockVisitorModel.delete.mockRejectedValue(new Error('Database error'));

      const result = await visitorService.deleteVisitor(mockVisitorId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to delete visitor');
    });
  });
});