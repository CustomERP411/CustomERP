// One-shot reproducer for the platform preview pipeline. Mirrors what
// platform/backend/src/services/previewManager.js does up to spawning
// `node src/index.js` in the standalone build, but without the queue,
// reverse-proxy, or the parent platform process.
//
//   node test/_smoke_preview.js [path/to/sdf.json]
//
// Default SDF: test/sample_sdf_demo_everything.json (the closest analogue to
// what the user was previewing).
//
// On crash this prints the same tail the platform shows in its UI as
// "Önizleme sunucusu beklenmedik şekilde çöktü". Logs land in
// generated/_smoke_preview-<ts>/ so you can re-run without rm-ing anything.

'use strict';

const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const argSdf = process.argv[2];
const sdfPath = argSdf
  ? path.resolve(process.cwd(), argSdf)
  : path.join(REPO_ROOT, 'test', 'sample_sdf_demo_everything.json');

const BrickRepository = require('../platform/assembler/BrickRepository');
const ProjectAssembler = require('../platform/assembler/ProjectAssembler');

async function main() {
  const sdf = JSON.parse(fs.readFileSync(sdfPath, 'utf8'));
  const outputRoot = path.join(REPO_ROOT, 'generated');
  fs.mkdirSync(outputRoot, { recursive: true });

  const brickRepo = new BrickRepository(path.join(REPO_ROOT, 'brick-library'));
  const assembler = new ProjectAssembler(brickRepo, outputRoot);

  const genId = `_smoke_preview-${Date.now()}`;
  console.log(`[smoke] Assembling standalone preview ${genId} from ${sdfPath}`);
  let outputDir;
  try {
    outputDir = await assembler.assemble(genId, sdf, { standalone: true, language: 'en' });
  } catch (err) {
    console.error('[smoke] ASSEMBLE FAILED:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
  console.log(`[smoke] Assembled ok at ${outputDir}`);

  const appDir = path.join(outputDir, 'app');
  if (!fs.existsSync(path.join(appDir, 'src', 'index.js'))) {
    console.error(`[smoke] app/src/index.js missing in ${appDir}`);
    process.exit(3);
  }

  console.log(`[smoke] npm install --omit=dev in ${appDir}`);
  const inst = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: appDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    timeout: 240_000,
  });
  if (inst.status !== 0) {
    console.error(`[smoke] npm install failed (status=${inst.status})`);
    process.exit(4);
  }

  console.log(`[smoke] Spawning node src/index.js (PORT=0)`);
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: appDir,
    env: { ...process.env, PORT: '0', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  let portResolved = false;
  const onData = (chunk) => {
    const s = chunk.toString();
    output += s;
    process.stdout.write(s);
    if (!portResolved) {
      const m = s.match(/(?:running on port|listening on port|port)\s+(\d+)/i);
      if (m) {
        portResolved = true;
        console.log(`\n[smoke] Healthy on port ${m[1]} — killing child for smoke test exit`);
        try { child.kill('SIGTERM'); } catch (_) { /* ignore */ }
      }
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('exit', (code, signal) => {
    if (!portResolved) {
      console.error(
        `\n[smoke] CRASHED before becoming healthy (code=${code}, signal=${signal})\n` +
        `[smoke] Tail of stdout/stderr:\n${output.slice(-2000)}`
      );
      process.exit(5);
    }
    console.log(`[smoke] Child exited cleanly (code=${code}, signal=${signal})`);
    process.exit(0);
  });

  setTimeout(() => {
    if (portResolved) return;
    portResolved = true;
    console.error(`\n[smoke] Timeout waiting for port. Tail:\n${output.slice(-2000)}`);
    try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
    process.exit(6);
  }, 60_000);
}

main().catch((err) => {
  console.error('[smoke] FATAL:', err && err.stack ? err.stack : err);
  process.exit(1);
});
