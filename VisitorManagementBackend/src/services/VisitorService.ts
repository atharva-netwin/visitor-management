import { Pool } from 'pg';
import { Visitor } from '../models/Visitor';
import { SyncService } from './SyncService';
import { 
  CreateVisitorRequest, 
  UpdateVisitorRequest, 
  VisitorFilters,
  VisitorResponse,
  VisitorListResponse,
  DeleteResponse,
  BulkSyncRequest,
  BulkSyncResponse
} from '../types';
import { logger } from '../utils/logger';
import { validateVisitorData, validateVisitorUpdate } from '../utils/validation';

export class VisitorService {
  private visitorModel: Visitor;
  private syncService: SyncService;

  constructor(pool: Pool) {
    this.visitorModel = new Visitor(pool);
    this.syncService = new SyncService(pool);
  }

  async createVisitor(userId: string, visitorData: CreateVisitorRequest): Promise<VisitorResponse> {
    try {
      // Validate input data
      const validation = validateVisitorData(visitorData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      const visitor = await this.visitorModel.create(userId, visitorData);
      
      return {
        success: true,
        visitor
      };
    } catch (error: any) {
      logger.error('Error in createVisitor service', { error, userId, visitorData });
      
      if (error.code === '23505') { // Unique constraint violation
        return {
          success: false,
          error: 'A visitor with this information already exists'
        };
      }
      
      return {
        success: false,
        error: 'Failed to create visitor'
      };
    }
  }

  async getVisitorById(id: string, userId: string): Promise<VisitorResponse> {
    try {
      const visitor = await this.visitorModel.findById(id, userId);
      
      if (!visitor) {
        return {
          success: false,
          error: 'Visitor not found'
        };
      }
      
      return {
        success: true,
        visitor
      };
    } catch (error) {
      logger.error('Error in getVisitorById service', { error, id, userId });
      return {
        success: false,
        error: 'Failed to retrieve visitor'
      };
    }
  }

  async getVisitorsByUser(userId: string, filters: VisitorFilters = {}): Promise<VisitorListResponse> {
    try {
      const { visitors, total } = await this.visitorModel.findByUserId(userId, filters);
      
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const totalPages = Math.ceil(total / limit);
      
      return {
        success: true,
        visitors,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      logger.error('Error in getVisitorsByUser service', { error, userId, filters });
      return {
        success: false,
        error: 'Failed to retrieve visitors'
      };
    }
  }

  async updateVisitor(id: string, userId: string, updates: UpdateVisitorRequest): Promise<VisitorResponse> {
    try {
      // Validate update data
      const validation = validateVisitorUpdate(updates);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      const visitor = await this.visitorModel.update(id, userId, updates);
      
      if (!visitor) {
        return {
          success: false,
          error: 'Visitor not found'
        };
      }
      
      return {
        success: true,
        visitor
      };
    } catch (error) {
      logger.error('Error in updateVisitor service', { error, id, userId, updates });
      return {
        success: false,
        error: 'Failed to update visitor'
      };
    }
  }

  async deleteVisitor(id: string, userId: string): Promise<DeleteResponse> {
    try {
      const deleted = await this.visitorModel.delete(id, userId);
      
      if (!deleted) {
        return {
          success: false,
          error: 'Visitor not found'
        };
      }
      
      return {
        success: true
      };
    } catch (error) {
      logger.error('Error in deleteVisitor service', { error, id, userId });
      return {
        success: false,
        error: 'Failed to delete visitor'
      };
    }
  }

  async bulkSync(userId: string, syncRequest: BulkSyncRequest): Promise<BulkSyncResponse> {
    try {
      return await this.syncService.processBulkSync(userId, syncRequest);
    } catch (error) {
      logger.error('Error in bulkSync service', { error, userId, syncRequest });
      return {
        success: false,
        results: [],
        conflicts: [],
        errors: [],
        syncTimestamp: new Date().toISOString(),
        error: 'Failed to process bulk sync'
      };
    }
  }

  async getLastSyncTimestamp(userId: string): Promise<string | null> {
    try {
      return await this.syncService.getLastSyncTimestamp(userId);
    } catch (error) {
      logger.error('Error in getLastSyncTimestamp service', { error, userId });
      return null;
    }
  }

  async resolveConflicts(userId: string, conflicts: any[]) {
    try {
      return await this.syncService.resolveConflicts(userId, conflicts);
    } catch (error) {
      logger.error('Error in resolveConflicts service', { error, userId });
      throw error;
    }
  }

  async getSyncProgress(sessionId: string) {
    try {
      return await this.syncService.getSyncProgress(sessionId);
    } catch (error) {
      logger.error('Error in getSyncProgress service', { error, sessionId });
      return null;
    }
  }

  async getUserSyncHistory(userId: string, limit?: number) {
    try {
      return await this.syncService.getUserSyncHistory(userId, limit);
    } catch (error) {
      logger.error('Error in getUserSyncHistory service', { error, userId });
      return [];
    }
  }

  async getLocalIdMappings(userId: string) {
    try {
      return await this.syncService.getLocalIdMappings(userId);
    } catch (error) {
      logger.error('Error in getLocalIdMappings service', { error, userId });
      return {};
    }
  }

  async getConflictStatistics(userId: string) {
    try {
      return await this.syncService.getConflictStatistics(userId);
    } catch (error) {
      logger.error('Error in getConflictStatistics service', { error, userId });
      return {
        totalConflicts: 0,
        resolvedConflicts: 0,
        pendingConflicts: 0,
        conflictsByType: {}
      };
    }
  }
}