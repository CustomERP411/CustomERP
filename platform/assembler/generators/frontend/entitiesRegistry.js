// Builds `src/config/entities.ts` in the generated frontend.
//
// Note on i18n: entity `display_name` comes from the SDF which the AI Gateway
// generates in `project.language` (via the language directive injected into
// every prompt). We therefore trust `e.display_name` when present, and only
// fall back to `capitalize(e.slug)` when the SDF did not provide one. Slugs
// are always English and must not be translated — they double as URL paths
// and DB table names in the generated ERP.
function buildEntitiesRegistry({ visibleEntities, childSlugs, escapeJsString, capitalize, guessDisplayField, sharedModulesMap, language: _language }) {
  const childSet = new Set(childSlugs || []);
  const smMap = sharedModulesMap || {};
  return `export interface EntityNavItem {
  slug: string;
  displayName: string;
  displayField: string;
  module?: string;
  isChild?: boolean;
  sharedModules?: string[];
}

export const ENTITIES: EntityNavItem[] = [
${(visibleEntities || [])
  .map((e) => {
    const displayField = guessDisplayField(e);
    const module = e.module || 'inventory';
    const isChild = childSet.has(e.slug);
    const sm = module === 'shared' && smMap[e.slug] && smMap[e.slug].length ? smMap[e.slug] : null;
    return `  { slug: '${e.slug}', displayName: '${escapeJsString(e.display_name || capitalize(e.slug))}', displayField: '${escapeJsString(displayField)}', module: '${module}'${isChild ? ', isChild: true' : ''}${sm ? `, sharedModules: [${sm.map(m => `'${m}'`).join(', ')}]` : ''} },`;
  })
  .join('\n')}
];
`;
}

module.exports = {
  buildEntitiesRegistry,
};
