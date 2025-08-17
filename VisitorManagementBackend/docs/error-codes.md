# API Error Codes and Troubleshooting Guide

This document provides comprehensive information about error codes returned by the Visitor Management API, along with troubleshooting steps and resolution strategies.

## Error Response Format

All API errors follow a standardized format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error-specific details
    },
    "correlationId": "req_123456789"
  }
}
```

## Error Codes Reference

### Authentication Errors

#### AUTHENTICATION_FAILED
- **HTTP Status**: 401
- **Description**: Authentication credentials are invalid or missing
- **Common Causes**:
  - Invalid email/password combination
  - Expired or malformed JWT token
  - Missing Authorization header
  - Invalid refresh token
- **Troubleshooting**:
  1. Verify email and password are correct
  2. Check that Authorization header is properly formatted: `Bearer <token>`
  3. Ensure token hasn't expired (access tokens expire in 15 minutes)
  4. Use refresh token to obtain new access token
  5. Re-authenticate if refresh token is also expired

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_FAILED",
    "message": "Invalid email or password",
    "correlationId": "req_123456789"
  }
}
```

#### AUTHORIZATION_FAILED
- **HTTP Status**: 403
- **Description**: User lacks permission to access the requested resource
- **Common Causes**:
  - Attempting to access another user's data
  - Account is deactivated
  - Insufficient privileges for the operation
- **Troubleshooting**:
  1. Verify you're accessing your own resources
  2. Check account status with administrator
  3. Ensure you have the required permissions

### Validation Errors

#### VALIDATION_ERROR
- **HTTP Status**: 400
- **Description**: Request data failed validation rules
- **Common Causes**:
  - Missing required fields
  - Invalid data formats (email, phone, URL)
  - Data exceeds length limits
  - Invalid enum values
- **Troubleshooting**:
  1. Check the `details` array for specific field errors
  2. Verify all required fields are provided
  3. Ensure data formats match API specifications
  4. Check field length limits

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Please provide a valid email address"
      },
      {
        "field": "password",
        "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      }
    ],
    "correlationId": "req_123456789"
  }
}
```

### Resource Errors

#### RESOURCE_NOT_FOUND
- **HTTP Status**: 404
- **Description**: Requested resource doesn't exist or user doesn't have access
- **Common Causes**:
  - Invalid resource ID
  - Resource was deleted
  - User doesn't own the resource
- **Troubleshooting**:
  1. Verify the resource ID is correct
  2. Check if resource was recently deleted
  3. Ensure you have access to the resource

#### DUPLICATE_RESOURCE
- **HTTP Status**: 400
- **Description**: Attempting to create a resource that already exists
- **Common Causes**:
  - Email already registered
  - Duplicate local ID in sync operations
- **Troubleshooting**:
  1. Check if resource already exists
  2. Use update operation instead of create
  3. For sync operations, verify local ID uniqueness

### Rate Limiting Errors

#### RATE_LIMIT_EXCEEDED
- **HTTP Status**: 429
- **Description**: Too many requests within the allowed time window
- **Rate Limits**:
  - Authentication endpoints: 5 requests per 15 minutes
  - General API endpoints: 100 requests per 15 minutes
  - Sync endpoints: 10 requests per 5 minutes
- **Troubleshooting**:
  1. Wait for the rate limit window to reset (check `Retry-After` header)
  2. Implement exponential backoff in your client
  3. Reduce request frequency
  4. Use bulk operations where available

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "limit": 5,
      "remaining": 0,
      "resetTime": "2023-01-01T12:15:00.000Z"
    },
    "correlationId": "req_123456789"
  }
}
```

### Synchronization Errors

#### SYNC_CONFLICT
- **HTTP Status**: 409
- **Description**: Data conflict detected during synchronization
- **Common Causes**:
  - Concurrent modifications to the same record
  - Timestamp mismatches
  - Data integrity violations
