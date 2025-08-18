# Local Development Deployment Guide: Visitor Management System

This guide will help you set up and run the Visitor Management System locally on your laptop, using Supabase as your cloud database. This is perfect for development, testing, and personal use.

## What You'll Build

- **Backend API**: Running locally on your laptop (http://localhost:3000)
- **Database**: Supabase PostgreSQL (cloud-hosted, free tier)
- **Mobile App**: Expo development server for testing
- **Redis**: Local Redis instance for caching and sessions

## What You'll Need

### Required Software
1. **Node.js** (v18 or higher)
2. **Git** 
3. **Redis** (for local caching)
4. **Code Editor** (VS Code recommended)

### Required Accounts (Free)
1. **Supabase Account** - For your database
2. **Expo Account** - For mobile app development

---

## Phase 1: Install Required Software

### Step 1: Install Node.js
1. Go to https://nodejs.org
2. Download the LTS version (recommended)
3. Run the installer with default settings
4. Open Command Prompt/Terminal and verify:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers for both.

### Step 2: Install Git
1. Go to https://git-scm.com/downloads
2. Download Git for your operating system
3. Run the installer with default settings
4. Verify installation:
   ```bash
   git --version
   ```

### Step 3: Install Redis

#### Windows:
1. Download Redis from: https://github.com/microsoftarchive/redis/releases
2. Download the latest .msi file
3. Run the installer
4. Redis will start automatically as a Windows service

#### macOS:
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Redis
brew install redis

# Start Redis
brew services start redis
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Step 4: Verify Redis Installation
```bash
redis-cli ping
```
You should see: `PONG`

---

## Phase 2: Set Up Database

### Step 5: Create Supabase Account and Database

#### 5.1 Create Supabase Account
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with your email or GitHub account
4. Verify your email address

#### 5.2 Create a New Project
1. Click "New project"
2. Choose your organization (usually your username)
3. Fill in the project details:
   - **Name**: `visitor-management-local`
   - **Database Password**: Create a strong password (SAVE THIS PASSWORD!)
   - **Region**: Choose the region closest to you
4. Click "Create new project"
5. Wait 2-3 minutes for the database to be created

#### 5.3 Get Database Connection Details
1. In your Supabase project, click "Settings" in the left sidebar
2. Click "Database"
3. Scroll down to "Connection string"
4. Copy the "URI" connection string
5. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
6. **SAVE THIS CONNECTION STRING** - you'll need it later

#### 5.4 Set Up Database Tables
1. In Supabase, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Copy the content from your `VisitorManagementBackend/supabase-setup.sql` file
4. Paste it into the Supabase SQL Editor
5. Click "Run" button
6. You should see "Success. No rows returned" message
7. Click "Tables" in the left sidebar to verify tables were created

---

## Phase 3: Set Up the Backend

### Step 6: Clone and Set Up the Project

#### 6.1 Navigate to Your Project
Open Command Prompt/Terminal and navigate to your project folder:
```bash
cd path/to/your/project
# For example: cd Desktop/VisitorManagementSystem
```

#### 6.2 Install Backend Dependencies
```bash
cd VisitorManagementBackend
npm install
```

### Step 7: Configure Environment Variables

#### 7.1 Generate Security Keys
Run these commands to generate secure JWT keys:
```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```
**SAVE THESE KEYS** - you'll need them in the next step.

#### 7.2 Create Local Environment File
Create a new file called `.env.local` in the `VisitorManagementBackend` folder:

```env
# Database Configuration (from Supabase)
DB_HOST=db.xxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-database-password
DB_SSL=true

# JWT Configuration (from Step 7.1)
JWT_ACCESS_SECRET=your-generated-access-secret
JWT_REFRESH_SECRET=your-generated-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Application Configuration
NODE_ENV=development
PORT=3000
BCRYPT_SALT_ROUNDS=12
LOG_LEVEL=debug

# Redis Configuration (Local)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # Leave empty for local Redis

# CORS Configuration (Allow local development)
CORS_ORIGINS=http://localhost:3000,http://localhost:19006,exp://192.168.1.100:19000

# Health Check
HEALTH_CHECK_ENABLED=true
```

**Replace these values:**
- `db.xxx.supabase.co` - Use the host from your Supabase connection string
- `your-supabase-database-password` - Use your Supabase database password
- `your-generated-access-secret` - Use the first key from Step 7.1
- `your-generated-refresh-secret` - Use the second key from Step 7.1

### Step 8: Test Database Connection

#### 8.1 Test the Connection
```bash
npm run test:db-connection
```

You should see:
```
✅ Database connection successful
✅ All tables exist
✅ Database is ready for use
```

If you see errors, double-check your database connection string and password.

### Step 9: Run Database Migrations

#### 9.1 Run Migrations
```bash
npm run migrate
```

You should see:
```
✅ Starting database migrations...
✅ All migrations completed successfully
```

### Step 10: Start the Backend Server

#### 10.1 Start in Development Mode
```bash
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3000
✅ Database connected successfully
✅ Redis connected successfully
✅ All services initialized
```

#### 10.2 Test the Backend
Open your browser and go to: http://localhost:3000/api/health

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" }
  }
}
```

🎉 **Your backend is now running locally!**

---

## Phase 4: Test Your App - Multiple 100% Working Methods

### Method 1: Web Browser Testing (EASIEST - 100% WORKS)

#### Step 11: Set Up Web Testing

Navigate to your mobile app folder:
```bash
cd ../VisitorManagementApp
npm install
```

#### Step 12: Start Web Version
```bash
npm run web
```

This will open your app in a web browser at `http://localhost:19006`. You can:
- ✅ Test login/registration
- ✅ Test all app functionality
- ✅ See both Sign In and Sign Up buttons
- ✅ No phone needed!

