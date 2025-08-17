# API Versioning and Backward Compatibility

This document outlines the API versioning strategy, backward compatibility policies, and migration guidelines for the Visitor Management API.

## Versioning Strategy

### Current Version
- **API Version**: 1.0.0
- **Base URL**: `https://api.visitormanagement.com/api/`
- **OpenAPI Specification**: Available at `/api-docs.json`

### Versioning Approach

The API follows **Semantic Versioning (SemVer)** principles:

- **Major Version (X.y.z)**: Breaking changes that require client updates
- **Minor Version (x.Y.z)**: New features that are backward compatible
- **Patch Version (x.y.Z)**: Bug fixes and minor improvements

### Version Communication

1. **HTTP Headers**: Version information is included in response headers
   ```
   X-API-Version: 1.0.0
   X-API-Compatibility: 1.0.0
   ```

2. **Version Endpoint**: Get current version information
   ```
   GET /api/version
   ```

3. **OpenAPI Specification**: Version is documented in the OpenAPI spec
   ```json
   {
     "info": {
       "version": "1.0.0"
     }
   }
   ```

## Backward Compatibility Policy

### What We Guarantee

#### ✅ Backward Compatible Changes (Minor/Patch versions)
- Adding new optional fields to request/response schemas
- Adding new endpoints
- Adding new optional query parameters
- Adding new enum values (where additive)
- Improving error messages
- Performance improvements
- Bug fixes that don't change behavior

#### ❌ Breaking Changes (Major versions)
- Removing endpoints
- Removing fields from responses
- Making optional fields required
- Changing field types or formats
- Changing HTTP status codes for existing scenarios
- Changing authentication mechanisms
- Removing enum values
- Changing URL structures

### Deprecation Process

When we need to make breaking changes:

1. **Announcement**: 90 days advance notice via:
   - API documentation updates
   - Email notifications to registered developers
   - Deprecation warnings in API responses

2. **Deprecation Headers**: Deprecated endpoints return warning headers:
   ```
   Deprecation: true
   Sunset: Sat, 31 Dec 2023 23:59:59 GMT
   Link: <https://api.visitormanagement.com/docs/migration>; rel="successor-version"
   ```

3. **Migration Period**: Minimum 6 months overlap between versions

4. **Sunset**: Old version is discontinued after migration period

## Version History

### Version 1.0.0 (Current)
- **Release Date**: January 2024
- **Status**: Active
- **Features**:
  - User authentication with JWT tokens
  - Visitor CRUD operations
  - Offline-to-online synchronization
  - Analytics and reporting
  - Health monitoring

### Planned Versions

#### Version 1.1.0 (Planned - Q2 2024)
- **New Features**:
  - Bulk visitor operations
  - Advanced filtering options
  - Webhook notifications
  - Enhanced analytics
- **Backward Compatibility**: Full
- **Migration Required**: No

#### Version 1.2.0 (Planned - Q3 2024)
- **New Features**:
  - Multi-tenant support
  - Advanced user roles
  - API key authentication
  - Rate limiting per user
- **Backward Compatibility**: Full
- **Migration Required**: No

#### Version 2.0.0 (Planned - Q1 2025)
- **Breaking Changes**:
  - New authentication flow
  - Restructured response formats
  - Updated error codes
  - New URL structure
- **Migration Required**: Yes
- **Migration Guide**: Will be provided 90 days before release

## Client Implementation Guidelines

### Version Detection

Always check the API version in your client applications:

```javascript
// Check API version on startup
async function checkApiVersion() {
  const response = await fetch('/api/version');
  const version = await response.json();
  
  if (!isCompatibleVersion(version.version)) {
    console.warn('API version mismatch. Please update your client.');
  }
}

function isCompatibleVersion(apiVersion) {
  const [major, minor] = apiVersion.split('.').map(Number);
  const [clientMajor, clientMinor] = CLIENT_VERSION.split('.').map(Number);
  
  // Same major version is required
  if (major !== clientMajor) {
    return false;
  }
  
  // API minor version should be >= client minor version
  return minor >= clientMinor;
}
```

### Handling Version Changes

