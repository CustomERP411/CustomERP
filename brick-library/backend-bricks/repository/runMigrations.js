require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function buildPgConfigFromEnv() {
  const hasDiscrete =
    !!process.env.PGHOST ||
    !!process.env.PGUSER ||
    !!process.env.PGPASSWORD ||
    !!process.env.PGDATABASE ||
    !!process.env.PGPORT;

  if (hasDiscrete) {
    const cfg = {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      user: process.env.PGUSER || 'erpuser',
      password: process.env.PGPASSWORD || 'erppassword',
      database: process.env.PGDATABASE || 'erpdb',
    };
    if (!Number.isFinite(cfg.port)) cfg.port = 5432;
    return cfg;
  }

  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: 'localhost',
    port: 5432,
    user: 'erpuser',
    password: 'erppassword',
    database: 'erpdb',
  };
}

const pool = new Pool(buildPgConfigFromEnv());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDb(maxAttempts = 20, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`[MIGRATIONS] DB not ready (attempt ${attempt}/${maxAttempts}): ${err.message || err}`);
      await sleep(delayMs);
    }
  }
}

async function runMigrations() {
  await waitForDb();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[MIGRATIONS] Migrations directory not found: ${migrationsDir}`);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const already = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
      if (already.rows.length) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATIONS] Applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('[MIGRATIONS] Up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('[MIGRATIONS] Failed:', err.message || err);
  process.exit(1);
});
