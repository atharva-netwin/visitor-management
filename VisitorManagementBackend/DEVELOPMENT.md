# Development Setup Guide

This guide will help you set up the Visitor Management Backend for local development.

## Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- Git

## Quick Start

1. **Clone and install dependencies**
   ```bash
   cd VisitorManagementBackend
   npm install
   ```

2. **Start development services**
   ```bash
   # Start PostgreSQL and Redis containers
   npm run docker:dev:up
   
   # Wait for services to be ready (check logs)
   npm run docker:dev:logs
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # The default values should work with Docker setup
   ```

4. **Run database migrations**
   ```bash
   # Run migrations to set up database schema
   npm run migrate
   
   # Check migration status
   npm run migrate:status
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000` with hot reloading enabled.

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build the TypeScript code
- `npm start` - Start production server

### Database
- `npm run migrate` - Run pending database migrations
- `npm run migrate:status` - Check migration status
- `npm run migrate:rollback <id>` - Rollback a specific migration

### Docker Services
- `npm run docker:dev:up` - Start PostgreSQL and Redis containers
- `npm run docker:dev:down` - Stop containers
- `npm run docker:dev:logs` - View container logs
- `npm run docker:dev:clean` - Stop containers and remove volumes

### Testing
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Environment Variables

The application uses the following environment variables (see `.env.example`):

### Server Configuration
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

### Database Configuration
- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: visitor_management)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: password)
- `DB_SSL` - Enable SSL (default: false)

### Redis Configuration
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (optional)

### JWT Configuration
- `JWT_ACCESS_SECRET` - Secret for access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `JWT_ACCESS_EXPIRY` - Access token expiry (default: 15m)
- `JWT_REFRESH_EXPIRY` - Refresh token expiry (default: 7d)

### Security Configuration
- `CORS_ORIGINS` - Allowed CORS origins (comma-separated)
- `BCRYPT_SALT_ROUNDS` - bcrypt salt rounds (default: 12)

## Database Schema

The application uses PostgreSQL with the following main tables:

- `users` - User accounts and authentication
- `visitors` - Visitor information and data
- `refresh_tokens` - JWT refresh token management
- `migrations` - Database migration tracking

## Redis Usage

Redis is used for:

- **Session Management** - User session storage and tracking
- **Refresh Tokens** - JWT refresh token storage
- **Caching** - Application data caching
- **Rate Limiting** - API rate limiting data

## Development Tools

### Database Management
- **pgAdmin** - Available at `http://localhost:8080`
  - Email: `admin@example.com`
  - Password: `admin`

### Redis Management
- **Redis Commander** - Available at `http://localhost:8081`

### API Testing
- **Health Check** - `GET http://localhost:3000/api/health`

## Testing

The project includes comprehensive tests for:

- Database connection and operations
- Redis connection and session management
- API endpoints (when implemented)
- Service layer logic

Run tests with:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL container is running: `docker ps`
2. Check container logs: `npm run docker:dev:logs`
3. Verify environment variables in `.env`
4. Test connection: `npm run migrate:status`

### Redis Connection Issues
1. Ensure Redis container is running: `docker ps`
2. Check Redis health: Visit health check endpoint
3. Verify Redis configuration in `.env`

### Migration Issues
1. Check database connection first
2. Verify migration files exist in `src/database/migrations/`
3. Check migration status: `npm run migrate:status`
4. View detailed logs in console output

### Port Conflicts
If you get port conflicts:
1. Stop conflicting services
2. Or modify ports in `docker-compose.dev.yml`
3. Update corresponding environment variables

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use proper secrets for JWT keys
3. Enable SSL for database connections
4. Configure proper CORS origins
5. Set up proper logging and monitoring
6. Use managed database services (RDS, ElastiCache)

See deployment documentation for specific cloud platform instructions.