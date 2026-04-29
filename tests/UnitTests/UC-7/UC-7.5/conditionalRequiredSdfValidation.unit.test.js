/**
 * Plan G D6 — sdfValidation extends the invariant case to validate
 * `conditional_required(...)` rules: required field exists, when_field
 * exists, exactly one when_<op> comparator, and per-operator value-type
 * checks.
 *
 * SUT: platform/assembler/assembler/sdfValidation.js
 *      (_validateConditionalRequired + the case 'invariant' branch
 *       inside _validateRelations)
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

function sdfWithInvariant(rule) {
  return {
    project_name: 'Test',
    entities: [
      {
        slug: 'employees',
        fields: [
          { name: 'status', type: 'string', options: ['Active', 'Terminated'] },
          { name: 'termination_date', type: 'date' },
        ],
        relations: [{ kind: 'invariant', rule, severity: 'block' }],
      },
    ],
  };
}

describe('Plan G D6 — conditional_required argument validation', () => {
  const harness = buildAssemblerHarness();

  test('1. accepts a well-formed equals invariant', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status, when_equals=Terminated)',
        ),
      ),
    ).not.toThrow();
  });

  test('2. accepts a well-formed when_in invariant', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status, when_in=[Terminated, Resigned])',
        ),
      ),
    ).not.toThrow();
  });

  test('3. accepts a well-formed when_is_set invariant', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status, when_is_set=true)',
        ),
      ),
    ).not.toThrow();
  });

  test('4. rejects when `field` is missing', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(when_field=status, when_equals=Terminated)',
        ),
      ),
    ).toThrow(/non-empty 'field' arg/);
  });

  test('5. rejects when `when_field` is missing', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_equals=Terminated)',
        ),
      ),
    ).toThrow(/non-empty 'when_field' arg/);
  });

  test('6. rejects when no comparator is provided', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status)',
        ),
      ),
    ).toThrow(/exactly one comparator/);
  });

  test('7. rejects when multiple comparators are provided', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status, when_equals=Terminated, when_not_equals=Active)',
        ),
      ),
    ).toThrow(/multiple comparators/);
  });

  test('8. rejects when `field` references missing field on entity', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=ghost_field, when_field=status, when_equals=Terminated)',
        ),
      ),
    ).toThrow(/field 'ghost_field' does not exist/);
  });

  test('9. rejects when `when_field` references missing field on entity', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=ghost_status, when_equals=Terminated)',
        ),
      ),
    ).toThrow(/when_field 'ghost_status' does not exist/);
  });

  test('10. rejects when_in with non-list value', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status, when_in=Terminated)',
        ),
      ),
    ).toThrow(/non-empty list/);
  });

  test('11. rejects when_is_set with non-boolean value', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status, when_is_set=yes)',
        ),
      ),
    ).toThrow(/'true' or 'false'/);
  });

  test('12. rejects when_equals with empty value', () => {
    expect(() =>
      harness._validateSdf(
        sdfWithInvariant(
          'conditional_required(field=termination_date, when_field=status, when_equals=)',
        ),
      ),
    ).toThrow(/must be non-empty/);
  });

  test('13. accepts conditional_required alongside other invariants', () => {
    const sdf = {
      project_name: 'Test',
      entities: [
        {
          slug: 'employees',
          fields: [
            { name: 'status', type: 'string' },
            { name: 'termination_date', type: 'date' },
          ],
          relations: [
            {
              kind: 'invariant',
              rule: 'conditional_required(field=termination_date, when_field=status, when_equals=Terminated)',
              severity: 'block',
            },
            {
              // Sibling invariants with arbitrary names continue to pass
              // with only the non-empty-rule check (the parser may not
              // recognize them, but we don't reject unknown names).
              kind: 'invariant',
              rule: 'custom_audit_check(scope=entity)',
              severity: 'warn',
            },
          ],
        },
      ],
    };
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });
});
