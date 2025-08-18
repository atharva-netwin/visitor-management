# Visitor Management API Documentation

## Overview

The Visitor Management API is a RESTful service that provides comprehensive visitor tracking and management capabilities. It supports user authentication, visitor CRUD operations, offline synchronization, analytics, and system monitoring.

**Base URL:** `https://your-api-domain.com/api`  
**API Version:** 1.0.0  
**Authentication:** Bearer Token (JWT)

## Table of Contents

1. [Authentication](#authentication)
2. [Visitors](#visitors)
3. [Synchronization](#synchronization)
4. [Analytics](#analytics)
5. [System](#system)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

### Register User

Creates a new user account with email and password authentication.

**Endpoint:** `POST /auth/register`  
**Authentication:** None required

#### Request Body

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Validation Rules

- **email**: Valid email format, required
- **password**: Minimum 8 characters, must contain uppercase, lowercase, number, and special character
- **firstName**: 1-100 characters, required
- **lastName**: 1-100 characters, required

#### Response

**Success (201):**
```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "password",
        "message": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      }
    ],
    "correlationId": "req_123456789"
  }
}
```

### Login User

Authenticates a user with email and password, returning JWT tokens.

**Endpoint:** `POST /auth/login`  
**Authentication:** None required

#### Request Body

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z",
    "lastLoginAt": "2023-01-01T10:30:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Refresh Token

Exchanges a valid refresh token for new access and refresh tokens.

**Endpoint:** `POST /auth/refresh`  
**Authentication:** None required

#### Request Body

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout User

Logs out the authenticated user and revokes their refresh tokens.

**Endpoint:** `POST /auth/logout`  
**Authentication:** Bearer Token required

#### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Get Current User

Retrieves the profile information for the currently authenticated user.

**Endpoint:** `GET /auth/me`  
**Authentication:** Bearer Token required

#### Response

**Success (200):**
```json
{
  "success": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z",
    "lastLoginAt": "2023-01-01T10:30:00.000Z"
  }
}
```

---

## Visitors

### Create Visitor

Creates a new visitor record for the authenticated user.

**Endpoint:** `POST /visitors`  
**Authentication:** Bearer Token required

#### Request Body

```json
{
  "name": "Jane Smith",
  "title": "Marketing Director",
  "company": "Tech Corp Inc.",
  "phone": "+1234567890",
  "email": "jane.smith@techcorp.com",
  "website": "https://www.techcorp.com",
  "interests": ["technology", "marketing", "innovation"],
  "notes": "Met at tech conference, interested in our new product line",
  "captureMethod": "business_card",
  "capturedAt": "2023-01-01T10:30:00.000Z",
  "localId": "local_123456"
}
```

#### Validation Rules

- **name**: 1-255 characters, required
- **title**: 0-255 characters, optional
- **company**: 1-255 characters, required
- **phone**: Valid phone format, optional
- **email**: Valid email format, optional
- **website**: Valid URL format, optional
- **interests**: Array of strings (0-20 items), required
- **notes**: 0-2000 characters, optional
- **captureMethod**: "business_card" or "event_badge", required
- **capturedAt**: ISO date string, required
- **localId**: 0-255 characters, optional

#### Response

**Success (201):**
```json
{
  "success": true,
  "visitor": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Jane Smith",
    "title": "Marketing Director",
    "company": "Tech Corp Inc.",
    "phone": "+1234567890",
    "email": "jane.smith@techcorp.com",
    "website": "https://www.techcorp.com",
    "interests": ["technology", "marketing", "innovation"],
    "notes": "Met at tech conference, interested in our new product line",
    "captureMethod": "business_card",
    "capturedAt": "2023-01-01T10:30:00.000Z",
    "createdAt": "2023-01-01T10:30:00.000Z",
    "updatedAt": "2023-01-01T10:30:00.000Z",
    "localId": "local_123456",
    "syncVersion": 1
  }
}
```

### Get All Visitors

Retrieves all visitors associated with the authenticated user with pagination and filtering.

**Endpoint:** `GET /visitors`  
**Authentication:** Bearer Token required

#### Query Parameters

- **page** (integer): Page number (default: 1)
- **limit** (integer): Items per page (default: 20, max: 100)
- **company** (string): Filter by company name (partial match)
- **captureMethod** (string): Filter by capture method ("business_card" or "event_badge")
- **interests** (array): Filter by interests (multiple values supported)
- **startDate** (string): Filter visitors captured after this date (ISO format)
- **endDate** (string): Filter visitors captured before this date (ISO format)
- **search** (string): Search in name, company, email, and notes

#### Example Request

```
GET /visitors?page=1&limit=20&company=Tech&captureMethod=business_card&interests=technology&interests=marketing&startDate=2023-01-01T00:00:00.000Z&endDate=2023-01-31T23:59:59.999Z&search=jane
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "visitors": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "userId": "123e4567-e89b-12d3-a456-426614174001",
      "name": "Jane Smith",
      "title": "Marketing Director",
      "company": "Tech Corp Inc.",
      "phone": "+1234567890",
      "email": "jane.smith@techcorp.com",
      "website": "https://www.techcorp.com",
      "interests": ["technology", "marketing", "innovation"],
      "notes": "Met at tech conference",
      "captureMethod": "business_card",
      "capturedAt": "2023-01-01T10:30:00.000Z",
      "createdAt": "2023-01-01T10:30:00.000Z",
      "updatedAt": "2023-01-01T10:30:00.000Z",
      "localId": "local_123456",
      "syncVersion": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### Get Visitor by ID

Retrieves a single visitor by their unique ID.

**Endpoint:** `GET /visitors/{id}`  
**Authentication:** Bearer Token required

#### Path Parameters

- **id** (string): Unique visitor ID (UUID format)

#### Response

**Success (200):**
```json
{
  "success": true,
  "visitor": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Jane Smith",
    "title": "Marketing Director",
    "company": "Tech Corp Inc.",
    "phone": "+1234567890",
    "email": "jane.smith@techcorp.com",
    "website": "https://www.techcorp.com",
    "interests": ["technology", "marketing", "innovation"],
    "notes": "Met at tech conference",
    "captureMethod": "business_card",
    "capturedAt": "2023-01-01T10:30:00.000Z",
    "createdAt": "2023-01-01T10:30:00.000Z",
    "updatedAt": "2023-01-01T10:30:00.000Z",
    "localId": "local_123456",
    "syncVersion": 1
  }
}
```

### Update Visitor

Updates an existing visitor record with new information.

**Endpoint:** `PUT /visitors/{id}`  
**Authentication:** Bearer Token required

#### Path Parameters

- **id** (string): Unique visitor ID (UUID format)

#### Request Body

```json
{
  "title": "Senior Marketing Director",
  "interests": ["technology", "marketing", "innovation", "AI"],
  "notes": "Updated after follow-up meeting. Very interested in AI solutions."
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "visitor": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Jane Smith",
    "title": "Senior Marketing Director",
    "company": "Tech Corp Inc.",
    "phone": "+1234567890",
    "email": "jane.smith@techcorp.com",
    "website": "https://www.techcorp.com",
    "interests": ["technology", "marketing", "innovation", "AI"],
    "notes": "Updated after follow-up meeting. Very interested in AI solutions.",
    "captureMethod": "business_card",
    "capturedAt": "2023-01-01T10:30:00.000Z",
    "createdAt": "2023-01-01T10:30:00.000Z",
    "updatedAt": "2023-01-01T11:00:00.000Z",
    "localId": "local_123456",
    "syncVersion": 2
  }
}
```

### Delete Visitor

Soft deletes a visitor record (sets deletedAt timestamp).

**Endpoint:** `DELETE /visitors/{id}`  
**Authentication:** Bearer Token required

#### Path Parameters

- **id** (string): Unique visitor ID (UUID format)

#### Response

**Success (200):**
```json
{
  "success": true
}
```

---

## Synchronization

### Bulk Sync

Processes bulk visitor operations from the mobile app for offline-to-online synchronization.

**Endpoint:** `POST /visitors/bulk-sync`  
**Authentication:** Bearer Token required  
**Rate Limit:** 10 requests per 5 minutes

#### Request Body

```json
{
  "operations": [
    {
      "action": "create",
      "localId": "local_001",
      "timestamp": "2023-01-01T10:30:00.000Z",
      "data": {
        "name": "New Contact",
        "company": "New Company",
        "interests": ["technology"],
        "captureMethod": "business_card",
        "capturedAt": "2023-01-01T10:30:00.000Z"
      }
    },
    {
      "action": "update",
      "localId": "local_002",
      "serverId": "123e4567-e89b-12d3-a456-426614174000",
      "timestamp": "2023-01-01T11:00:00.000Z",
      "data": {
        "title": "Updated Title"
      }
    },
    {
      "action": "delete",
      "localId": "local_003",
      "serverId": "123e4567-e89b-12d3-a456-426614174001",
      "timestamp": "2023-01-01T11:30:00.000Z"
    }
  ],
  "lastSyncTimestamp": "2023-01-01T09:00:00.000Z"
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "results": [
    {
      "localId": "local_001",
      "serverId": "123e4567-e89b-12d3-a456-426614174002",
      "action": "create",
      "status": "success"
    },
    {
      "localId": "local_002",
      "serverId": "123e4567-e89b-12d3-a456-426614174000",
      "action": "update",
      "status": "success"
    },
    {
      "localId": "local_003",
      "serverId": "123e4567-e89b-12d3-a456-426614174001",
      "action": "delete",
      "status": "conflict",
      "conflictData": {
        "clientData": {},
        "serverData": {
          "name": "Server Updated Name",
          "updatedAt": "2023-01-01T11:15:00.000Z"
        },
        "conflictFields": ["name", "updatedAt"]
      }
    }
  ],
  "conflicts": [
    {
      "localId": "local_003",
      "serverId": "123e4567-e89b-12d3-a456-426614174001",
      "action": "delete",
      "status": "conflict",
      "conflictData": {
        "clientData": {},
        "serverData": {
          "name": "Server Updated Name",
          "updatedAt": "2023-01-01T11:15:00.000Z"
        },
        "conflictFields": ["name", "updatedAt"]
      }
    }
  ],
  "errors": [],
  "syncTimestamp": "2023-01-01T12:00:00.000Z"
}
```

### Get Last Sync Timestamp

Retrieves the timestamp of the last successful sync for the authenticated user.

**Endpoint:** `GET /visitors/sync/timestamp`  
**Authentication:** Bearer Token required

#### Response

**Success (200):**
```json
{
  "success": true,
  "lastSyncTimestamp": "2023-01-01T12:00:00.000Z"
}
```

### Resolve Conflicts

Resolves conflicts that occurred during bulk sync operations.

**Endpoint:** `POST /visitors/sync/resolve-conflicts`  
**Authentication:** Bearer Token required

#### Request Body

```json
{
  "conflicts": [
    {
      "localId": "local_003",
      "strategy": "server_wins"
    },
    {
      "localId": "local_004",
      "strategy": "manual",
      "resolvedData": {
        "name": "Manually Resolved Name",
        "title": "Manually Resolved Title"
      }
    }
  ]
}
```

#### Response

**Success (200):**
```json
{
  "success": true,
  "resolved": [
    {
      "localId": "local_003",
      "strategy": "server_wins",
      "status": "resolved"
    },
    {
      "localId": "local_004",
      "strategy": "manual",
      "status": "resolved"
    }
  ],
  "errors": []
}
```

### Get Local ID Mappings

Retrieves mappings between local IDs (from mobile app) and server IDs.

**Endpoint:** `GET /visitors/sync/mappings`  
**Authentication:** Bearer Token required

#### Response

**Success (200):**
```json
{
  "success": true,
  "mappings": {
    "local_001": "123e4567-e89b-12d3-a456-426614174000",
    "local_002": "123e4567-e89b-12d3-a456-426614174001"
  }
}
```

---

## Analytics

### Get Daily Statistics

Retrieves comprehensive visitor statistics for a specific date.

**Endpoint:** `GET /analytics/daily/{date}`  
**Authentication:** Bearer Token required

#### Path Parameters

- **date** (string): Date in YYYY-MM-DD format

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "date": "2023-01-01",
    "totalVisitors": 25,
    "byCompany": {
      "Tech Corp Inc.": 5,
      "Innovation Labs": 3,
      "Digital Solutions": 2
    },
    "byCaptureMethod": {
      "business_card": 18,
      "event_badge": 7
    },
    "byInterests": {
      "technology": 15,
      "marketing": 8,
      "innovation": 12
    },
    "topCompanies": [
      {
        "company": "Tech Corp Inc.",
        "count": 5
      },
      {
        "company": "Innovation Labs",
        "count": 3
      }
    ],
    "topInterests": [
      {
        "interest": "technology",
        "count": 15
      },
      {
        "interest": "innovation",
        "count": 12
      }
    ]
  }
}
```

### Get Monthly Statistics

Retrieves comprehensive visitor statistics for a specific month.

**Endpoint:** `GET /analytics/monthly/{year}/{month}`  
**Authentication:** Bearer Token required

#### Path Parameters

- **year** (integer): Year (4-digit)
- **month** (integer): Month (1-12)

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "year": 2023,
    "month": 1,
    "totalVisitors": 450,
    "dailyBreakdown": [
      {
        "date": "2023-01-01",
        "count": 25
      },
      {
        "date": "2023-01-02",
        "count": 18
      }
    ],
    "byCompany": {
      "Tech Corp Inc.": 50,
      "Innovation Labs": 30
    },
    "byCaptureMethod": {
      "business_card": 320,
      "event_badge": 130
    },
    "byInterests": {
      "technology": 200,
      "marketing": 150
    },
    "topCompanies": [
      {
        "company": "Tech Corp Inc.",
        "count": 50
      }
    ],
    "topInterests": [
      {
        "interest": "technology",
        "count": 200
      }
    ],
    "averagePerDay": 14.5
  }
}
```

### Generate Custom Report

Generates a custom analytics report with flexible filtering and grouping options.

**Endpoint:** `GET /analytics/report`  
**Authentication:** Bearer Token required

#### Query Parameters

- **startDate** (string): Start date for the report (ISO format)
- **endDate** (string): End date for the report (ISO format)
- **company** (string): Filter by company name (partial match)
- **captureMethod** (string): Filter by capture method
- **interests** (array): Filter by interests (multiple values supported)
- **groupBy** (string): Group results by dimension ("day", "week", "month", "company", "interest")
- **limit** (integer): Maximum number of results (default: 100, max: 1000)
- **offset** (integer): Number of results to skip (default: 0)

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "totalVisitors": 150,
    "filteredVisitors": 75,
    "groupedData": [
      {
        "group": "2023-01-01",
        "count": 25,
        "percentage": 33.3
      },
      {
        "group": "2023-01-02",
        "count": 18,
        "percentage": 24.0
      }
    ],
    "summary": {
      "byCompany": {
        "Tech Corp Inc.": 30,
        "Innovation Labs": 20
      },
      "byCaptureMethod": {
        "business_card": 50,
        "event_badge": 25
      },
      "byInterests": {
        "technology": 40,
        "marketing": 25
      },
      "dateRange": {
        "start": "2023-01-01T00:00:00.000Z",
        "end": "2023-01-31T23:59:59.999Z"
      }
    },
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 75
    }
  }
}
```

### Export Data

Exports visitor data in CSV or JSON format with optional filtering.

**Endpoint:** `GET /analytics/export`  
**Authentication:** Bearer Token required

#### Query Parameters

- **format** (string): Export format ("csv" or "json"), required
- **startDate** (string): Start date for export (ISO format)
- **endDate** (string): End date for export (ISO format)
- **company** (string): Filter by company name (partial match)
- **captureMethod** (string): Filter by capture method
- **interests** (array): Filter by interests (multiple values supported)

#### Response

**Success (200) - CSV Format:**
```
Content-Type: text/csv

Name,Company,Email,Phone,Interests,Capture Method,Captured At
Jane Smith,Tech Corp Inc.,jane@techcorp.com,+1234567890,"technology,marketing",business_card,2023-01-01T10:30:00.000Z
```

**Success (200) - JSON Format:**
```json
{
  "success": true,
  "data": "[{\"name\":\"Jane Smith\",\"company\":\"Tech Corp Inc.\",\"email\":\"jane@techcorp.com\",\"phone\":\"+1234567890\",\"interests\":[\"technology\",\"marketing\"],\"captureMethod\":\"business_card\",\"capturedAt\":\"2023-01-01T10:30:00.000Z\"}]",
  "filename": "visitors_export_2023-01-01.json",
  "contentType": "application/json"
}
```

---

## System

### Health Check

Comprehensive health check endpoint that verifies the status of all system components.

**Endpoint:** `GET /health`  
**Authentication:** None required

#### Response

**Success (200) - Healthy:**
```json
{
  "status": "healthy",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "details": "Connected to PostgreSQL"
    },
    "redis": {
      "status": "healthy",
      "responseTime": 5,
      "details": "Connected to Redis"
    },
    "api": {
      "status": "healthy",
      "responseTime": 2,
      "details": "API responding normally"
    }
  },
  "uptime": 86400,
  "version": "1.0.0"
}
```

**Success (200) - Degraded:**
```json
{
  "status": "degraded",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15,
      "details": "Connected to PostgreSQL"
    },
    "redis": {
      "status": "degraded",
      "responseTime": 150,
      "details": "High response time"
    },
    "api": {
      "status": "healthy",
      "responseTime": 2,
      "details": "API responding normally"
    }
  },
  "uptime": 86400,
  "version": "1.0.0"
}
```

### Readiness Probe

Kubernetes/container orchestration readiness probe.

**Endpoint:** `GET /health/ready`  
**Authentication:** None required

#### Response

**Success (200):**
```json
{
  "status": "ready",
  "timestamp": "2023-01-01T12:00:00.000Z"
}
```

### Liveness Probe

Kubernetes/container orchestration liveness probe.

**Endpoint:** `GET /health/live`  
**Authentication:** None required

#### Response

**Success (200):**
```json
{
  "status": "alive",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "uptime": 86400,
  "pid": 12345
}
```

### Prometheus Metrics

Exposes application metrics in Prometheus format for monitoring and alerting.

**Endpoint:** `GET /metrics`  
**Authentication:** None required

#### Response

**Success (200):**
```
Content-Type: text/plain; version=0.0.4; charset=utf-8

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/visitors",status_code="200"} 1234

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/visitors",le="0.1"} 800

# HELP visitors_total Total number of visitors created
# TYPE visitors_total counter
visitors_total 5678
```

### Version Information

Returns version information about the API and runtime environment.

**Endpoint:** `GET /version`  
**Authentication:** None required

#### Response

**Success (200):**
```json
{
  "version": "1.0.0",
  "name": "visitor-management-backend",
  "nodeVersion": "v18.17.0",
  "environment": "production",
  "uptime": 86400,
  "timestamp": "2023-01-01T12:00:00.000Z"
}
```

---

## Data Models

### User Profile

```json
{
  "id": "string (UUID)",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "isActive": "boolean",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)",
  "lastLoginAt": "string (ISO date, optional)"
}
```

### Visitor Profile

```json
{
  "id": "string (UUID)",
  "userId": "string (UUID)",
  "name": "string",
  "title": "string (optional)",
  "company": "string",
  "phone": "string (optional)",
  "email": "string (optional)",
  "website": "string (optional)",
  "interests": "array of strings",
  "notes": "string (optional)",
  "captureMethod": "string (business_card | event_badge)",
  "capturedAt": "string (ISO date)",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)",
  "deletedAt": "string (ISO date, optional)",
  "localId": "string (optional)",
  "syncVersion": "number"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": "any (optional)",
    "correlationId": "string"
  }
}
```

---

## Error Handling

### Error Codes

- **VALIDATION_ERROR**: Request validation failed
- **AUTHENTICATION_FAILED**: Invalid credentials or token
- **AUTHORIZATION_FAILED**: Insufficient permissions
- **RESOURCE_NOT_FOUND**: Requested resource not found
- **DUPLICATE_RESOURCE**: Resource already exists
- **RATE_LIMIT_EXCEEDED**: Too many requests
- **INTERNAL_SERVER_ERROR**: Server error
- **DATABASE_ERROR**: Database operation failed
- **SYNC_CONFLICT**: Synchronization conflict detected

### HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate resource)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error
- **503**: Service Unavailable (health check failed)

---

## Rate Limiting

### Authentication Endpoints

- **Login/Register**: 5 attempts per 15 minutes per IP
- **Token Refresh**: 10 requests per minute per user

### API Endpoints

- **General API**: 100 requests per minute per user
- **Bulk Sync**: 10 requests per 5 minutes per user
- **Analytics Export**: 5 requests per hour per user

### Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Authentication

### Bearer Token

Include the access token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Expiration

- **Access Token**: 15 minutes
- **Refresh Token**: 7 days

### Token Rotation

Refresh tokens are automatically rotated on each use for enhanced security.

---

## CORS

The API supports Cross-Origin Resource Sharing (CORS) for web applications. Allowed origins are configured per environment.

## Content Types

- **Request**: `application/json`
- **Response**: `application/json` (default), `text/csv` (exports), `text/plain` (metrics)

## Pagination

List endpoints support pagination with the following parameters:

- **page**: Page number (default: 1)
- **limit**: Items per page (default: 20, max: 100)

Pagination information is included in the response:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```