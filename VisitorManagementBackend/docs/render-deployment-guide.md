# Render.com Deployment Guide

This guide walks you through deploying the Visitor Management Backend to Render.com's free tier.

## Prerequisites

- A GitHub account with your backend code pushed to a repository
- Supabase database already set up (see `supabase-setup-guide.md`)
- Basic understanding of environment variables and deployment

## Render.com Free Tier Specifications

- **RAM**: 512 MB
- **CPU**: 0.1 CPU units
- **Storage**: 1 GB disk space
- **Bandwidth**: 100 GB/month
- **Uptime**: 750 hours/month (sleeps after 15 minutes of inactivity)
- **Custom domains**: Supported
- **SSL**: Automatic HTTPS

## Step 1: Prepare Your Repository

1. **Ensure your code is on GitHub**
   ```bash
   # If not already done, push your code to GitHub
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Verify build configuration**
   - Ensure `package.json` has correct build and start scripts
   - Verify TypeScript compilation works: `npm run build`
   - Test production build locally: `npm start`

3. **Check render.yaml configuration**
   - The `render.yaml` file should be in your repository root or backend directory
   - Verify the `rootDir` path matches your project structure

## Step 2: Create Render Account and Service

1. **Sign up for Render**
   - Go to [render.com](https://render.com)
   - Click "Get Started for Free"
   - Sign up with GitHub (recommended for easy repository access)

2. **Create a new Web Service**
   - Click "New +" in the dashboard
   - Select "Web Service"
   - Choose "Build and deploy from a Git repository"
   - Click "Connect" next to your GitHub repository

3. **Configure the service**
   - **Name**: `visitor-management-backend`
   - **Region**: Choose closest to your users (e.g., Oregon, Ohio, Frankfurt)
   - **Branch**: `main`
   - **Root Directory**: `VisitorManagementBackend` (if backend is in subdirectory)
   - **Runtime**: Node
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`

## Step 3: Configure Environment Variables

1. **Navigate to Environment tab**
   - In your service dashboard, click "Environment"
   - Add the following environment variables:

2. **Required Environment Variables**

   **Database Configuration (from Supabase)**
   ```
   DB_HOST=db.your-project-ref.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=your-supabase-database-password
   DB_SSL=true
   ```

   **JWT Configuration (generate secure secrets)**
   ```bash
   # Generate secrets locally
   node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   ```
   
   ```
   JWT_ACCESS_SECRET=your-generated-access-secret
   JWT_REFRESH_SECRET=your-generated-refresh-secret
   JWT_ACCESS_EXPIRY=15m
   JWT_REFRESH_EXPIRY=7d
   ```

   **Application Configuration**
   ```
   NODE_ENV=production
   PORT=3000
   BCRYPT_SALT_ROUNDS=12
   LOG_LEVEL=info
   CORS_ORIGINS=https://your-app-domain.com,http://localhost:3000
   ```

3. **Optional Environment Variables**

   **Redis Configuration (for caching - optional for free tier)**
   ```
   REDIS_HOST=your-redis-host.com
   REDIS_PORT=6379
   REDIS_PASSWORD=your-redis-password
   ```

   **Rate Limiting (optional - uses defaults if not set)**
   ```
   RATE_LIMIT_AUTH_WINDOW_MS=900000
   RATE_LIMIT_AUTH_MAX=5
   RATE_LIMIT_API_WINDOW_MS=900000
   RATE_LIMIT_API_MAX=100
   ```

## Step 4: Deploy and Test

1. **Trigger deployment**
   - Click "Create Web Service"
   - Render will automatically start building and deploying
   - Monitor the build logs for any errors

2. **Wait for deployment**
   - First deployment takes 5-10 minutes
   - You'll see build logs in real-time
   - Service will be available at `https://your-service-name.onrender.com`

3. **Test the deployment**
   ```bash
   # Test health endpoint
   curl https://your-service-name.onrender.com/api/health
   
   # Expected response:
   {
     "status": "healthy",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "services": {
       "database": { "status": "healthy" },
       "redis": { "status": "healthy" }
     }
   }
   ```

4. **Test user registration**
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

## Step 5: Configure Auto-Deploy

1. **Enable auto-deploy**
   - In service settings, ensure "Auto-Deploy" is enabled
   - This will redeploy automatically when you push to the main branch

2. **Set up branch protection** (optional but recommended)
   - In GitHub, set up branch protection rules for main branch
   - Require pull request reviews before merging
   - Require status checks to pass

## Step 6: Custom Domain (Optional)

