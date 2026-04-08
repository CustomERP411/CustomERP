-- Migration: 003_review_workflow
-- Extend approvals table for SDF-level review workflow with revision tracking

-- Track which SDF version the decision was made against
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS sdf_version INTEGER;

-- Store free-text revision instructions when decision = 'revision_requested'
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS revision_instructions TEXT;

-- Track the SDF version produced after an AI revision completes
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS resulting_sdf_version INTEGER;

-- module_id is already nullable in the original schema; no ALTER needed.
-- Review decisions are project-level (module_id = NULL).

-- Efficient reverse-chronological history queries per project
CREATE INDEX IF NOT EXISTS idx_approvals_project_decided
  ON approvals(project_id, decided_at DESC);
