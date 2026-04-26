const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const NODE_VERSION = '20.18.1';

const PLATFORMS = {
  'macos-arm64': { nodeDir: `node-v${NODE_VERSION}-darwin-arm64`, ext: 'tar.gz', binRel: 'bin/node', os: 'darwin', arch: 'arm64' },
  'macos-x64':   { nodeDir: `node-v${NODE_VERSION}-darwin-x64`,   ext: 'tar.gz', binRel: 'bin/node', os: 'darwin', arch: 'x64' },
  'linux-x64':   { nodeDir: `node-v${NODE_VERSION}-linux-x64`,    ext: 'tar.xz', binRel: 'bin/node', os: 'linux',  arch: 'x64' },
  'windows-x64': { nodeDir: `node-v${NODE_VERSION}-win-x64`,      ext: 'zip',    binRel: 'node.exe', os: 'win32',  arch: 'x64' },
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
    return platform.startsWith('windows') ? path.dirname(cachedBin) : path.join(cacheDir, `node-${platform}`, 'bin');
  }

  const archiveName = `${info.nodeDir}.${info.ext}`;
  const url = `https://nodejs.org/dist/v${NODE_VERSION}/${archiveName}`;
  const archivePath = path.join(cacheDir, archiveName);

  console.log(`[STANDALONE] Downloading Node.js for ${platform} from ${url}`);

  try {
    await execAsync(`curl -fsSL -o "${archivePath}" "${url}"`, { timeout: 120000 });
  } catch (err) {
    throw new Error(`Failed to download Node.js binary: ${err.message}`);
  }

  const extractDir = path.join(cacheDir, `node-${platform}`);
  await ensureDir(extractDir);

  console.log(`[STANDALONE] Extracting Node.js binary...`);
  if (info.ext === 'tar.gz') {
    await execAsync(`tar -xzf "${archivePath}" -C "${extractDir}" --strip-components=1`);
  } else if (info.ext === 'tar.xz') {
    await execAsync(`tar -xJf "${archivePath}" -C "${extractDir}" --strip-components=1`);
  } else {
    await execAsync(`unzip -qo "${archivePath}" -d "${cacheDir}"`);
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
  return platform.startsWith('windows') ? path.dirname(cachedBin) : path.join(extractDir, 'bin');
}

async function replaceBetterSqlitePrebuilt(appDir, targetOs, targetArch, { requireSuccess = false } = {}) {
  const pkgDir = path.join(appDir, 'node_modules', 'better-sqlite3');
  if (!fs.existsSync(pkgDir)) {
    if (requireSuccess) {
      throw new Error(
        '[STANDALONE] better-sqlite3 is missing from node_modules; cannot build Linux bundle.'
      );
    }
    return;
  }

  const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const version = pkgJson.version;
  console.log(`[STANDALONE] Replacing better-sqlite3 v${version} native binary for ${targetOs}-${targetArch}...`);

  const buildRelease = path.join(pkgDir, 'build', 'Release');
  const targetFile = path.join(buildRelease, 'better_sqlite3.node');

  // Node.js major version -> ABI version mapping
  const nodeAbiMap = { '20': '115', '22': '127', '23': '131' };
  const nodeMajor = NODE_VERSION.split('.')[0];
  const abiVersion = nodeAbiMap[nodeMajor] || '115';

  // Delete the Linux-compiled binary
  if (fs.existsSync(targetFile)) {
    await fsp.unlink(targetFile);
  }
  await ensureDir(buildRelease);

  const cacheDir = getCacheDir();
  await ensureDir(cacheDir);

  // Download the prebuilt binary directly from GitHub releases.
  // better-sqlite3 uses: better-sqlite3-v{VER}-node-v{ABI}-{OS}-{ARCH}.tar.gz
  const tarName = `better-sqlite3-v${version}-node-v${abiVersion}-${targetOs}-${targetArch}.tar.gz`;
  const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/${tarName}`;
  const tmpFile = path.join(cacheDir, tarName);

  try {
    console.log(`[STANDALONE] Downloading ${tarName}...`);
    await execAsync(`curl -fsSL -o "${tmpFile}" "${url}"`, { timeout: 60000 });
    await execAsync(`tar -xzf "${tmpFile}" -C "${pkgDir}"`);
    await fsp.unlink(tmpFile).catch(() => {});

    if (fs.existsSync(targetFile)) {
      console.log('[STANDALONE] Native module replaced successfully.');
      return;
    }
    if (requireSuccess) {
      throw new Error(
        '[STANDALONE] Downloaded better-sqlite3 archive did not contain the expected native binary.'
      );
    }
    console.warn('[STANDALONE] Downloaded archive did not contain expected binary.');
  } catch (err) {
    await fsp.unlink(tmpFile).catch(() => {});
    if (requireSuccess) {
      throw err;
    }
    console.warn(`[STANDALONE] Download failed: ${err.message.split('\n')[0]}`);
  }

  if (requireSuccess) {
    throw new Error(
      '[STANDALONE] Could not install glibc better-sqlite3 prebuild for Linux; standalone bundle is invalid.'
    );
  }
  console.warn('[STANDALONE] Could not replace native module for target platform. The bundle may not work.');
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
  await execAsync('npm install --production --no-optional', {
    cwd: appDir,
    timeout: 180000,
    env: { ...process.env, NODE_ENV: 'production' },
    maxBuffer: 10 * 1024 * 1024,
  });

  // 1b. Replace native addons with correct prebuilt binaries for the target platform.
  // Always for cross-OS/arch builds, and always for linux-x64: npm on Alpine (musl) would
  // otherwise leave a musl .node while we ship glibc Node — same arch so not "cross" there.
  const isCrossBuild = info.os !== process.platform || info.arch !== process.arch;
  const shouldReplaceSqlite = isCrossBuild || platform === 'linux-x64';
  if (shouldReplaceSqlite) {
    await replaceBetterSqlitePrebuilt(appDir, info.os, info.arch, { requireSuccess: platform === 'linux-x64' });
  }

  // 2. npm install + build frontend
  if (fs.existsSync(path.join(frontendDir, 'package.json'))) {
    console.log('[STANDALONE] Installing frontend dependencies...');
    await execAsync('npm install --include=dev', {
      cwd: frontendDir,
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
    });

    console.log('[STANDALONE] Building frontend...');
    await execAsync('npx vite build', {
      cwd: frontendDir,
      timeout: 120000,
      env: { ...process.env, VITE_API_URL: '/api' },
      maxBuffer: 10 * 1024 * 1024,
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
    const nodeExe = path.join(nodeBinDir, info.binRel);
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
