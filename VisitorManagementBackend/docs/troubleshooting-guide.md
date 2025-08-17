# Integration Troubleshooting Guide

This guide provides solutions to common issues encountered when integrating with the Visitor Management API, including authentication problems, sync conflicts, network errors, and performance issues.

## Authentication Issues

### 1. Invalid Credentials Error

**Problem**: Getting "Invalid email or password" error despite correct credentials.

**Possible Causes**:
- Email case sensitivity issues
- Password encoding problems
- Account not activated
- Rate limiting in effect

**Solutions**:
```javascript
// Ensure email is lowercase
const loginData = {
  email: email.toLowerCase().trim(),
  password: password
};

// Check for rate limiting headers
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'];
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
}
```

### 2. Token Expired Error

**Problem**: Getting "Token expired" error on API calls.

**Solutions**:
```javascript
// Implement automatic token refresh
const refreshToken = async () => {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: storedRefreshToken
      })
    });
    
    if (response.ok) {
      const { accessToken, refreshToken: newRefreshToken } = await response.json();
      // Update stored tokens
      await updateStoredTokens(accessToken, newRefreshToken);
      return accessToken;
    }
  } catch (error) {
    // Redirect to login
    redirectToLogin();
  }
};
```

### 3. CORS Issues

**Problem**: Cross-origin requests blocked by browser.

**Solutions**:
- Ensure your mobile app origin is configured in the backend CORS settings
- For development, the backend allows `http://localhost:*` and `exp://192.168.*`
- For production, add your domain to the CORS whitelist

```javascript
// Backend CORS configuration example
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:19006',
    'exp://192.168.1.100:19000',
    'https://yourdomain.com'
  ],
  credentials: true
};
```

## Sync Issues

### 1. Sync Conflicts

**Problem**: Data conflicts during offline-to-online sync.

**Understanding Conflict Resolution**:
- **Server Wins**: Server data takes precedence (default)
- **Client Wins**: Local data overwrites server data
- **Merge**: Combines data where possible
- **Manual**: Requires user intervention

**Example Handling**:
```javascript
const handleSyncConflicts = async (syncResult) => {
  if (syncResult.conflicts && syncResult.conflicts.length > 0) {
    for (const conflict of syncResult.conflicts) {
      switch (conflict.resolution.strategy) {
        case 'server_wins':
          // Update local data with server version
          await updateLocalRecord(conflict.localId, conflict.serverData);
          break;
          
        case 'manual':
          // Present conflict resolution UI to user
          await presentConflictResolution(conflict);
          break;
          
        case 'merge':
          // Apply merged data
          await updateLocalRecord(conflict.localId, conflict.resolution.resolvedData);
          break;
      }
    }
  }
};
```

### 2. Partial Sync Failures

**Problem**: Some records sync successfully while others fail.

**Solutions**:
```javascript
const handlePartialSync = async (syncResult) => {
  const { successful, failed } = syncResult;
  
  // Update successful records
  for (const success of successful) {
    await updateLocalRecord(success.localId, {
      serverId: success.serverId,
      synced: true,
      lastSyncAt: new Date().toISOString()
    });
  }
  
  // Retry failed records later
  for (const failure of failed) {
    await markForRetry(failure.localId, failure.error);
  }
  
  // Schedule retry for failed records
  if (failed.length > 0) {
    setTimeout(() => retrySyncFailures(), 30000); // Retry in 30 seconds
  }
};
```

### 3. Large Dataset Sync Performance

**Problem**: Sync operations timing out with large datasets.

**Solutions**:
```javascript
// Implement chunked sync
const syncInChunks = async (records, chunkSize = 50) => {
  const chunks = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }
  
  const results = [];
  for (const chunk of chunks) {
    try {
      const result = await syncChunk(chunk);
      results.push(result);
      
      // Add delay between chunks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Chunk sync failed:', error);
      // Continue with next chunk
    }
  }
  
  return results;
};
```

## Network Issues

### 1. Connection Timeouts

**Problem**: API requests timing out.

**Solutions**:
```javascript
// Configure appropriate timeouts
const apiClient = axios.create({
  baseURL: 'https://your-api.com',
  timeout: 30000, // 30 seconds
  retry: 3,
  retryDelay: 1000
});

// Implement exponential backoff
const exponentialBackoff = (attempt) => {
  return Math.min(1000 * Math.pow(2, attempt), 30000);
};
```

### 2. Intermittent Network Failures

**Problem**: Random network failures causing sync issues.

**Solutions**:
```javascript
// Implement robust retry logic
const apiCallWithRetry = async (apiCall, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = exponentialBackoff(attempt);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

### 3. Offline Detection

**Problem**: App not properly detecting offline/online state.

**Solutions**:
```javascript
// React Native network detection
import NetInfo from '@react-native-async-storage/async-storage';

