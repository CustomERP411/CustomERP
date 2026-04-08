-- Migration: 002_soft_delete
-- Add soft-delete support to projects and users tables

-- Projects: add deleted_at column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Users: add deleted_at column
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Partial index for fast listing of active (non-deleted) projects
CREATE INDEX IF NOT EXISTS idx_projects_active
  ON projects(owner_user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- Partial index for active users (login / JWT lookups)
CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(user_id)
  WHERE deleted_at IS NULL;
