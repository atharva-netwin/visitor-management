import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Visitor Management API',
      version: '1.0.0',
      description: `
        A comprehensive backend API for the Visitor Management mobile application.
        
        ## Features
        - User authentication with JWT tokens
        - Visitor data management with CRUD operations
        - Offline-to-online data synchronization
        - Analytics and reporting
        - Rate limiting and security
        - Health monitoring
        
        ## Authentication
        Most endpoints require authentication using JWT Bearer tokens. 
        Use the /auth/login endpoint to obtain tokens.
        
        ## Rate Limits
        - Authentication endpoints: 5 requests per 15 minutes
        - General API endpoints: 100 requests per 15 minutes  
        - Sync endpoints: 10 requests per 5 minutes
        
        ## Error Handling
        All endpoints return standardized error responses with correlation IDs for debugging.
      `,
      contact: {
        name: 'API Support',
        email: 'support@visitormanagement.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.visitormanagement.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Visitors',
        description: 'Visitor management CRUD operations'
      },
      {
        name: 'Synchronization',
        description: 'Offline-to-online data synchronization endpoints'
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting endpoints'
      },
      {
        name: 'System',
        description: 'System health, monitoring, and version endpoints'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /auth/login endpoint'
        }
      },
      schemas: {
        // Error schemas
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              required: ['code', 'message', 'correlationId'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'VALIDATION_ERROR',
                    'AUTHENTICATION_FAILED', 
                    'AUTHORIZATION_FAILED',
                    'RESOURCE_NOT_FOUND',
                    'DUPLICATE_RESOURCE',
                    'RATE_LIMIT_EXCEEDED',
                    'INTERNAL_SERVER_ERROR',
                    'DATABASE_ERROR',
                    'SYNC_CONFLICT'
                  ],
                  example: 'VALIDATION_ERROR'
                },
                message: {
                  type: 'string',
                  example: 'Validation failed'
                },
                details: {
                  type: 'object',
                  description: 'Additional error details'
                },
                correlationId: {
                  type: 'string',
                  example: 'req_123456789'
                }
              }
            }
          }
        },
        
        // User schemas
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com'
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 128,
              pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]',
              example: 'SecurePass123!',
              description: 'Must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            },
            firstName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'John'
            },
            lastName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Doe'
            }
          }
        },
        
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com'
            },
            password: {
              type: 'string',
              example: 'SecurePass123!'
            }
          }
        },
        
        UserProfile: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john.doe@example.com'
            },
            firstName: {
              type: 'string',
              example: 'John'
            },
            lastName: {
              type: 'string',
              example: 'Doe'
            },
            isActive: {
              type: 'boolean',
              example: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T00:00:00.000Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T00:00:00.000Z'
            },
            lastLoginAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T00:00:00.000Z',
              nullable: true
            }
          }
        },
        
        AuthResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            user: {
              $ref: '#/components/schemas/UserProfile'
            },
            accessToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT access token (expires in 15 minutes)'
            },
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT refresh token (expires in 7 days)'
            },
            error: {
              type: 'string',
              example: 'Invalid credentials'
            }
          }
        },
        
        TokenResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            accessToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            error: {
              type: 'string',
              example: 'Invalid refresh token'
            }
          }
        },
        
        // Visitor schemas
        CreateVisitorRequest: {
          type: 'object',
          required: ['name', 'company', 'interests', 'captureMethod', 'capturedAt'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              example: 'Jane Smith'
            },
            title: {
              type: 'string',
              maxLength: 255,
              example: 'Marketing Director'
            },
            company: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              example: 'Tech Corp Inc.'
            },
            phone: {
              type: 'string',
              maxLength: 50,
              pattern: '^[\\+]?[1-9][\\d]{0,15}$',
              example: '+1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 255,
              example: 'jane.smith@techcorp.com'
            },
            website: {
              type: 'string',
              format: 'uri',
              maxLength: 500,
              example: 'https://www.techcorp.com'
            },
            interests: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 100
              },
              minItems: 0,
              maxItems: 20,
              example: ['technology', 'marketing', 'innovation']
            },
            notes: {
              type: 'string',
              maxLength: 2000,
              example: 'Met at tech conference, interested in our new product line'
            },
            captureMethod: {
              type: 'string',
              enum: ['business_card', 'event_badge'],
              example: 'business_card'
            },
            capturedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T10:30:00.000Z'
            },
            localId: {
              type: 'string',
              maxLength: 255,
              example: 'local_123456',
              description: 'Local ID from mobile app for sync purposes'
            }
          }
        },
        
        UpdateVisitorRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              example: 'Jane Smith'
            },
            title: {
              type: 'string',
              maxLength: 255,
              example: 'Senior Marketing Director'
            },
            company: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              example: 'Tech Corp Inc.'
            },
            phone: {
              type: 'string',
              maxLength: 50,
              pattern: '^[\\+]?[1-9][\\d]{0,15}$',
              example: '+1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 255,
              example: 'jane.smith@techcorp.com'
            },
            website: {
              type: 'string',
              format: 'uri',
              maxLength: 500,
              example: 'https://www.techcorp.com'
            },
            interests: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 100
              },
              minItems: 0,
              maxItems: 20,
              example: ['technology', 'marketing', 'innovation', 'AI']
            },
            notes: {
              type: 'string',
              maxLength: 2000,
              example: 'Updated notes after follow-up meeting'
            },
            captureMethod: {
              type: 'string',
              enum: ['business_card', 'event_badge'],
              example: 'business_card'
            },
            capturedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T10:30:00.000Z'
            }
          }
        },
        
        VisitorProfile: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000'
            },
            userId: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174001'
            },
            name: {
              type: 'string',
              example: 'Jane Smith'
            },
            title: {
              type: 'string',
              example: 'Marketing Director'
            },
            company: {
              type: 'string',
              example: 'Tech Corp Inc.'
            },
            phone: {
              type: 'string',
              example: '+1234567890'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'jane.smith@techcorp.com'
            },
            website: {
              type: 'string',
              format: 'uri',
              example: 'https://www.techcorp.com'
            },
            interests: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['technology', 'marketing', 'innovation']
            },
            notes: {
              type: 'string',
              example: 'Met at tech conference, interested in our new product line'
            },
            captureMethod: {
              type: 'string',
              enum: ['business_card', 'event_badge'],
              example: 'business_card'
            },
            capturedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T10:30:00.000Z'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T10:30:00.000Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T10:30:00.000Z'
            },
            deletedAt: {
              type: 'string',
              format: 'date-time',
              example: '2023-01-01T10:30:00.000Z',
              nullable: true
            },
            localId: {
              type: 'string',
              example: 'local_123456'
            },
            syncVersion: {
              type: 'integer',
              example: 1
            }
          }
        },
        
        VisitorResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            visitor: {
              $ref: '#/components/schemas/VisitorProfile'
            },
            error: {
              type: 'string',
              example: 'Visitor not found'
            }
          }
        },
        
        VisitorListResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            visitors: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/VisitorProfile'
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: {
                  type: 'integer',
                  example: 1
                },
                limit: {
                  type: 'integer',
                  example: 20
                },
                total: {
                  type: 'integer',
                  example: 100
                },
                totalPages: {
                  type: 'integer',
                  example: 5
                }
              }
            },
            error: {
              type: 'string',
              example: 'Failed to retrieve visitors'
            }
          }
        },
        
        DeleteResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            error: {
              type: 'string',
              example: 'Visitor not found'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts'
  ]
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  // Swagger UI setup
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Visitor Management API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }));

  // JSON endpoint for the OpenAPI spec
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

export { specs as swaggerSpecs };