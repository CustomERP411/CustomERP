-- Migration: 013_user_block
-- Add block/suspend support to users

ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason TEXT DEFAULT NULL;
