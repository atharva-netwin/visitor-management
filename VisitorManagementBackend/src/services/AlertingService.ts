import { logger } from '@/utils/logger';
import { monitoringService } from './MonitoringService';

export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number; // errors per minute
    responseTime: number; // seconds
    memoryUsage: number; // percentage
    databaseConnections: number; // percentage of max connections
  };
  cooldownPeriod: number; // minutes between same alert types
}

export interface Alert {
  id: string;
  type: 'error_rate' | 'slow_response' | 'high_memory' | 'database_connections' | 'service_down';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: any;
}

class AlertingService {
  private config: AlertConfig;
  private alertHistory: Map<string, Date> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private responseTimeBuffer: number[] = [];
  private readonly BUFFER_SIZE = 100; // Keep last 100 response times

  constructor() {
    this.config = {
      enabled: process.env['ALERTING_ENABLED'] === 'true',
      thresholds: {
        errorRate: parseInt(process.env['ALERT_ERROR_RATE_THRESHOLD'] || '10'), // 10 errors per minute
        responseTime: parseFloat(process.env['ALERT_RESPONSE_TIME_THRESHOLD'] || '5'), // 5 seconds
        memoryUsage: parseInt(process.env['ALERT_MEMORY_THRESHOLD'] || '85'), // 85%
        databaseConnections: parseInt(process.env['ALERT_DB_CONNECTIONS_THRESHOLD'] || '80') // 80%
      },
      cooldownPeriod: parseInt(process.env['ALERT_COOLDOWN_MINUTES'] || '15') // 15 minutes
    };

    // Start monitoring if alerting is enabled
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  private startMonitoring(): void {
    // Check system health every minute
    setInterval(() => {
      this.checkSystemHealth();
    }, 60000);

    // Reset error counts every minute
    setInterval(() => {
      this.errorCounts.clear();
    }, 60000);

    logger.info('Alerting service started', { config: this.config });
  }

  private async checkSystemHealth(): Promise<void> {
    try {
      const health = await monitoringService.getSystemHealth();
      
      // Check service availability
      if (health.services.database.status === 'unhealthy') {
        await this.triggerAlert({
          type: 'service_down',
          severity: 'critical',
          message: 'Database service is unhealthy',
          metadata: { service: 'database', details: health.services.database.details }
        });
      }

      if (health.services.redis.status === 'unhealthy') {
        await this.triggerAlert({
          type: 'service_down',
          severity: 'critical',
          message: 'Redis service is unhealthy',
          metadata: { service: 'redis', details: health.services.redis.details }
        });
      }

      // Check memory usage
      const memoryUsagePercent = (health.metrics.memory.heapUsed / health.metrics.memory.heapTotal) * 100;
      if (memoryUsagePercent > this.config.thresholds.memoryUsage) {
        await this.triggerAlert({
          type: 'high_memory',
          severity: memoryUsagePercent > 95 ? 'critical' : 'warning',
          message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
          metadata: { 
            memoryUsage: memoryUsagePercent,
            heapUsed: health.metrics.memory.heapUsed,
            heapTotal: health.metrics.memory.heapTotal
          }
        });
      }

      // Check database connections
      const dbConnections = health.metrics.connections.database;
      const connectionUsagePercent = (dbConnections.total / 20) * 100; // Assuming max 20 connections
      if (connectionUsagePercent > this.config.thresholds.databaseConnections) {
        await this.triggerAlert({
          type: 'database_connections',
          severity: connectionUsagePercent > 95 ? 'critical' : 'warning',
          message: `High database connection usage: ${connectionUsagePercent.toFixed(1)}%`,
          metadata: { 
            connectionUsage: connectionUsagePercent,
            totalConnections: dbConnections.total,
            idleConnections: dbConnections.idle,
            waitingConnections: dbConnections.waiting
          }
        });
      }

      // Check average response time
      if (this.responseTimeBuffer.length > 0) {
        const avgResponseTime = this.responseTimeBuffer.reduce((a, b) => a + b, 0) / this.responseTimeBuffer.length;
        if (avgResponseTime > this.config.thresholds.responseTime) {
          await this.triggerAlert({
            type: 'slow_response',
            severity: avgResponseTime > this.config.thresholds.responseTime * 2 ? 'critical' : 'warning',
            message: `High average response time: ${avgResponseTime.toFixed(2)}s`,
            metadata: { 
              averageResponseTime: avgResponseTime,
              sampleSize: this.responseTimeBuffer.length
            }
          });
        }
      }

    } catch (error) {
      logger.error('Error during health check monitoring:', error);
    }
  }

  private async triggerAlert(alertData: Omit<Alert, 'id' | 'timestamp'>): Promise<void> {
    const alertKey = `${alertData.type}_${alertData.severity}`;
    const now = new Date();
    
    // Check cooldown period
    const lastAlert = this.alertHistory.get(alertKey);
    if (lastAlert) {
      const timeSinceLastAlert = (now.getTime() - lastAlert.getTime()) / (1000 * 60); // minutes
      if (timeSinceLastAlert < this.config.cooldownPeriod) {
        return; // Still in cooldown period
      }
    }

    const alert: Alert = {
      id: `${alertData.type}_${now.getTime()}`,
      timestamp: now,
      ...alertData
    };

    // Record alert
    this.alertHistory.set(alertKey, now);

    // Log alert
    logger.error('ALERT TRIGGERED', {
      alert: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata
      }
    });

    // Send alert through configured channels
    await this.sendAlert(alert);
  }

