# Visitor Management Backend

A production-ready Node.js/Express.js backend API for the Visitor Management mobile application.

## Features

- **Authentication**: JWT-based authentication with refresh tokens
- **Database**: PostgreSQL for primary data storage
- **Caching**: Redis for session management and caching
- **Security**: Comprehensive security middleware and rate limiting
- **Monitoring**: Structured logging and health checks
- **Testing**: Jest-based testing suite
- **TypeScript**: Full TypeScript support with strict type checking

## Quick Start

### Local Development

#### Prerequisites

- Node.js 18+
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (optional for development)

#### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your database credentials

5. Start the development server:
   ```bash
   npm run dev
   ```

### Production Deployment (Free Tier)

For production deployment using free cloud services:

1. **Database**: [Supabase Setup Guide](docs/supabase-setup-guide.md)
2. **Hosting**: [Render.com Deployment Guide](docs/render-deployment-guide.md)
3. **Complete Guide**: [Complete Deployment Guide](docs/complete-deployment-guide.md)

**Quick Deploy:**
- Database: Supabase PostgreSQL (free: 500MB)
- Hosting: Render.com (free: 512MB RAM, 750 hours/month)
- Total cost: $0/month

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start production server
- `npm run start:production` - Start with production initialization

### Testing
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:db-connection` - Test database connection
- `npm run health-check` - Test health endpoint

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Database
- `npm run migrate` - Run database migrations
- `npm run migrate:status` - Check migration status

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── models/          # Data models
├── routes/          # API routes
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── test/            # Test setup and utilities
```

## API Documentation

The API documentation will be available at `/api/docs` once implemented.

## Health Check

The server provides a health check endpoint at `/api/health` that returns:
- Server status
- Uptime
- Version
- Timestamp

## Documentation

### Deployment
- [Complete Deployment Guide](docs/complete-deployment-guide.md) - Full deployment walkthrough
- [Supabase Setup Guide](docs/supabase-setup-guide.md) - Database setup
- [Render.com Deployment Guide](docs/render-deployment-guide.md) - Hosting setup
- [Deployment Troubleshooting](docs/deployment-troubleshooting.md) - Common issues and solutions
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Pre-deployment verification

### API Documentation
- [API Documentation](docs/README.md) - Complete API reference
- [Authentication Guide](docs/authentication-guide.md) - JWT authentication
- [Error Codes](docs/error-codes.md) - Error handling reference
- [SDK Examples](docs/sdk-examples.md) - Integration examples

### Development
- [Development Guide](DEVELOPMENT.md) - Local development setup
- [Logging Guide](LOGGING.md) - Logging configuration
- [Monitoring Implementation](MONITORING_IMPLEMENTATION.md) - Monitoring setup

## Environment Variables

### Development
See `.env.example` for local development configuration.

### Production
- Use `.env.production.template` for production setup
- See [Complete Deployment Guide](docs/complete-deployment-guide.md) for detailed configuration

## Free Tier Deployment

This backend can be deployed completely free using:
- **Supabase**: PostgreSQL database (500MB free)
- **Render.com**: Web hosting (512MB RAM, 750 hours/month free)
- **Total cost**: $0/month for basic usage

See [Complete Deployment Guide](docs/complete-deployment-guide.md) for step-by-step instructions.

## License

MIT