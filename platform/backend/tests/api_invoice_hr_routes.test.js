// API-surface tests for generated invoice and HR module endpoints.
// These tests assert that generated backends expose REST routes for the new modules.
// Run after generating an ERP using the sample SDFs, e.g. via:
//   node test/module_generation.integration.test.js
//
// Then execute:
//   node platform/backend/tests/api_invoice_hr_routes.test.js

/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const assert = require('assert');

function log(msg) {
  console.log(msg);
}

async function listGeneratedRouteIndexes() {
  const root = path.resolve(__dirname, '..', '..', '..');
  const generatedRoot = path.join(root, 'generated');
  const entries = await fsp.readdir(generatedRoot, { withFileTypes: true }).catch(() => []);

  const candidates = await Promise.all(
    entries
      .filter((d) => d.isDirectory())
      .map(async (dir) => {
        const fullPath = path.join(generatedRoot, dir.name, 'backend', 'src', 'routes', 'index.js');
        if (!fs.existsSync(fullPath)) return null;
        const stat = await fsp.stat(fullPath);
        const content = await fsp.readFile(fullPath, 'utf8');
        return { name: dir.name, fullPath, mtime: stat.mtimeMs, content };
      })
  );

  return candidates.filter(Boolean).sort((a, b) => b.mtime - a.mtime);
}

function formatCandidateNames(candidates) {
  return candidates.slice(0, 10).map((c) => c.name).join(', ');
}

async function loadRoutesIndexForRequiredRoutes({ requiredRoutes, label }) {
  const candidates = await listGeneratedRouteIndexes();
  if (!candidates.length) {
    throw new Error('No generated backend routes/index.js found under generated/. Run the module generation integration tests first.');
  }

  const picked = candidates.find((candidate) =>
    requiredRoutes.every((routeSnippet) => candidate.content.includes(routeSnippet))
  );

  if (!picked) {
    throw new Error(
      [
        `No generated backend found with expected ${label} routes: ${requiredRoutes.join(', ')}`,
        `Recent generated candidates: ${formatCandidateNames(candidates)}`,
        'Generate an ERP artifact that includes the required module/entity routes and re-run this test.',
      ].join('\n')
    );
  }

  log(`Using generated backend for ${label} routes from: ${picked.name}`);
  return { content: picked.content, filePath: picked.fullPath };
}

async function testInvoiceRoutesExist() {
  const { content, filePath } = await loadRoutesIndexForRequiredRoutes({
    label: 'invoice',
    requiredRoutes: ["router.use('/invoices'", "router.use('/invoice_items'"],
  });

  assert.ok(
    content.includes("router.use('/invoices'"),
    `Expected /invoices route to be mounted in ${filePath}`
  );
  assert.ok(
    content.includes("router.use('/invoice_items'"),
    `Expected /invoice_items route to be mounted in ${filePath}`
  );

  console.log('✓ Invoice routes (/invoices, /invoice_items) are wired in routes index.');
}

async function testHrRoutesExist() {
  const { content, filePath } = await loadRoutesIndexForRequiredRoutes({
    label: 'HR',
    requiredRoutes: ["router.use('/employees'", "router.use('/departments'", "router.use('/leaves'"],
  });

  assert.ok(
    content.includes("router.use('/employees'"),
    `Expected /employees route to be mounted in ${filePath}`
  );
  assert.ok(
    content.includes("router.use('/departments'"),
    `Expected /departments route to be mounted in ${filePath}`
  );
  assert.ok(
    content.includes("router.use('/leaves'"),
    `Expected /leaves route to be mounted in ${filePath}`
  );

  console.log('✓ HR routes (/employees, /departments, /leaves) are wired in routes index.');
}

async function main() {
  try {
    await testInvoiceRoutesExist();
    await testHrRoutesExist();
    console.log('\nAll invoice/HR API surface checks passed.');
  } catch (err) {
    console.error('\nInvoice/HR API surface test failed.');
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