- **Troubleshooting**:
  1. Review conflict details in the response
  2. Choose appropriate resolution strategy:
     - `server_wins`: Accept server version
     - `client_wins`: Use client version
     - `merge`: Combine both versions
     - `manual`: Provide custom resolution
  3. Use conflict resolution endpoint to resolve

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "SYNC_CONFLICT",
    "message": "Data conflict detected",
    "details": {
      "localId": "local_123",
      "serverId": "uuid-456",
      "conflictFields": ["name", "company"],
      "clientData": {
        "name": "John Smith",
        "company": "Client Corp"
      },
      "serverData": {
        "name": "John Doe",
        "company": "Server Corp"
      }
    },
    "correlationId": "req_123456789"
  }
}
```

### System Errors

#### DATABASE_ERROR
- **HTTP Status**: 500
- **Description**: Database operation failed
- **Common Causes**:
  - Database connection issues
  - Query timeout
  - Data integrity constraints
- **Troubleshooting**:
  1. Retry the operation after a brief delay
  2. Check system status at `/api/health`
  3. Contact support if issue persists

#### INTERNAL_SERVER_ERROR
- **HTTP Status**: 500
- **Description**: Unexpected server error occurred
- **Troubleshooting**:
  1. Retry the operation
  2. Check if the issue is reproducible
  3. Contact support with correlation ID

## HTTP Status Code Reference

| Status Code | Meaning | When Used |
|-------------|---------|-----------|
| 200 | OK | Successful GET, PUT, DELETE operations |
| 201 | Created | Successful POST operations (resource created) |
| 400 | Bad Request | Validation errors, malformed requests |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Data conflicts, duplicate resources |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side errors |
| 503 | Service Unavailable | System maintenance or overload |

## Best Practices for Error Handling

### Client-Side Implementation

1. **Always Check Success Flag**:
   ```javascript
   if (!response.success) {
     handleError(response.error);
   }
   ```

2. **Use Correlation IDs for Support**:
   ```javascript
   console.error(`API Error: ${error.message} (ID: ${error.correlationId})`);
   ```

3. **Implement Retry Logic**:
   ```javascript
   async function apiCallWithRetry(apiCall, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await apiCall();
       } catch (error) {
         if (error.code === 'RATE_LIMIT_EXCEEDED') {
           const delay = Math.pow(2, i) * 1000; // Exponential backoff
           await new Promise(resolve => setTimeout(resolve, delay));
         } else {
           throw error;
         }
       }
     }
   }
   ```

4. **Handle Authentication Errors**:
   ```javascript
   if (error.code === 'AUTHENTICATION_FAILED') {
     // Try to refresh token
     const refreshed = await refreshAuthToken();
     if (refreshed) {
       // Retry original request
       return retryRequest();
     } else {
       // Redirect to login
       redirectToLogin();
     }
   }
   ```

### Mobile App Specific Handling

1. **Offline Mode Fallback**:
   ```javascript
   try {
     const result = await syncToServer(data);
   } catch (error) {
     if (error.code === 'DATABASE_ERROR' || !navigator.onLine) {
       // Store locally for later sync
       await storeOffline(data);
     }
   }
   ```

2. **Sync Conflict Resolution**:
   ```javascript
   if (error.code === 'SYNC_CONFLICT') {
     const resolution = await showConflictDialog(error.details);
     await resolveConflict(error.details.localId, resolution);
   }
   ```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rate by Code**: Track frequency of each error type
2. **Authentication Failures**: Monitor for potential security issues
3. **Rate Limit Hits**: Identify clients that need optimization
4. **Sync Conflicts**: Monitor data synchronization health
5. **Response Times**: Track API performance

### Alert Thresholds

- **High Error Rate**: >5% of requests returning 5xx errors
- **Authentication Failures**: >10 failed attempts from same IP in 5 minutes
- **Database Errors**: Any DATABASE_ERROR occurrences
- **Sync Conflicts**: >20% of sync operations resulting in conflicts

## Support and Debugging

When contacting support, please provide:

1. **Correlation ID** from the error response
2. **Timestamp** when the error occurred
3. **Request details** (endpoint, method, payload structure)
4. **User context** (user ID, account type)
5. **Steps to reproduce** the issue

### Debug Mode

For development environments, enable debug mode to get additional error details:

```bash
NODE_ENV=development DEBUG=true npm start
```

This will include stack traces and additional debugging information in error responses.