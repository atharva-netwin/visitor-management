# Structured Logging System

This document describes the comprehensive structured logging system implemented for the Visitor Management Backend.

## Overview

The logging system provides:
- **Structured JSON logging** with consistent format
- **Correlation ID tracking** for request tracing
- **Log rotation and retention** policies
- **Multiple log levels** and event types
- **Sensitive data sanitization**
- **Performance monitoring**
- **Security event tracking**

## Features Implemented

### ✅ Winston Logger Configuration
- JSON format for structured logging
- Multiple transports (Console, File, Daily Rotate)
- Environment-specific configuration
- Correlation ID support

### ✅ Log Rotation and Retention
- Daily log rotation with compression
- Configurable retention periods:
  - Error logs: 30 days
  - Combined logs: 14 days
  - Audit logs: 90 days
  - Exception logs: 30 days
- Automatic cleanup of old log files

### ✅ Request Logging Middleware
- Correlation ID generation for each request
- Request/response logging with sanitization
- Performance metrics tracking
- HTTP request logging with Morgan integration

### ✅ Error Tracking
- Enhanced error handler with correlation IDs
- Structured error logging with context
- Security event detection
- Sensitive data sanitization in error logs

### ✅ Event-Based Logging
- **System Events**: Server startup, shutdown, database connections
- **Security Events**: Authentication failures, suspicious activity
- **API Events**: Request lifecycle, response tracking
- **Database Events**: Query execution, performance
- **Performance Events**: Operation timing with automatic level assignment

## Usage Examples

### Basic Logging with Correlation ID
```typescript
import { logWithCorrelation } from '@/utils/logger';

// Info logging
logWithCorrelation.info('User action completed', { 
  userId: 123, 
  action: 'profile_update' 
}, correlationId);

// Error logging
logWithCorrelation.error('Database connection failed', error, {
  database: 'primary',
  retryAttempt: 3
}, correlationId);
```

### Event Logging
```typescript
import { 
  logSystemEvent, 
  logSecurityEvent, 
  logApiEvent, 
  logDatabaseEvent, 
  logPerformance 
} from '@/utils/logger';

// System events
logSystemEvent('server_started', { port: 3000 });

// Security events
logSecurityEvent('failed_login_attempt', { 
  ip: '192.168.1.1', 
  username: 'admin' 
});

// API events
logApiEvent('request_completed', { 
  method: 'POST', 
  endpoint: '/api/users',
  statusCode: 201 
});

// Database events
logDatabaseEvent('query_executed', { 
  table: 'users', 
  operation: 'SELECT',
  duration: 45 
});

// Performance monitoring
logPerformance('user_search', 1200, { 
  resultCount: 25 
});
```

## Log Structure

All logs follow a consistent JSON structure:

```json
{
  "timestamp": "2025-08-17 10:25:43.123",
  "level": "INFO",
  "service": "visitor-management-backend",
  "correlationId": "demo-1723891543123",
  "message": "User action completed",
  "eventType": "api",
  "userId": 123,
  "action": "profile_update",
  "environment": "production",
  "processId": 12345,
  "nodeVersion": "v18.17.0"
}
```

## Log Files

### Development Environment
- Console output with colored formatting
- File logging to `logs/` directory

### Production Environment
- Structured JSON logging to multiple files:
  - `logs/error-YYYY-MM-DD.log` - Error level logs
  - `logs/combined-YYYY-MM-DD.log` - All logs
  - `logs/audit-YYYY-MM-DD.log` - Security events
  - `logs/exceptions-YYYY-MM-DD.log` - Uncaught exceptions
  - `logs/rejections-YYYY-MM-DD.log` - Unhandled rejections

## Configuration

### Environment Variables
- `LOG_LEVEL` - Minimum log level (default: 'info')
- `NODE_ENV` - Environment mode affecting log format

### Log Levels
- `error` - Error conditions
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug information

## Security Features

### Data Sanitization
Sensitive fields are automatically redacted in logs:
- `password` → `[REDACTED]`
- `token` → `[REDACTED]`
- `secret` → `[REDACTED]`
- `authorization` → `Bearer [REDACTED]`

### Security Event Detection
Automatic detection and logging of:
- Authentication failures
- SQL injection attempts
- Path traversal attempts
- XSS attempts
- Suspicious error patterns

## Performance Monitoring

Automatic performance level assignment:
- **Debug level**: < 1000ms
- **Info level**: 1000ms - 5000ms  
- **Warn level**: > 5000ms

## Testing

Run the logging system tests:
```bash
# Unit tests
npm test -- --testPathPattern=logging.test.ts

# Integration tests  
npm test -- --testPathPattern=logging-integration.test.ts

# Demo script
npm run test:logging
```

## Log Management

### Automatic Cleanup
- Runs daily to remove old log files
- Configurable retention periods
- Compressed archives for space efficiency

### Log Statistics
```typescript
import { getLogStats } from '@/utils/logSetup';

const stats = await getLogStats();
console.log(`Total files: ${stats.totalFiles}`);
console.log(`Total size: ${stats.totalSize} bytes`);
```

## Correlation ID Tracking

Every request gets a unique correlation ID that flows through:
1. Request middleware
2. Business logic
3. Database operations
4. Error handling
5. Response logging

This enables complete request tracing across all system components.

## Requirements Satisfied

This implementation satisfies the following requirements:

- **6.1**: Structured logging with JSON format and correlation IDs ✅
- **6.4**: Error tracking with detailed context and sanitization ✅

The logging system provides comprehensive observability for the visitor management backend with enterprise-grade features for monitoring, debugging, and security analysis.