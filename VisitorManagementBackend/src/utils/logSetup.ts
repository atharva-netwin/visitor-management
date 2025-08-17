import { promises as fs } from 'fs';
import path from 'path';
import { logSystemEvent } from './logger';

/**
 * Ensures the logs directory exists and has proper permissions
 */
export async function ensureLogsDirectory(): Promise<void> {
  const logsDir = path.join(process.cwd(), 'logs');
  
  try {
    await fs.access(logsDir);
    logSystemEvent('logs_directory_exists', { path: logsDir });
  } catch (error) {
    try {
      await fs.mkdir(logsDir, { recursive: true });
      logSystemEvent('logs_directory_created', { path: logsDir });
    } catch (createError) {
      logSystemEvent('logs_directory_creation_failed', { 
        path: logsDir, 
        error: createError instanceof Error ? createError.message : String(createError) 
      });
      throw createError;
    }
  }
}

/**
 * Cleans up old log files based on retention policy
 */
export async function cleanupOldLogs(): Promise<void> {
  const logsDir = path.join(process.cwd(), 'logs');
  
  try {
    const files = await fs.readdir(logsDir);
    const now = Date.now();
    const retentionPeriods = {
      'error-': 30 * 24 * 60 * 60 * 1000, // 30 days
      'combined-': 14 * 24 * 60 * 60 * 1000, // 14 days
      'audit-': 90 * 24 * 60 * 60 * 1000, // 90 days
      'exceptions-': 30 * 24 * 60 * 60 * 1000, // 30 days
      'rejections-': 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    for (const file of files) {
      if (file.endsWith('.log') || file.endsWith('.log.gz')) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        const fileAge = now - stats.mtime.getTime();

        // Check if file should be deleted based on retention policy
        for (const [prefix, retention] of Object.entries(retentionPeriods)) {
          if (file.startsWith(prefix) && fileAge > retention) {
            await fs.unlink(filePath);
            logSystemEvent('old_log_file_deleted', { 
              file, 
              age: Math.floor(fileAge / (24 * 60 * 60 * 1000)) + ' days' 
            });
            break;
          }
        }
      }
    }
  } catch (error) {
    logSystemEvent('log_cleanup_failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Gets log directory statistics
 */
export async function getLogStats(): Promise<{
  totalFiles: number;
  totalSize: number;
  oldestFile: string | null;
  newestFile: string | null;
}> {
  const logsDir = path.join(process.cwd(), 'logs');
  
  try {
    const files = await fs.readdir(logsDir);
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestFile: string | null = null;
    let newestFile: string | null = null;

    for (const file of files) {
      if (file.endsWith('.log') || file.endsWith('.log.gz')) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        if (stats.mtime.getTime() < oldestTime) {
          oldestTime = stats.mtime.getTime();
          oldestFile = file;
        }

        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          newestFile = file;
        }
      }
    }

    return {
      totalFiles: files.filter(f => f.endsWith('.log') || f.endsWith('.log.gz')).length,
      totalSize,
      oldestFile,
      newestFile,
    };
  } catch (error) {
    logSystemEvent('log_stats_failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return {
      totalFiles: 0,
      totalSize: 0,
      oldestFile: null,
      newestFile: null,
    };
  }
}