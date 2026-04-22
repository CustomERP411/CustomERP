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
const MAX_QUEUED_BUILDS = 3;
const PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 minutes
const HEALTH_POLL_TIMEOUT = 60_000;

const _previews = new Map();
const _buildQueue = []; // { previewId, projectId, sdf }
let _buildRunning = false;
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

function getQueuePosition(previewId) {
  const idx = _buildQueue.findIndex((j) => j.previewId === previewId);
  return idx === -1 ? -1 : idx + 1; // 1-based for display
}

async function stopPreview(previewId) {
  const preview = _previews.get(previewId);
  if (!preview) return;

  // Remove from build queue if still queued
  const qIdx = _buildQueue.findIndex((j) => j.previewId === previewId);
  if (qIdx !== -1) _buildQueue.splice(qIdx, 1);

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

  const queuedBuilds = _buildQueue.length + (_buildRunning ? 1 : 0);
  if (queuedBuilds >= MAX_QUEUED_BUILDS) {
    const err = new Error('Build queue is full. Please wait for a current build to finish.');
    err.statusCode = 503;
    throw err;
  }

  await stopAllForProject(projectId);

  const previewId = crypto.randomBytes(8).toString('hex');

  _previews.set(previewId, {
    projectId,
    status: 'queued',
    port: null,
    process: null,
    outputDir: null,
    startedAt: Date.now(),
  });

  _startCleanupTimer();

  _buildQueue.push({ previewId, projectId, sdf });
  logger.info(`[PreviewManager] Preview ${previewId} queued (position ${_buildQueue.length})`);

  _drainQueue();

  const preview = _previews.get(previewId);
  return { previewId, status: preview ? preview.status : 'queued' };
}

function _drainQueue() {
  if (_buildRunning || _buildQueue.length === 0) return;

  const job = _buildQueue.shift();
  if (!job) return;

  const preview = _previews.get(job.previewId);
  if (!preview) {
    _drainQueue();
    return;
  }

  preview.status = 'building';
  _buildRunning = true;
  logger.info(`[PreviewManager] Starting build for preview ${job.previewId}`);

  _executeBuild(job.previewId, job.projectId, job.sdf)
    .then(() => {
      _buildRunning = false;
      _drainQueue();
    })
    .catch(() => {
      _buildRunning = false;
      _drainQueue();
    });
}

async function _executeBuild(previewId, projectId, sdf) {
  const basePath = `/preview/${previewId}`;

  try {
    logger.info(`[PreviewManager] Generating ERP code for preview ${previewId}...`);
    const { outputDir } = await erpGenerationService.generateProjectDir({
      projectId,
      sdf,
      standalone: true,
    });

    const preview = _previews.get(previewId);
    if (!preview) return; // stopped while building
    preview.outputDir = outputDir;

    const appDir = path.join(outputDir, 'app');
    const frontendDir = path.join(outputDir, 'frontend');

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

      const distDir = path.join(frontendDir, 'dist');
      const publicDir = path.join(appDir, 'public');
      if (fs.existsSync(distDir)) {
        await _copyRecursive(distDir, publicDir);
      }
      await fsp.rm(frontendDir, { recursive: true, force: true }).catch(() => {});
    }

    await fsp.writeFile(path.join(appDir, '.env'), 'PORT=0\n');

    logger.info(`[PreviewManager] Starting preview server...`);
    const port = await _startServer(previewId, appDir);

    const finalPreview = _previews.get(previewId);
    if (finalPreview) {
      finalPreview.status = 'running';
      finalPreview.port = port;
    }

    logger.info(`[PreviewManager] Preview ${previewId} running on port ${port}`);
  } catch (err) {
    logger.error(`[PreviewManager] Failed to start preview ${previewId}: ${err.message}`);
    await stopPreview(previewId);
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

    setTimeout(() => {
      if (portResolved) return;
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

function cleanupOrphanedDirs() {
  const os = require('os');
  const outputRoot =
    process.env.GENERATOR_OUTPUT_PATH ||
    path.join(os.tmpdir(), 'customerp-generated');

  fsp.readdir(outputRoot).then((entries) => {
    if (!entries.length) return;
    logger.info(`[PreviewManager] Cleaning ${entries.length} orphaned preview dir(s)`);
    for (const entry of entries) {
      fsp.rm(path.join(outputRoot, entry), { recursive: true, force: true }).catch(() => {});
    }
  }).catch(() => {});
}

cleanupOrphanedDirs();

module.exports = {
  startPreview,
  stopPreview,
  stopAllForProject,
  getPreview,
  getPreviewForProject,
  getQueuePosition,
};
