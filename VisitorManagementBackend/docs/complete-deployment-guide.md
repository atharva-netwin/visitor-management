# Complete Deployment Guide: Supabase + Render.com

This comprehensive guide walks you through deploying the Visitor Management Backend using Supabase (PostgreSQL) and Render.com (hosting) on their free tiers.

## Overview

**Architecture:**
- **Database**: Supabase PostgreSQL (free tier: 500MB storage)
- **Hosting**: Render.com Web Service (free tier: 512MB RAM, 750 hours/month)
- **Caching**: Optional Redis (Upstash free tier or skip for basic deployment)

**Total Cost**: $0/month for basic usage (with limitations)

## Prerequisites

- GitHub account with your backend code
- Basic understanding of environment variables
- Command line access for testing

## Phase 1: Database Setup (Supabase)

### Step 1: Create Supabase Project

1. **Sign up and create project**
   - Go to [supabase.com](https://supabase.com)
   - Sign in with GitHub
   - Click "New Project"
   - Fill in details:
     - **Name**: `visitor-management-backend`
     - **Database Password**: Generate and save a strong password
     - **Region**: Choose closest to your users

2. **Wait for project creation** (2-3 minutes)

### Step 2: Set Up Database Schema

1. **Open SQL Editor**
   - In Supabase dashboard, click "SQL Editor"
   - Click "New query"

2. **Execute setup script**
   - Copy entire contents of `supabase-setup.sql`
   - Paste into SQL editor
   - Click "Run"

3. **Verify tables created**
   - Go to "Table Editor"
   - Confirm tables exist: `users`, `visitors`, `refresh_tokens`

### Step 3: Get Connection Details

1. **Navigate to Settings > Database**
2. **Copy connection information:**
   - **Host**: `db.your-project-ref.supabase.co`
   - **Database**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: Your project password

## Phase 2: Hosting Setup (Render.com)

### Step 1: Prepare Repository

1. **Ensure code is on GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Verify build works locally**
   ```bash
   npm run build
   npm start
   ```

### Step 2: Create Render Service

1. **Sign up for Render**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect to your GitHub repository
   - Configure service:
     - **Name**: `visitor-management-backend`
     - **Region**: Choose closest to users
     - **Branch**: `main`
     - **Root Directory**: `VisitorManagementBackend` (if in subdirectory)
     - **Runtime**: Node
     - **Build Command**: `npm ci && npm run build`
     - **Start Command**: `npm start`

### Step 3: Configure Environment Variables

1. **Go to Environment tab in your Render service**

2. **Add required variables:**

   **Database (from Supabase):**
   ```
   DB_HOST=db.your-project-ref.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=your-supabase-password
   DB_SSL=true
   ```

   **JWT Secrets (generate secure ones):**
   ```bash
   # Generate locally
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   ```
   JWT_ACCESS_SECRET=your-generated-secret-1
   JWT_REFRESH_SECRET=your-generated-secret-2
   JWT_ACCESS_EXPIRY=15m
   JWT_REFRESH_EXPIRY=7d
   ```

   **Application Config:**
   ```
   NODE_ENV=production
   PORT=3000
   BCRYPT_SALT_ROUNDS=12
   LOG_LEVEL=info
   CORS_ORIGINS=https://your-domain.com,http://localhost:3000
   ```

3. **Deploy the service**
   - Click "Create Web Service"
   - Monitor build logs for errors

## Phase 3: Testing and Verification

### Step 1: Basic Health Check

```bash
# Replace with your actual Render URL
curl https://your-service-name.onrender.com/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": { "status": "healthy" }
  }
}
```

### Step 2: Test User Registration

```bash
curl -X POST https://your-service-name.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Step 3: Test User Login

```bash
curl -X POST https://your-service-name.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**Save the JWT token from the response for next test**

### Step 4: Test Protected Endpoint

```bash
# Use token from login response
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-service-name.onrender.com/api/visitors
```

## Phase 4: Mobile App Integration

### Step 1: Update Mobile App Configuration

1. **Update API base URL in your mobile app**
   ```typescript
   // In your mobile app configuration
   const API_BASE_URL = 'https://your-service-name.onrender.com';
   ```

2. **Test authentication flow**
   - User registration from mobile app
   - User login from mobile app
   - JWT token handling

### Step 2: Test Visitor Management

1. **Create visitor from mobile app**
2. **Verify data appears in Supabase dashboard**
3. **Test offline-to-online sync**

## Phase 5: Monitoring and Maintenance

### Step 1: Set Up Monitoring

1. **Health Check Monitoring**
   - Use external service like UptimeRobot (free)
   - Monitor: `https://your-service-name.onrender.com/api/health`

