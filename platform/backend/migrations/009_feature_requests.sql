CREATE TABLE IF NOT EXISTS feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  feature_name_normalized TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('chatbot', 'sdf_generation')),
  source_detail TEXT,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'denied', 'in_progress', 'completed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_requests_dedup
  ON feature_requests (feature_name_normalized, user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'));

CREATE INDEX IF NOT EXISTS idx_feature_requests_user ON feature_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests (status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_name ON feature_requests (feature_name_normalized);
