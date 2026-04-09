require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const routes = require('./routes');
const { pool, testConnection } = require('./config/database');
const logger = require('./utils/logger');
const previewManager = require('./services/previewManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Preview proxy -- MUST be before body parsers so the raw stream can be piped
app.use('/preview/:previewId', (req, res) => {
  const preview = previewManager.getPreview(req.params.previewId);
  if (!preview || preview.status !== 'running') {
    return res.status(404).json({ error: 'Preview not found or not ready' });
  }

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: preview.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${preview.port}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on('error', (err) => {
    logger.error(`[PreviewProxy] ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Preview proxy error: ' + err.message });
    }
  });

  req.pipe(proxyReq, { end: true });
});

// Body parsers (after preview proxy so they don't consume the piped stream)
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
app.use((err, req, res, _next) => {
  logger.error(err.stack || err.message || err);
  if (res.headersSent) return;
  const status = (err.statusCode && Number.isFinite(err.statusCode)) ? err.statusCode : 500;
  res.status(status).json({ error: status === 500 ? 'Internal server error' : (err.message || 'Internal server error') });
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

