import { Pool } from 'pg';
import { Visitor } from '../models/Visitor';
import { ConflictResolutionService } from './ConflictResolutionService';
import { SyncTrackingService } from './SyncTrackingService';
import { 
  BulkSyncRequest,
  BulkSyncResponse,
  SyncOperation,
  SyncResult,
  CreateVisitorRequest,
  UpdateVisitorRequest,
  VisitorProfile
} from '../types';
import { logger } from '../utils/logger';
import { validateVisitorData, validateVisitorUpdate } from '../utils/validation';

export class SyncService {
  private visitorModel: Visitor;
  private pool: Pool;
  private conflictResolutionService: ConflictResolutionService;
  private syncTrackingService: SyncTrackingService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.visitorModel = new Visitor(pool);
    this.conflictResolutionService = new ConflictResolutionService(pool);
    this.syncTrackingService = new SyncTrackingService(pool);
  }

  async processBulkSync(userId: string, syncRequest: BulkSyncRequest): Promise<BulkSyncResponse> {
    const syncTimestamp = new Date().toISOString();
    const results: SyncResult[] = [];
    const conflicts: SyncResult[] = [];
    const errors: SyncResult[] = [];

    // Create sync session for tracking
    const sessionId = await this.syncTrackingService.createSyncSession(
      userId, 
      syncRequest.operations.length
    );

    logger.info('Starting bulk sync process', {
      userId,
      sessionId,
      operationCount: syncRequest.operations.length,
      lastSyncTimestamp: syncRequest.lastSyncTimestamp
    });

    // Process operations in batches to avoid overwhelming the database
    const batchSize = 50;
    const operations = syncRequest.operations;

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await this.processBatch(userId, batch, syncTimestamp);
      
      batchResults.forEach(result => {
        results.push(result);
        
        if (result.status === 'conflict') {
          conflicts.push(result);
        } else if (result.status === 'error') {
          errors.push(result);
        }
      });

      // Update sync progress
      await this.syncTrackingService.updateSyncProgress(
        sessionId,
        Math.min(i + batchSize, operations.length),
        operations.length,
        `Processing batch ${Math.floor(i / batchSize) + 1}`
      );
    }

    // Complete sync session tracking
    const successCount = results.filter(r => r.status === 'success').length;
    await this.syncTrackingService.completeSyncSession(
      sessionId,
      successCount,
      errors.length,
      conflicts.length,
      errors.length > 0 ? 'Some operations failed' : undefined
    );

    const response: BulkSyncResponse = {
      success: errors.length === 0,
      results,
      conflicts,
      errors,
      syncTimestamp
    };

    logger.info('Bulk sync completed', {
      userId,
      sessionId,
      totalOperations: operations.length,
      successCount,
      conflictCount: conflicts.length,
      errorCount: errors.length
    });

    return response;
  }

  private async processBatch(userId: string, operations: SyncOperation[], syncTimestamp: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const operation of operations) {
      try {
        const result = await this.processOperation(userId, operation, syncTimestamp);
        results.push(result);
      } catch (error: any) {
        logger.error('Error processing sync operation', { error, operation, userId });
        results.push({
          localId: operation.localId,
          action: operation.action,
          status: 'error',
          error: error.message || 'Unknown error occurred'
        });
      }
    }

    return results;
  }

  private async processOperation(userId: string, operation: SyncOperation, syncTimestamp: string): Promise<SyncResult> {
    switch (operation.action) {
      case 'create':
        return await this.processCreateOperation(userId, operation, syncTimestamp);
      case 'update':
        return await this.processUpdateOperation(userId, operation, syncTimestamp);
      case 'delete':
        return await this.processDeleteOperation(userId, operation, syncTimestamp);
      default:
        throw new Error(`Unknown operation action: ${operation.action}`);
    }
  }

  private async processCreateOperation(userId: string, operation: SyncOperation, _syncTimestamp: string): Promise<SyncResult> {
    if (!operation.data) {
      return {
        localId: operation.localId,
        action: 'create',
        status: 'error',
        error: 'No data provided for create operation'
      };
    }

    // Validate the data
    const validation = validateVisitorData(operation.data as CreateVisitorRequest);
    if (!validation.isValid) {
      return {
        localId: operation.localId,
        action: 'create',
        status: 'error',
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Check if visitor already exists by localId
    const existingVisitor = await this.findVisitorByLocalId(userId, operation.localId);
    if (existingVisitor) {
      // Conflict: visitor already exists
      return await this.handleCreateConflict(userId, operation, existingVisitor);
    }

    try {
      const visitorData = {
        ...operation.data as CreateVisitorRequest,
        localId: operation.localId
      };

      const visitor = await this.visitorModel.create(userId, visitorData);

      return {
        localId: operation.localId,
        serverId: visitor.id,
        action: 'create',
        status: 'success'
      };
    } catch (error: any) {
      logger.error('Error creating visitor during sync', { error, operation, userId });
      return {
        localId: operation.localId,
        action: 'create',
        status: 'error',
        error: error.message || 'Failed to create visitor'
      };
    }
  }

  private async processUpdateOperation(userId: string, operation: SyncOperation, _syncTimestamp: string): Promise<SyncResult> {
    if (!operation.serverId && !operation.localId) {
      return {
        localId: operation.localId,
        action: 'update',
        status: 'error',
        error: 'No server ID or local ID provided for update operation'
      };
    }

    if (!operation.data) {
      return {
        localId: operation.localId,
        action: 'update',
        status: 'error',
        error: 'No data provided for update operation'
      };
    }

    // Validate the update data
    const validation = validateVisitorUpdate(operation.data as UpdateVisitorRequest);
    if (!validation.isValid) {
      return {
        localId: operation.localId,
        action: 'update',
        status: 'error',
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Find the visitor to update
    let visitor: VisitorProfile | null = null;
    
    if (operation.serverId) {
      visitor = await this.visitorModel.findById(operation.serverId, userId);
    } else {
      visitor = await this.findVisitorByLocalId(userId, operation.localId);
    }

    if (!visitor) {
      return {
        localId: operation.localId,
        ...(operation.serverId && { serverId: operation.serverId }),
        action: 'update',
        status: 'error',
        error: 'Visitor not found'
      };
    }

    // Check for conflicts based on timestamps
    const clientTimestamp = new Date(operation.timestamp);
    const serverTimestamp = new Date(visitor.updatedAt);

    if (serverTimestamp > clientTimestamp) {
      // Server has newer data - conflict
      return await this.handleUpdateConflict(userId, operation, visitor);
    }

    try {
      const updatedVisitor = await this.visitorModel.update(visitor.id, userId, operation.data as UpdateVisitorRequest);

      if (!updatedVisitor) {
        return {
          localId: operation.localId,
          serverId: visitor.id,
          action: 'update',
          status: 'error',
          error: 'Failed to update visitor'
        };
      }

      return {
        localId: operation.localId,
        serverId: updatedVisitor.id,
        action: 'update',
        status: 'success'
      };
    } catch (error: any) {
      logger.error('Error updating visitor during sync', { error, operation, userId });
      return {
        localId: operation.localId,
        serverId: visitor.id,
        action: 'update',
        status: 'error',
        error: error.message || 'Failed to update visitor'
      };
    }
  }

  private async processDeleteOperation(userId: string, operation: SyncOperation, _syncTimestamp: string): Promise<SyncResult> {
    if (!operation.serverId && !operation.localId) {
      return {
        localId: operation.localId,
        action: 'delete',
        status: 'error',
        error: 'No server ID or local ID provided for delete operation'
      };
    }

    // Find the visitor to delete
    let visitor: VisitorProfile | null = null;
    
    if (operation.serverId) {
      visitor = await this.visitorModel.findById(operation.serverId, userId);
    } else {
      visitor = await this.findVisitorByLocalId(userId, operation.localId);
    }

    if (!visitor) {
      // Visitor already deleted or doesn't exist - consider it successful
      return {
        localId: operation.localId,
        ...(operation.serverId && { serverId: operation.serverId }),
        action: 'delete',
        status: 'success'
      };
    }

    try {
      const deleted = await this.visitorModel.delete(visitor.id, userId, true); // Soft delete

      if (!deleted) {
        return {
          localId: operation.localId,
          serverId: visitor.id,
          action: 'delete',
          status: 'error',
          error: 'Failed to delete visitor'
        };
      }

      return {
        localId: operation.localId,
        serverId: visitor.id,
        action: 'delete',
        status: 'success'
      };
    } catch (error: any) {
      logger.error('Error deleting visitor during sync', { error, operation, userId });
      return {
        localId: operation.localId,
        serverId: visitor.id,
        action: 'delete',
        status: 'error',
        error: error.message || 'Failed to delete visitor'
      };
    }
  }

  private async handleCreateConflict(_userId: string, operation: SyncOperation, existingVisitor: VisitorProfile): Promise<SyncResult> {
    const clientData = operation.data;
    const serverData = existingVisitor;

    // Detect conflict fields
    const conflictFields = this.detectConflictFields(clientData, serverData);

    return {
      localId: operation.localId,
      serverId: existingVisitor.id,
      action: 'create',
      status: 'conflict',
      conflictData: {
        clientData,
        serverData,
        conflictFields
      }
    };
  }

  private async handleUpdateConflict(_userId: string, operation: SyncOperation, existingVisitor: VisitorProfile): Promise<SyncResult> {
    const clientData = operation.data;
    const serverData = existingVisitor;

    // Detect conflict fields
    const conflictFields = this.detectConflictFields(clientData, serverData);

    return {
      localId: operation.localId,
      serverId: existingVisitor.id,
      action: 'update',
      status: 'conflict',
      conflictData: {
        clientData,
        serverData,
        conflictFields
      }
    };
  }

  private detectConflictFields(clientData: any, serverData: any): string[] {
    const conflictFields: string[] = [];
    const fieldsToCheck = ['name', 'title', 'company', 'phone', 'email', 'website', 'interests', 'notes'];

    fieldsToCheck.forEach(field => {
      const clientValue = clientData?.[field];
      const serverValue = serverData[field];

      if (clientValue !== undefined && clientValue !== serverValue) {
        // Special handling for arrays (interests)
        if (Array.isArray(clientValue) && Array.isArray(serverValue)) {
          if (JSON.stringify(clientValue.sort()) !== JSON.stringify(serverValue.sort())) {
            conflictFields.push(field);
          }
        } else {
          conflictFields.push(field);
        }
      }
    });

    return conflictFields;
  }

  private async findVisitorByLocalId(userId: string, localId: string): Promise<VisitorProfile | null> {
    const client = await this.pool.connect();

    try {
      const query = 'SELECT * FROM visitors WHERE user_id = $1 AND local_id = $2 AND deleted_at IS NULL';
      const result = await client.query(query, [userId, localId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToVisitor(result.rows[0]);
    } catch (error) {
      logger.error('Error finding visitor by local ID', { error, userId, localId });
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToVisitor(row: any): VisitorProfile {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      title: row.title,
      company: row.company,
      phone: row.phone,
      email: row.email,
      website: row.website,
      interests: typeof row.interests === 'string' ? JSON.parse(row.interests) : row.interests,
      notes: row.notes,
      captureMethod: row.capture_method,
      capturedAt: row.captured_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      localId: row.local_id,
      syncVersion: row.sync_version
    };
  }

  async getLastSyncTimestamp(userId: string): Promise<string | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT MAX(updated_at) as last_sync 
        FROM visitors 
        WHERE user_id = $1
      `;
      const result = await client.query(query, [userId]);

      return result.rows[0]?.last_sync || null;
    } catch (error) {
      logger.error('Error getting last sync timestamp', { error, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveConflicts(userId: string, conflicts: SyncResult[]): Promise<SyncResult[]> {
    return await this.conflictResolutionService.resolveConflicts(userId, conflicts);
  }

  async getSyncProgress(sessionId: string) {
    return await this.syncTrackingService.getSyncProgress(sessionId);
  }

  async getUserSyncHistory(userId: string, limit?: number) {
    return await this.syncTrackingService.getUserSyncHistory(userId, limit);
  }

  async getLocalIdMappings(userId: string) {
    return await this.syncTrackingService.getLocalIdMappings(userId);
  }

  async getConflictStatistics(userId: string) {
    return await this.conflictResolutionService.getConflictStatistics(userId);
  }
}