import request from 'supertest';
import { Pool } from 'pg';
import app from '../index';
import { db } from '../database';
import { AuthService } from '../services/AuthService';
import { BulkSyncRequest, SyncOperation } from '../types';

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

describe('Sync API Integration Tests', () => {
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

  beforeAll(async () => {
    // Setup mock pool and client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = require('../database').pool;
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

    // Mock user authentication
    userId = 'test-user-id';
    authToken = 'Bearer mock-access-token';

    // Mock JWT verification middleware
    jest.mock('../middleware/auth', () => ({
      authenticateToken: (req: any, _res: any, next: any) => {
        req.user = { id: userId, email: testUser.email };
        next();
      }
    }));
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/visitors/bulk-sync', () => {
    it('should successfully process bulk sync with create operations', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'create',
            localId: 'local-1',
            timestamp: new Date().toISOString(),
            data: {
              name: 'John Doe',
              company: 'Acme Corp',
              phone: '+1234567890',
              email: 'john@acme.com',
              interests: ['technology', 'business'],
              captureMethod: 'business_card',
              capturedAt: new Date().toISOString()
            }
          },
          {
            action: 'create',
            localId: 'local-2',
            timestamp: new Date().toISOString(),
            data: {
              name: 'Jane Smith',
              company: 'Tech Inc',
              interests: ['innovation'],
              captureMethod: 'event_badge',
              capturedAt: new Date().toISOString()
            }
          }
        ]
      };

      // Mock database responses for create operations
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Check for existing visitor by localId
        .mockResolvedValueOnce({ // Create first visitor
          rows: [{
            id: 'server-id-1',
            user_id: userId,
            name: 'John Doe',
            company: 'Acme Corp',
            phone: '+1234567890',
            email: 'john@acme.com',
            interests: JSON.stringify(['technology', 'business']),
            capture_method: 'business_card',
            captured_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            local_id: 'local-1',
            sync_version: 1
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Check for existing visitor by localId
        .mockResolvedValueOnce({ // Create second visitor
          rows: [{
            id: 'server-id-2',
            user_id: userId,
            name: 'Jane Smith',
            company: 'Tech Inc',
            interests: JSON.stringify(['innovation']),
            capture_method: 'event_badge',
            captured_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            local_id: 'local-2',
            sync_version: 1
          }]
        });

      const response = await request(app)
        .post('/api/visitors/bulk-sync')
        .set('Authorization', authToken)
        .send(syncRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0].status).toBe('success');
      expect(response.body.results[0].localId).toBe('local-1');
      expect(response.body.results[0].serverId).toBe('server-id-1');
      expect(response.body.results[1].status).toBe('success');
      expect(response.body.conflicts).toHaveLength(0);
      expect(response.body.errors).toHaveLength(0);
    });

    it('should handle update operations with conflict detection', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'update',
            localId: 'local-1',
            serverId: 'server-id-1',
            timestamp: '2023-01-01T10:00:00.000Z', // Older timestamp
            data: {
              name: 'John Updated',
              company: 'Acme Corp Updated'
            }
          }
        ]
      };

      // Mock database response for existing visitor with newer timestamp
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'server-id-1',
          user_id: userId,
          name: 'John Server Updated',
          company: 'Acme Corp Server',
          updated_at: '2023-01-01T12:00:00.000Z', // Newer timestamp
          local_id: 'local-1',
          sync_version: 2
        }]
      });

      const response = await request(app)
        .post('/api/visitors/bulk-sync')
        .set('Authorization', authToken)
        .send(syncRequest)
        .expect(409); // Conflict status

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].status).toBe('conflict');
      expect(response.body.conflicts).toHaveLength(1);
      expect(response.body.conflicts[0].conflictData).toBeDefined();
    });

    it('should handle delete operations', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'delete',
            localId: 'local-1',
            serverId: 'server-id-1',
            timestamp: new Date().toISOString()
          }
        ]
      };

      // Mock database responses
      mockClient.query
        .mockResolvedValueOnce({ // Find visitor by ID
          rows: [{
            id: 'server-id-1',
            user_id: userId,
            name: 'John Doe',
            local_id: 'local-1'
          }]
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // Soft delete

      const response = await request(app)
        .post('/api/visitors/bulk-sync')
        .set('Authorization', authToken)
        .send(syncRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].status).toBe('success');
      expect(response.body.results[0].action).toBe('delete');
    });

    it('should validate sync request and reject invalid operations', async () => {
      const invalidSyncRequest = {
        operations: [
          {
            action: 'invalid-action',
            localId: 'local-1',
            timestamp: 'invalid-timestamp'
          }
        ]
      };

      const response = await request(app)
        .post('/api/visitors/bulk-sync')
        .set('Authorization', authToken)
        .send(invalidSyncRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject requests with too many operations', async () => {
      const operations: SyncOperation[] = [];
      for (let i = 0; i < 1001; i++) {
        operations.push({
          action: 'create',
          localId: `local-${i}`,
          timestamp: new Date().toISOString(),
          data: {
            name: `User ${i}`,
            company: 'Test Corp',
            interests: ['test'],
            captureMethod: 'business_card',
            capturedAt: new Date().toISOString()
          }
        });
      }

      const syncRequest: BulkSyncRequest = { operations };

      const response = await request(app)
        .post('/api/visitors/bulk-sync')
        .set('Authorization', authToken)
        .send(syncRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('1000 operations');
    });

    it('should require authentication', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [{
          action: 'create',
          localId: 'local-1',
          timestamp: new Date().toISOString(),
          data: {
            name: 'Test User',
            company: 'Test Corp',
            interests: ['test'],
            captureMethod: 'business_card',
            capturedAt: new Date().toISOString()
          }
        }]
      };

      const response = await request(app)
        .post('/api/visitors/bulk-sync')
        .send(syncRequest)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('GET /api/visitors/sync/timestamp', () => {
    it('should return last sync timestamp', async () => {
      const lastSyncTime = '2023-01-01T12:00:00.000Z';
      
      mockClient.query.mockResolvedValueOnce({
        rows: [{ last_sync: lastSyncTime }]
      });

      const response = await request(app)
        .get('/api/visitors/sync/timestamp')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.lastSyncTimestamp).toBe(lastSyncTime);
      expect(response.body.currentTimestamp).toBeDefined();
    });

    it('should return null for users with no visitors', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ last_sync: null }]
      });

      const response = await request(app)
        .get('/api/visitors/sync/timestamp')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.lastSyncTimestamp).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/visitors/sync/timestamp')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_FAILED');
    });
  });
});