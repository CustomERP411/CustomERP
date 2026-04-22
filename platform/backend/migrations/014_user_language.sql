-- Add preferred_language to users for i18n (EN/TR, pluggable).
-- Existing users default to 'en' so previous behavior is preserved.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(8) NOT NULL DEFAULT 'en';

-- Allowed values guard. Keep it permissive for future locales.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_preferred_language_chk;

ALTER TABLE users
  ADD CONSTRAINT users_preferred_language_chk
  CHECK (preferred_language IN ('en', 'tr'));
