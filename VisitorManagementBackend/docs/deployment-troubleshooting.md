# Deployment Troubleshooting Guide

This guide helps you diagnose and fix common issues when deploying the Visitor Management Backend to Render.com with Supabase.

## Common Build Issues

### 1. TypeScript Compilation Errors

**Error:**
```
error TS2307: Cannot find module '@/types' or its corresponding type declarations
```

**Solution:**
- Check `tsconfig.json` path mapping configuration
- Ensure all imports use correct relative or absolute paths
- Verify all TypeScript files are included in compilation

**Fix:**
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Fix path mapping in tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"]
    }
  }
}
```

### 2. Missing Dependencies

**Error:**
```
Error: Cannot find module 'some-package'
```

**Solution:**
- Ensure all dependencies are in `package.json`
- Check if dependency should be in `dependencies` vs `devDependencies`
- For build tools, move from `devDependencies` to `dependencies`

**Fix:**
```bash
# Install missing dependency
npm install some-package

# Move build dependency to production dependencies
npm install --save typescript @types/node
```

### 3. Build Command Failures

**Error:**
```
npm ERR! missing script: build
```

**Solution:**
- Verify `package.json` has correct build script
- Ensure build command is properly configured in Render

**Fix:**
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

## Common Runtime Issues

### 1. Port Binding Issues

**Error:**
```
Error: listen EADDRINUSE :::3000
```

**Solution:**
- Ensure your app uses `process.env.PORT`
- Render automatically assigns a port

**Fix:**
```typescript
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### 2. Database Connection Issues

**Error:**
```
Error: connect ECONNREFUSED
Error: password authentication failed for user "postgres"
```

**Solutions:**

**Check Environment Variables:**
```bash
# Verify all database variables are set
echo $DB_HOST
echo $DB_PORT
echo $DB_NAME
echo $DB_USER
# Don't echo password for security
```

**Verify Supabase Configuration:**
- Check Supabase project is not paused
- Verify connection string format
- Ensure SSL is enabled (`DB_SSL=true`)

**Test Connection Locally:**
```bash
# Test with environment variables
npm run test:db-connection
```

### 3. SSL Certificate Issues

**Error:**
```
Error: self signed certificate in certificate chain
```

**Solution:**
- Ensure `DB_SSL=true` for Supabase
- Configure SSL properly in database connection

**Fix:**
```typescript
const poolConfig: PoolConfig = {
  // ... other config
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
};
```

### 4. Memory Issues

**Error:**
```
Error: JavaScript heap out of memory
```

**Solutions:**
- Optimize memory usage in application
- Check for memory leaks
- Consider upgrading Render plan

**Debugging:**
```bash
# Monitor memory usage
node --max-old-space-size=512 dist/index.js

# Profile memory usage
node --inspect dist/index.js
```

## Environment Variable Issues

### 1. Missing Environment Variables

**Error:**
```
Error: JWT_ACCESS_SECRET is required
```

**Solution:**
- Check all required environment variables are set in Render dashboard
- Verify variable names match exactly (case-sensitive)

**Required Variables Checklist:**
```
✓ NODE_ENV=production
✓ PORT=3000
✓ DB_HOST=db.your-project-ref.supabase.co
✓ DB_PORT=5432
✓ DB_NAME=postgres
✓ DB_USER=postgres
✓ DB_PASSWORD=your-password
✓ DB_SSL=true
✓ JWT_ACCESS_SECRET=your-secret
✓ JWT_REFRESH_SECRET=your-secret
✓ CORS_ORIGINS=your-domains
```

### 2. Invalid Environment Variable Values

**Error:**
```
Error: Invalid JWT secret
```

**Solution:**
- Ensure JWT secrets are at least 32 characters
- Generate cryptographically secure secrets

**Fix:**
```bash
# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. CORS Configuration Issues

**Error:**
```
Access to fetch at 'https://your-api.onrender.com' from origin 'https://your-app.com' has been blocked by CORS policy
```

**Solution:**
- Add your domain to CORS_ORIGINS environment variable
- Use comma-separated list for multiple domains

**Fix:**
```
CORS_ORIGINS=https://your-app.com,https://www.your-app.com,http://localhost:3000
```

## Supabase-Specific Issues

### 1. Project Paused

**Error:**
```
Error: connect ETIMEDOUT
```

**Solution:**
- Supabase free tier pauses after 1 week of inactivity
- Visit Supabase dashboard to wake up project
- Consider upgrading to Pro plan for always-on database

### 2. Connection Limit Exceeded

**Error:**
```
Error: sorry, too many clients already
```

**Solution:**
- Reduce connection pool size
- Implement connection retry logic
- Monitor connection usage

**Fix:**
```typescript
const poolConfig: PoolConfig = {
  // Reduce for free tier
  min: 1,
  max: 5,
  // ... other config
};
```

### 3. Database Schema Issues

**Error:**
```
Error: relation "users" does not exist
```

**Solution:**
- Verify `supabase-setup.sql` was executed
- Check table creation in Supabase dashboard
- Re-run setup script if needed

**Verification:**
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'visitors', 'refresh_tokens');
```

