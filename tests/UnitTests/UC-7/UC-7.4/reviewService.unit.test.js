/**
 * UC-7.4 Review SDF — unit tests
 *
 * Covers TC-UC7.4-003 through TC-UC7.4-007.
 * SUT: platform/backend/src/services/reviewService.js (buildReviewSummary)
 *
 * reviewService is a pure function — no DB, no AI — so these tests
 * exercise it directly with hand-crafted SDF inputs.
 */

const { buildReviewSummary } = require(
  '../../../../platform/backend/src/services/reviewService',
);

describe('UC-7.4 / reviewService.buildReviewSummary', () => {
  // TC-UC7.4-003
  test('handles null / non-object SDFs with zeroed counts and a single warning', () => {
    const expected = {
      entityCount: 0,
      fieldCount: 0,
      relationCount: 0,
      moduleSummaries: [],
      entities: [],
      warnings: ['SDF is empty or not an object.'],
    };
    expect(buildReviewSummary(null)).toEqual(expected);
    expect(buildReviewSummary(undefined)).toEqual(expected);
    expect(buildReviewSummary('not-an-object')).toEqual(expected);
  });

  // TC-UC7.4-004
  test('counts entities, fields, and relation fields accurately', () => {
    const sdf = {
      project_name: 'Demo',
      entities: [
        {
          slug: 'products',
          module: 'inventory',
          fields: [
            { name: 'name', type: 'string' },
            { name: 'sku', type: 'string' },
            { name: 'qty', type: 'integer' },
            { name: 'supplier', type: 'relation', reference: { entity: 'suppliers' } },
            { name: 'category', type: 'reference', reference: { entity: 'categories' } },
          ],
        },
        {
          slug: 'suppliers',
          module: 'inventory',
          fields: [
            { name: 'name', type: 'string' },
            { name: 'contact', type: 'string' },
            // Relation carried via `reference.entity` (the other way
            // buildReviewSummary recognizes a relation field).
            { name: 'primary_product', reference: { entity: 'products' } },
          ],
        },
        // Ensure we don't crash on entities without fields after the
        // warning is emitted.
        { slug: 'categories', module: 'inventory', fields: [] },
      ],
    };

    const summary = buildReviewSummary(sdf);

    expect(summary.entityCount).toBe(3);
    expect(summary.fieldCount).toBe(5 + 3 + 0);
    expect(summary.relationCount).toBe(3); // 2 from products + 1 from suppliers
    // Per-entity breakdown:
    const products = summary.entities.find((e) => e.slug === 'products');
    expect(products.fieldCount).toBe(5);
    expect(products.relationFields).toHaveLength(2);
  });

  // TC-UC7.4-005
  test('warns when a relation field points at an entity slug that is not defined', () => {
    const sdf = {
      entities: [
        {
          slug: 'products',
          fields: [
            { name: 'supplier', type: 'relation', reference: { entity: 'ghost' } },
          ],
        },
      ],
    };
    const summary = buildReviewSummary(sdf);

    const hit = summary.warnings.find(
      (w) => w.includes('products') && w.includes('ghost'),
    );
    expect(hit).toBeDefined();
  });

  // TC-UC7.4-006
  test('warns about any entity with an empty `fields` array', () => {
    const sdf = { entities: [{ slug: 'alpha', fields: [] }] };
    const summary = buildReviewSummary(sdf);
    expect(summary.warnings).toContain('Entity "alpha" has no fields.');
  });

  // TC-UC7.4-007
  test('appends a warning for pending clarification questions', () => {
    const sdf = {
      entities: [{ slug: 'a', fields: [{ name: 'x', type: 'string' }] }],
      clarifications_needed: [{ id: 'q1' }, { id: 'q2' }],
    };
    const summary = buildReviewSummary(sdf);
    expect(summary.warnings).toContain('2 clarification(s) are still pending.');
  });
});