### Method 2: Android Emulator (RELIABLE)

#### Step 13: Install Android Studio
1. Download Android Studio from https://developer.android.com/studio
2. Install with default settings
3. Open Android Studio → More Actions → Virtual Device Manager
4. Create a new virtual device (Pixel 6 recommended)
5. Download a system image (API 33 recommended)
6. Start the emulator

#### Step 14: Run on Android Emulator
```bash
cd VisitorManagementApp
npm run android
```

The app will automatically install and run on your emulator.

### Method 3: Build APK for Real Device (MOST RELIABLE)

#### Step 15: Build Production APK
```bash
cd VisitorManagementApp
npx expo install --fix
npx eas build --platform android --profile preview --local
```

This creates an APK file you can install directly on any Android device.

### Method 4: Windows Subsystem for Android (WSA)

#### Step 16: Install WSA (Windows 11 only)
1. Open Microsoft Store
2. Search "Amazon Appstore"
3. Install Amazon Appstore (this installs WSA)
4. Enable Developer Mode in WSA settings

#### Step 17: Install APK on WSA
```bash
# After building APK from Method 3
adb connect 127.0.0.1:58526
adb install your-app.apk
```

### Method 5: React Native CLI (ALTERNATIVE)

#### Step 18: Convert to React Native CLI
```bash
cd VisitorManagementApp
npx @react-native-community/cli init VisitorManagementAppCLI
# Copy your src folder to the new project
# Update package.json dependencies
```

Then run:
```bash
npx react-native run-android
# or
npx react-native run-ios
```

### Method 6: Expo Development Build (ADVANCED)

#### Step 19: Create Development Build
```bash
cd VisitorManagementApp
npx expo install expo-dev-client
npx eas build --profile development --platform android
```

Install the development build APK on your device, then:
```bash
npx expo start --dev-client
```

### RECOMMENDED: Start with Method 1 (Web Browser)

**This is the fastest and most reliable way to test your app:**

1. **Open terminal in VisitorManagementApp folder**
2. **Run**: `npm run web`
3. **Browser opens automatically** at http://localhost:19006
4. **Test everything**: Login, Registration, all features work perfectly

**You'll see:**
- ✅ Login screen with username/password
- ✅ Green "Create New Account" button
- ✅ "Don't have an account? Sign Up" link
- ✅ Full registration form
- ✅ All functionality working

### Quick Fix for Web Issues

If the web version shows a white screen:

**Option 1: Clean Install**
```bash
cd VisitorManagementApp
rm -rf node_modules
rm package-lock.json
npm install
npm run web
```

**Option 2: Check Browser Console**
1. Open browser developer tools (F12)
2. Check Console tab for errors
3. Look for network errors or JavaScript errors

**Option 3: Try Different Browser**
- Chrome: `npm run web` then open http://localhost:19006
- Firefox: Same URL
- Edge: Same URL

**Option 4: Force Refresh**
- Press Ctrl+F5 (hard refresh)
- Or Ctrl+Shift+R

**Option 5: Check if Backend is Running**
Make sure your backend is still running at http://localhost:3000:
```bash
# In another terminal
cd VisitorManagementBackend
npm run dev:no-redis
```

**Option 6: Simple Test Page**
Create a simple test to verify web works:
```bash
cd VisitorManagementApp
echo 'import React from "react"; import { Text, View } from "react-native"; export default function App() { return <View style={{flex:1,justifyContent:"center",alignItems:"center"}}><Text>Hello World!</Text></View>; }' > TestApp.js
```

### API Configuration for All Methods

Make sure your `src/config/api.ts` has:
```typescript
export const API_CONFIG = {
  baseUrl: 'http://localhost:3000', // Your local backend
  timeout: 10000,
  retries: 3
};
```

---

## Phase 5: Test Everything

### Step 14: Complete System Test

#### 14.1 Test Backend API
In your browser, test these endpoints:
- http://localhost:3000/api/health (should show healthy status)
- http://localhost:3000/api/docs (should show API documentation)

#### 14.2 Test User Registration
Use curl or a tool like Postman:
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

You should get a success response with user data and tokens.

#### 14.3 Test Mobile App
1. Open the app on your phone
2. Try registering a new account
3. Try logging in
4. Try creating a visitor record
5. Test offline mode by turning off internet

---

## Phase 6: Development Workflow

