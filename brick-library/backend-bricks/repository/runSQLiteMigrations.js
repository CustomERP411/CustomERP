const fs = require('fs');
const path = require('path');

function runMigrations(dbGetter) {
  let getDb = dbGetter;
  if (!getDb) {
    try { require('dotenv').config(); } catch (_) { /* optional */ }
    getDb = require('./sqliteDb').getDb;
  }

  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn('[MIGRATIONS] Migrations directory not found:', migrationsDir);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const checkStmt = db.prepare('SELECT 1 FROM _migrations WHERE name = ?');
  const insertStmt = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const file of files) {
    if (checkStmt.get(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const applyOne = db.transaction(() => {
      db.exec(sql);
      insertStmt.run(file);
    });

    try {
      applyOne();
      console.log(`[MIGRATIONS] Applied ${file}`);
    } catch (err) {
      console.error(`[MIGRATIONS] Failed to apply ${file}:`, err.message || err);
      throw err;
    }
  }

  console.log('[MIGRATIONS] Up to date.');
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