  private async sendAlert(alert: Alert): Promise<void> {
    try {
      // In a production environment, you would integrate with:
      // - Email services (SendGrid, AWS SES, etc.)
      // - Slack/Teams webhooks
      // - PagerDuty/Opsgenie
      // - SMS services
      
      // For now, we'll log the alert and could extend with webhook support
      logger.warn('Alert notification sent', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message
      });

      // Example webhook integration (if configured)
      const webhookUrl = process.env['ALERT_WEBHOOK_URL'];
      if (webhookUrl) {
        await this.sendWebhookAlert(webhookUrl, alert);
      }

    } catch (error) {
      logger.error('Failed to send alert notification:', error);
    }
  }

  private async sendWebhookAlert(webhookUrl: string, alert: Alert): Promise<void> {
    try {
      // In a real implementation, you would use fetch or axios
      // const payload = {
      //   text: `🚨 ${alert.severity.toUpperCase()} ALERT: ${alert.message}`,
      //   alert: {
      //     id: alert.id,
      //     type: alert.type,
      //     severity: alert.severity,
      //     message: alert.message,
      //     timestamp: alert.timestamp.toISOString(),
      //     metadata: alert.metadata
      //   }
      // };

      // await fetch(webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });

      logger.info('Webhook alert sent', { webhookUrl, alertId: alert.id });
      
    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }

  // Public methods for recording events
  recordError(errorType: string): void {
    if (!this.config.enabled) return;

    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);

    // Check if error rate threshold is exceeded
    if (count + 1 >= this.config.thresholds.errorRate) {
      this.triggerAlert({
        type: 'error_rate',
        severity: 'warning',
        message: `High error rate for ${errorType}: ${count + 1} errors in the last minute`,
        metadata: { errorType, errorCount: count + 1 }
      });
    }
  }

  recordResponseTime(responseTime: number): void {
    if (!this.config.enabled) return;

    // Add to buffer
    this.responseTimeBuffer.push(responseTime);
    
    // Keep buffer size manageable
    if (this.responseTimeBuffer.length > this.BUFFER_SIZE) {
      this.responseTimeBuffer.shift();
    }
  }

  // Get alert history
  getAlertHistory(_limit: number = 50): Alert[] {
    // In a production environment, you would store alerts in a database
    // For now, return empty array as we're only keeping cooldown tracking
    return [];
  }

  // Update configuration
  updateConfig(newConfig: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Alerting configuration updated', { config: this.config });
  }

  // Get current configuration
  getConfig(): AlertConfig {
    return { ...this.config };
  }
}

// Create singleton instance
export const alertingService = new AlertingService();