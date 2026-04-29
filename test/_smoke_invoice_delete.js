// Quick smoke: assemble a project and verify the invoice list page now ships
// `handleDelete` + an `<InvoiceCard ... onDelete=` callsite.

'use strict';

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const BrickRepository = require('../platform/assembler/BrickRepository');
const ProjectAssembler = require('../platform/assembler/ProjectAssembler');

async function main() {
  const sdfPath = path.join(REPO_ROOT, 'test', 'sample_sdf_demo_everything.json');
  const sdf = JSON.parse(fs.readFileSync(sdfPath, 'utf8'));
  const outputRoot = path.join(REPO_ROOT, 'generated');
  fs.mkdirSync(outputRoot, { recursive: true });

  const brickRepo = new BrickRepository(path.join(REPO_ROOT, 'brick-library'));
  const assembler = new ProjectAssembler(brickRepo, outputRoot);

  const language = process.env.SMOKE_LANG || 'en';
  const genId = `_smoke_invoice_delete-${language}-${Date.now()}`;
  const outputDir = await assembler.assemble(genId, sdf, {
    standalone: true,
    language,
  });

  // Find any *Page.tsx that imports InvoiceCard.
  const pages = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/Page\.tsx$/.test(e.name) && !/FormPage\.tsx$/.test(e.name)) {
        try {
          const text = fs.readFileSync(full, 'utf8');
          if (text.includes('import InvoiceCard from')) pages.push({ full, text });
        } catch {/* ignore */}
      }
    }
  };
  for (const sub of ['frontend/modules', 'app/modules']) {
    const root = path.join(outputDir, ...sub.split('/'));
    if (fs.existsSync(root)) walk(root);
  }
  if (pages.length === 0) {
    console.error('[smoke] No invoice list page found');
    process.exit(1);
  }
  let failures = 0;
  for (const { full, text } of pages) {
    const rel = path.relative(REPO_ROOT, full);
    const checks = [
      ['handleDelete present', /const handleDelete\s*=\s*async/.test(text)],
      ['confirmDelete in I18N', /confirmDelete/.test(text)],
      ['onDelete prop on card', /<InvoiceCard[\s\S]*?onDelete=\{handleDelete\}/.test(text)],
      ['delete endpoint correct', /api\.delete\('\/[\w-]+\/'\s*\+\s*id\)/.test(text)],
    ];
    console.log(`\n[smoke] ${rel}`);
    for (const [name, ok] of checks) {
      console.log(`  ${ok ? 'OK ' : 'FAIL'} ${name}`);
      if (!ok) failures += 1;
    }
  }

  // Backend cascade-delete + auto-draft cleanup smoke checks.
  const findFile = (rel) => {
    const candidates = ['backend', 'app'].map((b) => path.join(outputDir, b, rel));
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return null;
  };
  const invoiceServicePath = findFile('modules/invoice/src/services/Billing_docketsService.js');
  if (invoiceServicePath) {
    const t = fs.readFileSync(invoiceServicePath, 'utf8');
    const beServiceChecks = [
      ['cascades billing_docket_lines', /__ownedRows[\s\S]*?findAll\('billing_docket_lines'\)[\s\S]*?repository\.delete\('billing_docket_lines'/.test(t)],
      ['blocks billing_settlement_splits', /dependents\.push\(\{[\s\S]*?entity:\s*'billing_settlement_splits'/.test(t)],
      ['does NOT cascade billing_settlement_splits', !/__ownedRows = await this\.repository\.findAll\('billing_settlement_splits'\)/.test(t)],
      ['emits 409 path', /statusCode = 409/.test(t)],
    ];
    console.log(`\n[smoke] ${path.relative(REPO_ROOT, invoiceServicePath)}`);
    for (const [name, ok] of beServiceChecks) {
      console.log(`  ${ok ? 'OK ' : 'FAIL'} ${name}`);
      if (!ok) failures += 1;
    }
  } else {
    console.error('[smoke] Billing_docketsService.js not found');
    failures += 1;
  }

  // Auto-draft cleanup on Cancel.
  const fePages = [];
  const walkFE = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkFE(full);
      else if (/FormPage\.tsx$/.test(e.name)) fePages.push(full);
    }
  };
  for (const sub of ['frontend/modules', 'app/modules']) {
    const root = path.join(outputDir, ...sub.split('/'));
    if (fs.existsSync(root)) walkFE(root);
  }
  const invoiceFormPath = fePages.find((p) => /Billing_docketsFormPage\.tsx$/.test(p));
  if (invoiceFormPath) {
    const t = fs.readFileSync(invoiceFormPath, 'utf8');
    const feFormChecks = [
      ['isAutoDraft state declared', /const \[isAutoDraft, setIsAutoDraft\]/.test(t)],
      ['flips isAutoDraft after navigate', /setIsAutoDraft\(true\);[\s\S]*?navigate\('\/billing_dockets\/'\s*\+\s*newId/.test(t)],
      ['handleCancel deletes orphan draft', /const handleCancel\s*=\s*async[\s\S]*?api\.delete\('\/billing_dockets\/'\s*\+\s*id\)/.test(t)],
      ['onCancel wired to handleCancel', /onCancel=\{handleCancel\}/.test(t)],
    ];
    console.log(`\n[smoke] ${path.relative(REPO_ROOT, invoiceFormPath)}`);
    for (const [name, ok] of feFormChecks) {
      console.log(`  ${ok ? 'OK ' : 'FAIL'} ${name}`);
      if (!ok) failures += 1;
    }
  } else {
    console.error('[smoke] Billing_docketsFormPage.tsx not found');
    failures += 1;
  }

  if (failures > 0) {
    console.error(`\n[smoke] ${failures} check(s) failed`);
    process.exit(2);
  }
  console.log(`\n[smoke] All checks passed across ${pages.length} invoice list page(s)`);
  // Cleanup
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
  } catch {/* ignore */}
}

main().catch((err) => {
  console.error('[smoke] FATAL:', err && err.stack ? err.stack : err);
  process.exit(1);
});
