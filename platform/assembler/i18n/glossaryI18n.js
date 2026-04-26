const trGlossary = require('./glossary.tr.json');

function defaultLabelFromName(name) {
  return String(name).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/** When language is tr, return Turkish label if the SDF label is empty or the default title-case from the name. */
function pickTrFieldLabel(fieldName, fieldLabel) {
  const g = trGlossary.fields && trGlossary.fields[fieldName];
  if (!g) return null;
  const auto = defaultLabelFromName(fieldName);
  if (fieldLabel == null || fieldLabel === '') return g;
  if (String(fieldLabel).trim().toLowerCase() === auto.toLowerCase()) return g;
  // If the AI returned a plain-English label for a canonical field, prefer the
  // deterministic Turkish glossary. Turkish labels usually contain non-ASCII
  // characters for these terms, while machine field names stay English.
  if (/^[\x00-\x7F]+$/.test(String(fieldLabel).trim())) return g;
  return null;
}

function pickTrEntityDisplayName(slug, displayName) {
  const g = trGlossary.entities && trGlossary.entities[slug];
  if (!g) return null;
  if (displayName == null || String(displayName).trim() === '') return g;
  const auto = defaultLabelFromName(slug);
  if (String(displayName).trim().toLowerCase() === auto.toLowerCase()) return g;
  if (/^[\x00-\x7F]+$/.test(String(displayName).trim())) return g;
  return null;
}

module.exports = {
  defaultLabelFromName,
  pickTrFieldLabel,
  pickTrEntityDisplayName,
  trGlossary,
};
