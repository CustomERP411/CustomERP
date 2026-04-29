/**
 * Repo-wide patcher for the bugs that ship with every generated ERP under
 * `generated/<project>/`. The corresponding template fixes live in:
 *
 *   platform/assembler/generators/frontend/entityPages/listPage.js   (hasStatusField)
 *   platform/assembler/generators/frontend/entityPages/formPage.js   (autoDraft state)
 *   platform/assembler/generators/backend/schemaGenerator.js         (FK NOT NULL)
 *   platform/assembler/generators/BackendGenerator.js                (003 migration)
 *   platform/assembler/generators/frontend/invoicePages.js           (invoice delete)
 *   brick-library/frontend-bricks/components/modules/invoice/InvoiceCard.tsx (onDelete prop)
 *
 * This script applies the same fixes to ALREADY-GENERATED projects in place,
 * so the user does not need to regenerate from scratch:
 *
 * (1) `*Page.tsx`: replace the buggy `&& hasStatusField` reference with an
 *     inline runtime check derived from the in-scope `fieldDefinitions`.
 *
 * (2) `*FormPage.tsx`: clear `autoDraftCreating` BEFORE the post-success
 *     navigate (react-router reuses the same component instance for /new →
 *     /:id/edit, so the useState initialiser does not re-run and the
 *     spinner state would otherwise survive the URL change), AND gate the
 *     spinner render on `!isEdit && autoDraftCreating` so any leftover
 *     truthy state is harmless once the URL flips to /:id/edit.
 *
 * (3) Backend migrations: drop a `003_relax_draft_fks.sql` next to the
 *     existing 001/002 migrations so DBs that were created before the fix
 *     get NOT NULL relaxed on the auto-draft-blocking FK columns. The
 *     migration runner is idempotent (tracks applied names in
 *     `_migrations`), so re-running this script is safe; the SQL itself
 *     also uses IS-NULLABLE guards so the ALTER is a no-op once dropped.
 *
 * (4) Invoice list pages: the card-style invoice list never shipped a
 *     Delete button. We (a) overwrite InvoiceCard.tsx with the new version
 *     that accepts an optional `onDelete` prop and (b) inject a
 *     `handleDelete` flow into the *InvoicesPage*-style files plus pass
 *     `onDelete={handleDelete}` to the card.
 *
 * Run from the repo root:
 *   node test/_patch_has_status_field.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATED_ROOT = path.join(REPO_ROOT, 'generated');

// ──────────────────────────────────────────────────────────────────────
// (1) hasStatusField fix — runs on every list page (`*Page.tsx`)
// ──────────────────────────────────────────────────────────────────────

const HAS_STATUS_NEEDLE =
  "const isStatusCol = col.key === 'status' && hasStatusField;";
const HAS_STATUS_REPLACEMENT =
  "const isStatusCol = col.key === 'status' && fieldDefinitions.some((f) => f && f.name === 'status');";

function patchHasStatusField(file, text) {
  if (!text.includes(HAS_STATUS_NEEDLE)) return null;
  return text.split(HAS_STATUS_NEEDLE).join(HAS_STATUS_REPLACEMENT);
}

// ──────────────────────────────────────────────────────────────────────
// (2) autoDraftCreating fix — runs on every form page (`*FormPage.tsx`)
// ──────────────────────────────────────────────────────────────────────

const AUTO_DRAFT_RESET_MARKER = 'setAutoDraftCreating(false);\n          setLoading(true);';

function patchAutoDraftCreating(file, text) {
  let next = text;
  let changed = false;

  // (2a) Reset autoDraftCreating before navigate in the success branch.
  // Old shape (single line indented 10 spaces):
  //   setLoading(true);
  //   navigate('/<slug>/' + newId + '/edit', { replace: true });
  //   return;
  // New shape: insert setAutoDraftCreating(false) above setLoading(true).
  const navigateRe =
    /(\n {10})setLoading\(true\);(\n {10}navigate\('\/[^']+\/' \+ newId \+ '\/edit', \{ replace: true \}\);)/;
  if (navigateRe.test(next) && !next.includes(AUTO_DRAFT_RESET_MARKER)) {
    next = next.replace(
      navigateRe,
      `$1setAutoDraftCreating(false);$1setLoading(true);$2`
    );
    changed = true;
  }

  // (2b) Gate the spinner JSX on !isEdit so any leftover state is benign
  // once react-router flips the URL to /:id/edit.
  const renderNeedle = '{autoDraftCreating ? (';
  const renderReplacement = '{!isEdit && autoDraftCreating ? (';
  if (next.includes(renderNeedle) && !next.includes(renderReplacement)) {
    next = next.split(renderNeedle).join(renderReplacement);
    changed = true;
  }

  return changed ? next : null;
}

// ──────────────────────────────────────────────────────────────────────
// (3) 003_relax_draft_fks.sql — emit per generated backend
// ──────────────────────────────────────────────────────────────────────

// Tables/columns we know the auto-draft flow trips on. Each ALTER is
// guarded by an information_schema check so the migration is safe on
// projects that don't ship a given table.
const FK_RELAX_TARGETS = [
  ['billing_dockets', 'customer_id'],
  ['billing_settlements', 'customer_id'],
  ['billing_adjustments', 'source_invoice_id'],
  ['procurement_orders', 'supplier_id'],
  ['dispatch_orders', 'customer_id'],
  ['arrival_dockets', 'purchase_order_id'],
];

function buildRelaxDraftFkSql() {
  const blocks = FK_RELAX_TARGETS.map(([slug, column]) => {
    return [
      '  IF EXISTS (',
      '    SELECT 1 FROM information_schema.columns',
      "    WHERE table_schema = 'public'",
      `      AND table_name = '${slug}'`,
      `      AND column_name = '${column}'`,
      "      AND is_nullable = 'NO'",
      '  ) THEN',
      `    ALTER TABLE "${slug}" ALTER COLUMN "${column}" DROP NOT NULL;`,
      '  END IF;',
    ].join('\n');
  });

  const header = [
    '-- Generated by test/_patch_has_status_field.js',
    '-- 003_relax_draft_fks.sql',
    '--',
    '-- Plan H follow-up: drops NOT NULL on FK columns that the auto-draft',
    '-- (POST /<slug>/draft) flow cannot pre-fill. The service-layer',
    '-- validator still enforces required-ness for non-Draft statuses, so',
    '-- this only widens the column constraint, not the validation rules.',
    '',
  ];

  return `${header.join('\n')}\nDO $$\nBEGIN\n${blocks.join('\n\n')}\nEND $$;\n`;
}

// ──────────────────────────────────────────────────────────────────────
// (4) Invoice list pages — add handleDelete + wire it to <InvoiceCard />
// ──────────────────────────────────────────────────────────────────────

// Read the canonical InvoiceCard from the brick library so we don't have
// to keep a duplicate copy in sync inside this script.
const INVOICE_CARD_BRICK = path.join(
  REPO_ROOT,
  'brick-library',
  'frontend-bricks',
  'components',
  'modules',
  'invoice',
  'InvoiceCard.tsx'
);

let _cachedCardSource = null;
function getInvoiceCardSource() {
  if (_cachedCardSource !== null) return _cachedCardSource;
  try {
    _cachedCardSource = fs.readFileSync(INVOICE_CARD_BRICK, 'utf8');
  } catch {
    _cachedCardSource = '';
  }
  return _cachedCardSource;
}

function patchInvoicesPage(file, text) {
  // Heuristic: only touch files that actually use InvoiceCard.
  if (!text.includes("import InvoiceCard from")) return null;
  // Already patched? (Idempotent.)
  if (/const handleDelete\s*=\s*async/.test(text)) return null;

  // Extract the slug from the first `api.get('/<slug>')` call. We need it
  // for the DELETE endpoint and the refresh refetch.
  const slugMatch = text.match(/api\.get\('\/([\w-]+)'\)/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  let patched = text;

  // (4a) Append delete-related keys to the I18N const. The existing block
  // ends with `\n} as const;`. We don't want to clobber whatever's in there,
  // just inject the missing keys before the closing brace.
  const i18nClose = '\n} as const;';
  const idxClose = patched.indexOf(i18nClose);
  if (idxClose < 0) return null;

  const i18nExtra = [
    '  "delete": "Delete",',
    '  "confirmDelete": "Are you sure you want to delete this?",',
    '  "deletedToast": "Record deleted.",',
    '  "deleteFailedToast": "Failed to delete record.",',
    '  "deleteBlockedTitle": "Cannot delete",',
    '  "cantDeleteRefBy": "This record is referenced by other records"',
  ].join('\n');

  // We're inserting BEFORE `\n} as const;`. The existing line above the
  // close is something like `  "loadFailed": "Failed to load invoices"`
  // (no trailing comma). Add a comma there before our extras.
  const beforeClose = patched.slice(0, idxClose);
  const afterClose = patched.slice(idxClose);
  // Match the last property in the I18N object (a non-comma-terminated line)
  // and add a comma. We only do this if the last char of beforeClose is `"`
  // (i.e., a closing quote of the previous value).
  const lastCharIdx = beforeClose.length - 1;
  let beforeWithComma = beforeClose;
  if (beforeClose[lastCharIdx] === '"') {
    beforeWithComma = `${beforeClose},`;
  }
  patched = `${beforeWithComma}\n${i18nExtra}${afterClose}`;

  // (4b) Inject refreshItems + handleDelete after the first `}, []);`
  // (close of the load useEffect).
  const useEffectMarker = '}, []);';
  const ueIdx = patched.indexOf(useEffectMarker);
  if (ueIdx < 0) return null;
  const insertAt = ueIdx + useEffectMarker.length;

  const helpers = `

  const refreshItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/${slug}');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast({ title: I18N.loadFailed, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (!confirm(I18N.confirmDelete)) return;
    try {
      await api.delete('/${slug}/' + id);
      toast({ title: I18N.deletedToast, variant: 'success' });
      await refreshItems();
    } catch (err: any) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      if (status === 409) {
        toast({
          title: I18N.deleteBlockedTitle,
          description: payload?.error || I18N.cantDeleteRefBy,
          variant: 'warning',
        });
        return;
      }
      console.error('Delete failed:', err);
      toast({
        title: I18N.deleteFailedToast,
        description: payload?.error || I18N.deleteFailedToast,
        variant: 'error',
      });
    }
  };`;

  patched = patched.slice(0, insertAt) + helpers + patched.slice(insertAt);

  // (4c) Add onDelete + deleteLabel props on the <InvoiceCard ... /> usage.
  // The original block ends with `currency={currency}` followed by `\n            />`.
  const cardCloseRe = /(<InvoiceCard\b[\s\S]*?currency=\{currency\})(\s*\/>)/;
  if (!cardCloseRe.test(patched)) return null;
  patched = patched.replace(
    cardCloseRe,
    `$1\n              onDelete={handleDelete}\n              deleteLabel={I18N.delete}$2`
  );

  return patched;
}

function patchInvoiceCard(file) {
  const fresh = getInvoiceCardSource();
  if (!fresh) return false;
  let current = '';
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  if (current === fresh) return false;
  fs.writeFileSync(file, fresh, 'utf8');
  return true;
}

// ──────────────────────────────────────────────────────────────────────
// Driver
// ──────────────────────────────────────────────────────────────────────

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function projectRoots() {
  if (!fs.existsSync(GENERATED_ROOT)) return [];
  return fs
    .readdirSync(GENERATED_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(GENERATED_ROOT, d.name));
}

function applyToProject(projectRoot) {
  const stats = {
    project: path.relative(REPO_ROOT, projectRoot),
    listPagesPatched: 0,
    formPagesPatched: 0,
    invoicePagesPatched: 0,
    invoiceCardsRewritten: 0,
    migrationWritten: false,
  };

  const frontendModules = path.join(projectRoot, 'frontend', 'modules');
  if (fs.existsSync(frontendModules)) {
    for (const file of walk(frontendModules)) {
      if (!/\.tsx?$/.test(file)) continue;
      const original = fs.readFileSync(file, 'utf8');
      let patched = original;

      const isFormPage = /FormPage\.tsx?$/.test(file);
      const isListPage = /Page\.tsx?$/.test(file) && !isFormPage;

      if (isListPage) {
        const next = patchHasStatusField(file, patched);
        if (next && next !== patched) {
          patched = next;
          stats.listPagesPatched += 1;
        }
        const invoiceNext = patchInvoicesPage(file, patched);
        if (invoiceNext && invoiceNext !== patched) {
          patched = invoiceNext;
          stats.invoicePagesPatched += 1;
        }
      }
      if (isFormPage) {
        const next = patchAutoDraftCreating(file, patched);
        if (next && next !== patched) {
          patched = next;
          stats.formPagesPatched += 1;
        }
      }

      if (patched !== original) {
        fs.writeFileSync(file, patched, 'utf8');
        console.log(`  patched ${path.relative(REPO_ROOT, file)}`);
      }
    }
  }

  // Refresh the InvoiceCard.tsx component shipped with the project so the
  // newly added `onDelete` prop has somewhere to land.
  const invoiceCardCandidates = [
    path.join(
      projectRoot,
      'frontend',
      'src',
      'components',
      'modules',
      'invoice',
      'InvoiceCard.tsx'
    ),
    path.join(
      projectRoot,
      'app',
      'src',
      'components',
      'modules',
      'invoice',
      'InvoiceCard.tsx'
    ),
  ];
  for (const candidate of invoiceCardCandidates) {
    if (fs.existsSync(candidate) && patchInvoiceCard(candidate)) {
      stats.invoiceCardsRewritten += 1;
      console.log(`  refreshed ${path.relative(REPO_ROOT, candidate)}`);
    }
  }

  // Two layouts exist:
  //   docker-compose / Postgres projects → backend/src/repository/migrations/
  //   standalone / SQLite previews       → app/src/repository/migrations/
  // 003_relax_draft_fks.sql is Postgres-only (DO $$ ... END $$;), so we
  // ONLY emit it under the docker-compose layout. The standalone schema
  // already has the relaxed FK columns courtesy of schemaGenerator's
  // _shouldEmitNotNull() helper.
  const pgMigrations = path.join(
    projectRoot,
    'backend',
    'src',
    'repository',
    'migrations'
  );
  const sqliteMigrations = path.join(
    projectRoot,
    'app',
    'src',
    'repository',
    'migrations'
  );

  if (fs.existsSync(pgMigrations) && !fs.existsSync(sqliteMigrations)) {
    const target = path.join(pgMigrations, '003_relax_draft_fks.sql');
    const sql = buildRelaxDraftFkSql();
    let needWrite = true;
    if (fs.existsSync(target)) {
      try {
        if (fs.readFileSync(target, 'utf8') === sql) needWrite = false;
      } catch {
        /* fall through */
      }
    }
    if (needWrite) {
      fs.writeFileSync(target, sql, 'utf8');
      stats.migrationWritten = true;
      console.log(`  wrote ${path.relative(REPO_ROOT, target)}`);
    }
  } else if (fs.existsSync(sqliteMigrations)) {
    // Standalone preview project — skip and remove any stale Postgres-only
    // 003 that a previous run of this script may have dropped here.
    const stale = path.join(sqliteMigrations, '003_relax_draft_fks.sql');
    if (fs.existsSync(stale)) {
      try {
        fs.unlinkSync(stale);
        console.log(
          `  removed ${path.relative(REPO_ROOT, stale)} (SQLite project)`
        );
      } catch {
        /* fall through */
      }
    }
  }

  return stats;
}

const roots = projectRoots();
if (roots.length === 0) {
  console.log('No projects found under generated/. Nothing to patch.');
  process.exit(0);
}

console.log(`Patching ${roots.length} generated project(s)...\n`);
const all = roots.map((root) => {
  console.log(`▶ ${path.relative(REPO_ROOT, root)}`);
  return applyToProject(root);
});

console.log('\nSummary:');
for (const s of all) {
  console.log(
    `  ${s.project}: ${s.listPagesPatched} list page(s), ` +
      `${s.formPagesPatched} form page(s), ` +
      `${s.invoicePagesPatched} invoice list page(s), ` +
      `${s.invoiceCardsRewritten} invoice card(s), ` +
      `migration: ${s.migrationWritten ? 'written' : 'up-to-date'}`
  );
}
