require('dotenv').config();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { pool, testConnection } = require('./config/database');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      service: 'customwerp-backend',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      service: 'customwerp-backend',
      database: 'disconnected',
      error: error.message 
    });
  }
});

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  let dbConnected = false;
  
  try {
    // Test database connection
    await testConnection();
    dbConnected = true;
  } catch (error) {
    logger.warn('Database connection failed, starting in offline mode:', error.message);
    logger.warn('Some features will be unavailable until database is connected.');
  }
  
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
    logger.info(`Database: ${dbConnected ? 'connected' : 'offline mode'}`);
  });
}

start();

