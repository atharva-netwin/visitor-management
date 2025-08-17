# Monitoring and Health Check Implementation

## Overview

This document describes the comprehensive monitoring and health check system implemented for the Visitor Management Backend as part of task 8.2.

## Components Implemented

### 1. MonitoringService (`src/services/MonitoringService.ts`)

A comprehensive monitoring service that provides:

- **HTTP Request Tracking**: Records request count, duration, and status codes
- **Connection Monitoring**: Tracks database and Redis connections
- **Error Tracking**: Records and categorizes application errors
- **Authentication Metrics**: Tracks login, registration, and token refresh attempts
- **Sync Operation Metrics**: Monitors bulk sync and conflict resolution operations
- **System Metrics**: Collects memory usage, uptime, and connection pool statistics
- **Prometheus Integration**: Exports metrics in Prometheus format

### 2. AlertingService (`src/services/AlertingService.ts`)

An intelligent alerting system that provides:

- **Configurable Thresholds**: Error rates, response times, memory usage, database connections
- **Alert Types**: Error rate, slow response, high memory, database connections, service down
- **Cooldown Periods**: Prevents alert spam with configurable cooldown periods
- **Multiple Severity Levels**: Warning and critical alerts
- **Webhook Integration**: Ready for integration with external alerting systems
- **Alert History**: Tracking and management of alert events

### 3. Health Check Endpoints (`src/routes/health.ts`)

Comprehensive health check endpoints:

- **`GET /api/health`**: Detailed system health with service status and metrics
- **`GET /api/health/ready`**: Kubernetes readiness probe
- **`GET /api/health/live`**: Kubernetes liveness probe
- **`GET /api/metrics`**: Prometheus metrics endpoint
- **`GET /api/version`**: API version and environment information

### 4. Monitoring Middleware (`src/middleware/monitoring.ts`)

Request tracking middleware:

- **Request Metrics**: Automatic HTTP request tracking
- **Connection Tracking**: Active connection monitoring
- **Error Tracking**: Automatic error recording
- **Route Pattern Normalization**: Consistent route naming for metrics

## Features

### Health Check Capabilities

- **Database Health**: Connection status, response time, connection pool metrics
- **Redis Health**: Connection status, response time, memory usage
- **System Health**: Memory usage, uptime, process information
- **Overall Status**: Aggregated health status (healthy/degraded/unhealthy)

### Prometheus Metrics

The system exports the following metrics:

- `http_requests_total`: Total HTTP requests by method, route, and status
- `http_request_duration_seconds`: Request duration histogram
- `active_connections_total`: Current active connections
- `database_connections_total`: Database connection pool metrics
- `redis_connections_total`: Redis connection status
- `system_memory_usage_bytes`: System memory usage
- `system_uptime_seconds`: System uptime
- `errors_total`: Error count by type and endpoint
- `auth_attempts_total`: Authentication attempts by type and status
- `sync_operations_total`: Sync operation metrics

### Alerting Capabilities

- **Error Rate Monitoring**: Alerts when error rates exceed thresholds
- **Response Time Monitoring**: Alerts for slow response times
- **Memory Usage Monitoring**: Alerts for high memory consumption
- **Database Connection Monitoring**: Alerts for connection pool exhaustion
- **Service Availability Monitoring**: Alerts when services become unavailable

## Configuration

### Environment Variables

The system supports the following environment variables:

```bash
# Alerting Configuration
ALERTING_ENABLED=true
ALERT_ERROR_RATE_THRESHOLD=10
ALERT_RESPONSE_TIME_THRESHOLD=5
ALERT_MEMORY_THRESHOLD=85
ALERT_DB_CONNECTIONS_THRESHOLD=80
ALERT_COOLDOWN_MINUTES=15
ALERT_WEBHOOK_URL=https://your-webhook-url.com/alerts
```

### Default Thresholds

- **Error Rate**: 10 errors per minute
- **Response Time**: 5 seconds average
- **Memory Usage**: 85% of heap
- **Database Connections**: 80% of pool size
- **Cooldown Period**: 15 minutes between same alert types

## Integration Points

### Authentication Controller

- Records successful and failed login attempts
- Tracks registration attempts
- Monitors token refresh operations

### Visitor Controller

- Records bulk sync operation metrics
- Tracks sync success/failure rates

### Main Application

- Automatic request tracking for all endpoints
- Error tracking middleware
- Connection monitoring
- Health check endpoints without rate limiting

## Testing

Comprehensive test coverage includes:

- **Unit Tests**: `src/__tests__/monitoring.test.ts`
- **Integration Tests**: `src/__tests__/health-integration.test.ts`
- **Mocked Dependencies**: Database and Redis health checks
- **Metrics Export Testing**: Prometheus format validation
- **Alert Configuration Testing**: Threshold and cooldown validation

## Usage Examples

### Health Check

```bash
# Basic health check
curl http://localhost:3000/api/health

# Readiness probe
curl http://localhost:3000/api/health/ready

# Liveness probe
curl http://localhost:3000/api/health/live

# Version information
curl http://localhost:3000/api/version
```

### Metrics

```bash
# Prometheus metrics
curl http://localhost:3000/api/metrics
```

### Programmatic Usage

```typescript
import { monitoringService, alertingService } from '@/services';

// Record custom metrics
monitoringService.recordHttpRequest('GET', '/api/custom', 200, 0.5);
monitoringService.recordError('CustomError', '/api/custom');

// Configure alerting
alertingService.updateConfig({
  enabled: true,
  thresholds: {
    errorRate: 20,
    responseTime: 3
  }
});
```

## Production Considerations

### Monitoring Integration

- **Prometheus**: Scrape `/api/metrics` endpoint
- **Grafana**: Create dashboards using exported metrics
- **Kubernetes**: Use `/api/health/ready` and `/api/health/live` probes

### Alerting Integration

- **Webhook Support**: Configure `ALERT_WEBHOOK_URL` for external systems
- **Slack/Teams**: Integrate webhook with chat platforms
- **PagerDuty/Opsgenie**: Route critical alerts to on-call systems

### Performance Impact

- **Minimal Overhead**: Metrics collection is asynchronous
- **Memory Efficient**: Configurable metric retention
- **Non-Blocking**: Health checks don't block request processing

## Security Considerations

- **No Authentication Required**: Health endpoints are public for monitoring
- **Rate Limiting Exempt**: Health checks bypass rate limiting
- **Sensitive Data**: No sensitive information exposed in metrics
- **Error Sanitization**: Stack traces are logged but not exposed in metrics

## Future Enhancements

- **Custom Metrics**: Business-specific metrics (visitor counts, etc.)
- **Distributed Tracing**: Integration with Jaeger or Zipkin
- **Log Aggregation**: Integration with ELK stack or similar
- **Advanced Alerting**: Machine learning-based anomaly detection
- **Dashboard Templates**: Pre-built Grafana dashboards