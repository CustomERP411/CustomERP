/* Quick smoke test for the SQLite seeder shim.
 *
 *  Verifies that the SQL patterns the dev-mode seeder issues
 *  (after the shim's translation) all run cleanly against a real
 *  better-sqlite3 database.
 *
 *  Run from the repo root:
 *      node test/_smoke_sqlite_seeder_shim.js
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

// Find a better-sqlite3 install we can use. Prefer one already installed
// in this repo (none of the platform deps install it, so this falls back
// to the existing generated/<id>/backend or a freshly-resolved global).
function loadDatabase() {
  const tryRequireFrom = (dir) => {
    try { return require(path.join(dir, 'better-sqlite3')); } catch { return null; }
  };
  // 1. Most generated standalone bundles drop better-sqlite3 in <bundle>/app/node_modules.
  //    For this smoke test we only need it locally — let the developer pre-install it
  //    via `npm install better-sqlite3` if it's not on the resolution path.
  try { return require('better-sqlite3'); } catch (_) { /* keep trying */ }
  for (const dir of [path.join(__dirname, '..', 'platform', 'backend', 'node_modules'),
                     path.join(__dirname, '..', 'platform', 'frontend', 'node_modules')]) {
    const m = tryRequireFrom(dir);
    if (m) return m;
  }
  console.error('better-sqlite3 is not installed. Run `npm install better-sqlite3` and retry.');
  process.exit(2);
}
const Database = loadDatabase();

