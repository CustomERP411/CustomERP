// Assembler i18n helper.
//
// The generated ERP is SINGLE-LANGUAGE — the locale is baked in at build time
// using `project.language` (locked at project creation). This module exposes a
// `tFor(language)` function that returns a scoped lookup `t('sidebar.dashboard')`
// used by the frontend generators to emit the right hardcoded strings.
//
// To add a new locale:
//  1. Drop a `<code>.json` file next to this module with the same key tree.
//  2. Add the code to `SUPPORTED_LANGUAGES` below.

const en = require('./en.json');
const tr = require('./tr.json');

const DICTIONARIES = { en, tr };
const SUPPORTED_LANGUAGES = Object.keys(DICTIONARIES);
const DEFAULT_LANGUAGE = 'en';

function normalizeLanguage(language) {
  const raw = String(language || '').toLowerCase().trim();
  if (SUPPORTED_LANGUAGES.includes(raw)) return raw;
  const prefix = raw.split('-')[0];
  return SUPPORTED_LANGUAGES.includes(prefix) ? prefix : DEFAULT_LANGUAGE;
}

function lookup(dict, keyPath) {
  const parts = String(keyPath || '').split('.');
  let current = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Returns a translator function bound to `language`.
 *
 * Usage:
 *   const t = tFor('tr');
 *   t('sidebar.dashboard') // → "Panel"
 *   t('sidebar.modules.invoice') // → "Faturalama"
 *
 * Falls back to English if the key is missing in the requested locale, and
 * finally to the key path itself if English is also missing (safer than
 * silently blanking out generated UI).
 */
function tFor(language) {
  const lang = normalizeLanguage(language);
  const primary = DICTIONARIES[lang];
  const fallback = DICTIONARIES[DEFAULT_LANGUAGE];
  return function t(keyPath) {
    const primaryVal = lookup(primary, keyPath);
    if (typeof primaryVal === 'string') return primaryVal;
    const fallbackVal = lookup(fallback, keyPath);
    if (typeof fallbackVal === 'string') return fallbackVal;
    return keyPath;
  };
}

function moduleDisplayNames(language) {
  const t = tFor(language);
  return {
    inventory: t('sidebar.modules.inventory'),
    invoice: t('sidebar.modules.invoice'),
    hr: t('sidebar.modules.hr'),
    shared: t('sidebar.modules.shared'),
  };
}

module.exports = {
  tFor,
  moduleDisplayNames,
  normalizeLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
};
