# Deployment Guide

This guide covers deploying the Visitor Management API to various cloud platforms, including free tier options.

## Quick Deploy Options

### Option 1: Supabase + Render.com (Free Tier)

This is the recommended free deployment option that provides:
- PostgreSQL database via Supabase (free tier: 500MB storage)
- API hosting via Render.com (free tier: 750 hours/month)
- Redis via Upstash (free tier: 10,000 requests/day)

#### Step 1: Set up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings > Database and copy your connection string
4. Run the database migrations:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Visitors table
CREATE TABLE visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  company VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  interests JSONB NOT NULL,
  notes TEXT,
  capture_method VARCHAR(20) NOT NULL CHECK (capture_method IN ('business_card', 'event_badge')),
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  local_id VARCHAR(255),
  sync_version INTEGER DEFAULT 1
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN DEFAULT false
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_visitors_user_id ON visitors(user_id);
CREATE INDEX idx_visitors_captured_at ON visitors(captured_at);
CREATE INDEX idx_visitors_company ON visitors(company);
CREATE INDEX idx_visitors_local_id ON visitors(local_id);
CREATE INDEX idx_visitors_interests ON visitors USING GIN(interests);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

#### Step 2: Set up Redis (Upstash)

1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a new Redis database
3. Copy the connection URL

#### Step 3: Deploy to Render.com

1. Fork this repository to your GitHub account
2. Go to [render.com](https://render.com) and create a free account
3. Create a new Web Service
4. Connect your GitHub repository
5. Configure the service:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Region**: Choose closest to your users

#### Step 4: Configure Environment Variables

In Render.com dashboard, add these environment variables:

```bash
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=your_supabase_connection_string
DB_SSL=true

# Redis
REDIS_URL=your_upstash_redis_url

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET=your_jwt_access_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS Origins (add your mobile app domains)
CORS_ORIGINS=http://localhost:3000,http://localhost:19006,exp://192.168.1.100:19000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

#### Step 5: Deploy and Test

1. Click "Deploy" in Render.com
2. Wait for deployment to complete
3. Test your API:

```bash
curl https://your-app-name.onrender.com/api/health
```

### Option 2: Railway (Alternative Free Option)

Railway offers another free tier option:

1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Add PostgreSQL and Redis plugins
4. Configure environment variables similar to Render.com
5. Deploy automatically

### Option 3: Vercel + PlanetScale (Serverless)

For a serverless deployment:

1. **Database**: Use PlanetScale (MySQL-compatible)
2. **API**: Deploy to Vercel
3. **Redis**: Use Upstash Redis

Note: Requires adapting the code for serverless functions.

## Production Deployment Options

### AWS Deployment

#### Using ECS Fargate

1. **Create ECR Repository**:
```bash
aws ecr create-repository --repository-name visitor-management-api
```

2. **Build and Push Docker Image**:
```bash
# Build image
docker build -t visitor-management-api .

# Tag for ECR
docker tag visitor-management-api:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/visitor-management-api:latest

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/visitor-management-api:latest
```

3. **Create ECS Task Definition**:
```json
{
  "family": "visitor-management-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/visitor-management-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:database-url"
        }
      ]
    }
  ]
}
```

4. **Set up RDS PostgreSQL and ElastiCache Redis**
5. **Create Application Load Balancer**
6. **Configure ECS Service**

#### Using Lambda (Serverless)

1. Use the Serverless Framework or AWS SAM
2. Adapt Express app for Lambda
3. Use RDS Proxy for database connections
4. Configure API Gateway

### Google Cloud Platform

#### Using Cloud Run

1. **Build and push to Container Registry**:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/visitor-management-api
```

2. **Deploy to Cloud Run**:
```bash
gcloud run deploy visitor-management-api \
  --image gcr.io/PROJECT_ID/visitor-management-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

3. **Set up Cloud SQL PostgreSQL**
4. **Configure Memorystore Redis**

### Azure Deployment

#### Using Container Instances

1. **Create Resource Group**:
```bash
az group create --name visitor-management --location eastus
```

2. **Create Container Instance**:
```bash
az container create \
  --resource-group visitor-management \
  --name visitor-management-api \
  --image your-registry/visitor-management-api:latest \
  --dns-name-label visitor-management-api \
  --ports 3000
