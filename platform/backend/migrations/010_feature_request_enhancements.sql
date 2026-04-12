ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS user_prompt TEXT;

CREATE TABLE IF NOT EXISTS feature_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'user')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fr_messages_request ON feature_request_messages (feature_request_id);
CREATE INDEX IF NOT EXISTS idx_fr_messages_created ON feature_request_messages (feature_request_id, created_at);
