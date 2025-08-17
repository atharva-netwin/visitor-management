import { Pool } from 'pg';
import { ConflictResolutionService } from '../services/ConflictResolutionService';
import { SyncResult } from '../types';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ConflictResolutionService', () => {
  let conflictResolutionService: ConflictResolutionService;
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

    conflictResolutionService = new ConflictResolutionService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveConflicts', () => {
    it('should resolve conflicts using server wins strategy', async () => {
      const conflicts: SyncResult[] = [
        {
          localId: 'local-1',
          serverId: 'server-1',
          action: 'update',
          status: 'conflict',
          conflictData: {
            clientData: { name: 'John Client' },
            serverData: { name: 'John Server' },
            conflictFields: ['name']
          }
        }
      ];

      const results = await conflictResolutionService.resolveConflicts(userId, conflicts);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('success');
      expect(results[0]?.action).toBe('update');
    });

    it('should resolve conflicts using client wins strategy for contact fields', async () => {
      const conflicts: SyncResult[] = [
        {
          localId: 'local-1',
          serverId: 'server-1',
          action: 'update',
          status: 'conflict',
          conflictData: {
            clientData: { phone: '+1234567890' },
            serverData: { phone: '+0987654321' },
            conflictFields: ['phone']
          }
        }
      ];

      // Mock successful update
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'server-1',
          phone: '+1234567890',
          updated_at: new Date().toISOString()
        }]
      });

      const results = await conflictResolutionService.resolveConflicts(userId, conflicts);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('success');
      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should resolve conflicts using merge strategy for interests', async () => {
      const conflicts: SyncResult[] = [
        {
          localId: 'local-1',
          serverId: 'server-1',
          action: 'update',
          status: 'conflict',
          conflictData: {
            clientData: { interests: ['technology', 'innovation'] },
            serverData: { interests: ['business', 'technology'] },
            conflictFields: ['interests']
          }
        }
      ];

      // Mock successful update
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'server-1',
          interests: JSON.stringify(['business', 'technology', 'innovation']),
          updated_at: new Date().toISOString()
        }]
      });

      const results = await conflictResolutionService.resolveConflicts(userId, conflicts);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('success');
      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should merge notes with separator', async () => {
      const conflicts: SyncResult[] = [
        {
          localId: 'local-1',
          serverId: 'server-1',
          action: 'update',
          status: 'conflict',
          conflictData: {
            clientData: { notes: 'Client notes' },
            serverData: { notes: 'Server notes' },
            conflictFields: ['notes']
          }
        }
      ];

      // Mock successful update
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 'server-1',
          notes: 'Server notes\n\n--- Merged from mobile ---\nClient notes',
          updated_at: new Date().toISOString()
        }]
      });

      const results = await conflictResolutionService.resolveConflicts(userId, conflicts);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('success');
    });

    it('should handle conflicts with missing conflict data', async () => {
      const conflicts: SyncResult[] = [
        {
          localId: 'local-1',
          serverId: 'server-1',
          action: 'update',
          status: 'conflict'
          // Missing conflictData
        }
      ];

      const results = await conflictResolutionService.resolveConflicts(userId, conflicts);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('error');
      expect(results[0]?.error).toContain('Invalid conflict data');
    });

    it('should handle database errors during conflict resolution', async () => {
      const conflicts: SyncResult[] = [
        {
          localId: 'local-1',
          serverId: 'server-1',
          action: 'update',
          status: 'conflict',
          conflictData: {
            clientData: { phone: '+1234567890' },
            serverData: { phone: '+0987654321' },
            conflictFields: ['phone']
          }
        }
      ];

      // Mock database error
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      const results = await conflictResolutionService.resolveConflicts(userId, conflicts);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('error');
      expect(results[0]?.error).toContain('Failed to apply client wins strategy');
    });
  });

  describe('getConflictStatistics', () => {
    it('should return conflict statistics', async () => {
      const statistics = await conflictResolutionService.getConflictStatistics(userId);

      expect(statistics).toEqual({
        totalConflicts: 0,
        resolvedConflicts: 0,
        pendingConflicts: 0,
        conflictsByType: {}
      });
    });
  });
});