const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable);
    });
    
    return unsubscribe;
  }, []);
  
  return isOnline;
};
```

## Data Validation Issues

### 1. Validation Errors

**Problem**: Getting validation errors on data submission.

**Common Validation Rules**:
- Email: Must be valid email format
- Phone: Optional, but if provided must be valid format
- Name: Required, 1-255 characters
- Company: Required, 1-255 characters
- Interests: Must be array of strings
- Capture Method: Must be 'business_card' or 'event_badge'

**Example Validation**:
```javascript
const validateVisitorData = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!data.company || data.company.trim().length === 0) {
    errors.push('Company is required');
  }
  
  if (data.email && !isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }
  
  if (!['business_card', 'event_badge'].includes(data.captureMethod)) {
    errors.push('Invalid capture method');
  }
  
  return errors;
};
```

### 2. Date Format Issues

**Problem**: Date format mismatches causing validation errors.

**Solutions**:
```javascript
// Always use ISO 8601 format
const formatDateForAPI = (date) => {
  return new Date(date).toISOString();
};

// Example usage
const visitorData = {
  name: 'John Doe',
  company: 'Acme Corp',
  capturedAt: formatDateForAPI(new Date()),
  // ... other fields
};
```

## Performance Issues

### 1. Slow API Responses

**Problem**: API calls taking too long to complete.

**Diagnostic Steps**:
1. Check network connectivity
2. Verify server health at `/api/health`
3. Check for rate limiting (429 status codes)
4. Monitor request/response sizes

**Solutions**:
```javascript
// Implement request caching
const cache = new Map();

const cachedApiCall = async (url, options = {}) => {
  const cacheKey = `${url}-${JSON.stringify(options)}`;
  
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    // Cache for 5 minutes
    if (Date.now() - timestamp < 300000) {
      return data;
    }
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
};
```

### 2. Memory Issues with Large Datasets

**Problem**: App running out of memory when handling large visitor lists.

**Solutions**:
```javascript
// Implement pagination
const loadVisitorsWithPagination = async (page = 1, limit = 50) => {
  const response = await fetch(`/api/visitors?page=${page}&limit=${limit}`);
  return response.json();
};

// Implement virtual scrolling for large lists
// Use libraries like react-native-super-grid or react-window
```

## Error Code Reference

### HTTP Status Codes

- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Valid token but insufficient permissions
- **404 Not Found**: Resource doesn't exist or user doesn't have access
- **409 Conflict**: Data conflict during sync operations
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

### Custom Error Codes

- **VALIDATION_ERROR**: Input validation failed
- **AUTHENTICATION_FAILED**: Login credentials invalid
- **AUTHORIZATION_FAILED**: Insufficient permissions
- **RESOURCE_NOT_FOUND**: Requested resource not found
- **DUPLICATE_RESOURCE**: Attempting to create duplicate resource
- **RATE_LIMIT_EXCEEDED**: API rate limit exceeded
- **SYNC_CONFLICT**: Data conflict during synchronization
- **DATABASE_ERROR**: Database operation failed

## Debugging Tips

### 1. Enable Debug Logging

```javascript
// Enable detailed logging in development
if (__DEV__) {
  console.log('API Request:', {
    url,
    method,
    headers,
    body: JSON.stringify(body, null, 2)
  });
}
```

### 2. Use Correlation IDs

All API responses include a `correlationId` for tracking requests:

```javascript
const handleApiError = (error) => {
  if (error.response?.data?.error?.correlationId) {
    console.error('API Error - Correlation ID:', error.response.data.error.correlationId);
    // Include this ID when reporting issues
  }
};
```

### 3. Monitor Network Traffic

Use tools like:
- **React Native**: Flipper Network Inspector
- **Web**: Browser Developer Tools Network tab
- **API Testing**: Postman or Insomnia

### 4. Health Check Endpoint

Always check the health endpoint first when troubleshooting:

```bash
curl https://your-api.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": { "status": "healthy", "responseTime": 15 },
    "redis": { "status": "healthy", "responseTime": 5 },
    "api": { "status": "healthy", "responseTime": 2 }
  },
  "uptime": 86400,
  "version": "1.0.0"
}
```

## Getting Help

### 1. Log Analysis

When reporting issues, include:
- Correlation ID from error response
- Request/response details
- Device/platform information
- Steps to reproduce

### 2. API Documentation

- Interactive API docs: `/api/docs`
- OpenAPI specification: `/api/docs/json`
- Authentication guide: See `authentication-guide.md`

### 3. Common Solutions Checklist

Before reporting issues, verify:
- [ ] Network connectivity
- [ ] Valid authentication tokens
- [ ] Correct API endpoint URLs
- [ ] Proper request format and headers
- [ ] Rate limiting not exceeded
- [ ] Server health status
- [ ] Latest app version installed

### 4. Support Channels

For additional support:
1. Check the API health endpoint
2. Review error logs with correlation IDs
3. Consult the API documentation
4. Test with minimal reproduction case

