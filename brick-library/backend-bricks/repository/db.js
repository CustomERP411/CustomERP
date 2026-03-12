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

const pool = new Pool({
  ...buildPgConfigFromEnv(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message || err);
});

async function testConnection() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0]?.now || null;
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  testConnection,
  buildPgConfigFromEnv,
};