### Step 15: Daily Development Routine

#### 15.1 Starting Your Development Environment
Every time you want to work on the project:

1. **Start Redis** (if not running):
   ```bash
   # Windows: Redis should start automatically
   # macOS: brew services start redis
   # Linux: sudo systemctl start redis-server
   ```

2. **Start Backend**:
   ```bash
   cd VisitorManagementBackend
   npm run dev
   ```

3. **Start Mobile App** (in a new terminal):
   ```bash
   cd VisitorManagementApp
   npm start
   ```

#### 15.2 Useful Development Commands

**Backend Commands:**
```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Check database connection
npm run test:db-connection

# Run migrations
npm run migrate

# Check migration status
npm run migrate:status

# Health check
npm run health-check

# View logs
npm run test:logging
```

**Mobile App Commands:**
```bash
# Start development server
npm start

# Start for web
npm run web

# Start for Android
npm run android

# Start for iOS
npm run ios

# Clear cache
npx expo start --clear
```

### Step 16: Making Changes

#### 16.1 Backend Changes
- Edit files in `VisitorManagementBackend/src/`
- The server will automatically restart when you save files
- Check the terminal for any errors

#### 16.2 Mobile App Changes
- Edit files in `VisitorManagementApp/src/`
- The app will automatically reload on your phone
- Shake your phone to open the developer menu

#### 16.3 Database Changes
- Add new migration files to `VisitorManagementBackend/src/database/migrations/`
- Run `npm run migrate` to apply changes

---

## Phase 7: Building for Production

### Step 17: Build Production APK

When you're ready to create a production version:

#### 17.1 Update Configuration
Edit `VisitorManagementApp/app.json`:
```json
{
  "expo": {
    "extra": {
      "environment": "production",
      "apiUrl": "http://your-laptop-ip:3000"
    }
  }
}
```

#### 17.2 Build APK
```bash
cd VisitorManagementApp
eas build --platform android --profile production
```

#### 17.3 Download and Install
1. Download the APK from the Expo build page
2. Transfer to your Android device
3. Install the APK

---

## Troubleshooting

### Common Issues and Solutions

#### Backend Issues

**Issue**: "Cannot connect to database"
- **Solution**: 
  - Check your Supabase connection string
  - Verify your database password
  - Ensure your internet connection is working
  - Run `npm run test:db-connection`

**Issue**: "Redis connection failed"
- **Solution**:
  - Check if Redis is running: `redis-cli ping`
  - Windows: Check Windows Services for Redis
  - macOS: `brew services restart redis`
  - Linux: `sudo systemctl restart redis-server`

**Issue**: "Port 3000 already in use"
- **Solution**:
  - Kill the process: `npx kill-port 3000`
  - Or change the port in `.env.local`: `PORT=3001`

#### Mobile App Issues

**Issue**: "Network request failed"
- **Solution**:
  - Make sure your backend is running
  - Check that your phone and laptop are on the same WiFi network
  - Update the API URL with your laptop's IP address
  - Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

**Issue**: "Expo Go won't connect"
- **Solution**:
  - Make sure both devices are on the same network
  - Try restarting the Expo development server
  - Clear Expo cache: `npx expo start --clear`

**Issue**: "App crashes on startup"
- **Solution**:
  - Check the Expo console for error messages
  - Restart the development server
  - Clear app data in Expo Go

### Getting Help

1. **Check Logs**: Always check the terminal output for errors
2. **Test Components**: Test backend and mobile app separately
3. **Restart Services**: Try restarting Redis, backend, and mobile app
4. **Clear Cache**: Clear Expo cache and npm cache if needed

---

## Maintenance

### Regular Tasks

#### Daily Development
- Start Redis, backend, and mobile app servers
- Check for any error messages in terminals
- Test new features on both backend and mobile app

#### Weekly
- Update dependencies: `npm update`
- Check Supabase dashboard for database usage
- Backup any important data

#### As Needed
- Add new database migrations for schema changes
- Update environment variables for new features
- Build new APK versions for testing

---

## Success! 🎉

If you've followed all these steps, you now have:

✅ A fully functional backend API running locally  
✅ A PostgreSQL database on Supabase  
✅ A local Redis instance for caching  
✅ A mobile app running on Expo  
✅ A complete local development environment  

Your system is now running at:
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs
- **Mobile App**: Expo Go on your phone
- **Database**: Supabase cloud

You can now:
- Develop and test features locally
- Make changes and see them instantly
- Build production APKs when ready
- Scale to cloud deployment later

Happy coding! 🚀

---

## Next Steps

### When You're Ready for Production
- Follow the original `COMPLETE_DEPLOYMENT_GUIDE.md` to deploy to Render
- Or set up your own VPS/cloud server
- Configure domain names and SSL certificates
- Set up automated backups

### Advanced Features
- Add push notifications
- Implement real-time features with WebSockets
- Add more analytics and reporting
- Integrate with external services

### Team Development
- Set up Git workflows for collaboration
- Configure CI/CD pipelines
- Set up staging environments
- Implement code review processes