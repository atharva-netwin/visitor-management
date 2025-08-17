-- Supabase Database Setup for Visitor Management Backend
-- This script creates all necessary tables, indexes, and functions for the visitor management system
-- Run this script in your Supabase SQL editor

-- Enable UUID extension (usually already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Create trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VISITORS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  company VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  interests JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  capture_method VARCHAR(20) NOT NULL CHECK (capture_method IN ('business_card', 'event_badge')),
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete timestamp
  
  -- Sync tracking fields
  local_id VARCHAR(255), -- Original ID from mobile app
  sync_version INTEGER DEFAULT 1
);

-- Create indexes for visitors table
CREATE INDEX IF NOT EXISTS idx_visitors_user_id ON visitors(user_id);
CREATE INDEX IF NOT EXISTS idx_visitors_captured_at ON visitors(captured_at);
CREATE INDEX IF NOT EXISTS idx_visitors_company ON visitors(company);
CREATE INDEX IF NOT EXISTS idx_visitors_local_id ON visitors(local_id);
CREATE INDEX IF NOT EXISTS idx_visitors_interests ON visitors USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_visitors_updated_at ON visitors(updated_at);
CREATE INDEX IF NOT EXISTS idx_visitors_capture_method ON visitors(capture_method);
CREATE INDEX IF NOT EXISTS idx_visitors_deleted_at ON visitors(deleted_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_visitors_user_captured ON visitors(user_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_user_company ON visitors(user_id, company);
CREATE INDEX IF NOT EXISTS idx_visitors_user_active ON visitors(user_id, deleted_at) WHERE deleted_at IS NULL;

-- Create trigger for visitors table
DROP TRIGGER IF EXISTS update_visitors_updated_at ON visitors;
CREATE TRIGGER update_visitors_updated_at 
    BEFORE UPDATE ON visitors 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- REFRESH TOKENS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN DEFAULT false
);

-- Create indexes for refresh_tokens table
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Create composite index for token validation queries
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(token_hash, expires_at, is_revoked) 
WHERE is_revoked = false;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables were created successfully
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN ('users', 'visitors', 'refresh_tokens')
ORDER BY tablename;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('users', 'visitors', 'refresh_tokens')
ORDER BY tablename, indexname;

-- Show table structure
\d users;
\d visitors;
\d refresh_tokens;