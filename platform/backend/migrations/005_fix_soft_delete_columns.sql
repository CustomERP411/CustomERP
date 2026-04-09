-- Migration: 005_fix_soft_delete_columns
-- Ensure soft-delete columns exist (safety for older databases)

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Indexes to support active-record queries
CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_active
  ON projects(owner_user_id, updated_at DESC)
  WHERE deleted_at IS NULL;
