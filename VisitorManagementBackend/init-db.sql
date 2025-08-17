-- Initialize database for development
-- This script runs when the PostgreSQL container starts for the first time

-- Create the database if it doesn't exist (this is handled by POSTGRES_DB env var)
-- But we can add any additional setup here

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a test user for development (optional)
-- CREATE USER visitor_app WITH PASSWORD 'app_password';
-- GRANT ALL PRIVILEGES ON DATABASE visitor_management TO visitor_app;