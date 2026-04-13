function buildEntitiesRegistry({ visibleEntities, childSlugs, escapeJsString, capitalize, guessDisplayField, sharedModulesMap }) {
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
