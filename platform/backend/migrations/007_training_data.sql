CREATE TABLE IF NOT EXISTS training_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  quality TEXT CHECK (quality IN ('good', 'bad', 'needs_edit')),
  reviewer_notes TEXT,
  edited_output JSONB,
  is_exported BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_reviews_session ON training_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_training_reviews_quality ON training_reviews(quality);
