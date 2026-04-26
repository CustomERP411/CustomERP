-- Record how each SDF row was created (for revision history / audit).
-- Nullable for rows created before this migration; API treats null as legacy heuristics.

ALTER TABLE sdfs
  ADD COLUMN IF NOT EXISTS change_kind VARCHAR(32);

COMMENT ON COLUMN sdfs.change_kind IS
  'initial, clarify, manual, ai_edit, regenerate, review_edit';
