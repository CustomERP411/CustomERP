ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

INSERT INTO users (user_id, name, email, password_hash, is_admin, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'Admin',
  'admin@admin.com',
  '$2b$10$0Meae6taUhA.6Y4YRRsFLOhgdA4TJrfnWHILgk3j8gg5qQP5jiNxy',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;
