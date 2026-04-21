/**
 * Database Migration Runner
 * Run with: npm run migrate
 */

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
      host: process.env.PGHOST || undefined,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      user: process.env.PGUSER || undefined,
      password: process.env.PGPASSWORD || undefined,
      database: process.env.PGDATABASE || undefined,
    };
    if (cfg.port !== undefined && !Number.isFinite(cfg.port)) {
      delete cfg.port;
    }
    return cfg;
  }

  return { connectionString: process.env.DATABASE_URL };
}

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

async function connectWithRetry() {
  const pool = new Pool(buildPgConfigFromEnv());
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await pool.connect();
      return { pool, client };
    } catch (err) {
      console.log(`⏳ Waiting for database (attempt ${attempt}/${MAX_RETRIES}): ${err.message}`);
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

async function runMigrations() {
  const { pool, client } = await connectWithRetry();
  
  try {
    console.log('🚀 Starting database migrations...\n');
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${files.length} migration file(s)\n`);
    
    for (const file of files) {
      // Check if already executed
      const result = await client.query(
        'SELECT 1 FROM _migrations WHERE name = $1',
        [file]
      );
      
      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }
      
      // Read and execute migration
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`📦 Executing ${file}...`);
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ ${file} completed\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();

