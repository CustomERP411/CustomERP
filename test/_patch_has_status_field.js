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

// Anchor marker only checks for the autoDraft reset call. Patch (2c) below
// inserts `setIsAutoDraft(true);` between this and `setLoading(true);`, so
// matching the literal pair would falsely re-fire (2a). Just look for the
// reset call presence — its only emitter is patch (2a) itself.
const AUTO_DRAFT_RESET_MARKER = 'setAutoDraftCreating(false);';

function patchAutoDraftCreating(file, text) {
  let next = text;
  let changed = false;

  // Idempotency cleanup — earlier patcher runs (before AUTO_DRAFT_RESET_MARKER
  // was relaxed) could re-fire (2a) once (2c) had inserted setIsAutoDraft
  // between the lines, leaving a duplicate `setAutoDraftCreating(false);`
  // sitting right next to the canonical one. Strip the dupe so the form
  // never schedules the same state setter twice.
  const dupeRe = /(setAutoDraftCreating\(false\);\s*\n\s*setIsAutoDraft\(true\);\s*\n\s*)setAutoDraftCreating\(false\);\s*\n\s*/;
  if (dupeRe.test(next)) {
    next = next.replace(dupeRe, '$1');
    changed = true;
  }

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

  // (2c) Auto-draft cleanup on Cancel. When the form's load redirected
  // /new → /:id/edit it left a placeholder Draft row; if the user clicks
  // Cancel WITHOUT saving, that row leaks into the list. Track the
  // "draft-but-not-yet-saved" condition with `isAutoDraft` and have a
  // dedicated `handleCancel` issue a DELETE before navigating away.
  if (
    next.includes('autoDraftCreating') &&
    !next.includes('const [isAutoDraft,')
  ) {
    // (i) Add isAutoDraft state right after autoDraftFailed.
    const stateAnchor =
      'const [autoDraftFailed, setAutoDraftFailed] = useState<boolean>(false);';
    if (next.includes(stateAnchor)) {
      next = next.replace(
        stateAnchor,
        `${stateAnchor}\n  const [isAutoDraft, setIsAutoDraft] = useState<boolean>(false);`
      );
      changed = true;
    }

    // (ii) Flip isAutoDraft on right after we kick off the navigate.
    const flipAnchor = 'setAutoDraftCreating(false);\n          setLoading(true);';
    if (next.includes(flipAnchor) && !next.includes('setIsAutoDraft(true);')) {
      next = next.replace(
        flipAnchor,
        'setAutoDraftCreating(false);\n          setIsAutoDraft(true);\n          setLoading(true);'
      );
      changed = true;
    }

    // (iii) Insert handleCancel right after the closing of handleSubmit.
    // We anchor on the unique edit-path call `await api.put('/<slug>/' + id, data);`,
    // walk forward to the next standalone `};` that closes the function,
    // and inject our handler immediately after it.
    if (!next.includes('const handleCancel = async')) {
      const slugMatch = next.match(/api\.delete\('\/([\w_-]+)\/'\s*\+\s*id\)/);
      const apiPutMatch = next.match(
        /await api\.put\('\/([\w_-]+)\/'\s*\+\s*id, data\);/
      );
      const slug = (slugMatch && slugMatch[1]) || (apiPutMatch && apiPutMatch[1]);
      // Find the end of handleSubmit by locating the next `\n  };` after the
      // first `const handleSubmit = async (data: any) => {`.
      const submitStart = next.indexOf('const handleSubmit = async (data: any) => {');
      if (slug && submitStart >= 0) {
        // Walk forward and bracket-count.
        let depth = 0;
        let endIdx = -1;
        let started = false;
        for (let i = submitStart; i < next.length; i += 1) {
          const c = next[i];
          if (c === '{') {
            depth += 1;
            started = true;
          } else if (c === '}') {
            depth -= 1;
            if (started && depth === 0) {
              endIdx = i;
              break;
            }
          }
        }
        if (endIdx > 0) {
          // Look for the `;` that follows the closing brace of `};`.
          // Insert the helper RIGHT after the closing `};` of handleSubmit.
          const after = next.indexOf(';', endIdx);
          if (after > 0) {
            const insertion = `\n\n  const handleCancel = async () => {\n    if (isAutoDraft && id) {\n      try {\n        await api.delete('/${slug}/' + id);\n      } catch (e) {\n        // Swallow — orphan can still be deleted from the list.\n      }\n    }\n    navigate('/${slug}');\n  };`;
            next = next.slice(0, after + 1) + insertion + next.slice(after + 1);
            changed = true;
          }
        }
      }
    }

    // (iv) Wire <DynamicForm onCancel={...}> to the new handler. Replaces
    // BOTH callsites (UI-sections branch + default-layout branch).
    const cancelOld = `onCancel={() => navigate('/${
      // re-derive slug from any DELETE call; keep the regex liberal
      ''
    }')}`;
    // We can't statically interpolate the slug here, so use a regex:
    const cancelNeedleRe = /onCancel=\{\(\)\s*=>\s*navigate\('\/[\w_-]+'\)\}/g;
    if (cancelNeedleRe.test(next)) {
      next = next.replace(cancelNeedleRe, 'onCancel={handleCancel}');
      changed = true;
    }
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
// (5) Cascade-delete owned children — patch service files in place
// ──────────────────────────────────────────────────────────────────────

// Build a cascade replacement block matching the new shape emitted by
// platform/assembler/generators/backend/validationCodegen.js.
function _buildCascadeBlock(otherSlug, fields) {
  const escSlug = otherSlug.replace(/'/g, "\\'");
  const checks = fields
    .map((f) => `String(row['${f}'] ?? '') === String(id)`)
    .join(' || ');
  return `      {
        const __ownedRows = await this.repository.findAll('${escSlug}');
        for (const row of __ownedRows) {
          if (${checks}) {
            try {
              await this.repository.delete('${escSlug}', row.id);
            } catch (e) {
              // Surface as 409 so the caller can react; the parent is still intact.
              const __cascadeErr = new Error('Cannot delete: failed to remove owned child row in ${escSlug} (' + (e && e.message ? e.message : 'unknown error') + ')');
              __cascadeErr.statusCode = 409;
              throw __cascadeErr;
            }
          }
        }
      }`;
}

// Read the SDF for a project, indexed by entity.slug → set of owned-child slugs.
function _ownedSlugMapForProject(projectRoot) {
  const sdfPath = path.join(projectRoot, 'sdf.json');
  let sdf;
  try {
    sdf = JSON.parse(fs.readFileSync(sdfPath, 'utf8'));
  } catch {
    return null;
  }
  const entities = Array.isArray(sdf && sdf.entities) ? sdf.entities : [];
  const map = new Map();
  for (const e of entities) {
    if (!e || !e.slug) continue;
    const owned = new Set();
    const children = Array.isArray(e.children) ? e.children : [];
    for (const ch of children) {
      if (!ch) continue;
      const slug = String(ch.entity || ch.slug || '').trim();
      if (slug) owned.add(slug);
    }
    if (owned.size) map.set(e.slug, owned);
  }
  return map;
}

function patchDeleteCascade(file, text, ownedMap) {
  if (!/Service\.js$/.test(file)) return null;
  if (!text.includes('// @HOOK: BEFORE_DELETE_VALIDATION')) return null;
  // Idempotent — already migrated to the new emitter.
  if (text.includes('Delete cascade + protection (generated)')) return null;

  const slugMatch = text.match(/this\.slug\s*=\s*'([\w_-]+)'/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  const ownedSlugs = ownedMap.get(slug);
  if (!ownedSlugs || ownedSlugs.size === 0) return null;

  // Each existing dependents block is shaped like:
  //
  //   {
  //     const rows = await this.repository.findAll('OTHER');
  //     const matches = rows.filter((row) => ... );
  //     if (matches.length) {
  //       dependents.push({
  //         entity: 'OTHER',
  //         via: [...],
  //         count: matches.length,
  //         preview: ...,
  //       });
  //     }
  //   }
  //
  // We keep blocks for external references and rewrite blocks for owned
  // children into cascading deletes. We walk by `findAll('SLUG')` anchors
  // and bracket-match outwards to find the enclosing `{ ... }` boundaries.
  const anchorRe = /const rows = await this\.repository\.findAll\('([\w_-]+)'\);/g;
  const replacements = [];
  let m;
  while ((m = anchorRe.exec(text)) !== null) {
    const otherSlug = m[1];
    if (!ownedSlugs.has(otherSlug)) continue; // External — keep block as-is.

    // Walk back from the match to the opening `{`.
    let openIdx = m.index;
    while (openIdx > 0 && text[openIdx] !== '{') openIdx -= 1;
    if (openIdx <= 0) continue;
    // Walk back further to capture the leading whitespace before `{`.
    let blockStart = openIdx;
    while (blockStart > 0 && (text[blockStart - 1] === ' ' || text[blockStart - 1] === '\n')) {
      // Stop when we've crossed at most one newline; we want to keep prior
      // statements untouched.
      if (text[blockStart - 1] === '\n' && text.slice(blockStart - 1, openIdx).includes('\n', 1)) break;
      blockStart -= 1;
      if (text[blockStart] === '\n') break;
    }

    // Now bracket-match forward from openIdx to find matching `}`.
    let depth = 0;
    let closeIdx = -1;
    for (let i = openIdx; i < text.length; i += 1) {
      const c = text[i];
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          closeIdx = i;
          break;
        }
      }
    }
    if (closeIdx < 0) continue;

    // Pull `via: [ ... ]` out of the block so we know which FK fields to
    // match on. Same regex shape as the codegen.
    const blockSrc = text.slice(openIdx, closeIdx + 1);
    const viaMatch = blockSrc.match(/via:\s*\[([^\]]*)\]/);
    if (!viaMatch) continue;
    const fields = viaMatch[1]
      .split(',')
      .map((s) => s.replace(/['"]/g, '').trim())
      .filter(Boolean);
    if (!fields.length) continue;

    replacements.push({
      from: openIdx,
      to: closeIdx + 1,
      replacement: _buildCascadeBlock(otherSlug, fields).replace(/^ {6}/, ''),
    });
  }

  if (!replacements.length) return null;

  // Apply replacements right-to-left so earlier indices stay valid.
  replacements.sort((a, b) => b.from - a.from);
  let out = text;
  for (const r of replacements) {
    out = out.slice(0, r.from) + r.replacement + out.slice(r.to);
  }

  // Mark the file as patched so re-runs are no-ops. We add a one-line
  // comment immediately under `// @HOOK: BEFORE_DELETE_VALIDATION` rather
  // than touching unrelated code.
  const marker = '// @HOOK: BEFORE_DELETE_VALIDATION';
  const markerIdx = out.indexOf(marker);
  if (markerIdx >= 0) {
    const insertAt = markerIdx + marker.length;
    out =
      out.slice(0, insertAt) +
      '\n    // Delete cascade + protection (generated)' +
      out.slice(insertAt);
  }

  return out;
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
// (6) Invoice list pages — resolve customer_id → customer_name so the
//     card stops painting raw UUIDs. Mirrors the codegen change in
//     platform/assembler/generators/frontend/invoicePages.js (REFERENCE_FIELDS,
//     REFERENCE_SLUGS, refMaps state, ref-loading useEffect, enrichedItems).
// ──────────────────────────────────────────────────────────────────────

function _resolveRefSlugForPatcher(field, sdf) {
  if (!field) return null;
  const explicit = field.reference_entity || field.referenceEntity;
  const name = String(field.name || '');
  const inferredBase = name.replace(/_ids?$/, '');
  const baseName = String(explicit || inferredBase);
  if (!baseName) return null;
  const entities = Array.isArray(sdf && sdf.entities) ? sdf.entities : [];
  const target = entities.find((e) =>
    e.slug === baseName ||
    e.slug === baseName + 's' ||
    e.slug === baseName + 'es' ||
    (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
    e.slug.startsWith(baseName)
  );
  return target ? target.slug : (explicit ? String(explicit) : null);
}

function _isRefFieldForPatcher(field) {
  if (!field) return false;
  if (field.type === 'reference') return true;
  const name = String(field.name || '');
  return /_ids?$/.test(name) && !!(field.reference_entity || field.referenceEntity);
}

function _displayFieldForPatcher(slug, sdf) {
  const entities = Array.isArray(sdf && sdf.entities) ? sdf.entities : [];
  const e = entities.find((x) => x && x.slug === slug);
  return (e && (e.display_field || e.displayField)) || 'name';
}

function _projectLanguage(sdf) {
  const meta = (sdf && (sdf.metadata || sdf.meta)) || {};
  const lang = String(meta.language || meta.lang || 'en').toLowerCase();
  return lang;
}

function patchInvoicesPageRefResolution(file, text, sdf) {
  if (!text.includes("import InvoiceCard from")) return null;
  if (text.includes('REFERENCE_FIELDS')) return null; // Already migrated.

  // Slug from the first api.get('/<slug>')
  const slugMatch = text.match(/api\.get\('\/([\w-]+)'\)/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  const entities = Array.isArray(sdf && sdf.entities) ? sdf.entities : [];
  const entity = entities.find((e) => e && e.slug === slug);
  if (!entity) return null;
  const fields = Array.isArray(entity.fields) ? entity.fields : [];
  const refFields = fields
    .map((f) => {
      if (!_isRefFieldForPatcher(f)) return null;
      const refSlug = _resolveRefSlugForPatcher(f, sdf);
      if (!refSlug) return null;
      const fieldName = String(f.name || '');
      const baseName = fieldName.endsWith('_id')
        ? fieldName.slice(0, -3)
        : fieldName.endsWith('_ids')
        ? fieldName.slice(0, -4)
        : fieldName;
      return {
        fieldName,
        baseName,
        refSlug,
        displayField: _displayFieldForPatcher(refSlug, sdf),
        multiple: !!(f.multiple || f.is_array || /_ids$/.test(fieldName)),
      };
    })
    .filter(Boolean);
  if (refFields.length === 0) return null;

  const refSlugs = Array.from(new Set(refFields.map((r) => r.refSlug)));
  const refMetaJson = JSON.stringify(refFields, null, 2);
  const refSlugsJson = JSON.stringify(refSlugs);
  const lang = _projectLanguage(sdf);
  const displayLocale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : lang;

  let next = text;

  // (6a) Ensure useMemo is imported alongside useEffect / useState.
  next = next.replace(
    /import\s*\{\s*([^}]*)\}\s*from\s*'react';/,
    (m, names) => {
      const tokens = names.split(',').map((s) => s.trim()).filter(Boolean);
      if (!tokens.includes('useMemo')) tokens.push('useMemo');
      return `import { ${tokens.join(', ')} } from 'react';`;
    }
  );

  // (6b) Inject REFERENCE_FIELDS / REFERENCE_SLUGS constants right before
  // `export default function`.
  const exportIdx = next.indexOf('export default function');
  if (exportIdx < 0) return null;
  const constsBlock = `const REFERENCE_FIELDS: Array<{
  fieldName: string;
  baseName: string;
  refSlug: string;
  displayField: string;
  multiple: boolean;
}> = ${refMetaJson};
const REFERENCE_SLUGS: string[] = ${refSlugsJson};

`;
  next = next.slice(0, exportIdx) + constsBlock + next.slice(exportIdx);

  // (6c) Add refMaps + refsLoading state right after the existing
  // statusFilter declaration.
  const statusFilterMarker = "const [statusFilter, setStatusFilter] = useState<string>('all');";
  if (!next.includes(statusFilterMarker)) return null;
  next = next.replace(
    statusFilterMarker,
    `${statusFilterMarker}
  const [refMaps, setRefMaps] = useState<Record<string, Record<string, string>>>({});
  const [refsLoading, setRefsLoading] = useState(REFERENCE_SLUGS.length > 0);`
  );

  // (6d) Inject the ref-loading useEffect AFTER the items-loading
  // useEffect's closing `}, []);` (the first one in the file).
  const firstUEMarker = '}, []);';
  const firstUEIdx = next.indexOf(firstUEMarker);
  if (firstUEIdx < 0) return null;
  const ueInsertAt = firstUEIdx + firstUEMarker.length;
  const refUE = `

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (REFERENCE_SLUGS.length === 0) {
        setRefsLoading(false);
        return;
      }
      try {
        const entries = await Promise.all(
          REFERENCE_SLUGS.map(async (slug) => {
            try {
              const res = await api.get('/' + slug);
              const rows = Array.isArray(res.data) ? res.data : [];
              const map: Record<string, string> = {};
              const displayField = REFERENCE_FIELDS.find((r) => r.refSlug === slug)?.displayField || 'name';
              for (const r of rows) {
                if (!r?.id) continue;
                const v = r[displayField] ?? r.name ?? r.code ?? r.id;
                map[String(r.id)] = String(v ?? '');
              }
              return [slug, map] as const;
            } catch (e) {
              console.error('Failed to load reference list:', slug, e);
              return [slug, {} as Record<string, string>] as const;
            }
          })
        );
        if (cancelled) return;
        setRefMaps(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);`;
  next = next.slice(0, ueInsertAt) + refUE + next.slice(ueInsertAt);

  // (6e) Replace the existing filteredItems derivation with one that
  // sources from enrichedItems (denormalised <base>_name fields).
  const filterRe = /const filteredItems = statusFilter === 'all'\s*\n?\s*\?\s*items\s*\n?\s*:\s*items\.filter\(\(inv\) => String\(inv\?\.status \|\| 'Draft'\)\.toLowerCase\(\) === statusFilter\.toLowerCase\(\)\);/;
  if (!filterRe.test(next)) return null;
  next = next.replace(
    filterRe,
    `const enrichedItems = useMemo(() => {
    if (REFERENCE_FIELDS.length === 0) return items;
    return items.map((row) => {
      const enriched: Record<string, any> = { ...row };
      for (const ref of REFERENCE_FIELDS) {
        const raw = row?.[ref.fieldName];
        const map = refMaps[ref.refSlug] || {};
        const resolveOne = (id: any) => {
          const sId = String(id ?? '');
          if (!sId) return '';
          const hit = map[sId];
          if (hit) return hit;
          return refsLoading ? '\u2026' : sId;
        };
        const resolved = ref.multiple
          ? (Array.isArray(raw) ? raw.map(resolveOne).filter(Boolean).join(', ') : '')
          : (raw ? resolveOne(raw) : '');
        enriched[ref.baseName + '_name'] = resolved;
      }
      return enriched;
    });
  }, [items, refMaps, refsLoading]);

  const filteredItems = statusFilter === 'all'
    ? enrichedItems
    : enrichedItems.filter((inv) => String(inv?.status || 'Draft').toLowerCase() === statusFilter.toLowerCase());`
  );

  return next;
}

// (6f) — Independent patch step that adds `locale` + per-label props to
// the <InvoiceCard /> usage. Runs separately so it works on pages that
// already have REFERENCE_FIELDS but were originally emitted before
// label/locale plumbing landed.
function patchInvoiceCardProps(file, text, sdf) {
  if (!text.includes("import InvoiceCard from")) return null;
  if (!/<InvoiceCard\b/.test(text)) return null;
  if (/locale=/.test(text)) return null; // Already wired.

  const lang = _projectLanguage(sdf);
  const displayLocale = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : lang;

  const i18nMissing = [];
  if (!/customerLabel=/.test(text)) i18nMissing.push('              customerLabel={(I18N as any).customer ?? "Customer"}');
  if (!/issueDateLabel=/.test(text)) i18nMissing.push('              issueDateLabel={(I18N as any).issueDate ?? "Issue Date"}');
  if (!/dueDateLabel=/.test(text)) i18nMissing.push('              dueDateLabel={(I18N as any).dueDate ?? "Due Date"}');
  if (!/totalLabel=/.test(text)) i18nMissing.push('              totalLabel={(I18N as any).total ?? "Total"}');
  const localeLine = `              locale="${displayLocale}"`;
  const extras = [...i18nMissing, localeLine].join('\n');

  // Anchor on `deleteLabel={I18N.delete}` (always present after step 4)
  // followed by the self-closing `/>` of the JSX element.
  const re = /(deleteLabel=\{I18N\.delete\})(\s*\/>)/;
  if (!re.test(text)) return null;
  return text.replace(re, `$1\n${extras}$2`);
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
    invoicePagesRefResolved: 0,
    invoiceCardsRewritten: 0,
    servicesCascaded: 0,
    migrationWritten: false,
  };

  // SDF for ref-resolution lookup; missing SDF means we skip the
  // ref-resolution step but everything else still runs.
  let projectSdf = null;
  try {
    projectSdf = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'sdf.json'), 'utf8')
    );
  } catch {/* leave null */}

  // Backend services — cascade-delete owned children. Both layouts ship
  // their service files under `<root>/modules/<mod>/src/services/*Service.js`,
  // either rooted at `backend/` (Postgres compose layout) or `app/`
  // (standalone preview layout).
  const ownedMap = _ownedSlugMapForProject(projectRoot);
  if (ownedMap && ownedMap.size > 0) {
    const backendBases = ['backend', 'app'];
    for (const base of backendBases) {
      const moduleRoot = path.join(projectRoot, base, 'modules');
      if (!fs.existsSync(moduleRoot)) continue;
      for (const file of walk(moduleRoot)) {
        if (!/Service\.js$/.test(file)) continue;
        const original = fs.readFileSync(file, 'utf8');
        const patched = patchDeleteCascade(file, original, ownedMap);
        if (patched && patched !== original) {
          fs.writeFileSync(file, patched, 'utf8');
          stats.servicesCascaded += 1;
          console.log(`  cascaded ${path.relative(REPO_ROOT, file)}`);
        }
      }
    }
  }

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
        if (projectSdf) {
          const refNext = patchInvoicesPageRefResolution(file, patched, projectSdf);
          if (refNext && refNext !== patched) {
            patched = refNext;
            stats.invoicePagesRefResolved += 1;
            console.log(`  ref-resolved ${path.relative(REPO_ROOT, file)}`);
          }
          const propNext = patchInvoiceCardProps(file, patched, projectSdf);
          if (propNext && propNext !== patched) {
            patched = propNext;
            console.log(`  invoice-card-props ${path.relative(REPO_ROOT, file)}`);
          }
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
      `${s.invoicePagesRefResolved} invoice page(s) with ref-resolution, ` +
      `${s.invoiceCardsRewritten} invoice card(s), ` +
      `${s.servicesCascaded} service(s) with cascade delete, ` +
      `migration: ${s.migrationWritten ? 'written' : 'up-to-date'}`
  );
}
