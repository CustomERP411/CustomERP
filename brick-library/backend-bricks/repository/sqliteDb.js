const path = require('path');
const fs = require('fs');

const dbPath =
  process.env.SQLITE_PATH ||
  path.join(process.cwd(), 'data', 'erp.db');

let db;

function getDb() {
  if (!db) {
    const Database = require('better-sqlite3');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  }
  return db;
}

function testConnection() {
  const row = getDb().prepare('SELECT 1 AS ok').get();
  return row && row.ok === 1;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, testConnection, closeDb };
