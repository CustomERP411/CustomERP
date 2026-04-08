-- Migration: 004_mode_and_conversations
-- Add server-side mode tracking and pre-build conversation persistence

-- Track current project mode (chat or build)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'chat';

-- Structured snapshot of pre-build conversation context, linked to the SDF it produced
CREATE TABLE IF NOT EXISTS project_conversations (
    conversation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    sdf_version INTEGER,
    mode VARCHAR(20),
    business_answers JSONB,
    selected_modules JSONB,
    access_requirements JSONB,
    description_snapshot TEXT,
    default_question_answers JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_conversations_project
  ON project_conversations(project_id, created_at DESC);
