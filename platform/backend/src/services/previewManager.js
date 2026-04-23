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
const PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 minutes hard safety net
const HEALTH_POLL_TIMEOUT = 60_000;
// Grace window after the last heartbeat before we assume the user left.
// Heartbeats from the frontend ping every 20s, so 60s covers a couple misses.
const HEARTBEAT_GRACE_MS = Number(process.env.PREVIEW_HEARTBEAT_GRACE_MS) || 60_000;
// After status flips to `running`, give the frontend a warmup window to send
// its first heartbeat before the grace sweeper is allowed to kill it.
const HEARTBEAT_WARMUP_MS = 90_000;
// How long to retain a preview record after it errored/stopped so the frontend
// has a chance to pick up the terminal state on its next poll.
const ERROR_RETENTION_MS = 2 * 60_000;

// Stable set of error codes the frontend can map to localized copy.
const ERROR_CODES = Object.freeze({
  NO_SDF: 'NO_SDF',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  QUEUE_FULL: 'QUEUE_FULL',
  CAPACITY: 'CAPACITY',
  ASSEMBLE_FAILED: 'ASSEMBLE_FAILED',
  NPM_INSTALL_FAILED: 'NPM_INSTALL_FAILED',
  FRONTEND_BUILD_FAILED: 'FRONTEND_BUILD_FAILED',
  PORT_TIMEOUT: 'PORT_TIMEOUT',
  SPAWN_FAILED: 'SPAWN_FAILED',
  CRASHED: 'CRASHED',
  STALE: 'STALE',
  BUILD_FAILED: 'BUILD_FAILED',
});

function createPreviewError(code, statusCode, message) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

const _previews = new Map();
const _buildQueue = []; // { previewId, projectId, sdf }
let _buildRunning = false;
let _cleanupTimer = null;

function _startCleanupTimer() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, preview] of _previews) {
      // Hard TTL safety net
      if (now - preview.startedAt > PREVIEW_TTL_MS) {
        logger.info(`[PreviewManager] Auto-stopping stale preview ${id} (hard TTL)`);
        _markError(id, ERROR_CODES.STALE, 'Preview expired (30 minute limit)');
        _killAndFree(id).catch(() => {});
        continue;
      }

      // Heartbeat-driven cleanup for running previews
      if (preview.status === 'running' && preview.runningSince) {
        const sinceRunning = now - preview.runningSince;
        if (sinceRunning < HEARTBEAT_WARMUP_MS) continue;
        const lastBeat = preview.lastHeartbeatAt || preview.runningSince;
        if (now - lastBeat > HEARTBEAT_GRACE_MS) {
          logger.info(`[PreviewManager] Stopping preview ${id} — no heartbeat for ${now - lastBeat}ms`);
          _killAndFree(id).catch(() => {});
        }
      }

      // Retention cleanup for terminal states
      if ((preview.status === 'error' || preview.status === 'stopped') && preview.terminalAt) {
        if (now - preview.terminalAt > ERROR_RETENTION_MS) {
          _previews.delete(id);
        }
      }
    }
  }, 30_000);
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

function touchHeartbeat(previewId) {
  const preview = _previews.get(previewId);
  if (!preview) return false;
  preview.lastHeartbeatAt = Date.now();
  return true;
}

function touchHeartbeatForProject(projectId) {
  const preview = getPreviewForProject(projectId);
  if (!preview) return false;
  return touchHeartbeat(preview.previewId);
}

function _markError(previewId, code, message) {
  const preview = _previews.get(previewId);
  if (!preview) return;
  preview.status = 'error';
  preview.errorCode = code;
  preview.errorMessage = message;
  preview.terminalAt = Date.now();
}

/**
 * Kill the child process + delete the working directory WITHOUT removing the
 * preview record, so a terminal state (error/stopped) can still be observed by
 * subsequent status polls. The cleanup sweeper eventually evicts the record.
 */
async function _killAndFree(previewId) {
  const preview = _previews.get(previewId);
  if (!preview) return;

  const qIdx = _buildQueue.findIndex((j) => j.previewId === previewId);
  if (qIdx !== -1) _buildQueue.splice(qIdx, 1);

  if (preview.process && !preview.process.killed) {
    try { preview.process.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => {
      try { if (preview.process && !preview.process.killed) preview.process.kill('SIGKILL'); } catch (_) {}
    }, 3000);
  }
  preview.process = null;

  if (preview.outputDir) {
    erpGenerationService.rmDirRecursive(preview.outputDir).catch(() => {});
    preview.outputDir = null;
  }
}

