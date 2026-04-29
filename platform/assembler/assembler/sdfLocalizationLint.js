// SDF Localization Lint (Plan D follow-up #7)
//
// Walks the SDF and surfaces any user-facing string that is not registered as a
// localization key in `platform/assembler/i18n/en.json` (the canonical English
// dictionary). Keys follow the naming convention documented in
// `SDF_REFERENCE.md` under "Localization keys (Plan D)" — entity / wizard /
// status / validation / common.
//
// Severity model:
//   - All projects currently surface findings at `warn` severity. The lint
//     still walks the SDF and reports unkeyed strings (so we can build a
//     translation backlog), but it does not block assembly.
//   - Rationale: AI generators emit user-facing copy as raw strings in the
//     project's target language (driven by the per-language prompt
//     directives). There is no pipeline yet that registers per-project
//     entity strings (e.g. `entity.products.label`) into the platform
//     dictionaries, so a `block` severity for non-English projects breaks
//     every Turkish/etc. generation today even when the strings are already
//     in the correct language. `tFor(language)` falls back to the raw value
//     anyway, so the runtime is safe — leak risk only exists for genuine
//     English-text-in-Turkish-project bugs, which are easy to spot in the UI.
//   - When a real key/dictionary pipeline lands, flip non-English back to
//     `block` here.
//
// The lint never modifies the SDF. Callers (sdfValidation._validateSdf in this
// repo, but also unit tests) decide what to do with the report.
//
// API:
//   const lint = require('./sdfLocalizationLint');
//   const report = lint.lintSdfLocalization(sdf, { language: 'tr' });
//   // report = {
//   //   language: 'tr',
//   //   severity: 'block' | 'warn',
//   //   findings: [{ path, raw, suggestedKey, severity }, ...],
//   //   keyedCount: number,
//   //   unkeyedCount: number
//   // }

'use strict';

const path = require('path');
const fs = require('fs');

// Canonical English dictionary path. Loaded lazily so tests can override the
// dictionary by passing `options.dictionary` directly without disk reads.
const DEFAULT_EN_DICT_PATH = path.join(__dirname, '..', 'i18n', 'en.json');

let CACHED_EN_DICT = null;
function _loadDefaultEnDict() {
  if (CACHED_EN_DICT) return CACHED_EN_DICT;
  try {
    const raw = fs.readFileSync(DEFAULT_EN_DICT_PATH, 'utf8');
    CACHED_EN_DICT = JSON.parse(raw);
  } catch (_err) {
    CACHED_EN_DICT = {};
  }
  return CACHED_EN_DICT;
}

// A string already shaped as a dot-path key (e.g. `entity.invoices.label`) is
// treated as keyed even if the dictionary does not yet contain it — the lint
// signals "intent to localize" rather than full coverage. This is the same
// permissive read `tFor` uses in `labels.js`.
const DOT_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;

function _isDotPathKey(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  return DOT_KEY_RE.test(value);
}

