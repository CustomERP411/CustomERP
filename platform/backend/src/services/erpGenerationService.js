const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

function getPaths() {
  // Prefer explicit paths (Docker mounts)
  const assemblerPath =
    process.env.ASSEMBLER_PATH ||
    path.resolve(__dirname, '../../../..', 'assembler'); // local: platform/assembler

  const brickLibraryPath =
    process.env.BRICK_LIBRARY_PATH ||
    path.resolve(__dirname, '../../../../', 'brick-library'); // local: /brick-library

  const outputRoot =
    process.env.GENERATOR_OUTPUT_PATH ||
    path.join(os.tmpdir(), 'customerp-generated');

  return { assemblerPath, brickLibraryPath, outputRoot };
}

function safeFileName(name) {
  return String(name || 'custom-erp')
    .trim()
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'custom-erp';
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function rmDirRecursive(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

async function generateProjectDir({ projectId, sdf }) {
  const { assemblerPath, brickLibraryPath, outputRoot } = getPaths();

  await ensureDir(outputRoot);

  // Dynamic require so backend can run even if generator isn't mounted.
  const BrickRepository = require(path.join(assemblerPath, 'BrickRepository'));
  const ProjectAssembler = require(path.join(assemblerPath, 'ProjectAssembler'));

  const brickRepo = new BrickRepository(brickLibraryPath);
  const assembler = new ProjectAssembler(brickRepo, outputRoot);

  const genId = `${safeFileName(projectId)}-${Date.now()}`;
  const outputDir = await assembler.assemble(genId, sdf);
  return { outputDir, genId };
}

function streamZipFromDir(res, { outputDir, zipName }) {
  let archiver;
  try {
    // Lazy-require so the backend can still start even if dependencies haven't been rebuilt yet.
    // (In dev docker-compose we mount src/, but node_modules comes from the image build.)
    archiver = require('archiver');
  } catch (e) {
    const err = new Error(
      "Cannot generate ZIP because dependency 'archiver' is not installed. " +
      "Rebuild the backend image to install new dependencies (e.g. `docker compose up -d --build backend`)."
    );
    err.statusCode = 500;
    throw err;
  }

  return new Promise((resolve, reject) => {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(zipName)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => reject(err));
    res.on('close', () => resolve());
    res.on('finish', () => resolve());

    archive.pipe(res);
    archive.directory(outputDir, false);
    try {
      archive.finalize();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  getPaths,
  generateProjectDir,
  streamZipFromDir,
  rmDirRecursive,
};


