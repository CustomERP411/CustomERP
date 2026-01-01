const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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

