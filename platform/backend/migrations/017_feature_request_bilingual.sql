-- Plan K (Group K — Chatbot scope guard) §K4: bilingual feature_requests.
--
-- The chat scope guard now persists feature requests in TWO languages:
--   * `name_en`     — canonical English label (drives dedup with
--                     `feature_name_normalized`).
--   * `name_native` — same label in the project language at the time of
--                     submission (en/tr/...).
--   * `language`    — the project language code captured at submission so
--                     the admin / "My Requests" pages can pick the right
--                     column when re-rendering.
--
-- The legacy `feature_name` column stays as the canonical English value so
-- existing aggregate queries (`getStats`, dedup index, etc.) keep working
-- without code changes. New writes set `feature_name = name_en`.
--
-- Backfill: existing rows had only `feature_name`. We treat that as the
-- canonical English text and mirror it into both new columns. `language`
-- defaults to `'en'` because pre-Plan-K rows came from before the bilingual
-- writer existed and were authored in English by the chatbot.

ALTER TABLE feature_requests
  ADD COLUMN IF NOT EXISTS name_en      TEXT,
  ADD COLUMN IF NOT EXISTS name_native  TEXT,
  ADD COLUMN IF NOT EXISTS language     VARCHAR(10);

UPDATE feature_requests
   SET name_en     = COALESCE(name_en, feature_name),
       name_native = COALESCE(name_native, feature_name),
       language    = COALESCE(language, 'en')
 WHERE name_en IS NULL OR name_native IS NULL OR language IS NULL;
