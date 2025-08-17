# Supabase Database Setup Guide

This guide walks you through setting up a free Supabase PostgreSQL database for the Visitor Management Backend.

## Prerequisites

- A GitHub account (for Supabase signup)
- Basic understanding of SQL and environment variables

## Step 1: Create Supabase Project

1. **Sign up for Supabase**
   - Go to [supabase.com](https://supabase.com)
   - Click "Start your project" 
   - Sign in with GitHub

2. **Create a new project**
   - Click "New Project"
   - Choose your organization (or create one)
   - Fill in project details:
     - **Name**: `visitor-management-backend`
     - **Database Password**: Generate a strong password (save this!)
     - **Region**: Choose closest to your users
     - **Pricing Plan**: Free tier (up to 500MB database, 2GB bandwidth)

3. **Wait for project creation**
   - This takes 2-3 minutes
   - You'll see a dashboard when ready

## Step 2: Configure Database

1. **Access SQL Editor**
   - In your Supabase dashboard, click "SQL Editor" in the sidebar
   - Click "New query"

2. **Run the setup script**
   - Copy the entire contents of `supabase-setup.sql`
   - Paste into the SQL editor
   - Click "Run" to execute

3. **Verify tables were created**
   - Go to "Table Editor" in the sidebar
   - You should see three tables: `users`, `visitors`, `refresh_tokens`
   - Click on each table to verify the structure

## Step 3: Get Connection Details

1. **Navigate to Settings**
   - Click "Settings" in the sidebar
   - Click "Database"

2. **Copy connection information**
   - **Host**: `db.your-project-ref.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: The password you set during project creation

3. **Get the connection string**
   - Scroll down to "Connection string"
   - Copy the "URI" format (starts with `postgresql://`)
   - This contains all connection details in one string

## Step 4: Configure Environment Variables

1. **Copy the environment template**
   ```bash
   cp .env.supabase.example .env.production
   ```

2. **Update the database configuration**
   ```env
   DB_HOST=db.your-project-ref.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=your-supabase-database-password
   DB_SSL=true
   ```

3. **Generate JWT secrets**
   ```bash
   # Generate random secrets (32+ characters each)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Configure Redis (optional for development)**
   - For development, you can use a local Redis or skip Redis features
   - For production, consider [Upstash Redis](https://upstash.com/) (free tier available)

## Step 5: Test Connection

1. **Install dependencies** (if not already done)
   ```bash
   npm install
   ```

2. **Test database connection**
   ```bash
   # Set environment variables
   export $(cat .env.production | xargs)
   
   # Run a simple connection test
   npm run test:db-connection
   ```

3. **Run migrations** (if needed)
   ```bash
   npm run migrate
   ```

## Step 6: Verify Setup

1. **Check table structure**
   - In Supabase dashboard, go to "Table Editor"
   - Verify all three tables exist with correct columns

2. **Test API endpoints**
   ```bash
   # Start the server
   npm run dev
   
   # Test health endpoint
   curl http://localhost:3000/api/health
   ```

3. **Test user registration**
   ```bash
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "TestPassword123!",
       "firstName": "Test",
       "lastName": "User"
     }'
   ```

## Supabase Free Tier Limits

- **Database**: 500MB storage
- **Bandwidth**: 2GB per month
- **API requests**: 50,000 per month
- **Authentication**: 50,000 monthly active users
- **Storage**: 1GB
- **Edge Functions**: 500,000 invocations per month

## Security Best Practices

1. **Row Level Security (RLS)**
   - Supabase enables RLS by default
   - Consider adding RLS policies for additional security
   - Our backend handles authorization, but RLS adds defense in depth

2. **Database Password**
   - Use a strong, unique password
   - Store securely (never commit to version control)
   - Consider rotating periodically

3. **Connection Security**
   - Always use SSL in production (`DB_SSL=true`)
   - Limit database access to your application only
   - Monitor connection logs in Supabase dashboard

## Monitoring and Maintenance

1. **Database Usage**
   - Monitor storage usage in Supabase dashboard
   - Set up alerts for approaching limits
   - Consider upgrading to Pro plan if needed

2. **Performance**
   - Monitor query performance in SQL Editor
   - Use EXPLAIN ANALYZE for slow queries
   - Our indexes should handle most common queries efficiently

3. **Backups**
   - Supabase automatically backs up your database
   - Free tier: 7 days of backup retention
   - Pro tier: 30 days of backup retention

## Troubleshooting

### Connection Issues

1. **SSL Certificate errors**
   ```
   Error: self signed certificate in certificate chain
   ```
   - Ensure `DB_SSL=true` in environment
   - Check if your hosting platform supports SSL connections

2. **Connection timeout**
   ```
   Error: connect ETIMEDOUT
   ```
   - Verify host and port are correct
   - Check if your hosting platform allows outbound connections
   - Ensure Supabase project is not paused (free tier pauses after 1 week of inactivity)

3. **Authentication failed**
   ```
   Error: password authentication failed
   ```
   - Double-check database password
   - Ensure no extra spaces in environment variables
   - Try resetting database password in Supabase dashboard

### Performance Issues

1. **Slow queries**
   - Check if indexes are being used: `EXPLAIN ANALYZE your_query`
   - Monitor query performance in Supabase dashboard
   - Consider adding custom indexes for your specific use cases

2. **Connection pool exhaustion**
   - Reduce max connections in pool configuration
   - Implement connection retry logic
   - Monitor connection usage

### Free Tier Limitations

1. **Database size limit reached**
   - Clean up old data (implement data retention policies)
   - Optimize data types and remove unused columns
   - Consider upgrading to Pro plan ($25/month)

2. **Bandwidth limit exceeded**
   - Implement response caching
   - Optimize API responses (remove unnecessary data)
   - Consider CDN for static assets

## Next Steps

After successfully setting up Supabase:

1. **Deploy to Render.com** - Follow the Render.com deployment guide
2. **Configure mobile app** - Update mobile app to use production API URL
3. **Set up monitoring** - Configure logging and alerting
4. **Performance testing** - Test with realistic data volumes

## Support

- **Supabase Documentation**: [docs.supabase.com](https://docs.supabase.com)
- **Supabase Community**: [github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
- **PostgreSQL Documentation**: [postgresql.org/docs](https://www.postgresql.org/docs/)