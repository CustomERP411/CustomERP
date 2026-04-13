CREATE TABLE IF NOT EXISTS training_step_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  quality TEXT CHECK (quality IN ('good', 'bad', 'needs_edit')),
  reviewer_notes TEXT,
  corrective_instruction TEXT,
  edited_output JSONB,
  is_exported BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, agent)
);

CREATE INDEX IF NOT EXISTS idx_training_step_reviews_session ON training_step_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_training_step_reviews_agent ON training_step_reviews(agent);
CREATE INDEX IF NOT EXISTS idx_training_step_reviews_quality ON training_step_reviews(quality);
