const { Pool } = require('pg');
const logger = require('../utils/logger');

function buildPgConfigFromEnv() {
  // Prefer discrete PG* vars when present. This avoids URL encoding issues with DATABASE_URL
  // (e.g., passwords containing `@`, `#`, `:`) and makes Compose configs simpler.
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

    // If an invalid port is provided, fall back to default (pg will default to 5432).
    if (cfg.port !== undefined && !Number.isFinite(cfg.port)) {
      delete cfg.port;
    }

    return cfg;
  }

  return {
    connectionString: process.env.DATABASE_URL,
  };
}

const pool = new Pool({
  ...buildPgConfigFromEnv(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connected successfully at', result.rows[0].now);
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    throw error;
  }
}

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 50)}...`);
  return result;
}

module.exports = {
  pool,
  query,
  testConnection,
};

