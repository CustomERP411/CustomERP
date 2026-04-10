// Integration tests for module generation using sample SDFs.
// Run with: node test/module_generation.integration.test.js

/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const assert = require('assert');

const BrickRepository = require('../platform/assembler/BrickRepository');
const ProjectAssembler = require('../platform/assembler/ProjectAssembler');

function log(msg) {
  console.log(msg);
}

async function generateFromSdf(label, sdfRelativePath) {
  const root = path.resolve(__dirname, '..');
  const brickLibraryPath = path.resolve(root, 'brick-library');
  const outputRoot = path.resolve(root, 'generated');
  const sdfPath = path.resolve(root, sdfRelativePath);

  log(`\n=== [${label}] Generating ERP from ${path.relative(root, sdfPath)} ===`);

  const raw = await fsp.readFile(sdfPath, 'utf8');
  const sdf = JSON.parse(raw);

  const projectId = `itest-${label.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  const brickRepo = new BrickRepository(brickLibraryPath);
  const assembler = new ProjectAssembler(brickRepo, outputRoot);

  const outputDir = await assembler.assemble(projectId, sdf);
  log(`Generated at: ${outputDir}`);
  return { outputDir, sdf };
}

function expectDirExists(base, rel, message) {
  const full = path.join(base, rel);
  assert.ok(fs.existsSync(full), message || `Expected directory: ${rel}`);
}

async function expectFileContains(filePath, needle, message) {
  assert.ok(fs.existsSync(filePath), `Expected file to exist: ${filePath}`);
  const content = await fsp.readFile(filePath, 'utf8');
  assert.ok(
    content.includes(needle),
    message || `Expected to find "${needle}" in ${filePath}`
  );
}

async function testInvoiceOnlyBuild() {
  const { outputDir } = await generateFromSdf(
    'invoice-only',
    'test/sample_sdf_invoice.json'
  );

  const backendRoot = path.join(outputDir, 'backend');
  const frontendRoot = path.join(outputDir, 'frontend');

  expectDirExists(outputDir, 'backend', 'Backend folder should be generated');
  expectDirExists(outputDir, 'frontend', 'Frontend folder should be generated');

  // Backend modules
  expectDirExists(backendRoot, path.join('modules', 'invoice'), 'Invoice backend module should exist');

  // Routes should expose invoice and invoice_items APIs
  const routesIndex = path.join(backendRoot, 'src', 'routes', 'index.js');
  await expectFileContains(
    routesIndex,
    "router.use('/invoices'",
    'Routes index should mount /invoices API'
  );
  await expectFileContains(
    routesIndex,
    "router.use('/invoice_items'",
    'Routes index should mount /invoice_items API'
  );

  // Frontend should have invoice pages
  expectDirExists(
    path.join(outputDir, 'frontend'),
    path.join('modules', 'invoice'),
    'Invoice frontend module should exist'
  );
}

async function testHrOnlyBuild() {
  const { outputDir } = await generateFromSdf('hr-only', 'test/sample_sdf_hr.json');

  const backendRoot = path.join(outputDir, 'backend');
  const frontendRoot = path.join(outputDir, 'frontend');

  expectDirExists(outputDir, 'backend', 'Backend folder should be generated');
  expectDirExists(outputDir, 'frontend', 'Frontend folder should be generated');

  // Backend modules
  expectDirExists(backendRoot, path.join('modules', 'hr'), 'HR backend module should exist');

  const routesIndex = path.join(backendRoot, 'src', 'routes', 'index.js');
  await expectFileContains(
    routesIndex,
    "router.use('/employees'",
    'Routes index should mount /employees API'
  );
  await expectFileContains(
    routesIndex,
    "router.use('/departments'",
    'Routes index should mount /departments API'
  );
  await expectFileContains(
    routesIndex,
    "router.use('/leaves'",
    'Routes index should mount /leaves API'
  );

  // Frontend should have HR pages
  expectDirExists(
    frontendRoot,
    path.join('modules', 'hr'),
    'HR frontend module should exist'
  );
}

async function testHrInventoryCombinedBuild() {
  const { outputDir } = await generateFromSdf(
    'hr-inventory',
    'test/sample_sdf_hr_inventory.json'
  );

  const backendRoot = path.join(outputDir, 'backend');
  const frontendRoot = path.join(outputDir, 'frontend');

  expectDirExists(backendRoot, path.join('modules', 'hr'), 'HR backend module should exist');
  expectDirExists(
    backendRoot,
    path.join('modules', 'inventory'),
    'Inventory backend module should exist'
  );

  const routesIndex = path.join(backendRoot, 'src', 'routes', 'index.js');
  await expectFileContains(
    routesIndex,
    "router.use('/products'",
    'Routes index should mount /products API'
  );
  await expectFileContains(
    routesIndex,
    "router.use('/warehouses'",
    'Routes index should mount /warehouses API'
  );

  expectDirExists(frontendRoot, path.join('modules', 'hr'), 'HR frontend module should exist');
  expectDirExists(
    frontendRoot,
    path.join('modules', 'inventory'),
    'Inventory frontend module should exist'
  );
}

async function testMultiModuleBuild() {
  const { outputDir } = await generateFromSdf(
    'multi-module',
    'test/sample_sdf_multi_module.json'
  );

  const backendRoot = path.join(outputDir, 'backend');
  const frontendRoot = path.join(outputDir, 'frontend');

  expectDirExists(
    backendRoot,
    path.join('modules', 'inventory'),
    'Inventory backend module should exist'
  );
  expectDirExists(
    backendRoot,
    path.join('modules', 'invoice'),
    'Invoice backend module should exist'
  );

  const routesIndex = path.join(backendRoot, 'src', 'routes', 'index.js');
  await expectFileContains(
    routesIndex,
    "router.use('/products'",
    'Routes index should mount /products API'
  );
  await expectFileContains(
    routesIndex,
    "router.use('/invoices'",
    'Routes index should mount /invoices API'
  );

  expectDirExists(
    frontendRoot,
    path.join('modules', 'inventory'),
    'Inventory frontend module should exist'
  );
  expectDirExists(
    frontendRoot,
    path.join('modules', 'invoice'),
    'Invoice frontend module should exist'
  );
}

async function main() {
  try {
    await testInvoiceOnlyBuild();
    await testHrOnlyBuild();
    await testHrInventoryCombinedBuild();
    await testMultiModuleBuild();
    console.log('\nAll module generation integration checks passed.');
  } catch (err) {
    console.error('\nModule generation integration test failed.');
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

