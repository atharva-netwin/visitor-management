import request from 'supertest';
import { Pool } from 'pg';
import app from '../index';
import { db } from '../database';
import { AuthService } from '../services/AuthService';
import { CreateVisitorRequest, UpdateVisitorRequest } from '../types';

// Mock the database and cache initialization
jest.mock('../database', () => ({
  initializeDatabase: jest.fn(),
  db: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
  },
  pool: {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  }
}));

jest.mock('../cache', () => ({
  initializeCache: jest.fn(),
  redis: {
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
    disconnect: jest.fn()
  }
}));

describe('Visitor API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User'
  };

  const testVisitor: CreateVisitorRequest = {
    name: 'John Doe',
    title: 'Software Engineer',
    company: 'Tech Corp',
    phone: '+1234567890',
    email: 'john@techcorp.com',
    website: 'https://techcorp.com',
    interests: ['technology', 'software'],
    notes: 'Met at tech conference',
    captureMethod: 'business_card',
    capturedAt: '2024-01-15T10:00:00Z'
  };

  beforeAll(async () => {
    // Setup mock database
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = require('../database').pool;
    mockPool.connect.mockResolvedValue(mockClient);

    // Mock user authentication
    userId = 'test-user-id';
    authToken = 'mock-jwt-token';

    // Mock JWT verification
    jest.mock('jsonwebtoken', () => ({
      verify: jest.fn(() => ({
        id: userId,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName
      })),
      sign: jest.fn(() => authToken)
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/visitors', () => {
    it('should create a visitor successfully', async () => {
      const mockVisitorId = 'visitor-123';
      const mockCreatedVisitor = {
        id: mockVisitorId,
        user_id: userId,
        name: testVisitor.name,
        title: testVisitor.title,
        company: testVisitor.company,
        phone: testVisitor.phone,
        email: testVisitor.email,
        website: testVisitor.website,
        interests: JSON.stringify(testVisitor.interests),
        notes: testVisitor.notes,
        capture_method: testVisitor.captureMethod,
        captured_at: testVisitor.capturedAt,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        deleted_at: null,
        local_id: null,
        sync_version: 1
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockCreatedVisitor],
        rowCount: 1
      });

      const response = await request(app)
        .post('/api/visitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testVisitor)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.visitor).toBeDefined();
      expect(response.body.visitor.name).toBe(testVisitor.name);
      expect(response.body.visitor.company).toBe(testVisitor.company);
    });

    it('should return 400 for invalid visitor data', async () => {
      const invalidVisitor = {
        ...testVisitor,
        name: '', // Invalid: empty name
        email: 'invalid-email' // Invalid: bad email format
      };

      const response = await request(app)
        .post('/api/visitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidVisitor)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/visitors')
        .send(testVisitor)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('GET /api/visitors', () => {
    it('should retrieve visitors with pagination', async () => {
      const mockVisitors = [{
        id: 'visitor-1',
        user_id: userId,
        name: 'John Doe',
        company: 'Tech Corp',
        interests: JSON.stringify(['technology']),
        capture_method: 'business_card',
        captured_at: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        deleted_at: null,
        sync_version: 1
      }];

      // Mock count query
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '1' }],
        rowCount: 1
      });

      // Mock data query
      mockClient.query.mockResolvedValueOnce({
        rows: mockVisitors,
        rowCount: 1
      });

      const response = await request(app)
        .get('/api/visitors?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.visitors).toHaveLength(1);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
      });
    });

    it('should filter visitors by company', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        rowCount: 1
      });

      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(app)
        .get('/api/visitors?company=TechCorp')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.visitors).toHaveLength(0);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/visitors')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('GET /api/visitors/:id', () => {
    it('should retrieve a specific visitor', async () => {
      const visitorId = 'visitor-123';
      const mockVisitor = {
        id: visitorId,
        user_id: userId,
        name: 'John Doe',
        company: 'Tech Corp',
        interests: JSON.stringify(['technology']),
        capture_method: 'business_card',
        captured_at: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        deleted_at: null,
        sync_version: 1
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockVisitor],
        rowCount: 1
      });

      const response = await request(app)
        .get(`/api/visitors/${visitorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.visitor.id).toBe(visitorId);
      expect(response.body.visitor.name).toBe('John Doe');
    });

    it('should return 404 for non-existent visitor', async () => {
      const visitorId = 'non-existent';

      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(app)
        .get(`/api/visitors/${visitorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('PUT /api/visitors/:id', () => {
    it('should update a visitor successfully', async () => {
      const visitorId = 'visitor-123';
      const updateData: UpdateVisitorRequest = {
        name: 'Jane Doe',
        title: 'Senior Engineer'
      };

      const mockUpdatedVisitor = {
        id: visitorId,
        user_id: userId,
        name: 'Jane Doe',
        title: 'Senior Engineer',
        company: 'Tech Corp',
        interests: JSON.stringify(['technology']),
        capture_method: 'business_card',
        captured_at: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T11:00:00Z',
        deleted_at: null,
        sync_version: 1
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockUpdatedVisitor],
        rowCount: 1
      });

      const response = await request(app)
        .put(`/api/visitors/${visitorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.visitor.name).toBe('Jane Doe');
      expect(response.body.visitor.title).toBe('Senior Engineer');
    });

    it('should return 404 for non-existent visitor', async () => {
      const visitorId = 'non-existent';
      const updateData: UpdateVisitorRequest = {
        name: 'Jane Doe'
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(app)
        .put(`/api/visitors/${visitorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('DELETE /api/visitors/:id', () => {
    it('should delete a visitor successfully (soft delete)', async () => {
      const visitorId = 'visitor-123';

      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      });

      const response = await request(app)
        .delete(`/api/visitors/${visitorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent visitor', async () => {
      const visitorId = 'non-existent';

      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(app)
        .delete(`/api/visitors/${visitorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});