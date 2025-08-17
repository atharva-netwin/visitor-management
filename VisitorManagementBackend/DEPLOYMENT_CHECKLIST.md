# Deployment Checklist

Use this checklist to ensure a successful deployment to Render.com with Supabase.

## Pre-Deployment Checklist

### 1. Code Preparation
- [ ] All code committed and pushed to GitHub main branch
- [ ] Build passes locally: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] No sensitive data in code (passwords, secrets, etc.)

### 2. Database Setup (Supabase)
- [ ] Supabase project created
- [ ] Database password saved securely
- [ ] `supabase-setup.sql` script executed successfully
- [ ] All tables created (users, visitors, refresh_tokens)
- [ ] Database connection tested locally
- [ ] Database indexes verified

### 3. Environment Configuration
- [ ] JWT secrets generated (32+ characters each)
- [ ] CORS origins configured for your domains
- [ ] Redis configuration prepared (if using)
- [ ] All required environment variables documented

## Deployment Steps

### 1. Render.com Setup
- [ ] Render account created and connected to GitHub
- [ ] Web service created and connected to repository
- [ ] Build and start commands configured
- [ ] Health check path set to `/api/health`

### 2. Environment Variables Configuration
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] Database variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- [ ] `DB_SSL=true`
- [ ] JWT secrets (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)
- [ ] JWT expiry times (JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY)
- [ ] CORS origins (CORS_ORIGINS)
- [ ] `BCRYPT_SALT_ROUNDS=12`
- [ ] `LOG_LEVEL=info`
- [ ] Redis variables (if using): REDIS_HOST, REDIS_PORT, REDIS_PASSWORD

### 3. Deployment Verification
- [ ] Build completes successfully
- [ ] Service starts without errors
- [ ] Health check endpoint responds: `GET /api/health`
- [ ] Database connection verified
- [ ] Redis connection verified (if configured)

## Post-Deployment Testing

### 1. API Endpoints Testing
- [ ] Health check: `GET /api/health`
- [ ] User registration: `POST /api/auth/register`
- [ ] User login: `POST /api/auth/login`
- [ ] Protected endpoint access with JWT token
- [ ] Visitor creation: `POST /api/visitors`
- [ ] Visitor retrieval: `GET /api/visitors`

### 2. Security Testing
- [ ] HTTPS enforced (automatic with Render)
- [ ] CORS headers present and correct
- [ ] Rate limiting working
- [ ] JWT token validation working
- [ ] Password hashing working (bcrypt)

### 3. Performance Testing
- [ ] Response times acceptable (< 2 seconds for most endpoints)
- [ ] Database queries optimized
- [ ] Memory usage within limits (< 400MB for free tier)
- [ ] No memory leaks detected

## Monitoring Setup

### 1. Health Monitoring
- [ ] Health check endpoint monitored
- [ ] Uptime monitoring configured (external service)
- [ ] Error rate monitoring
- [ ] Response time monitoring

### 2. Logging
- [ ] Application logs visible in Render dashboard
- [ ] Error logs captured and searchable
- [ ] Log levels appropriate for production
- [ ] No sensitive data in logs

### 3. Alerts
- [ ] Service down alerts configured
- [ ] High error rate alerts
- [ ] Performance degradation alerts
- [ ] Database connection failure alerts

## Mobile App Integration

### 1. API Configuration
- [ ] Mobile app API base URL updated to Render service URL
- [ ] API endpoints tested from mobile app
- [ ] Authentication flow tested end-to-end
- [ ] Offline sync tested with production backend

### 2. Testing
- [ ] User registration from mobile app
- [ ] User login from mobile app
- [ ] Visitor creation and sync
- [ ] Offline-to-online sync functionality
- [ ] Error handling for network issues

## Security Hardening

### 1. Environment Security
- [ ] All secrets stored as environment variables (not in code)
- [ ] Database password rotated from default
- [ ] JWT secrets are cryptographically secure
- [ ] No debug information exposed in production

### 2. API Security
- [ ] Rate limiting configured and tested
- [ ] Input validation working
- [ ] SQL injection protection verified
- [ ] XSS protection headers present

### 3. Database Security
- [ ] Database accessible only from application
- [ ] SSL/TLS encryption enabled
- [ ] No default passwords used
- [ ] Backup and recovery plan in place

## Performance Optimization

### 1. Application Performance
- [ ] Database connection pooling configured
- [ ] Query optimization verified
- [ ] Response compression enabled
- [ ] Caching implemented where appropriate

### 2. Resource Usage
- [ ] Memory usage optimized for free tier (< 400MB)
- [ ] CPU usage efficient
- [ ] Startup time minimized
- [ ] Cold start performance acceptable

## Backup and Recovery

### 1. Database Backups
- [ ] Supabase automatic backups verified (7 days retention on free tier)
- [ ] Backup restoration process tested
- [ ] Critical data export capability verified

### 2. Application Recovery
- [ ] Deployment rollback process documented
- [ ] Configuration backup maintained
- [ ] Recovery time objectives defined

## Documentation

### 1. Deployment Documentation
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Troubleshooting guide created
- [ ] API documentation updated with production URLs

### 2. Operational Documentation
- [ ] Monitoring procedures documented
- [ ] Incident response procedures
- [ ] Maintenance procedures
- [ ] Contact information for support

## Final Verification

### 1. End-to-End Testing
- [ ] Complete user journey tested (registration → login → visitor management)
- [ ] Mobile app integration fully functional
- [ ] All critical features working
- [ ] Performance meets requirements

### 2. Production Readiness
- [ ] Service stable for 24+ hours
- [ ] No critical errors in logs
- [ ] Resource usage within acceptable limits
- [ ] Monitoring and alerts functioning

### 3. Team Handoff
- [ ] Operations team briefed
- [ ] Documentation shared
- [ ] Access credentials provided
- [ ] Support procedures established

## Rollback Plan

If deployment fails or issues are discovered:

1. **Immediate Actions**
   - [ ] Revert to previous working deployment
   - [ ] Notify stakeholders
   - [ ] Document issues encountered

2. **Investigation**
   - [ ] Analyze logs for root cause
   - [ ] Test fixes in staging environment
   - [ ] Update deployment checklist based on learnings

3. **Re-deployment**
   - [ ] Address identified issues
   - [ ] Re-run full checklist
   - [ ] Monitor closely after re-deployment

## Notes

- Free tier limitations: 512MB RAM, sleeps after 15 minutes of inactivity
- Consider upgrading to paid tier for production use
- Monitor usage to avoid hitting free tier limits
- Keep this checklist updated based on deployment experiences