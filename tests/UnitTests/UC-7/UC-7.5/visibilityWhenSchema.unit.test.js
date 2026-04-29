/**
 * Plan G D2 — sdfValidation.js visibility_when shape + sibling-field check.
 *
 * SUT: platform/assembler/assembler/sdfValidation.js
 *      (_validateVisibilityWhen + the field-loop in _validateSdf that calls it)
 *
 * Covers the six supported operators (equals, not_equals, in, not_in,
 * is_set, is_unset), every malformed-shape rejection, and the
 * sibling-field-must-exist cross-check.
 */

const sdfValidation = require(
  '../../../../platform/assembler/assembler/sdfValidation',
);

function buildAssemblerHarness() {
  return {
    _validateSdf: sdfValidation._validateSdf,
    _validateRelations: sdfValidation._validateRelations,
    _validateVisibilityWhen: sdfValidation._validateVisibilityWhen,
    _validateConditionalRequired: sdfValidation._validateConditionalRequired,
    _withSystemEntities: (entities) => entities,
    _resolveErpModules: () => ({ enabledModules: [], hasErpConfig: false }),
    _normalizeEntityModule: () => 'shared',
    _normalizeEntitiesForModules: (entities) => ({ normalizedEntities: entities, moduleMap: {} }),
    _validateInventoryPriorityAConfig: () => {},
    _validateInvoicePriorityAConfig: () => {},
    _validateHRPriorityAConfig: () => {},
  };
}

function sdfWithVisibility(predicate) {
  return {
    project_name: 'Test',
    entities: [
      {
        slug: 'employees',
        fields: [
          { name: 'status', type: 'string', options: ['Active', 'Terminated'] },
          { name: 'termination_date', type: 'date', visibility_when: predicate },
        ],
      },
    ],
  };
}

describe('Plan G D2 — sdfValidation visibility_when shape', () => {
  const harness = buildAssemblerHarness();

  test.each([
    ['equals scalar', { field: 'status', equals: 'Terminated' }],
    ['not_equals scalar', { field: 'status', not_equals: 'Active' }],
    ['in array', { field: 'status', in: ['Pending', 'Approved'] }],
    ['not_in array', { field: 'status', not_in: ['Cancelled', 'Voided'] }],
    ['is_set true', { field: 'status', is_set: true }],
    ['is_unset false', { field: 'status', is_unset: false }],
  ])('accepts %s', (_label, predicate) => {
    expect(() => harness._validateSdf(sdfWithVisibility(predicate))).not.toThrow();
  });

  test('rejects predicate without `field`', () => {
    expect(() =>
      harness._validateSdf(sdfWithVisibility({ equals: 'Terminated' })),
    ).toThrow(/non-empty string 'field'/);
  });

  test('rejects predicate with empty `field`', () => {
    expect(() =>
      harness._validateSdf(sdfWithVisibility({ field: '', equals: 'Terminated' })),
    ).toThrow(/non-empty string 'field'/);
  });

  test('rejects predicate with no comparator', () => {
    expect(() =>
      harness._validateSdf(sdfWithVisibility({ field: 'status' })),
    ).toThrow(/exactly one comparator/);
  });

  test('rejects predicate with multiple comparators', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithVisibility({ field: 'status', equals: 'Terminated', not_equals: 'Active' }),
      ),
    ).toThrow(/multiple comparators/);
  });

  test('rejects predicate with unknown comparator', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithVisibility({ field: 'status', matches: 'Terminated' }),
      ),
    ).toThrow(/unknown comparator/);
  });

  test('rejects in with non-array value', () => {
    expect(() =>
      harness._validateSdf(sdfWithVisibility({ field: 'status', in: 'Pending' })),
    ).toThrow(/non-empty list/);
  });

  test('rejects in with empty array', () => {
    expect(() =>
      harness._validateSdf(sdfWithVisibility({ field: 'status', in: [] })),
    ).toThrow(/non-empty list/);
  });

  test('rejects is_set with non-boolean value', () => {
    expect(() =>
      harness._validateSdf(sdfWithVisibility({ field: 'status', is_set: 'yes' })),
    ).toThrow(/must be a boolean/);
  });

  test('rejects equals with array value', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithVisibility({ field: 'status', equals: ['Pending', 'Approved'] }),
      ),
    ).toThrow(/must be a scalar/);
  });

  test('rejects equals with null value', () => {
    expect(() =>
      harness._validateSdf(sdfWithVisibility({ field: 'status', equals: null })),
    ).toThrow(/must be a scalar/);
  });

  test('rejects predicate referencing missing sibling field', () => {
    const sdf = {
      project_name: 'Test',
      entities: [
        {
          slug: 'employees',
          fields: [
            { name: 'termination_date', type: 'date', visibility_when: { field: 'status', equals: 'Terminated' } },
          ],
        },
      ],
    };
    expect(() => harness._validateSdf(sdf)).toThrow(
      /references sibling 'status' which does not exist/,
    );
  });

  test('predicate referencing existing sibling passes', () => {
    const sdf = {
      project_name: 'Test',
      entities: [
        {
          slug: 'employees',
          fields: [
            { name: 'status', type: 'string' },
            { name: 'termination_date', type: 'date', visibility_when: { field: 'status', equals: 'Terminated' } },
          ],
        },
      ],
    };
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });
});