## Render.com Specific Issues

### 1. Build Timeout

**Error:**
```
Build timed out after 15 minutes
```

**Solution:**
- Optimize build process
- Remove unnecessary dependencies
- Use `.dockerignore` to exclude files

**Optimization:**
```bash
# Use npm ci instead of npm install
npm ci --only=production

# Clear npm cache
npm cache clean --force
```

### 2. Service Won't Start

**Error:**
```
Service failed to start
```

**Debugging Steps:**
1. Check build logs for compilation errors
2. Check runtime logs for startup errors
3. Verify health check endpoint
4. Test locally with production environment

**Health Check Test:**
```bash
# Test health endpoint
curl https://your-service.onrender.com/api/health
```

### 3. Cold Start Issues

**Symptom:**
- First request after inactivity takes 30+ seconds
- Service appears to be "sleeping"

**Solutions:**
- This is normal for free tier (sleeps after 15 minutes)
- Implement keep-alive pinging
- Consider upgrading to paid plan

**Keep-Alive Script:**
```bash
# Ping service every 10 minutes
*/10 * * * * curl https://your-service.onrender.com/api/health
```

## Performance Issues

### 1. Slow Response Times

**Symptoms:**
- API responses take > 5 seconds
- Database queries are slow

**Solutions:**
- Check database indexes are created
- Optimize queries
- Implement caching

**Query Optimization:**
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM visitors WHERE user_id = $1;

-- Ensure indexes exist
\d visitors
```

### 2. Memory Leaks

**Symptoms:**
- Memory usage increases over time
- Service crashes with out of memory errors

**Debugging:**
```bash
# Monitor memory usage
node --inspect dist/index.js

# Use heap profiler
node --heap-prof dist/index.js
```

**Common Causes:**
- Unclosed database connections
- Event listeners not removed
- Large objects not garbage collected

## Security Issues

### 1. JWT Token Issues

**Error:**
```
Error: invalid signature
Error: jwt expired
```

**Solutions:**
- Verify JWT secrets match between environments
- Check token expiry times
- Ensure clock synchronization

**Debugging:**
```bash
# Decode JWT token (without verification)
node -e "console.log(JSON.stringify(require('jsonwebtoken').decode('your-token'), null, 2))"
```

### 2. Rate Limiting Issues

**Error:**
```
Error: Too Many Requests
```

**Solutions:**
- Check rate limiting configuration
- Verify client isn't making excessive requests
- Adjust rate limits if needed

**Configuration:**
```typescript
const rateLimits = {
  auth: { windowMs: 15 * 60 * 1000, max: 5 },
  api: { windowMs: 15 * 60 * 1000, max: 100 },
  sync: { windowMs: 5 * 60 * 1000, max: 10 }
};
```

## Monitoring and Debugging

### 1. Log Analysis

**Access Logs:**
- Render Dashboard → Your Service → Logs
- Filter by log level (error, warn, info)
- Search for specific error messages

**Common Log Patterns:**
```
ERROR: Database connection failed
WARN: Redis connection failed, continuing without cache
INFO: Server started on port 3000
```

### 2. Health Check Monitoring

**Manual Health Check:**
```bash
curl -v https://your-service.onrender.com/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" }
  },
  "uptime": 3600,
  "version": "1.0.0"
}
```

### 3. Database Monitoring

**Connection Status:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Check connection details
SELECT pid, usename, application_name, client_addr, state 
FROM pg_stat_activity 
WHERE datname = 'postgres';
```

## Recovery Procedures

### 1. Service Recovery

**If service is down:**
1. Check Render dashboard for errors
2. Review recent deployments
3. Check environment variables
4. Restart service if needed
5. Rollback to previous version if necessary

### 2. Database Recovery

**If database is inaccessible:**
1. Check Supabase dashboard
2. Verify project is not paused
3. Test connection from local environment
4. Check for maintenance windows
5. Contact Supabase support if needed

### 3. Emergency Rollback

**Steps:**
1. Go to Render dashboard
2. Navigate to your service
3. Go to "Deploys" tab
4. Click "Rollback" on last working deployment
5. Monitor service after rollback

## Getting Help

### 1. Render Support
- **Documentation**: [render.com/docs](https://render.com/docs)
- **Community**: [community.render.com](https://community.render.com)
- **Status Page**: [status.render.com](https://status.render.com)

### 2. Supabase Support
- **Documentation**: [docs.supabase.com](https://docs.supabase.com)
- **Community**: [github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
- **Status Page**: [status.supabase.com](https://status.supabase.com)

### 3. Application Support
- Check application logs first
- Review this troubleshooting guide
- Test locally with production configuration
- Create GitHub issue with detailed error information

## Prevention

### 1. Pre-deployment Testing
- Always test locally with production environment variables
- Run full test suite before deployment
- Verify database migrations work
- Test health check endpoint

### 2. Monitoring Setup
- Set up uptime monitoring
- Configure error rate alerts
- Monitor resource usage
- Track performance metrics

### 3. Documentation
- Keep environment variables documented
- Maintain deployment runbook
- Document known issues and solutions
- Update troubleshooting guide based on new issues