1. **Add custom domain**
   - In Render dashboard, go to "Settings" > "Custom Domains"
   - Click "Add Custom Domain"
   - Enter your domain (e.g., `api.yourdomain.com`)

2. **Configure DNS**
   - Add a CNAME record pointing to your Render service
   - `api.yourdomain.com` → `your-service-name.onrender.com`

3. **SSL Certificate**
   - Render automatically provisions SSL certificates
   - Your API will be available at `https://api.yourdomain.com`

## Monitoring and Maintenance

### 1. Monitor Service Health

**Render Dashboard**
- Monitor CPU, memory, and response times
- View deployment history and logs
- Set up alerts for service downtime

**Health Check Endpoint**
```bash
# Monitor your service health
curl https://your-service-name.onrender.com/api/health
```

### 2. Log Management

**View Logs**
- In Render dashboard, click "Logs" tab
- Filter by log level (info, warn, error)
- Download logs for analysis

**Log Retention**
- Free tier: 7 days of log retention
- Paid tiers: 30+ days of log retention

### 3. Performance Optimization

**Free Tier Limitations**
- Service sleeps after 15 minutes of inactivity
- Cold start time: 10-30 seconds
- Consider upgrading to paid tier for production use

**Optimization Tips**
- Implement health check pinging to keep service awake
- Use caching to reduce database queries
- Optimize bundle size and startup time

## Troubleshooting

### Common Deployment Issues

1. **Build Failures**
   ```
   Error: Cannot find module 'typescript'
   ```
   - Ensure TypeScript is in dependencies, not devDependencies
   - Or add to build command: `npm ci && npx tsc && npm start`

2. **Environment Variable Issues**
   ```
   Error: connect ECONNREFUSED
   ```
   - Verify all database environment variables are set correctly
   - Check Supabase connection details
   - Ensure DB_SSL=true for Supabase

3. **Port Binding Issues**
   ```
   Error: listen EADDRINUSE :::3000
   ```
   - Ensure your app uses `process.env.PORT`
   - Render automatically assigns a port

4. **Memory Issues**
   ```
   Error: JavaScript heap out of memory
   ```
   - Optimize memory usage in your application
   - Consider upgrading to a paid plan with more RAM

### Service Not Starting

1. **Check build logs**
   - Look for compilation errors
   - Verify all dependencies are installed

2. **Check runtime logs**
   - Look for startup errors
   - Verify database connection

3. **Test locally**
   ```bash
   # Test production build locally
   NODE_ENV=production npm run build
   NODE_ENV=production npm start
   ```

### Database Connection Issues

1. **Supabase connection**
   - Verify Supabase project is not paused
   - Check connection string format
   - Ensure SSL is enabled

2. **Network issues**
   - Render should have no issues connecting to Supabase
   - Check if Supabase has any IP restrictions

## Scaling and Upgrades

### When to Upgrade

**Upgrade to Starter Plan ($7/month) if you need:**
- Always-on service (no sleeping)
- More consistent performance
- Better for production use

**Upgrade to Standard Plan ($25/month) if you need:**
- More CPU and RAM
- Higher traffic handling
- Better performance guarantees

### Horizontal Scaling

- Render supports multiple instances
- Use load balancer for high availability
- Consider database connection pooling

## Security Considerations

1. **Environment Variables**
   - Never commit secrets to version control
   - Use Render's environment variable management
   - Rotate secrets regularly

2. **HTTPS**
   - Render provides automatic HTTPS
   - Ensure your app redirects HTTP to HTTPS

3. **CORS Configuration**
   - Set appropriate CORS origins
   - Don't use wildcard (*) in production

4. **Rate Limiting**
   - Configure appropriate rate limits
   - Monitor for abuse patterns

## Cost Management

**Free Tier Usage**
- Monitor your 750 hours/month limit
- Service sleeps automatically to conserve hours
- 100GB bandwidth should be sufficient for most APIs

**Optimization Tips**
- Implement efficient caching
- Optimize API responses
- Use compression middleware

## Next Steps

After successful deployment:

1. **Update mobile app configuration**
   - Change API base URL to your Render service
   - Test all mobile app functionality

2. **Set up monitoring**
   - Configure uptime monitoring
   - Set up error tracking
   - Monitor performance metrics

3. **Implement CI/CD**
   - Set up automated testing
   - Configure deployment notifications
   - Implement staging environment

## Support Resources

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Render Community**: [community.render.com](https://community.render.com)
- **Render Status**: [status.render.com](https://status.render.com)
- **GitHub Issues**: For application-specific issues