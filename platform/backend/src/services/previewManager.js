const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');

const execAsync = promisify(exec);
const logger = require('../utils/logger');
const erpGenerationService = require('./erpGenerationService');

const MAX_CONCURRENT_PREVIEWS = Number(process.env.MAX_PREVIEW_INSTANCES) || 3;
const PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 minutes
const HEALTH_POLL_INTERVAL = 500;
const HEALTH_POLL_TIMEOUT = 60_000;

const _previews = new Map();

let _cleanupTimer = null;

function _startCleanupTimer() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, preview] of _previews) {
      if (now - preview.startedAt > PREVIEW_TTL_MS) {
        logger.info(`[PreviewManager] Auto-stopping stale preview ${id}`);
        stopPreview(id).catch(() => {});
      }
    }
  }, 60_000);
  _cleanupTimer.unref();
}

function getPreview(previewId) {
  return _previews.get(previewId) || null;
}

function getPreviewForProject(projectId) {
  for (const [id, p] of _previews) {
    if (p.projectId === projectId) return { ...p, previewId: id };
  }
  return null;
}

async function stopPreview(previewId) {
  const preview = _previews.get(previewId);
  if (!preview) return;

  if (preview.process && !preview.process.killed) {
    try { preview.process.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => {
      try { if (!preview.process.killed) preview.process.kill('SIGKILL'); } catch (_) {}
    }, 3000);
  }

  if (preview.outputDir) {
    erpGenerationService.rmDirRecursive(preview.outputDir).catch(() => {});
  }

  _previews.delete(previewId);
  logger.info(`[PreviewManager] Preview ${previewId} stopped`);
}

async function stopAllForProject(projectId) {
  for (const [id, p] of _previews) {
    if (p.projectId === projectId) await stopPreview(id);
  }
}

async function startPreview(projectId, sdf) {
  if (_previews.size >= MAX_CONCURRENT_PREVIEWS) {
    const err = new Error('Too many active previews. Please close an existing preview first.');
    err.statusCode = 503;
    throw err;
  }

  await stopAllForProject(projectId);

  const previewId = crypto.randomBytes(8).toString('hex');
  const basePath = `/preview/${previewId}`;

  _previews.set(previewId, {
    projectId,
    status: 'building',
    port: null,
    process: null,
    outputDir: null,
    startedAt: Date.now(),
  });

  _startCleanupTimer();

  try {
    // 1. Assemble the ERP code (standalone = SQLite mode)
    logger.info(`[PreviewManager] Generating ERP code for preview ${previewId}...`);
    const { outputDir } = await erpGenerationService.generateProjectDir({
      projectId,
      sdf,
      standalone: true,
    });
    _previews.get(previewId).outputDir = outputDir;

    const appDir = path.join(outputDir, 'app');
    const frontendDir = path.join(outputDir, 'frontend');

    // 2. npm install backend
    logger.info(`[PreviewManager] Installing backend dependencies...`);
    try {
      await execAsync('npm install --production --no-optional', {
        cwd: appDir,
        timeout: 180_000,
        env: { ...process.env, NODE_ENV: 'production' },
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (installErr) {
      const output = (installErr.stdout || '').slice(-2000) + (installErr.stderr || '').slice(-2000);
      logger.error(`[PreviewManager] Backend npm install failed: ${output}`);
      throw installErr;
    }

    // 3. npm install + vite build frontend with preview base path
    if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
      logger.info(`[PreviewManager] Installing frontend dependencies...`);
      try {
        await execAsync('npm install --include=dev', {
          cwd: frontendDir,
          timeout: 180_000,
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch (installErr) {
        const output = (installErr.stdout || '').slice(-2000) + (installErr.stderr || '').slice(-2000);
        logger.error(`[PreviewManager] Frontend npm install failed: ${output}`);
        throw installErr;
      }

      logger.info(`[PreviewManager] Building frontend with base path ${basePath}/...`);
      try {
        await execAsync(`npx vite build --base ${basePath}/`, {
          cwd: frontendDir,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_API_URL: `${basePath}/api`,
            VITE_BASE_PATH: basePath,
          },
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch (buildErr) {
        const output = (buildErr.stdout || '').slice(-2000);
        const errOutput = (buildErr.stderr || '').slice(-2000);
        logger.error(`[PreviewManager] Vite build failed.\nSTDOUT: ${output}\nSTDERR: ${errOutput}`);
        throw buildErr;
      }

      // Copy dist -> app/public
      const distDir = path.join(frontendDir, 'dist');
      const publicDir = path.join(appDir, 'public');
      if (fs.existsSync(distDir)) {
        await _copyRecursive(distDir, publicDir);
      }
      await fsp.rm(frontendDir, { recursive: true, force: true }).catch(() => {});
    }

    // 4. Write .env with PORT=0 (OS picks a free port)
    await fsp.writeFile(path.join(appDir, '.env'), 'PORT=0\n');

    // 5. Start the Express server
    logger.info(`[PreviewManager] Starting preview server...`);
    const port = await _startServer(previewId, appDir);

    const preview = _previews.get(previewId);
    if (preview) {
      preview.status = 'running';
      preview.port = port;
    }

    logger.info(`[PreviewManager] Preview ${previewId} running on port ${port}`);
    return { previewId, port, status: 'running' };
  } catch (err) {
    logger.error(`[PreviewManager] Failed to start preview ${previewId}: ${err.message}`);
    await stopPreview(previewId);
    throw err;
  }
}

function _startServer(previewId, appDir) {
  return new Promise((resolve, reject) => {
    const entryFile = path.join(appDir, 'src', 'index.js');
    if (!fs.existsSync(entryFile)) {
      return reject(new Error('Generated ERP entry file not found'));
    }

    const child = spawn(process.execPath, [entryFile], {
      cwd: appDir,
      env: { ...process.env, PORT: '0', NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    const preview = _previews.get(previewId);
    if (preview) preview.process = child;

    let portResolved = false;
    let output = '';

    const onData = (chunk) => {
      output += chunk.toString();
      // The generated server prints "Server running on port XXXX"
      const match = output.match(/(?:running on port|listening on port|port)\s+(\d+)/i);
      if (match && !portResolved) {
        portResolved = true;
        const port = parseInt(match[1], 10);
        resolve(port);
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('error', (err) => {
      if (!portResolved) {
        portResolved = true;
        reject(new Error(`Preview process error: ${err.message}`));
      }
    });

    child.on('exit', (code) => {
      if (!portResolved) {
        portResolved = true;
        reject(new Error(`Preview process exited with code ${code} before becoming healthy. Output: ${output.slice(-500)}`));
      }
    });

    // Timeout fallback: if we can't detect the port from stdout, poll /health
    setTimeout(async () => {
      if (portResolved) return;
      // If we couldn't parse port from output, try a range of common ports
      portResolved = true;
      reject(new Error(`Could not determine preview port within timeout. Output: ${output.slice(-500)}`));
    }, HEALTH_POLL_TIMEOUT);
  });
}

async function _copyRecursive(src, dest) {
  const stat = await fsp.stat(src);
  if (stat.isDirectory()) {
    await fsp.mkdir(dest, { recursive: true });
    const entries = await fsp.readdir(src);
    for (const entry of entries) {
      await _copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(src, dest);
  }
}

module.exports = {
  startPreview,
  stopPreview,
  stopAllForProject,
  getPreview,
  getPreviewForProject,
};
