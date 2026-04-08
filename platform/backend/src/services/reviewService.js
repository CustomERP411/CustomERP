/**
 * Builds a structured review summary from an SDF JSON object.
 * Pure computation — no DB or AI calls.
 */
function buildReviewSummary(sdfJson) {
  if (!sdfJson || typeof sdfJson !== 'object') {
    return {
      entityCount: 0,
      fieldCount: 0,
      relationCount: 0,
      moduleSummaries: [],
      entities: [],
      warnings: ['SDF is empty or not an object.'],
    };
  }

  const entities = Array.isArray(sdfJson.entities) ? sdfJson.entities : [];
  const warnings = [];

  let totalFields = 0;
  let totalRelations = 0;
  const moduleEntityMap = new Map();
  const allSlugs = new Set(entities.map((e) => e?.slug).filter(Boolean));

  const entitySummaries = entities.map((entity) => {
    if (!entity || typeof entity !== 'object') {
      warnings.push('Encountered a non-object entity entry.');
      return { slug: '(invalid)', fields: [], relationFields: [] };
    }

    const slug = entity.slug || entity.name || '(unnamed)';
    const fields = Array.isArray(entity.fields) ? entity.fields : [];

    if (fields.length === 0) {
      warnings.push(`Entity "${slug}" has no fields.`);
    }

    const relationFields = fields.filter((f) => {
      if (!f || typeof f !== 'object') return false;
      if (f.type === 'relation' || f.type === 'reference') return true;
      if (f.reference && typeof f.reference === 'object' && f.reference.entity) return true;
      return false;
    });

    for (const rf of relationFields) {
      const target =
        rf.reference?.entity || rf.relation?.entity || rf.relatedEntity || null;
      if (target && !allSlugs.has(target)) {
        warnings.push(
          `Entity "${slug}" references "${target}" which is not defined in the SDF.`
        );
      }
    }

    totalFields += fields.length;
    totalRelations += relationFields.length;

    const moduleName = entity.module || entity.group || 'Unassigned';
    moduleEntityMap.set(moduleName, (moduleEntityMap.get(moduleName) || 0) + 1);

    return {
      slug,
      fieldCount: fields.length,
      relationFields,
    };
  });

  const moduleSummaries = Array.from(moduleEntityMap.entries()).map(
    ([name, count]) => ({ name, entityCount: count })
  );

  if (Array.isArray(sdfJson.clarifications_needed) && sdfJson.clarifications_needed.length > 0) {
    warnings.push(
      `${sdfJson.clarifications_needed.length} clarification(s) are still pending.`
    );
  }

  return {
    entityCount: entities.length,
    fieldCount: totalFields,
    relationCount: totalRelations,
    moduleSummaries,
    entities: entitySummaries,
    warnings,
  };
}

module.exports = { buildReviewSummary };
