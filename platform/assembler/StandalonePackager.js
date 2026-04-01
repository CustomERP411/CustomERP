const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const NODE_VERSION = '20.18.1';

const PLATFORMS = {
  'macos-arm64': { nodeDir: `node-v${NODE_VERSION}-darwin-arm64`, ext: 'tar.gz', binRel: 'bin/node' },
  'macos-x64':   { nodeDir: `node-v${NODE_VERSION}-darwin-x64`,   ext: 'tar.gz', binRel: 'bin/node' },
  'linux-x64':   { nodeDir: `node-v${NODE_VERSION}-linux-x64`,    ext: 'tar.xz', binRel: 'bin/node' },
  'windows-x64': { nodeDir: `node-v${NODE_VERSION}-win-x64`,      ext: 'zip',    binRel: 'node.exe' },
};

function getCacheDir() {
  return process.env.STANDALONE_CACHE_DIR || path.join(os.tmpdir(), 'customerp-standalone-cache');
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyRecursive(src, dest) {
  const stat = await fsp.stat(src);
  if (stat.isDirectory()) {
    await ensureDir(dest);
    const entries = await fsp.readdir(src);
    for (const entry of entries) {
      await copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fsp.copyFile(src, dest);
    const mode = stat.mode;
    if (mode & 0o111) {
      try { await fsp.chmod(dest, mode); } catch (_) { /* best-effort */ }
    }
  }
}

async function downloadNodeBinary(platform) {
  const info = PLATFORMS[platform];
  if (!info) throw new Error(`Unsupported platform: ${platform}. Supported: ${Object.keys(PLATFORMS).join(', ')}`);

  const cacheDir = getCacheDir();
  await ensureDir(cacheDir);
  const cachedBin = path.join(cacheDir, `node-${platform}`, info.binRel);

  if (fs.existsSync(cachedBin)) {
    console.log(`[STANDALONE] Using cached Node.js binary for ${platform}`);
    return path.dirname(platform.startsWith('windows') ? cachedBin : path.join(cacheDir, `node-${platform}`, 'bin'));
  }

  const archiveName = `${info.nodeDir}.${info.ext}`;
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${archiveName}`;
  const archivePath = path.join(cacheDir, archiveName);

  console.log(`[STANDALONE] Downloading Node.js for ${platform} from ${url}`);

  try {
    execSync(`curl -fsSL -o "${archivePath}" "${url}"`, { stdio: 'pipe', timeout: 120000 });
  } catch (err) {
    throw new Error(`Failed to download Node.js binary: ${err.message}`);
  }

  const extractDir = path.join(cacheDir, `node-${platform}`);
  await ensureDir(extractDir);

  console.log(`[STANDALONE] Extracting Node.js binary...`);
  if (info.ext === 'tar.gz') {
    execSync(`tar -xzf "${archivePath}" -C "${extractDir}" --strip-components=1`, { stdio: 'pipe' });
  } else if (info.ext === 'tar.xz') {
    execSync(`tar -xJf "${archivePath}" -C "${extractDir}" --strip-components=1`, { stdio: 'pipe' });
  } else {
    execSync(`unzip -qo "${archivePath}" -d "${cacheDir}"`, { stdio: 'pipe' });
    const unzippedDir = path.join(cacheDir, info.nodeDir);
    if (fs.existsSync(unzippedDir) && unzippedDir !== extractDir) {
      const entries = await fsp.readdir(unzippedDir);
      for (const entry of entries) {
        const src = path.join(unzippedDir, entry);
        const dest = path.join(extractDir, entry);
        await fsp.rename(src, dest).catch(() => copyRecursive(src, dest));
      }
      await fsp.rm(unzippedDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  try { await fsp.unlink(archivePath); } catch (_) { /* cleanup best-effort */ }

  if (!fs.existsSync(cachedBin)) {
    throw new Error(`Node.js binary not found after extraction at ${cachedBin}`);
  }
  return path.dirname(platform.startsWith('windows') ? cachedBin : path.join(extractDir, 'bin'));
}

async function buildStandaloneBundle({ assembledDir, platform, projectName }) {
  const info = PLATFORMS[platform];
  if (!info) throw new Error(`Unsupported platform: ${platform}`);

  const appDir = path.join(assembledDir, 'app');
  const frontendDir = path.join(assembledDir, 'frontend');
  const outputDir = assembledDir;

  // 1. npm install backend dependencies
  console.log('[STANDALONE] Installing backend dependencies...');
  if (!fs.existsSync(path.join(appDir, 'package.json'))) {
    throw new Error('Backend package.json not found in assembled output');
  }
  execSync('npm install --production --no-optional 2>&1', {
    cwd: appDir,
    stdio: 'pipe',
    timeout: 180000,
    env: { ...process.env, NODE_ENV: 'production' },
  });

  // 2. npm install + build frontend
  if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
    console.log('[STANDALONE] Installing frontend dependencies...');
    execSync('npm install 2>&1', {
      cwd: frontendDir,
      stdio: 'pipe',
      timeout: 180000,
    });

    console.log('[STANDALONE] Building frontend...');
    execSync('npx vite build 2>&1', {
      cwd: frontendDir,
      stdio: 'pipe',
      timeout: 120000,
      env: { ...process.env, VITE_API_URL: '/api' },
    });

    // 3. Copy frontend dist to app/public
    const distDir = path.join(frontendDir, 'dist');
    const publicDir = path.join(appDir, 'public');
    if (fs.existsSync(distDir)) {
      console.log('[STANDALONE] Copying frontend build to app/public...');
      await copyRecursive(distDir, publicDir);
    } else {
      console.warn('[STANDALONE] Warning: frontend dist/ not found after build');
    }

    // Remove frontend source (not needed in final bundle)
    await fsp.rm(frontendDir, { recursive: true, force: true }).catch(() => {});
  }

  // 4. Bundle Node.js runtime
  console.log('[STANDALONE] Preparing Node.js runtime...');
  const nodeBinDir = await downloadNodeBinary(platform);
  const runtimeDir = path.join(outputDir, 'runtime');

  if (platform.startsWith('windows')) {
    await ensureDir(runtimeDir);
    const nodeExe = path.join(path.dirname(nodeBinDir), info.binRel);
    await fsp.copyFile(nodeExe, path.join(runtimeDir, 'node.exe'));
  } else {
    const runtimeBinDir = path.join(runtimeDir, 'bin');
    await ensureDir(runtimeBinDir);
    const nodeBin = path.join(nodeBinDir, 'node');
    await fsp.copyFile(nodeBin, path.join(runtimeBinDir, 'node'));
    await fsp.chmod(path.join(runtimeBinDir, 'node'), 0o755);
  }

  // 5. Write launcher scripts
  const brickLibPath = process.env.BRICK_LIBRARY_PATH || path.resolve(__dirname, '..', '..', 'brick-library');
  const templateDir = path.join(brickLibPath, 'templates', 'standalone');

  if (platform.startsWith('windows')) {
    const bat = fs.readFileSync(path.join(templateDir, 'start.bat'), 'utf8');
    await fsp.writeFile(path.join(outputDir, 'start.bat'), bat);
  } else if (platform.startsWith('macos')) {
    const sh = fs.readFileSync(path.join(templateDir, 'start.command'), 'utf8');
    await fsp.writeFile(path.join(outputDir, 'start.command'), sh);
    await fsp.chmod(path.join(outputDir, 'start.command'), 0o755);
    await fsp.writeFile(path.join(outputDir, 'start.sh'), sh);
    await fsp.chmod(path.join(outputDir, 'start.sh'), 0o755);
  } else {
    const sh = fs.readFileSync(path.join(templateDir, 'start.sh'), 'utf8');
    await fsp.writeFile(path.join(outputDir, 'start.sh'), sh);
    await fsp.chmod(path.join(outputDir, 'start.sh'), 0o755);
  }

  // 6. Write .env for the app
  await fsp.writeFile(path.join(appDir, '.env'), `PORT=3000\n`);

  // Remove docker/compose artifacts that shouldn't be in standalone
  for (const f of ['docker-compose.yml', 'Dockerfile', '.dockerignore', 'dev.sh', 'dev.ps1']) {
    await fsp.unlink(path.join(outputDir, f)).catch(() => {});
    await fsp.unlink(path.join(appDir, f)).catch(() => {});
  }

  console.log(`[STANDALONE] Bundle ready for ${platform} at ${outputDir}`);
  return outputDir;
}

module.exports = {
  PLATFORMS,
  buildStandaloneBundle,
  downloadNodeBinary,
  getCacheDir,
};