// Inline the shim from scripts/seed-mock-data-sqlite.template.js so we can
// exercise it without spinning up the whole seeder. Keep this in sync.
function buildShim(_db) {
  function translateSqlForSqlite(text, values) {
    let sql = String(text);
    const params = Array.isArray(values) ? values.slice() : [];
    sql = sql.replace(/::\s*[a-zA-Z_][a-zA-Z0-9_]*/g, '');
    if (/information_schema\.columns/i.test(sql)) {
      return { kind: 'columns', tableName: params[0] };
    }
    if (/information_schema\.tables/i.test(sql)) {
      return { kind: 'tables' };
    }
    const truncMatch = sql.match(/^\s*TRUNCATE\s+(.+?)\s+RESTART\s+IDENTITY\s+CASCADE\s*;?\s*$/i);
    if (truncMatch) {
      const list = truncMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
      return { kind: 'truncate', tables: list };
    }
    sql = sql.replace(/\$\d+/g, '?');
    return { kind: 'sql', sql, params };
  }
  function pgIsNullableFromPragma(r) { return Number(r.notnull) === 0 ? 'YES' : 'NO'; }
  function pgDataTypeFromPragma(r) {
    const raw = String(r.type || '').toUpperCase();
    if (!raw) return 'text';
    if (raw.includes('INT')) return 'integer';
    if (raw.includes('REAL') || raw.includes('FLOA') || raw.includes('DOUB')) return 'double precision';
    if (raw.includes('NUMERIC') || raw.includes('DECIMAL')) return 'numeric';
    if (raw.includes('BOOL')) return 'boolean';
    if (raw.includes('JSON')) return 'jsonb';
    if (raw.includes('DATE') && !raw.includes('TIME')) return 'date';
    if (raw.includes('TIMESTAMP') || raw.includes('DATETIME')) return 'timestamp without time zone';
    return 'text';
  }
  return {
    async query(text, values) {
      const plan = translateSqlForSqlite(text, values);
      if (plan.kind === 'columns') {
        const slug = String(plan.tableName || '');
        const rows = _db.prepare(`PRAGMA table_info("${slug.replace(/"/g, '""')}")`).all();
        return {
          rows: rows.map((r) => ({
            column_name: r.name,
            data_type: pgDataTypeFromPragma(r),
            is_nullable: pgIsNullableFromPragma(r),
            column_default: r.dflt_value === undefined ? null : r.dflt_value,
          })),
        };
      }
      if (plan.kind === 'tables') {
        return { rows: _db.prepare(`SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() };
      }
      if (plan.kind === 'truncate') {
        const tx = _db.transaction(() => {
          for (const t of plan.tables) _db.prepare(`DELETE FROM ${t}`).run();
        });
        tx();
        return { rows: [] };
      }
      const safe = plan.params.map((v) => {
        if (v === undefined) return null;
        if (v === null) return v;
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return String(v); } }
        return v;
      });
      const t = plan.sql.trim().toLowerCase();
      const stmt = _db.prepare(plan.sql);
      if (t.startsWith('select') || / returning /i.test(plan.sql)) {
        return { rows: stmt.all(...safe) };
      }
      const info = stmt.run(...safe);
      return { rows: [], rowCount: info.changes };
    },
    async end() { try { _db.close(); } catch {} },
  };
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-shim-test-'));
  const dbPath = path.join(tmp, 'erp.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  // Mimic an assembler-emitted entity table so we can exercise the
  // realistic SQL shapes.
  db.exec(`
    CREATE TABLE IF NOT EXISTS "stock_articles" (
      id              TEXT PRIMARY KEY,
      sku             TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      quantity        INTEGER NOT NULL DEFAULT 0,
      price           NUMERIC NOT NULL DEFAULT 0,
      is_active       INTEGER DEFAULT 1,
      meta            TEXT,                                   -- "jsonb-mapped"
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "stock_movements" (
      id              TEXT PRIMARY KEY,
      article_id      TEXT NOT NULL,
      delta           INTEGER NOT NULL,
      occurred_at     TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
  `);

  const pool = buildShim(db);
  let pass = 0;
  let fail = 0;
  const ok = (label) => { pass++; console.log(`✓ ${label}`); };
  const ko = (label, e) => { fail++; console.log(`✗ ${label}: ${e && e.message ? e.message : e}`); };

  try {
    // 1. information_schema.columns translation
    const cols = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
       ORDER BY ordinal_position`,
      ['stock_articles']
    );
    assert(cols.rows.length === 9, `expected 9 columns, got ${cols.rows.length}`);
    const skuCol = cols.rows.find((c) => c.column_name === 'sku');
    assert(skuCol && skuCol.data_type === 'text' && skuCol.is_nullable === 'NO', 'sku column shape wrong');
    ok('information_schema.columns -> PRAGMA table_info');
  } catch (e) { ko('information_schema.columns -> PRAGMA table_info', e); }

  try {
    // 2. information_schema.tables translation
    const tabs = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    );
    const names = tabs.rows.map((r) => r.table_name).sort();
    assert(names.includes('stock_articles') && names.includes('stock_movements'), 'tables list missing entries');
    ok('information_schema.tables -> sqlite_master');
  } catch (e) { ko('information_schema.tables -> sqlite_master', e); }

  try {
    // 3. INSERT ... RETURNING * with $-placeholders + JSON object payload
    const now = new Date().toISOString();
    const res = await pool.query(
      `INSERT INTO "stock_articles" ("id","sku","name","quantity","price","is_active","meta","created_at","updated_at")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      ['a1', 'AA100-10-R', 'Premium Widget', 50, 12.5, true, JSON.stringify({ tags: ['demo'] }), now, now]
    );
    assert(res.rows.length === 1, 'no row returned from INSERT RETURNING *');
    assert(res.rows[0].id === 'a1', `wrong id: ${res.rows[0].id}`);
    assert(res.rows[0].is_active === 1, 'boolean true should bind as 1');
    ok('INSERT ... RETURNING * with $-placeholders, boolean, and JSON object');
  } catch (e) { ko('INSERT ... RETURNING * with $-placeholders, boolean, and JSON object', e); }

  try {
    // 4. SELECT COUNT(*)::int AS n FROM "..."  (the ::int strip)
    const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM "stock_articles"`);
    assert(cnt.rows.length === 1 && cnt.rows[0].n === 1, `count expected 1, got ${cnt.rows[0] && cnt.rows[0].n}`);
    ok('SELECT COUNT(*)::int AS n  (strip ::int)');
  } catch (e) { ko('SELECT COUNT(*)::int AS n  (strip ::int)', e); }

  try {
    // 5. UPDATE with $N placeholders
    const now = new Date().toISOString();
    await pool.query(
      `UPDATE "stock_articles" SET "quantity" = $1, "updated_at" = $2 WHERE "id" = $3`,
      [99, now, 'a1']
    );
    const row = (await pool.query(`SELECT quantity FROM "stock_articles" WHERE id = $1`, ['a1'])).rows[0];
    assert(row.quantity === 99, `expected 99, got ${row.quantity}`);
    ok('UPDATE with $-placeholders');
  } catch (e) { ko('UPDATE with $-placeholders', e); }

  try {
    // 6. TRUNCATE multi-table RESTART IDENTITY CASCADE
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO "stock_movements" (id, article_id, delta, occurred_at, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      ['m1', 'a1', 5, now, now, now]
    );
    await pool.query(`TRUNCATE "stock_articles", "stock_movements" RESTART IDENTITY CASCADE`);
    const a = (await pool.query(`SELECT COUNT(*)::int AS n FROM "stock_articles"`)).rows[0].n;
    const m = (await pool.query(`SELECT COUNT(*)::int AS n FROM "stock_movements"`)).rows[0].n;
    assert(a === 0 && m === 0, `truncate left rows behind: stock_articles=${a} stock_movements=${m}`);
    ok('TRUNCATE list RESTART IDENTITY CASCADE');
  } catch (e) { ko('TRUNCATE list RESTART IDENTITY CASCADE', e); }

  try {
    // 7. Repeated INSERT to confirm the prepared-statement path is reusable
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      await pool.query(
        `INSERT INTO "stock_articles" ("id","sku","name","quantity","price","is_active","meta","created_at","updated_at")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [`x${i}`, `BB${100 + i}-01-R`, `Item ${i}`, i, i + 0.5, false, JSON.stringify({ i }), now, now]
      );
    }
    const cnt = (await pool.query(`SELECT COUNT(*)::int AS n FROM "stock_articles"`)).rows[0].n;
    assert(cnt === 5, `expected 5 rows after repeat insert, got ${cnt}`);
    ok('Repeated INSERT ... RETURNING * (statement reuse + boolean=false)');
  } catch (e) { ko('Repeated INSERT ... RETURNING * (statement reuse + boolean=false)', e); }

  try {
    // 8. SELECT 1 health check
    const r = await pool.query(`SELECT 1`);
    assert(r.rows.length === 1, 'SELECT 1 returned no row');
    ok('SELECT 1 health check');
  } catch (e) { ko('SELECT 1 health check', e); }

  await pool.end();

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  if (fail) process.exit(1);
})();
