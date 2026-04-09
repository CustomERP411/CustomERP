function validateGeneratorSdf(sdf) {
  if (!sdf || typeof sdf !== 'object') return { valid: false, error: 'SDF must be a JSON object' };
  const projectName = sdf.project_name || sdf.projectName;
  if (!projectName || typeof projectName !== 'string') return { valid: false, error: 'SDF.project_name is required' };
  if (!Array.isArray(sdf.entities) || sdf.entities.length === 0) return { valid: false, error: 'SDF.entities must be a non-empty array' };

  for (const e of sdf.entities) {
    if (!e || typeof e !== 'object') return { valid: false, error: 'Each entity must be an object' };
    if (!e.slug || typeof e.slug !== 'string') return { valid: false, error: 'Each entity.slug is required' };
    if (!Array.isArray(e.fields)) return { valid: false, error: `Entity ${e.slug}: fields must be an array` };
  }

  return { valid: true };
}

function parseModulesInput(rawModules) {
  const allowed = new Set(['inventory', 'invoice', 'hr']);

  const list = Array.isArray(rawModules)
    ? rawModules
    : (typeof rawModules === 'string' ? rawModules.split(',') : []);

  const normalized = list
    .map((moduleKey) => String(moduleKey || '').trim().toLowerCase())
    .filter((moduleKey) => allowed.has(moduleKey));

  const unique = [];
  const seen = new Set();
  for (const moduleKey of normalized) {
    if (seen.has(moduleKey)) continue;
    seen.add(moduleKey);
    unique.push(moduleKey);
  }

  return unique;
}

module.exports = { validateGeneratorSdf, parseModulesInput };
