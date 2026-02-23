function buildEntitiesRegistry({ visibleEntities, escapeJsString, capitalize, guessDisplayField }) {
  return `export interface EntityNavItem {
  slug: string;
  displayName: string;
  displayField: string;
  module?: string;
}

export const ENTITIES: EntityNavItem[] = [
${(visibleEntities || [])
  .map((e) => {
    const displayField = guessDisplayField(e);
    const module = e.module || 'inventory';
    return `  { slug: '${e.slug}', displayName: '${escapeJsString(e.display_name || capitalize(e.slug))}', displayField: '${escapeJsString(displayField)}', module: '${module}' },`;
  })
  .join('\n')}
];
`;
}

module.exports = {
  buildEntitiesRegistry,
};


