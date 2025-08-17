import { Request, Response } from 'express';
import { VisitorService } from '../services/VisitorService';
import { CreateVisitorRequest, UpdateVisitorRequest, VisitorFilters, BulkSyncRequest, ErrorCodes } from '../types';
import { logger } from '../utils/logger';
import { recordSyncOperation } from '@/middleware/monitoring';
import { v4 as uuidv4 } from 'uuid';

export class VisitorController {
  private visitorService: VisitorService;

  constructor(visitorService: VisitorService) {
    this.visitorService = visitorService;
  }

  createVisitor = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const visitorData: CreateVisitorRequest = req.body;
      const result = await this.visitorService.createVisitor(userId, visitorData);

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: result.error || 'Failed to create visitor',
            correlationId
          }
        });
        return;
      }

      logger.info('Visitor created successfully', { 
        visitorId: result.visitor?.id, 
        userId, 
        correlationId 
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error('Error in createVisitor controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  getVisitors = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      // Parse query parameters for filtering
      const filters: VisitorFilters = {};
      
      if (req.query['page']) {
        filters.page = parseInt(req.query['page'] as string);
      }
      
      if (req.query['limit']) {
        filters.limit = parseInt(req.query['limit'] as string);
      }
      
      if (req.query['company']) {
        filters.company = req.query['company'] as string;
      }
      
      if (req.query['captureMethod']) {
        filters.captureMethod = req.query['captureMethod'] as 'business_card' | 'event_badge';
      }
      
      if (req.query['interests']) {
        filters.interests = (req.query['interests'] as string).split(',');
      }
      
      if (req.query['startDate']) {
        filters.startDate = req.query['startDate'] as string;
      }
      
      if (req.query['endDate']) {
        filters.endDate = req.query['endDate'] as string;
      }
      
      if (req.query['search']) {
        filters.search = req.query['search'] as string;
      }

      const result = await this.visitorService.getVisitorsByUser(userId, filters);

      if (!result.success) {
        res.status(500).json({
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            message: result.error || 'Failed to retrieve visitors',
            correlationId
          }
        });
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Error in getVisitors controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  getVisitorById = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Visitor ID is required',
            correlationId
          }
        });
        return;
      }

      const result = await this.visitorService.getVisitorById(id, userId);

      if (!result.success) {
        const statusCode = result.error === 'Visitor not found' ? 404 : 500;
        const errorCode = result.error === 'Visitor not found' ? 
          ErrorCodes.RESOURCE_NOT_FOUND : ErrorCodes.INTERNAL_SERVER_ERROR;

        res.status(statusCode).json({
          success: false,
          error: {
            code: errorCode,
            message: result.error || 'Failed to retrieve visitor',
            correlationId
          }
        });
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error('Error in getVisitorById controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  updateVisitor = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Visitor ID is required',
            correlationId
          }
        });
        return;
      }

      const updates: UpdateVisitorRequest = req.body;
      const result = await this.visitorService.updateVisitor(id, userId, updates);

      if (!result.success) {
        const statusCode = result.error === 'Visitor not found' ? 404 : 400;
        const errorCode = result.error === 'Visitor not found' ? 
          ErrorCodes.RESOURCE_NOT_FOUND : ErrorCodes.VALIDATION_ERROR;

        res.status(statusCode).json({
          success: false,
          error: {
            code: errorCode,
            message: result.error || 'Failed to update visitor',
            correlationId
          }
        });
        return;
      }

      logger.info('Visitor updated successfully', { 
        visitorId: id, 
        userId, 
        correlationId 
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in updateVisitor controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  deleteVisitor = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Visitor ID is required',
            correlationId
          }
        });
        return;
      }

      const result = await this.visitorService.deleteVisitor(id, userId);

      if (!result.success) {
        const statusCode = result.error === 'Visitor not found' ? 404 : 500;
        const errorCode = result.error === 'Visitor not found' ? 
          ErrorCodes.RESOURCE_NOT_FOUND : ErrorCodes.INTERNAL_SERVER_ERROR;

        res.status(statusCode).json({
          success: false,
          error: {
            code: errorCode,
            message: result.error || 'Failed to delete visitor',
            correlationId
          }
        });
        return;
      }

      logger.info('Visitor deleted successfully', { 
        visitorId: id, 
        userId, 
        correlationId 
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in deleteVisitor controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  bulkSync = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const syncRequest: BulkSyncRequest = req.body;
      
      // Validate sync request
      if (!syncRequest.operations || !Array.isArray(syncRequest.operations)) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Operations array is required',
            correlationId
          }
        });
        return;
      }

      if (syncRequest.operations.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'At least one operation is required',
            correlationId
          }
        });
        return;
      }

      // Limit batch size to prevent abuse
      if (syncRequest.operations.length > 1000) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Maximum 1000 operations allowed per sync request',
            correlationId
          }
        });
        return;
      }

      logger.info('Processing bulk sync request', {
        userId,
        operationCount: syncRequest.operations.length,
        correlationId
      });

      const result = await this.visitorService.bulkSync(userId, syncRequest);

      // Record sync operation metrics
      if (result.success) {
        recordSyncOperation('bulk_sync', 'success');
      } else {
        recordSyncOperation('bulk_sync', 'failure');
      }

      // Return appropriate status code based on results
      let statusCode = 200;
      if (!result.success) {
        statusCode = 500;
      } else if (result.conflicts.length > 0) {
        statusCode = 409; // Conflict status for partial success with conflicts
      }

      logger.info('Bulk sync completed', {
        userId,
        success: result.success,
        successCount: result.results.filter(r => r.status === 'success').length,
        conflictCount: result.conflicts.length,
        errorCount: result.errors.length,
        correlationId
      });

      res.status(statusCode).json(result);
    } catch (error) {
      logger.error('Error in bulkSync controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  getLastSyncTimestamp = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const lastSyncTimestamp = await this.visitorService.getLastSyncTimestamp(userId);

      res.json({
        success: true,
        lastSyncTimestamp,
        currentTimestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error in getLastSyncTimestamp controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  resolveConflicts = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const { conflicts } = req.body;
      
      if (!conflicts || !Array.isArray(conflicts)) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Conflicts array is required',
            correlationId
          }
        });
        return;
      }

      const resolvedConflicts = await this.visitorService.resolveConflicts(userId, conflicts);

      res.json({
        success: true,
        resolvedConflicts
      });
    } catch (error) {
      logger.error('Error in resolveConflicts controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  getSyncProgress = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const { sessionId } = req.params;
      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Session ID is required',
            correlationId
          }
        });
        return;
      }

      const progress = await this.visitorService.getSyncProgress(sessionId);

      res.json({
        success: true,
        progress
      });
    } catch (error) {
      logger.error('Error in getSyncProgress controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  getSyncHistory = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined;
      const history = await this.visitorService.getUserSyncHistory(userId, limit);

      res.json({
        success: true,
        history
      });
    } catch (error) {
      logger.error('Error in getSyncHistory controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  getLocalIdMappings = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const mappings = await this.visitorService.getLocalIdMappings(userId);

      res.json({
        success: true,
        mappings
      });
    } catch (error) {
      logger.error('Error in getLocalIdMappings controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };

  getConflictStatistics = async (req: Request, res: Response): Promise<void> => {
    const correlationId = uuidv4();
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCodes.AUTHENTICATION_FAILED,
            message: 'User not authenticated',
            correlationId
          }
        });
        return;
      }

      const statistics = await this.visitorService.getConflictStatistics(userId);

      res.json({
        success: true,
        statistics
      });
    } catch (error) {
      logger.error('Error in getConflictStatistics controller', { error, correlationId });
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          correlationId
        }
      });
    }
  };
}