function _resolveKey(dict, keyPath) {
  if (!dict || typeof dict !== 'object') return undefined;
  const parts = String(keyPath || '').split('.');
  let cursor = dict;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in cursor) {
      cursor = cursor[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function _isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Slugify an enum option / status value so it is safe under a dot-path key.
// `On Leave` -> `on_leave`, `Half Day` -> `half_day`, `Approved` -> `approved`.
function _slugifyValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Walk the SDF and collect every user-facing string with the canonical key the
// lint expects to find for it. Returns [{ path, raw, key }, ...].
function _collectUserFacingStrings(sdf) {
  const out = [];
  if (!sdf || typeof sdf !== 'object') return out;

  // Top-level SDF strings (Plan J). Project-level title/description and
  // module-level title/description are user-facing copy that needs the same
  // localization treatment as entity labels.
  if (_isNonEmptyString(sdf.project_name)) {
    out.push({
      path: 'project_name',
      raw: sdf.project_name,
      key: 'project.name',
    });
  }
  if (_isNonEmptyString(sdf.project_description)) {
    out.push({
      path: 'project_description',
      raw: sdf.project_description,
      key: 'project.description',
    });
  }

  const modulesObj = sdf.modules && typeof sdf.modules === 'object' ? sdf.modules : null;
  if (modulesObj) {
    for (const moduleId of Object.keys(modulesObj)) {
      const mod = modulesObj[moduleId];
      if (!mod || typeof mod !== 'object') continue;
      if (_isNonEmptyString(mod.title)) {
        out.push({
          path: `modules.${moduleId}.title`,
          raw: mod.title,
          key: `module.${moduleId}.title`,
          aliasKeys: [`sidebar.modules.${moduleId}`],
        });
      }
      if (_isNonEmptyString(mod.description)) {
        out.push({
          path: `modules.${moduleId}.description`,
          raw: mod.description,
          key: `module.${moduleId}.description`,
        });
      }
    }
  }

  const entities = Array.isArray(sdf.entities) ? sdf.entities : [];
  for (const ent of entities) {
    if (!ent || typeof ent !== 'object') continue;
    const slug = typeof ent.slug === 'string' ? ent.slug : null;
    if (!slug) continue;

    if (_isNonEmptyString(ent.display_name)) {
      out.push({
        path: `entities[${slug}].display_name`,
        raw: ent.display_name,
        key: `entity.${slug}.label`,
      });
    }
    if (_isNonEmptyString(ent.display_name_plural)) {
      out.push({
        path: `entities[${slug}].display_name_plural`,
        raw: ent.display_name_plural,
        key: `entity.${slug}.label_plural`,
      });
    }

    const fields = Array.isArray(ent.fields) ? ent.fields : [];
    for (const field of fields) {
      if (!field || typeof field !== 'object') continue;
      const fname = typeof field.name === 'string' ? field.name : null;
      if (!fname) continue;

      if (_isNonEmptyString(field.label)) {
        out.push({
          path: `entities[${slug}].fields[${fname}].label`,
          raw: field.label,
          key: `entity.${slug}.field.${fname}.label`,
        });
      }
      if (_isNonEmptyString(field.help)) {
        out.push({
          path: `entities[${slug}].fields[${fname}].help`,
          raw: field.help,
          key: `entity.${slug}.field.${fname}.help`,
        });
      }
      if (_isNonEmptyString(field.placeholder)) {
        out.push({
          path: `entities[${slug}].fields[${fname}].placeholder`,
          raw: field.placeholder,
          key: `entity.${slug}.field.${fname}.placeholder`,
        });
      }

      // Enum option values surface as user-facing strings when the field has
      // `options[]`. Each option value gets a key under
      // `entity.<slug>.field.<f>.option.<value_slug>`. Status fields are
      // additionally lintable through the cross-cutting `status.<slug>.<v>`
      // key — we emit BOTH; passing either dictionary entry counts.
      const options = Array.isArray(field.options) ? field.options : [];
      for (const opt of options) {
        const optValue = typeof opt === 'string' ? opt : (opt && opt.value);
        const optLabel = typeof opt === 'string'
          ? opt
          : (opt && (opt.label || opt.value));
        if (!_isNonEmptyString(optValue)) continue;
        if (!_isNonEmptyString(optLabel)) continue;
        const valueSlug = _slugifyValue(optValue);
        if (!valueSlug) continue;
        out.push({
          path: `entities[${slug}].fields[${fname}].options[${optValue}]`,
          raw: optLabel,
          key: `entity.${slug}.field.${fname}.option.${valueSlug}`,
          // Keys that are also acceptable. The lint passes if ANY of these
          // resolve in the dictionary.
          aliasKeys: [`status.${slug}.${valueSlug}`],
        });
      }

      // Validation messages live on rules. Generated `validation.js` uses the
      // shared `validation.<rule>` keys, so unkeyed inline messages are also
      // surfaced.
      if (_isNonEmptyString(field.required_message)) {
        out.push({
          path: `entities[${slug}].fields[${fname}].required_message`,
          raw: field.required_message,
          key: 'validation.required',
          aliasKeys: [`entity.${slug}.field.${fname}.error.required`],
        });
      }
    }

    // Action buttons declared on the entity (e.g. workflow actions). Some
    // SDFs author them under `actions[]`, others under
    // `bulk_actions.actions[]`. We walk both shapes (Plan J).
    const actions = Array.isArray(ent.actions) ? ent.actions : [];
    for (const action of actions) {
      if (!action || typeof action !== 'object') continue;
      const aid = typeof action.id === 'string'
        ? action.id
        : (typeof action.action_id === 'string' ? action.action_id : null);
      if (!aid) continue;
      if (_isNonEmptyString(action.label)) {
        out.push({
          path: `entities[${slug}].actions[${aid}].label`,
          raw: action.label,
          key: `entity.${slug}.action.${aid}.label`,
        });
      }
      if (_isNonEmptyString(action.confirm)) {
        out.push({
          path: `entities[${slug}].actions[${aid}].confirm`,
          raw: action.confirm,
          key: `entity.${slug}.action.${aid}.confirm`,
        });
      }
    }

    // bulk_actions can be an array of {id,label,confirm,...} entries or an
    // object whose `actions[]` field carries the same shape. Both surfaces
    // are user-facing copy.
    const bulkActions = (() => {
      const ba = ent.bulk_actions || ent.bulkActions;
      if (Array.isArray(ba)) return ba;
      if (ba && typeof ba === 'object' && Array.isArray(ba.actions)) return ba.actions;
      return [];
    })();
    for (const action of bulkActions) {
      if (!action || typeof action !== 'object') continue;
      const aid = typeof action.id === 'string'
        ? action.id
        : (typeof action.action_id === 'string' ? action.action_id : null);
      if (!aid) continue;
      if (_isNonEmptyString(action.label)) {
        out.push({
          path: `entities[${slug}].bulk_actions[${aid}].label`,
          raw: action.label,
          key: `entity.${slug}.bulk_action.${aid}.label`,
          aliasKeys: [`entity.${slug}.action.${aid}.label`],
        });
      }
      if (_isNonEmptyString(action.confirm)) {
        out.push({
          path: `entities[${slug}].bulk_actions[${aid}].confirm`,
          raw: action.confirm,
          key: `entity.${slug}.bulk_action.${aid}.confirm`,
          aliasKeys: [`entity.${slug}.action.${aid}.confirm`],
        });
      }
    }

    // Invariant relations carry user-facing `message` text.
    const relations = Array.isArray(ent.relations) ? ent.relations : [];
    for (let i = 0; i < relations.length; i += 1) {
      const rel = relations[i];
      if (!rel || typeof rel !== 'object') continue;
      if (rel.kind !== 'invariant') continue;
      const errorId = typeof rel.id === 'string' && rel.id
        ? rel.id
        : `inv_${i}`;
      if (_isNonEmptyString(rel.message)) {
        out.push({
          path: `entities[${slug}].relations[${i}].message`,
          raw: rel.message,
          key: `entity.${slug}.error.${errorId}`,
        });
      }
    }

    // UI Sections — every `heading` on a `fields` or `line_items` section
    // is rendered to the user. The Pydantic + sdfValidation pass already
    // enforces dot-key shape; this lint pass additionally requires non-EN
    // projects to actually carry a translation entry in the dictionary so
    // raw keys like `form.sections.identity` never leak through `tFor`.
    const uiSections = ent.ui && typeof ent.ui === 'object' && Array.isArray(ent.ui.sections)
      ? ent.ui.sections
      : [];
    for (let si = 0; si < uiSections.length; si += 1) {
      const section = uiSections[si];
      if (!section || typeof section !== 'object') continue;
      const kind = typeof section.kind === 'string' ? section.kind : null;
      if (kind !== 'fields' && kind !== 'line_items') continue;
      if (!_isNonEmptyString(section.heading)) continue;
      out.push({
        path: `entities[${slug}].ui.sections[${si}].heading`,
        raw: section.heading,
        key: section.heading,
      });
    }
  }

  return out;
}

/**
 * Run the localization lint over an SDF.
 *
 * @param {object} sdf - The SDF to lint.
 * @param {object} [options]
 * @param {string} [options.language='en'] - Project language. Drives severity.
 * @param {object} [options.dictionary] - Override en dictionary (tests).
 * @returns {{
 *   language: string,
 *   severity: 'block'|'warn',
 *   findings: Array<{path: string, raw: string, suggestedKey: string, severity: 'block'|'warn', reason?: string}>,
 *   keyedCount: number,
 *   unkeyedCount: number
 * }}
 */
function lintSdfLocalization(sdf, options = {}) {
  const language = (options.language || 'en').toLowerCase();
  const isEnglish = language === 'en';
  // See header comment: severity is `warn` for every language until the
  // per-project key/dictionary pipeline exists. Findings still get reported
  // so they can be triaged.
  const baseSeverity = 'warn';
  const dict = options.dictionary || _loadDefaultEnDict();

  const collected = _collectUserFacingStrings(sdf);
  const findings = [];
  let keyedCount = 0;
  let unkeyedCount = 0;

  for (const entry of collected) {
    // Pass 1: the raw value itself looks like a dot-path key. The caller is
    // already keying through `t()`. On English projects we accept this even
    // when the dictionary does not yet carry the entry. On non-English
    // projects we additionally require dictionary completeness — otherwise
    // `tFor(language)` falls back to the keyPath and the UI shows raw key
    // text like "entity.invoices.label" to the user (Plan J).
    if (_isDotPathKey(entry.raw)) {
      const dictHit = typeof _resolveKey(dict, entry.raw) === 'string';
      if (isEnglish || dictHit) {
        keyedCount += 1;
        continue;
      }
      unkeyedCount += 1;
      findings.push({
        path: entry.path,
        raw: entry.raw,
        suggestedKey: entry.raw,
        severity: baseSeverity,
        reason: 'dictionary_missing_entry',
      });
      continue;
    }

    // Pass 2: any of the canonical keys (suggested + aliases) resolve in
    // the en dictionary.
    const candidates = [entry.key, ...(entry.aliasKeys || [])];
    const hit = candidates.some((k) => typeof _resolveKey(dict, k) === 'string');
    if (hit) {
      keyedCount += 1;
      continue;
    }

    unkeyedCount += 1;
    findings.push({
      path: entry.path,
      raw: entry.raw,
      suggestedKey: entry.key,
      severity: baseSeverity,
      reason: 'unkeyed_string',
    });
  }

  return {
    language,
    severity: baseSeverity,
    findings,
    keyedCount,
    unkeyedCount,
  };
}

module.exports = {
  lintSdfLocalization,
  _slugifyValue,
  _collectUserFacingStrings,
  _isDotPathKey,
};