```

3. **Set up Azure Database for PostgreSQL**
4. **Configure Azure Cache for Redis**

## Docker Configuration

### Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy node_modules from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source files
RUN rm -rf src/ tsconfig.json

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"]
```

### docker-compose.yml (Development)

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@db:5432/visitor_management
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=visitor_management
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Environment Variables Reference

### Required Variables

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:port/database
DB_SSL=true

# Redis
REDIS_URL=redis://user:password@host:port

# JWT
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

### Optional Variables

```bash
# CORS
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_SYNC_MAX=10

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/app.log

# Monitoring
PROMETHEUS_ENABLED=true
HEALTH_CHECK_TIMEOUT=5000

# Security
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=900000
```

## SSL/TLS Configuration

### Let's Encrypt (Free SSL)

Most cloud platforms provide automatic SSL certificates. For custom deployments:

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Configure nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring and Logging

### Health Checks

Configure health check endpoints:
- **Kubernetes**: Use liveness and readiness probes
- **Docker**: Use HEALTHCHECK instruction
- **Cloud platforms**: Configure health check URLs

### Logging

Set up centralized logging:
- **AWS**: CloudWatch Logs
- **GCP**: Cloud Logging
- **Azure**: Azure Monitor
- **Self-hosted**: ELK Stack or Grafana Loki

### Metrics

Configure metrics collection:
- **Prometheus**: Enable metrics endpoint
- **Cloud platforms**: Use native monitoring
- **APM**: New Relic, DataDog, or similar

## Security Considerations

### Production Security Checklist

- [ ] Use HTTPS everywhere
- [ ] Set strong JWT secrets
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets
- [ ] Set up database SSL
- [ ] Configure security headers
- [ ] Enable request logging
- [ ] Set up monitoring and alerting
- [ ] Use non-root user in containers
- [ ] Keep dependencies updated
- [ ] Configure firewall rules
- [ ] Set up backup strategy

### Database Security

```sql
-- Create read-only user for monitoring
CREATE USER monitoring WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE visitor_management TO monitoring;
GRANT USAGE ON SCHEMA public TO monitoring;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;

-- Create application user with limited permissions
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE visitor_management TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

## Backup and Recovery

### Database Backups

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
rm backup_$DATE.sql
```

### Disaster Recovery

1. **Database**: Set up automated backups and point-in-time recovery
2. **Application**: Use infrastructure as code (Terraform, CloudFormation)
3. **Monitoring**: Set up alerts for service degradation
4. **Documentation**: Maintain runbooks for common issues

## Performance Optimization

### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM visitors WHERE user_id = $1;

-- Create additional indexes if needed
CREATE INDEX CONCURRENTLY idx_visitors_created_at ON visitors(created_at);

-- Update table statistics
ANALYZE visitors;
```

### Application Optimization

- Enable response compression
- Implement caching strategies
- Use connection pooling
- Optimize database queries
- Monitor memory usage
- Set up CDN for static assets

## Troubleshooting Deployment Issues

### Common Issues

1. **Database Connection Errors**
   - Check connection string format
   - Verify SSL settings
   - Ensure database is accessible from app

2. **Redis Connection Errors**
   - Verify Redis URL format
   - Check network connectivity
   - Ensure Redis is running

3. **Environment Variable Issues**
   - Check variable names and values
   - Ensure secrets are properly set
   - Verify environment loading

4. **Port and Networking Issues**
   - Check port configuration
   - Verify firewall rules
   - Ensure load balancer configuration

### Debugging Commands

```bash
# Check application logs
docker logs container_name

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check health endpoint
curl https://your-api.com/api/health

# Test API endpoints
curl -X POST https://your-api.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","firstName":"Test","lastName":"User"}'
```

---

For additional support, check the [troubleshooting guide](troubleshooting-guide.md) or review the application logs for specific error messages.