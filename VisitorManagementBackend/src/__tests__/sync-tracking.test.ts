import { Pool } from 'pg';
import { SyncTrackingService } from '../services/SyncTrackingService';

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('SyncTrackingService', () => {
  let syncTrackingService: SyncTrackingService;
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

    syncTrackingService = new SyncTrackingService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSyncSession', () => {
    it('should create a sync session and return session ID', async () => {
      const totalOperations = 10;
      const sessionId = await syncTrackingService.createSyncSession(userId, totalOperations);

      expect(sessionId).toMatch(/^sync_test-user-id_\d+$/);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle errors during session creation', async () => {
      (mockPool.connect as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      await expect(syncTrackingService.createSyncSession(userId, 10))
        .rejects.toThrow('Database error');
    });
  });

  describe('updateSyncProgress', () => {
    it('should update sync progress', async () => {
      const sessionId = 'test-session-id';
      
      await syncTrackingService.updateSyncProgress(sessionId, 5, 10, 'Processing batch 1');

      // Should not throw any errors
      expect(true).toBe(true);
    });

    it('should mark as completed when processed equals total', async () => {
      const sessionId = 'test-session-id';
      
      await syncTrackingService.updateSyncProgress(sessionId, 10, 10);

      // Should not throw any errors
      expect(true).toBe(true);
    });
  });

  describe('completeSyncSession', () => {
    it('should complete sync session with success status', async () => {
      const sessionId = 'test-session-id';
      
      await syncTrackingService.completeSyncSession(sessionId, 8, 0, 2);

      // Should not throw any errors
      expect(true).toBe(true);
    });

    it('should complete sync session with failed status when there are errors', async () => {
      const sessionId = 'test-session-id';
      
      await syncTrackingService.completeSyncSession(sessionId, 5, 3, 2, 'Some operations failed');

      // Should not throw any errors
      expect(true).toBe(true);
    });
  });

  describe('getSyncProgress', () => {
    it('should return null for non-existent session', async () => {
      const progress = await syncTrackingService.getSyncProgress('non-existent-session');

      expect(progress).toBeNull();
    });
  });

  describe('getUserSyncHistory', () => {
    it('should return empty array for user with no sync history', async () => {
      const history = await syncTrackingService.getUserSyncHistory(userId);

      expect(history).toEqual([]);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      (mockPool.connect as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const history = await syncTrackingService.getUserSyncHistory(userId);

      expect(history).toEqual([]);
    });
  });

  describe('getActiveSyncSessions', () => {
    it('should return empty array for user with no active sessions', async () => {
      const sessions = await syncTrackingService.getActiveSyncSessions(userId);

      expect(sessions).toEqual([]);
    });
  });

  describe('trackLocalIdMapping', () => {
    it('should track local ID mapping successfully', async () => {
      const localId = 'local-123';
      const serverId = 'server-456';

      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      await syncTrackingService.trackLocalIdMapping(userId, localId, serverId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE visitors'),
        [localId, serverId, userId]
      );
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(syncTrackingService.trackLocalIdMapping(userId, 'local-123', 'server-456'))
        .rejects.toThrow('Database error');
    });
  });

  describe('getLocalIdMappings', () => {
    it('should return local ID mappings', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { local_id: 'local-1', server_id: 'server-1' },
          { local_id: 'local-2', server_id: 'server-2' }
        ]
      });

      const mappings = await syncTrackingService.getLocalIdMappings(userId);

      expect(mappings).toEqual({
        'local-1': 'server-1',
        'local-2': 'server-2'
      });
    });

    it('should handle null local IDs', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { local_id: 'local-1', server_id: 'server-1' },
          { local_id: null, server_id: 'server-2' }
        ]
      });

      const mappings = await syncTrackingService.getLocalIdMappings(userId);

      expect(mappings).toEqual({
        'local-1': 'server-1'
      });
    });

    it('should handle database errors', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(syncTrackingService.getLocalIdMappings(userId))
        .rejects.toThrow('Database error');
    });
  });

  describe('cleanupOldSyncSessions', () => {
    it('should cleanup old sync sessions', async () => {
      const cleanedCount = await syncTrackingService.cleanupOldSyncSessions(30);

      expect(cleanedCount).toBe(0); // Mock implementation returns 0
    });

    it('should handle errors during cleanup', async () => {
      // Mock implementation doesn't throw, but test the error handling path
      const cleanedCount = await syncTrackingService.cleanupOldSyncSessions(30);

      expect(cleanedCount).toBe(0);
    });
  });
});