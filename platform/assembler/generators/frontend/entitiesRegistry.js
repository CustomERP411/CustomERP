function buildEntitiesRegistry({ visibleEntities, escapeJsString, capitalize, guessDisplayField }) {
  return `export interface EntityNavItem {
  slug: string;
  displayName: string;
  displayField: string;
}

export const ENTITIES: EntityNavItem[] = [
${(visibleEntities || [])
  .map((e) => {
    const displayField = guessDisplayField(e);
    return `  { slug: '${e.slug}', displayName: '${escapeJsString(e.display_name || capitalize(e.slug))}', displayField: '${escapeJsString(displayField)}' },`;
  })
  .join('\n')}
];
`;
}

module.exports = {
  buildEntitiesRegistry,
};