/**
 * User-initiated stop: kill + free + drop the record so the UI goes back to
 * `none`. Use this from controller DELETE handlers.
 */
async function stopPreview(previewId) {
  const preview = _previews.get(previewId);
  if (!preview) return;
  await _killAndFree(previewId);
  _previews.delete(previewId);
  logger.info(`[PreviewManager] Preview ${previewId} stopped`);
}

async function stopAllForProject(projectId) {
  for (const [id, p] of _previews) {
    if (p.projectId === projectId) await stopPreview(id);
  }
}

async function startPreview(projectId, sdf) {
  // Idempotent: if a non-terminal preview already exists for this project,
  // return it instead of starting a second build (covers double-clicks and
  // races between the status poll and the mount effect on PreviewPage).
  const existing = getPreviewForProject(projectId);
  if (existing && (existing.status === 'queued' || existing.status === 'building' || existing.status === 'running')) {
    return { previewId: existing.previewId, status: existing.status };
  }

  // If a terminal-state preview is still retained, evict it before creating
  // a fresh one (user clicked "Retry").
  if (existing && (existing.status === 'error' || existing.status === 'stopped')) {
    _previews.delete(existing.previewId);
  }

  if (_previews.size >= MAX_CONCURRENT_PREVIEWS) {
    throw createPreviewError(
      ERROR_CODES.CAPACITY,
      503,
      'Too many active previews. Please close an existing preview first.',
    );
  }

  const queuedBuilds = _buildQueue.length + (_buildRunning ? 1 : 0);
  if (queuedBuilds >= MAX_QUEUED_BUILDS) {
    throw createPreviewError(
      ERROR_CODES.QUEUE_FULL,
      503,
      'Build queue is full. Please wait for a current build to finish.',
    );
  }

  const previewId = crypto.randomBytes(8).toString('hex');

  _previews.set(previewId, {
    projectId,
    status: 'queued',
    phase: 'queued',
    port: null,
    process: null,
    outputDir: null,
    startedAt: Date.now(),
    lastHeartbeatAt: Date.now(),
    runningSince: null,
    terminalAt: null,
    errorCode: null,
    errorMessage: null,
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
  preview.phase = 'assembling';
  _buildRunning = true;
  logger.info(`[PreviewManager] Starting build for preview ${job.previewId}`);

  _executeBuild(job.previewId, job.projectId, job.sdf)
    .finally(() => {
      _buildRunning = false;
      _drainQueue();
    });
}

function _setPhase(previewId, phase) {
  const preview = _previews.get(previewId);
  if (preview) preview.phase = phase;
}

async function _executeBuild(previewId, projectId, sdf) {
  const basePath = `/preview/${previewId}`;

  try {
    _setPhase(previewId, 'assembling');
    logger.info(`[PreviewManager] Generating ERP code for preview ${previewId}...`);
    let outputDir;
    try {
      const result = await erpGenerationService.generateProjectDir({
        projectId,
        sdf,
        standalone: true,
      });
      outputDir = result.outputDir;
    } catch (err) {
      throw createPreviewError(
        ERROR_CODES.ASSEMBLE_FAILED,
        500,
        `Failed to assemble ERP code: ${err.message}`,
      );
    }

    const preview = _previews.get(previewId);
    if (!preview) return; // stopped while building
    preview.outputDir = outputDir;

    const appDir = path.join(outputDir, 'app');
    const frontendDir = path.join(outputDir, 'frontend');

    _setPhase(previewId, 'installing_backend');
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
      throw createPreviewError(
        ERROR_CODES.NPM_INSTALL_FAILED,
        500,
        'Failed to install backend dependencies',
      );
    }

    if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
      _setPhase(previewId, 'installing_frontend');
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
        throw createPreviewError(
          ERROR_CODES.NPM_INSTALL_FAILED,
          500,
          'Failed to install frontend dependencies',
        );
      }

      _setPhase(previewId, 'building_frontend');
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
        throw createPreviewError(
          ERROR_CODES.FRONTEND_BUILD_FAILED,
          500,
          'Failed to build frontend bundle',
        );
      }

      const distDir = path.join(frontendDir, 'dist');
      const publicDir = path.join(appDir, 'public');
      if (fs.existsSync(distDir)) {
        await _copyRecursive(distDir, publicDir);
      }
      await fsp.rm(frontendDir, { recursive: true, force: true }).catch(() => {});
    }

    await fsp.writeFile(path.join(appDir, '.env'), 'PORT=0\n');

    _setPhase(previewId, 'starting');
    logger.info(`[PreviewManager] Starting preview server...`);
    const port = await _startServer(previewId, appDir);

    const finalPreview = _previews.get(previewId);
    if (finalPreview) {
      finalPreview.status = 'running';
      finalPreview.phase = 'running';
      finalPreview.port = port;
      finalPreview.runningSince = Date.now();
      finalPreview.lastHeartbeatAt = Date.now();
    }

    logger.info(`[PreviewManager] Preview ${previewId} running on port ${port}`);
  } catch (err) {
    const code = err.code && ERROR_CODES[err.code] ? err.code : ERROR_CODES.BUILD_FAILED;
    const message = err.message || 'Preview build failed';
    logger.error(`[PreviewManager] Failed to start preview ${previewId} (${code}): ${message}`);
    _markError(previewId, code, message);
    await _killAndFree(previewId);
  }
}