#### Graceful Degradation
```javascript
async function createVisitor(visitorData) {
  try {
    // Try with new field (added in v1.1.0)
    const response = await api.post('/api/visitors', {
      ...visitorData,
      tags: visitorData.tags // New field
    });
    return response.data;
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR' && error.details.some(d => d.field === 'tags')) {
      // Fallback for older API version
      const { tags, ...legacyData } = visitorData;
      const response = await api.post('/api/visitors', legacyData);
      return response.data;
    }
    throw error;
  }
}
```

#### Feature Detection
```javascript
class ApiClient {
  constructor() {
    this.features = new Set();
  }
  
  async initialize() {
    const version = await this.getVersion();
    this.detectFeatures(version);
  }
  
  detectFeatures(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    
    if (major >= 1 && minor >= 1) {
      this.features.add('bulk-operations');
      this.features.add('webhooks');
    }
    
    if (major >= 1 && minor >= 2) {
      this.features.add('multi-tenant');
      this.features.add('api-keys');
    }
  }
  
  hasFeature(feature) {
    return this.features.has(feature);
  }
}
```

### Error Handling for Version Mismatches

```javascript
function handleApiError(error) {
  switch (error.code) {
    case 'API_VERSION_MISMATCH':
      showUpdateDialog('Please update your app to continue using this service.');
      break;
      
    case 'DEPRECATED_ENDPOINT':
      console.warn(`Endpoint deprecated: ${error.message}`);
      // Continue with fallback logic
      break;
      
    case 'UNSUPPORTED_VERSION':
      showErrorDialog('This app version is no longer supported. Please update.');
      break;
  }
}
```

## Migration Guides

### Migrating from v1.0 to v1.1 (When Available)

#### New Features Available
- Bulk operations for visitors
- Webhook notifications
- Enhanced filtering

#### Code Changes Required
None - fully backward compatible

#### Recommended Updates
```javascript
// Before (v1.0)
for (const visitor of visitors) {
  await api.post('/api/visitors', visitor);
}

// After (v1.1) - More efficient
await api.post('/api/visitors/bulk', { visitors });
```

### Preparing for v2.0 Migration

#### Expected Breaking Changes
1. **Authentication**: OAuth 2.0 instead of JWT
2. **Response Format**: Standardized envelope format
3. **Error Codes**: New error code structure
4. **URLs**: RESTful resource-based URLs

#### Migration Timeline
- **90 days before**: Migration guide published
- **60 days before**: v2.0 beta available for testing
- **30 days before**: Final migration checklist
- **Release day**: v1.x deprecated, v2.0 active
- **6 months after**: v1.x sunset

## Testing Strategy

### Version Compatibility Testing

1. **Automated Tests**: Run test suite against multiple API versions
2. **Contract Testing**: Use tools like Pact for consumer-driven contracts
3. **Canary Deployments**: Gradual rollout of new versions
4. **Monitoring**: Track error rates during version transitions

### Example Test Structure
```javascript
describe('API Version Compatibility', () => {
  test('v1.0 client works with v1.1 API', async () => {
    const client = new ApiClient('1.0.0');
    const result = await client.getVisitors();
    expect(result).toBeDefined();
  });
  
  test('handles unknown fields gracefully', async () => {
    const response = await api.get('/api/visitors/123');
    // Should not break if new fields are added
    expect(response.data.id).toBeDefined();
  });
});
```

## Best Practices

### For API Consumers

1. **Version Pinning**: Specify compatible version ranges
2. **Feature Detection**: Check for feature availability
3. **Graceful Degradation**: Handle missing features elegantly
4. **Update Monitoring**: Subscribe to API change notifications
5. **Testing**: Test against multiple API versions

### For API Providers

1. **Semantic Versioning**: Follow SemVer strictly
2. **Documentation**: Keep version docs up to date
3. **Communication**: Announce changes early
4. **Monitoring**: Track version usage and errors
5. **Support**: Maintain multiple versions during transitions

## Support and Resources

### Documentation
- **Current API Docs**: `/api-docs`
- **Version History**: `/docs/changelog`
- **Migration Guides**: `/docs/migrations`

### Support Channels
- **Developer Forum**: https://forum.visitormanagement.com
- **Email Support**: api-support@visitormanagement.com
- **Status Page**: https://status.visitormanagement.com

### Tools and SDKs
- **JavaScript SDK**: Automatically handles version compatibility
- **Mobile SDKs**: iOS and Android with version management
- **Postman Collection**: Updated for each version
- **OpenAPI Generator**: Generate clients for any version