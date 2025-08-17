# Visitor Management API Documentation

Welcome to the Visitor Management API documentation. This directory contains comprehensive guides and examples for integrating with the API.

## Quick Start

1. **[Authentication Guide](authentication-guide.md)** - Learn how to authenticate with the API
2. **[Mobile Integration Guide](mobile-integration-guide.md)** - Complete guide for mobile app integration
3. **[Sync Examples](sync-examples.md)** - Examples for offline-to-online data synchronization
4. **[Troubleshooting Guide](troubleshooting-guide.md)** - Solutions to common integration issues

## API Reference

- **Interactive API Documentation**: Available at `/api/docs` when the server is running
- **OpenAPI Specification**: Available at `/api/docs/json`
- **[Error Codes Reference](error-codes.md)** - Complete list of error codes and meanings
- **[API Versioning](api-versioning.md)** - Information about API versions and compatibility

## Platform-Specific Guides

- **[Platform Authentication Examples](platform-auth-examples.md)** - Authentication examples for different platforms (React Native, Web, etc.)

## Architecture Overview

The Visitor Management API is built with:
- **Node.js + TypeScript** for type safety and modern JavaScript features
- **Express.js** for the REST API framework
- **PostgreSQL** for primary data storage
- **Redis** for session management and caching
- **JWT** for secure authentication with refresh token rotation

## Key Features

### Authentication & Security
- User registration and login
- JWT-based authentication with refresh tokens
- Rate limiting and abuse prevention
- Input sanitization and XSS protection
- CORS configuration for mobile apps

### Visitor Management
- Create, read, update, delete visitor records
- Bulk operations for efficient data handling
- User-scoped data access (users only see their own data)
- Rich visitor data including interests, notes, and capture methods

### Offline-to-Online Sync
- Bulk sync endpoint for mobile app data
- Conflict resolution strategies (server wins, client wins, merge)
- Partial sync success handling
- Sync tracking with local ID mapping

### Analytics & Reporting
- Daily and monthly visitor statistics
- Custom reports with flexible filtering
- Data export in CSV and JSON formats
- Caching for improved performance

### Monitoring & Operations
- Health check endpoints
- Structured logging with correlation IDs
- Prometheus metrics integration
- Error tracking and alerting

## Getting Started

### 1. Authentication

First, register a user account:

```bash
curl -X POST https://your-api.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Then login to get access tokens:

```bash
curl -X POST https://your-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

### 2. Create a Visitor

```bash
curl -X POST https://your-api.com/api/visitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Jane Smith",
    "company": "Tech Corp",
    "email": "jane@techcorp.com",
    "phone": "+1-555-0123",
    "interests": ["technology", "innovation"],
    "captureMethod": "business_card",
    "capturedAt": "2024-01-15T10:30:00.000Z"
  }'
```

### 3. Sync Offline Data

```bash
curl -X POST https://your-api.com/api/visitors/bulk-sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "operations": [
      {
        "action": "create",
        "localId": "local-123",
        "data": {
          "name": "Bob Johnson",
          "company": "StartupXYZ",
          "captureMethod": "event_badge",
          "capturedAt": "2024-01-15T09:15:00.000Z"
        }
      }
    ]
  }'
```

## Rate Limits

The API implements different rate limits for different endpoints:

- **Authentication endpoints**: 5 requests per 15 minutes
- **General API endpoints**: 100 requests per 15 minutes  
- **Sync endpoints**: 10 requests per 5 minutes

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Error Handling

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... },
    "correlationId": "abc123-def456-ghi789"
  }
}
```

Always include the `correlationId` when reporting issues for faster troubleshooting.

## Environment Setup

### Development
- API Base URL: `http://localhost:3000`
- Database: Local PostgreSQL
- Redis: Local Redis instance

### Production
- API Base URL: Your deployed API URL
- Database: Managed PostgreSQL (e.g., Supabase, AWS RDS)
- Redis: Managed Redis (e.g., Redis Cloud, AWS ElastiCache)

## Support

- **Health Check**: `GET /api/health` - Check API status
- **API Documentation**: `/api/docs` - Interactive API explorer
- **Troubleshooting**: See [troubleshooting-guide.md](troubleshooting-guide.md)
- **Error Codes**: See [error-codes.md](error-codes.md)

## Contributing

When contributing to the API:

1. Follow TypeScript best practices
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Include correlation IDs in all error responses
5. Follow the existing error response format
6. Add appropriate rate limiting for new endpoints

## Changelog

### Version 1.0.0
- Initial API release
- User authentication with JWT
- Visitor CRUD operations
- Offline-to-online sync
- Analytics and reporting
- Comprehensive documentation

---

For detailed implementation examples and troubleshooting, see the individual guide files in this directory.