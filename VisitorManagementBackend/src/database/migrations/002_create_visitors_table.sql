-- Migration: Create visitors table
-- Description: Creates the visitors table with all visitor information and sync tracking

CREATE TABLE visitors (
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

-- Create indexes for performance optimization
CREATE INDEX idx_visitors_user_id ON visitors(user_id);
CREATE INDEX idx_visitors_captured_at ON visitors(captured_at);
CREATE INDEX idx_visitors_company ON visitors(company);
CREATE INDEX idx_visitors_local_id ON visitors(local_id);
CREATE INDEX idx_visitors_interests ON visitors USING GIN(interests);
CREATE INDEX idx_visitors_created_at ON visitors(created_at);
CREATE INDEX idx_visitors_updated_at ON visitors(updated_at);
CREATE INDEX idx_visitors_capture_method ON visitors(capture_method);
CREATE INDEX idx_visitors_deleted_at ON visitors(deleted_at);

-- Create composite indexes for common queries
CREATE INDEX idx_visitors_user_captured ON visitors(user_id, captured_at DESC);
CREATE INDEX idx_visitors_user_company ON visitors(user_id, company);
CREATE INDEX idx_visitors_user_active ON visitors(user_id, deleted_at) WHERE deleted_at IS NULL;

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_visitors_updated_at 
    BEFORE UPDATE ON visitors 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();