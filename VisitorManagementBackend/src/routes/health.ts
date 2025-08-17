import { Router, Request, Response } from 'express';
import { monitoringService } from '@/services/MonitoringService';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: System health check
 *     description: |
 *       Comprehensive health check endpoint that verifies the status of all system components.
 *       Checks database connectivity, Redis availability, and overall system health.
 *       Returns detailed status information for monitoring and alerting systems.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy or degraded but operational
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, timestamp, uptime, version]
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-01-01T12:00:00.000Z"
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                           description: Response time in milliseconds
 *                         details:
 *                           type: string
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         details:
 *                           type: string
 *                     api:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         responseTime:
 *                           type: number
 *                         details:
 *                           type: string
 *                 uptime:
 *                   type: number
 *                   description: System uptime in seconds
 *                   example: 86400
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *             examples:
 *               healthy:
 *                 summary: All systems healthy
 *                 value:
 *                   status: "healthy"
 *                   timestamp: "2023-01-01T12:00:00.000Z"
 *                   services:
 *                     database:
 *                       status: "healthy"
 *                       responseTime: 15
 *                       details: "Connected to PostgreSQL"
 *                     redis:
 *                       status: "healthy"
 *                       responseTime: 5
 *                       details: "Connected to Redis"
 *                     api:
 *                       status: "healthy"
 *                       responseTime: 2
 *                       details: "API responding normally"
 *                   uptime: 86400
 *                   version: "1.0.0"
 *               degraded:
 *                 summary: Some services degraded
 *                 value:
 *                   status: "degraded"
 *                   timestamp: "2023-01-01T12:00:00.000Z"
 *                   services:
 *                     database:
 *                       status: "healthy"
 *                       responseTime: 15
 *                       details: "Connected to PostgreSQL"
 *                     redis:
 *                       status: "degraded"
 *                       responseTime: 150
 *                       details: "High response time"
 *                     api:
 *                       status: "healthy"
 *                       responseTime: 2
 *                       details: "API responding normally"
 *                   uptime: 86400
 *                   version: "1.0.0"
 *       503:
 *         description: System is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "unhealthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 version:
 *                   type: string
 *                 error:
 *                   type: string
 *                   example: "Database connection failed"
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.getSystemHealth();
    
    // Set appropriate HTTP status based on health
    const httpStatus = healthStatus.status === 'healthy' ? 200 
                     : healthStatus.status === 'degraded' ? 200 
                     : 503;

    res.status(httpStatus).json(healthStatus);
    
    // Log health check if not healthy
    if (healthStatus.status !== 'healthy') {
      logger.warn('Health check returned non-healthy status', {
        status: healthStatus.status,
        services: healthStatus.services
      });
    }
    
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env['npm_package_version'] || '1.0.0',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/health/ready:
 *   get:
 *     summary: Readiness probe
 *     description: |
 *       Kubernetes/container orchestration readiness probe.
 *       Indicates whether the application is ready to receive traffic.
 *       Checks that all critical services are available and responsive.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Application is ready to receive traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ready"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Application is not ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "not_ready"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 reason:
 *                   type: string
 *                   example: "System status: degraded"
 *                 error:
 *                   type: string
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.getSystemHealth();
    
    if (healthStatus.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: `System status: ${healthStatus.status}`
      });
    }
    
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/health/live:
 *   get:
 *     summary: Liveness probe
 *     description: |
 *       Kubernetes/container orchestration liveness probe.
 *       Simple check to verify the application process is running.
 *       Always returns 200 if the process is alive.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Application process is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "alive"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Process uptime in seconds
 *                 pid:
 *                   type: integer
 *                   description: Process ID
 */
router.get('/health/live', (_req: Request, res: Response) => {
  // Simple liveness check - if the process is running, it's alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Prometheus metrics
 *     description: |
 *       Exposes application metrics in Prometheus format for monitoring and alerting.
 *       Includes custom application metrics, HTTP request metrics, and system metrics.
 *       Used by monitoring systems like Prometheus, Grafana, and alerting tools.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # HELP http_requests_total Total number of HTTP requests
 *                 # TYPE http_requests_total counter
 *                 http_requests_total{method="GET",route="/api/visitors",status_code="200"} 1234
 *                 
 *                 # HELP http_request_duration_seconds HTTP request duration in seconds
 *                 # TYPE http_request_duration_seconds histogram
 *                 http_request_duration_seconds_bucket{method="GET",route="/api/visitors",le="0.1"} 800
 *                 
 *                 # HELP visitors_total Total number of visitors created
 *                 # TYPE visitors_total counter
 *                 visitors_total 5678
 *       500:
 *         description: Failed to retrieve metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve metrics"
 *                 message:
 *                   type: string
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getMetrics();
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics);
    
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/version:
 *   get:
 *     summary: API version information
 *     description: |
 *       Returns version information about the API and runtime environment.
 *       Useful for debugging, monitoring, and ensuring API compatibility.
 *       Includes application version, Node.js version, and environment details.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Version information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                   description: Application version
 *                 name:
 *                   type: string
 *                   example: "visitor-management-backend"
 *                   description: Application name
 *                 nodeVersion:
 *                   type: string
 *                   example: "v18.17.0"
 *                   description: Node.js version
 *                 environment:
 *                   type: string
 *                   example: "production"
 *                   description: Current environment
 *                 uptime:
 *                   type: number
 *                   example: 86400
 *                   description: Process uptime in seconds
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-01-01T12:00:00.000Z"
 *                   description: Current server timestamp
 */
router.get('/version', (_req: Request, res: Response) => {
  res.json({
    version: process.env['npm_package_version'] || '1.0.0',
    name: process.env['npm_package_name'] || 'visitor-management-backend',
    nodeVersion: process.version,
    environment: process.env['NODE_ENV'] || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

export { router as healthRouter };