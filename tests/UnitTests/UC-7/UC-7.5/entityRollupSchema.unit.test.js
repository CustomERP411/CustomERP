/**
 * Plan H F4 — sdfValidation._validateRollupOverrides accepts well-formed
 * `entity.rollups` and rejects malformed shapes; soft-warns on unknown
 * source-entity keys.
 *
 * SUT: platform/assembler/assembler/sdfValidation.js
 *      (_validateRollupOverrides + the entity-loop call site that
 *       invokes it inside _validateSdf)
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
    _validateRollupOverrides: sdfValidation._validateRollupOverrides,
    _withSystemEntities: (entities) => entities,
    _resolveErpModules: () => ({ enabledModules: [], hasErpConfig: false }),
    _normalizeEntityModule: () => 'shared',
    _normalizeEntitiesForModules: (entities) => ({ normalizedEntities: entities, moduleMap: {} }),
    _validateInventoryPriorityAConfig: () => {},
    _validateInvoicePriorityAConfig: () => {},
    _validateHRPriorityAConfig: () => {},
  };
}

function sdfWithRollups(rollups) {
  return {
    project_name: 'Test',
    entities: [
      {
        slug: 'departments',
        fields: [{ name: 'name', type: 'string' }],
        rollups,
      },
      {
        slug: 'employees',
        fields: [
          { name: 'full_name', type: 'string' },
        ],
      },
    ],
  };
}

describe('Plan H F4 — entity.rollups schema validation', () => {
  const harness = buildAssemblerHarness();

  test('1. accepts undefined / missing rollups (no-op)', () => {
    expect(() => harness._validateSdf(sdfWithRollups(undefined))).not.toThrow();
  });

  test('2. accepts false to suppress an auto-derived rollup', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: false }))).not.toThrow();
  });

  test('3. accepts a fully-populated override object', () => {
    expect(() => harness._validateSdf(sdfWithRollups({
      employees: {
        label: 'Team members',
        columns: ['full_name', 'title', 'status'],
        foreign_key: 'department_id',
      },
    }))).not.toThrow();
  });

  test('4. accepts partial override (columns only)', () => {
    expect(() => harness._validateSdf(sdfWithRollups({
      employees: { columns: ['full_name', 'title'] },
    }))).not.toThrow();
  });

  test('5. rejects rollups when the value is true', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: true })))
      .toThrow(/true is not a valid value/);
  });

  test('6. rejects rollups when value is a non-object, non-bool primitive', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: 'yes' })))
      .toThrow(/must be false or an object/);
  });

  test('7. rejects rollups when value is an array', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: ['full_name'] })))
      .toThrow(/must be false or an object/);
  });

  test('8. rejects rollups with empty-string keys', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ '': false })))
      .toThrow(/keys must be non-empty strings/);
  });

  test('9. rejects unknown override sub-keys', () => {
    expect(() => harness._validateSdf(sdfWithRollups({
      employees: { tooltip: 'x', columns: ['full_name'] },
    }))).toThrow(/unsupported keys/);
  });

  test('10. rejects label that is not a non-empty string', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: { label: '   ' } })))
      .toThrow(/label must be a non-empty string/);
    expect(() => harness._validateSdf(sdfWithRollups({ employees: { label: 42 } })))
      .toThrow(/label must be a non-empty string/);
  });

  test('11. rejects foreign_key that is not a non-empty string', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: { foreign_key: '' } })))
      .toThrow(/foreign_key must be a non-empty string/);
  });

  test('12. rejects columns that is not a non-empty array', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: { columns: [] } })))
      .toThrow(/columns must be a non-empty list/);
    expect(() => harness._validateSdf(sdfWithRollups({ employees: { columns: 'name' } })))
      .toThrow(/columns must be a non-empty list/);
  });

  test('13. rejects columns whose entries are not non-empty strings', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: { columns: [''] } })))
      .toThrow(/columns entries must be non-empty strings/);
    expect(() => harness._validateSdf(sdfWithRollups({ employees: { columns: [null] } })))
      .toThrow(/columns entries must be non-empty strings/);
  });

  test('14. soft-warns on unknown source-entity slug in rollups (does not throw)', () => {
    const sdf = sdfWithRollups({ ghost_entity: { columns: ['anything'] } });
    expect(() => harness._validateSdf(sdf)).not.toThrow();
    expect(Array.isArray(sdf.warnings)).toBe(true);
    expect(sdf.warnings.some((w) => /ghost_entity/.test(w) && /unknown entity slug/.test(w))).toBe(true);
  });

  test('15. rejects rollups when value is null', () => {
    expect(() => harness._validateSdf(sdfWithRollups({ employees: null })))
      .toThrow(/must be false or an object/);
  });

  test('16. rejects rollups itself when not a mapping', () => {
    const sdf = {
      project_name: 'Test',
      entities: [
        {
          slug: 'departments',
          fields: [{ name: 'name', type: 'string' }],
          rollups: ['employees'],
        },
      ],
    };
    expect(() => harness._validateSdf(sdf))
      .toThrow(/rollups must be an object keyed by source-entity slug/);
  });
});
