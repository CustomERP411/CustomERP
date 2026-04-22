-- Add language to projects: locked at creation time, drives AI prompts and
-- generated ERP language. Existing projects default to 'en'.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS language VARCHAR(8) NOT NULL DEFAULT 'en';

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_language_chk;

ALTER TABLE projects
  ADD CONSTRAINT projects_language_chk
  CHECK (language IN ('en', 'tr'));
