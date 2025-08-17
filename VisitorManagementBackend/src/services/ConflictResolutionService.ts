import { Pool } from 'pg';
import { 
  SyncResult,
  ConflictResolution,
  UpdateVisitorRequest
} from '../types';
import { Visitor } from '../models/Visitor';
import { logger } from '../utils/logger';

export class ConflictResolutionService {
  private visitorModel: Visitor;

  constructor(pool: Pool) {
    this.visitorModel = new Visitor(pool);
  }

  async resolveConflicts(userId: string, conflicts: SyncResult[]): Promise<SyncResult[]> {
    const resolvedResults: SyncResult[] = [];

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(userId, conflict);
        resolvedResults.push(resolution);
      } catch (error: any) {
        logger.error('Error resolving conflict', { error, conflict, userId });
        resolvedResults.push({
          ...conflict,
          status: 'error',
          error: `Failed to resolve conflict: ${error.message}`
        });
      }
    }

    return resolvedResults;
  }

  private async resolveConflict(userId: string, conflict: SyncResult): Promise<SyncResult> {
    if (!conflict.conflictData || !conflict.serverId) {
      return {
        ...conflict,
        status: 'error',
        error: 'Invalid conflict data'
      };
    }

    const { clientData, serverData, conflictFields } = conflict.conflictData;
    
    // Determine resolution strategy based on conflict type and fields
    const strategy = this.determineResolutionStrategy(conflictFields, clientData, serverData);
    
    switch (strategy) {
      case 'server_wins':
        return await this.applyServerWinsStrategy(userId, conflict);
      
      case 'client_wins':
        return await this.applyClientWinsStrategy(userId, conflict);
      
      case 'merge':
        return await this.applyMergeStrategy(userId, conflict);
      
      case 'manual':
        return await this.flagForManualReview(userId, conflict);
      
      default:
        return await this.applyServerWinsStrategy(userId, conflict); // Default fallback
    }
  }

  private determineResolutionStrategy(
    conflictFields: string[], 
    clientData: any, 
    serverData: any
  ): ConflictResolution['strategy'] {
    // Critical fields that should prefer server data for consistency
    const criticalFields = ['id', 'userId', 'createdAt'];
    const hasCriticalConflict = conflictFields.some(field => criticalFields.includes(field));
    
    if (hasCriticalConflict) {
      return 'server_wins';
    }

    // Fields that can be merged
    const mergeableFields = ['interests', 'notes'];
    const canMerge = conflictFields.every(field => mergeableFields.includes(field));
    
    if (canMerge) {
      return 'merge';
    }

    // For contact information, prefer client data (more likely to be updated)
    const contactFields = ['phone', 'email', 'website'];
    const isContactOnly = conflictFields.every(field => contactFields.includes(field));
    
    if (isContactOnly) {
      return 'client_wins';
    }

    // For business information, check timestamps
    const businessFields = ['name', 'title', 'company'];
    const isBusinessInfo = conflictFields.some(field => businessFields.includes(field));
    
    if (isBusinessInfo) {
      // If client data is significantly newer (more than 1 hour), prefer client
      const clientTimestamp = new Date(clientData.capturedAt || clientData.updatedAt || 0);
      const serverTimestamp = new Date(serverData.updatedAt || serverData.capturedAt || 0);
      const timeDiff = clientTimestamp.getTime() - serverTimestamp.getTime();
      const oneHour = 60 * 60 * 1000;
      
      if (timeDiff > oneHour) {
        return 'client_wins';
      }
    }

    // Default to server wins for data consistency
    return 'server_wins';
  }

  private async applyServerWinsStrategy(userId: string, conflict: SyncResult): Promise<SyncResult> {
    // Server data wins - no changes needed, just return success
    logger.info('Applying server wins strategy', { 
      localId: conflict.localId, 
      serverId: conflict.serverId,
      userId 
    });

    return {
      localId: conflict.localId,
      ...(conflict.serverId && { serverId: conflict.serverId }),
      action: conflict.action,
      status: 'success'
    };
  }

  private async applyClientWinsStrategy(userId: string, conflict: SyncResult): Promise<SyncResult> {
    if (!conflict.serverId || !conflict.conflictData) {
      return {
        ...conflict,
        status: 'error',
        error: 'Missing server ID or conflict data for client wins strategy'
      };
    }

    try {
      // Apply client data to server
      const clientData = conflict.conflictData.clientData;
      const updatedVisitor = await this.visitorModel.update(
        conflict.serverId, 
        userId, 
        clientData as UpdateVisitorRequest
      );

      if (!updatedVisitor) {
        return {
          ...conflict,
          status: 'error',
          error: 'Failed to apply client data to server'
        };
      }

      logger.info('Applied client wins strategy', { 
        localId: conflict.localId, 
        serverId: conflict.serverId,
        userId 
      });

      return {
        localId: conflict.localId,
        serverId: conflict.serverId,
        action: conflict.action,
        status: 'success'
      };
    } catch (error: any) {
      logger.error('Error applying client wins strategy', { error, conflict, userId });
      return {
        ...conflict,
        status: 'error',
        error: `Failed to apply client wins strategy: ${error.message}`
      };
    }
  }

  private async applyMergeStrategy(userId: string, conflict: SyncResult): Promise<SyncResult> {
    if (!conflict.serverId || !conflict.conflictData) {
      return {
        ...conflict,
        status: 'error',
        error: 'Missing server ID or conflict data for merge strategy'
      };
    }

    try {
      const { clientData, serverData, conflictFields } = conflict.conflictData;
      const mergedData: any = { ...serverData };

      // Merge specific fields
      for (const field of conflictFields) {
        switch (field) {
          case 'interests':
            // Merge arrays, remove duplicates
            const clientInterests = Array.isArray(clientData[field]) ? clientData[field] : [];
            const serverInterests = Array.isArray(serverData[field]) ? serverData[field] : [];
            mergedData[field] = [...new Set([...serverInterests, ...clientInterests])];
            break;
          
          case 'notes':
            // Concatenate notes with separator
            const clientNotes = clientData[field] || '';
            const serverNotes = serverData[field] || '';
            if (clientNotes && serverNotes && clientNotes !== serverNotes) {
              mergedData[field] = `${serverNotes}\n\n--- Merged from mobile ---\n${clientNotes}`;
            } else {
              mergedData[field] = clientNotes || serverNotes;
            }
            break;
          
          default:
            // For other fields, prefer client data
            mergedData[field] = clientData[field];
        }
      }

      const updatedVisitor = await this.visitorModel.update(
        conflict.serverId, 
        userId, 
        mergedData as UpdateVisitorRequest
      );

      if (!updatedVisitor) {
        return {
          ...conflict,
          status: 'error',
          error: 'Failed to apply merged data to server'
        };
      }

      logger.info('Applied merge strategy', { 
        localId: conflict.localId, 
        serverId: conflict.serverId,
        mergedFields: conflictFields,
        userId 
      });

      return {
        localId: conflict.localId,
        serverId: conflict.serverId,
        action: conflict.action,
        status: 'success'
      };
    } catch (error: any) {
      logger.error('Error applying merge strategy', { error, conflict, userId });
      return {
        ...conflict,
        status: 'error',
        error: `Failed to apply merge strategy: ${error.message}`
      };
    }
  }

  private async flagForManualReview(userId: string, conflict: SyncResult): Promise<SyncResult> {
    // Store conflict for manual review - in a real system, this might go to a queue
    // For now, we'll just log it and return the conflict status
    logger.warn('Conflict flagged for manual review', { 
      localId: conflict.localId, 
      serverId: conflict.serverId,
      conflictFields: conflict.conflictData?.conflictFields,
      userId 
    });

    // In a production system, you might want to:
    // 1. Store the conflict in a separate table for admin review
    // 2. Send notifications to administrators
    // 3. Create a dashboard for conflict resolution

    return {
      ...conflict,
      status: 'conflict', // Keep as conflict for manual resolution
      error: 'Conflict requires manual review'
    };
  }

  async getConflictStatistics(_userId: string): Promise<{
    totalConflicts: number;
    resolvedConflicts: number;
    pendingConflicts: number;
    conflictsByType: Record<string, number>;
  }> {
    // This would typically query a conflicts table
    // For now, return mock data structure
    return {
      totalConflicts: 0,
      resolvedConflicts: 0,
      pendingConflicts: 0,
      conflictsByType: {}
    };
  }
}