function _startServer(previewId, appDir) {
  return new Promise((resolve, reject) => {
    const entryFile = path.join(appDir, 'src', 'index.js');
    if (!fs.existsSync(entryFile)) {
      return reject(createPreviewError(
        ERROR_CODES.SPAWN_FAILED,
        500,
        'Generated ERP entry file not found',
      ));
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
      const s = chunk.toString();
      output += s;
      // Keep only the last ~4KB to cap memory.
      if (output.length > 4096) output = output.slice(-4096);
      if (!portResolved) {
        const match = output.match(/(?:running on port|listening on port|port)\s+(\d+)/i);
        if (match) {
          portResolved = true;
          const port = parseInt(match[1], 10);
          resolve(port);
        }
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('error', (err) => {
      if (!portResolved) {
        portResolved = true;
        reject(createPreviewError(
          ERROR_CODES.SPAWN_FAILED,
          500,
          `Preview process error: ${err.message}`,
        ));
      }
    });

    // If the child exits BEFORE we resolve a port → startup failure.
    // If it exits AFTER (preview is running) → crash.
    child.on('exit', (code, signal) => {
      if (!portResolved) {
        portResolved = true;
        reject(createPreviewError(
          ERROR_CODES.CRASHED,
          500,
          `Preview process exited with code ${code} before becoming healthy. Tail: ${output.slice(-500)}`,
        ));
        return;
      }
      const preview = _previews.get(previewId);
      if (preview && preview.status === 'running') {
        logger.error(`[PreviewManager] Preview ${previewId} crashed (code=${code}, signal=${signal}). Tail: ${output.slice(-500)}`);
        _markError(previewId, ERROR_CODES.CRASHED, 'Preview process crashed unexpectedly');
        _killAndFree(previewId).catch(() => {});
      }
    });

    setTimeout(() => {
      if (portResolved) return;
      portResolved = true;
      reject(createPreviewError(
        ERROR_CODES.PORT_TIMEOUT,
        500,
        `Could not determine preview port within timeout. Tail: ${output.slice(-500)}`,
      ));
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

/**
 * Sweep stale preview working directories on startup WITHOUT touching the
 * standalone zip artifacts the download flow writes to the same output root.
 * Preview dirs are created by `generateProjectDir` with a nanoid-like name that
 * has no extension; generated zip artifacts end in `.zip`. We also respect an
 * explicit opt-out env flag for operators who manage the cache externally.
 */
function cleanupOrphanedDirs() {
  if (process.env.PREVIEW_SKIP_ORPHAN_CLEANUP === '1') return;

  const os = require('os');
  const outputRoot =
    process.env.GENERATOR_OUTPUT_PATH ||
    path.join(os.tmpdir(), 'customerp-generated');

  fsp.readdir(outputRoot, { withFileTypes: true }).then((entries) => {
    const toRemove = entries.filter((e) => {
      if (!e.isDirectory()) return false; // leave files (zips) alone
      if (e.name.startsWith('.')) return false;
      return true;
    });
    if (!toRemove.length) return;
    logger.info(`[PreviewManager] Cleaning ${toRemove.length} orphaned preview dir(s)`);
    for (const entry of toRemove) {
      fsp.rm(path.join(outputRoot, entry.name), { recursive: true, force: true }).catch(() => {});
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
  touchHeartbeat,
  touchHeartbeatForProject,
  ERROR_CODES,
};