2. **Log Monitoring**
   - Check Render dashboard logs regularly
   - Set up log alerts for errors

### Step 2: Performance Monitoring

1. **Monitor resource usage**
   - Check RAM usage (free tier: 512MB limit)
   - Monitor response times
   - Track database performance in Supabase

2. **Free tier limitations**
   - Service sleeps after 15 minutes of inactivity
   - 750 hours/month uptime limit
   - Cold start time: 10-30 seconds

## Phase 6: Security Hardening

### Step 1: Security Checklist

- [ ] Strong, unique JWT secrets (32+ characters)
- [ ] Database password rotated from default
- [ ] CORS configured for your domains only
- [ ] Rate limiting enabled and tested
- [ ] HTTPS enforced (automatic with Render)
- [ ] No sensitive data in logs or code

### Step 2: Regular Maintenance

1. **Monthly tasks:**
   - Review access logs
   - Check for security updates
   - Monitor resource usage

2. **Quarterly tasks:**
   - Rotate JWT secrets
   - Review and update dependencies
   - Performance optimization review

## Troubleshooting

### Common Issues

1. **Service won't start**
   - Check build logs in Render dashboard
   - Verify all environment variables are set
   - Test build locally: `npm run build && npm start`

2. **Database connection fails**
   - Verify Supabase project is not paused
   - Check connection details are correct
   - Ensure `DB_SSL=true`

3. **JWT authentication fails**
   - Verify JWT secrets are set correctly
   - Check token expiry times
   - Test token generation locally

### Getting Help

- **Render Support**: [render.com/docs](https://render.com/docs)
- **Supabase Support**: [docs.supabase.com](https://docs.supabase.com)
- **Troubleshooting Guide**: See `deployment-troubleshooting.md`

## Scaling Considerations

### When to Upgrade

**Render.com Starter Plan ($7/month):**
- Always-on service (no sleeping)
- Better performance consistency
- Recommended for production use

**Supabase Pro Plan ($25/month):**
- 8GB database storage
- Better performance
- 30-day backup retention

### Performance Optimization

1. **Database optimization**
   - Monitor slow queries in Supabase
   - Ensure indexes are used effectively
   - Implement query caching

2. **Application optimization**
   - Minimize cold start time
   - Implement response caching
   - Optimize bundle size

## Backup and Recovery

### Database Backups

- **Supabase free tier**: 7 days automatic backup retention
- **Manual backups**: Export data regularly
- **Recovery**: Use Supabase dashboard to restore

### Application Recovery

- **Deployment rollback**: Use Render dashboard
- **Configuration backup**: Keep environment variables documented
- **Code backup**: Ensure code is in version control

## Cost Optimization

### Free Tier Limits

**Supabase:**
- 500MB database storage
- 2GB bandwidth/month
- 50,000 API requests/month

**Render.com:**
- 512MB RAM
- 750 hours/month (sleeps after 15 minutes)
- 100GB bandwidth/month

### Monitoring Usage

1. **Database usage**: Monitor in Supabase dashboard
2. **Hosting usage**: Monitor in Render dashboard
3. **Set up alerts**: Before reaching limits

## Next Steps

After successful deployment:

1. **Custom domain**: Set up custom domain in Render
2. **SSL certificate**: Automatic with Render
3. **Performance testing**: Load test your API
4. **Documentation**: Update API documentation with production URLs
5. **Team access**: Share access credentials securely

## Conclusion

You now have a production-ready backend deployed on free tiers of Supabase and Render.com. The setup provides:

- ✅ PostgreSQL database with automatic backups
- ✅ RESTful API with JWT authentication
- ✅ HTTPS encryption
- ✅ Health monitoring
- ✅ Automatic deployments from GitHub
- ✅ Scalable architecture

For production use with higher traffic, consider upgrading to paid tiers for better performance and reliability.