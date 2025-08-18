-- Mark existing migrations as completed since tables already exist from Supabase setup
-- Run this in your Supabase SQL Editor

INSERT INTO migrations (id, filename) VALUES 
(1, '001_create_users_table.sql'),
(2, '002_create_visitors_table.sql'),
(3, '003_create_refresh_tokens_table.sql')
ON CONFLICT (id) DO NOTHING;

-- Verify the migrations were marked as complete
SELECT * FROM migrations ORDER BY id;