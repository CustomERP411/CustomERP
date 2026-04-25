-- Migration: 016_answer_review
-- Add answer-reviewer payload to project_conversations so we can audit which
-- pre-distributor reviews ran, which issues were raised, and which unsupported
-- features the user acknowledged before generation continued.

ALTER TABLE project_conversations
  ADD COLUMN IF NOT EXISTS answer_review JSONB,
  ADD COLUMN IF NOT EXISTS acknowledged_unsupported_features JSONB;
