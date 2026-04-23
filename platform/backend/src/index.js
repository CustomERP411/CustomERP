require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const routes = require('./routes');
const { pool, testConnection } = require('./config/database');
const logger = require('./utils/logger');
const previewManager = require('./services/previewManager');
const { verifyIframeToken, cookieNameFor, DEFAULT_TTL_MS: PREVIEW_COOKIE_TTL_MS } = require('./utils/previewToken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

function parseCookie(header, name) {
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

// Preview proxy -- MUST be before body parsers so the raw stream can be piped
app.use('/preview/:previewId', (req, res) => {
  const previewId = req.params.previewId;
  const preview = previewManager.getPreview(previewId);
  if (!preview || preview.status !== 'running') {
    return res.status(404).json({ error: 'Preview not found or not ready', code: 'NOT_FOUND' });
  }

  // --- Auth gate: either a valid cookie is already set, or ?token= lets us ---
  // --- set the cookie now and redirect to a clean URL.
  const cookieName = cookieNameFor(previewId);
  const cookieToken = parseCookie(req.headers.cookie, cookieName);
  const cookieValid = cookieToken && verifyIframeToken(cookieToken, { previewId });

  if (!cookieValid) {
    const queryIdx = req.url.indexOf('?');
    const queryString = queryIdx === -1 ? '' : req.url.slice(queryIdx + 1);
    const queryToken = new URLSearchParams(queryString).get('token');
    const queryValid = queryToken && verifyIframeToken(queryToken, { previewId });

    if (!queryValid) {
      return res.status(401).json({ error: 'Preview access unauthorized', code: 'UNAUTHORIZED' });
    }

    // Set an httpOnly cookie scoped to this preview's path and redirect so the
    // token disappears from the URL bar + future asset requests are authed.
    const cookieAttrs = [
      `${cookieName}=${queryToken}`,
      `Path=/preview/${previewId}/`,
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${Math.floor(PREVIEW_COOKIE_TTL_MS / 1000)}`,
    ];
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      cookieAttrs.push('Secure');
    }
    res.setHeader('Set-Cookie', cookieAttrs.join('; '));

    // Rebuild clean URL without the token param.
    const params = new URLSearchParams(queryString);
    params.delete('token');
    const qs = params.toString();
    const cleanPath = (queryIdx === -1 ? req.url : req.url.slice(0, queryIdx)) + (qs ? `?${qs}` : '');
    res.setHeader('Location', `/preview/${previewId}${cleanPath}`);
    res.status(302).end();
    return;
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
      res.status(502).json({ error: 'Preview proxy error: ' + err.message, code: 'PROXY_ERROR' });
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

// Event loop watchdog — if the loop is blocked for over 30s, force-exit so
// Docker restart: always can bring the process back.
const WATCHDOG_INTERVAL_MS = 10_000;
const WATCHDOG_MAX_DELAY_MS = 30_000;

(function startWatchdog() {
  let lastTick = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;
    if (delta > WATCHDOG_MAX_DELAY_MS) {
      logger.error(`[Watchdog] Event loop was blocked for ${delta}ms — exiting`);
      process.exit(1);
    }
  }, WATCHDOG_INTERVAL_MS);
  timer.unref();
})();

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

