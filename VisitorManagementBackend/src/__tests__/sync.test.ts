import { Pool } from 'pg';
import { SyncService } from '../services/SyncService';
import { BulkSyncRequest, SyncOperation } from '../types';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the validation functions
jest.mock('../utils/validation', () => ({
  validateVisitorData: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  validateVisitorUpdate: jest.fn().mockReturnValue({ isValid: true, errors: [] })
}));

describe('SyncService', () => {
  let syncService: SyncService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  const userId = 'test-user-id';

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0
    } as any;

    syncService = new SyncService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processBulkSync', () => {
    it('should process create operations successfully', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'create',
            localId: 'local-1',
            timestamp: new Date().toISOString(),
            data: {
              name: 'John Doe',
              company: 'Acme Corp',
              interests: ['technology'],
              captureMethod: 'business_card',
              capturedAt: new Date().toISOString()
            }
          }
        ]
      };

      // Mock database responses
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No existing visitor
        .mockResolvedValueOnce({ // Create visitor
          rows: [{
            id: 'server-id-1',
            user_id: userId,
            name: 'John Doe',
            company: 'Acme Corp',
            interests: JSON.stringify(['technology']),
            capture_method: 'business_card',
            captured_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            local_id: 'local-1',
            sync_version: 1
          }]
        });

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe('success');
      expect(result.results[0]?.localId).toBe('local-1');
      expect(result.results[0]?.serverId).toBe('server-id-1');
      expect(result.conflicts).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect conflicts during create operations', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'create',
            localId: 'local-1',
            timestamp: new Date().toISOString(),
            data: {
              name: 'John Doe',
              company: 'Acme Corp',
              interests: ['technology'],
              captureMethod: 'business_card',
              capturedAt: new Date().toISOString()
            }
          }
        ]
      };

      // Mock existing visitor found
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'existing-server-id',
          user_id: userId,
          name: 'John Different',
          company: 'Different Corp',
          interests: JSON.stringify(['business']),
          capture_method: 'event_badge',
          captured_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          local_id: 'local-1',
          sync_version: 1
        }]
      });

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe('conflict');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.conflictData).toBeDefined();
      expect(result.conflicts[0]?.conflictData?.conflictFields).toContain('name');
      expect(result.conflicts[0]?.conflictData?.conflictFields).toContain('company');
    });

    it('should process update operations successfully', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'update',
            localId: 'local-1',
            serverId: 'server-id-1',
            timestamp: '2023-01-01T12:00:00.000Z',
            data: {
              name: 'John Updated',
              company: 'Acme Updated'
            }
          }
        ]
      };

      // Mock finding existing visitor
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'server-id-1',
            user_id: userId,
            name: 'John Doe',
            company: 'Acme Corp',
            updated_at: '2023-01-01T10:00:00.000Z', // Older timestamp
            local_id: 'local-1',
            sync_version: 1
          }]
        })
        .mockResolvedValueOnce({ // Update visitor
          rows: [{
            id: 'server-id-1',
            user_id: userId,
            name: 'John Updated',
            company: 'Acme Updated',
            updated_at: '2023-01-01T12:00:00.000Z',
            local_id: 'local-1',
            sync_version: 2
          }]
        });

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe('success');
      expect(result.results[0]?.action).toBe('update');
    });

    it('should detect conflicts during update operations', async () => {
      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'update',
            localId: 'local-1',
            serverId: 'server-id-1',
            timestamp: '2023-01-01T10:00:00.000Z', // Older timestamp
            data: {
              name: 'John Updated',
              company: 'Acme Updated'
            }
          }
        ]
      };

      // Mock finding existing visitor with newer timestamp
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'server-id-1',
          user_id: userId,
          name: 'John Server Updated',
          company: 'Acme Server',
          updated_at: '2023-01-01T12:00:00.000Z', // Newer timestamp
          local_id: 'local-1',
          sync_version: 2
        }]
      });

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe('conflict');
      expect(result.conflicts).toHaveLength(1);
    });

    it('should process delete operations successfully', async () => {
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

      // Mock finding and deleting visitor
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'server-id-1',
            user_id: userId,
            name: 'John Doe',
            local_id: 'local-1'
          }]
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // Soft delete

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe('success');
      expect(result.results[0]?.action).toBe('delete');
    });

    it('should handle delete operations for non-existent visitors', async () => {
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

      // Mock visitor not found
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe('success'); // Consider already deleted as success
      expect(result.results[0]?.action).toBe('delete');
    });

    it('should handle validation errors', async () => {
      const { validateVisitorData } = require('../utils/validation');
      validateVisitorData.mockReturnValueOnce({
        isValid: false,
        errors: ['Name is required']
      });

      const syncRequest: BulkSyncRequest = {
        operations: [
          {
            action: 'create',
            localId: 'local-1',
            timestamp: new Date().toISOString(),
            data: {
              company: 'Acme Corp',
              interests: ['technology'],
              captureMethod: 'business_card',
              capturedAt: new Date().toISOString()
            }
          }
        ]
      };

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe('error');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.error).toContain('Name is required');
    });

    it('should process operations in batches', async () => {
      const operations: SyncOperation[] = [];
      for (let i = 0; i < 75; i++) {
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

      // Mock database responses for all operations
      for (let i = 0; i < 75; i++) {
        mockClient.query
          .mockResolvedValueOnce({ rows: [] }) // No existing visitor
          .mockResolvedValueOnce({ // Create visitor
            rows: [{
              id: `server-id-${i}`,
              user_id: userId,
              name: `User ${i}`,
              company: 'Test Corp',
              local_id: `local-${i}`,
              sync_version: 1
            }]
          });
      }

      const result = await syncService.processBulkSync(userId, syncRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(75);
      expect(result.results.every(r => r.status === 'success')).toBe(true);
    });
  });

  describe('getLastSyncTimestamp', () => {
    it('should return last sync timestamp', async () => {
      const lastSyncTime = '2023-01-01T12:00:00.000Z';
      mockClient.query.mockResolvedValueOnce({
        rows: [{ last_sync: lastSyncTime }]
      });

      const result = await syncService.getLastSyncTimestamp(userId);

      expect(result).toBe(lastSyncTime);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('MAX(updated_at)'),
        [userId]
      );
    });

    it('should return null when no visitors exist', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ last_sync: null }]
      });

      const result = await syncService.getLastSyncTimestamp(userId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(syncService.getLastSyncTimestamp(userId)).rejects.toThrow('Database error');
    });
  });
});