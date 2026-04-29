/**
 * Plan G D5 — `_relInv_conditional_required` server-side invariant.
 *
 * SUT: brick-library/backend-bricks/mixins/relationRuleLibrary.js
 *      (_relInv_conditional_required + _relUtil_evalVisibilityPredicate)
 *
 * Coverage:
 *   - Predicate doesn't match: invariant is a no-op regardless of value.
 *   - Predicate matches AND field is set: invariant is a no-op.
 *   - Predicate matches AND field is empty: throw 400 with field_errors.
 *   - All six operators behave identically to the form-side evaluator.
 *   - INVARIANT_NAMES advertises 'conditional_required' so the runner
 *     dispatches it at runtime.
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const {
  LIBRARY_PROTO,
  INVARIANT_NAMES,
} = require(
  path.join(REPO_ROOT, 'brick-library/backend-bricks/mixins/relationRuleLibrary.js')
);
const {
  parseRelationRule,
} = require(
  path.join(REPO_ROOT, 'brick-library/backend-bricks/mixins/relationRuleParser.js')
);

function makeSelf() {
  return {
    slug: 'employees',
    _relUtil_evalVisibilityPredicate: LIBRARY_PROTO._relUtil_evalVisibilityPredicate,
    _relUtil_fieldError: LIBRARY_PROTO._relUtil_fieldError,
  };
}

async function runInvariant(rule, { data = {}, prevState = null } = {}) {
  const parsedRule = parseRelationRule(rule);
  expect(parsedRule).not.toBeNull();
  const ctx = { rel: {}, parsedRule, data, prevState, op: 'create' };
  return LIBRARY_PROTO._relInv_conditional_required.call(makeSelf(), ctx);
}

async function expectThrow(rule, opts) {
  let caught;
  try {
    await runInvariant(rule, opts);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeDefined();
  return caught;
}

describe('Plan G D5 — INVARIANT_NAMES advertises conditional_required', () => {
  test('1. registered for runner dispatch', () => {
    expect(INVARIANT_NAMES).toContain('conditional_required');
  });
});

describe('Plan G D5 — _relInv_conditional_required (equals)', () => {
  const rule =
    'conditional_required(field=termination_date, when_field=status, when_equals=Terminated)';

  test('2. predicate does not match: no-op even when field empty', async () => {
    await expect(
      runInvariant(rule, { data: { status: 'Active' } }),
    ).resolves.toBeUndefined();
  });

  test('3. predicate matches AND field set: no-op', async () => {
    await expect(
      runInvariant(rule, { data: { status: 'Terminated', termination_date: '2025-01-01' } }),
    ).resolves.toBeUndefined();
  });

  test('4. predicate matches AND field empty: throws 400 with field_errors', async () => {
    const err = await expectThrow(rule, { data: { status: 'Terminated' } });
    expect(err.statusCode).toBe(400);
    expect(err.fieldErrors).toBeDefined();
    expect(err.fieldErrors.termination_date).toBeDefined();
    expect(err.fieldErrors.termination_date.code).toBe('conditional_required');
  });

  test('5. predicate matches AND field whitespace-only: throws', async () => {
    const err = await expectThrow(rule, {
      data: { status: 'Terminated', termination_date: '   ' },
    });
    expect(err.statusCode).toBe(400);
  });
});

describe('Plan G D5 — operator coverage', () => {
  test('6. not_equals: throws when sibling differs and field empty', async () => {
    const rule =
      'conditional_required(field=note, when_field=status, when_not_equals=Active)';
    await expect(
      runInvariant(rule, { data: { status: 'Active' } }),
    ).resolves.toBeUndefined();
    const err = await expectThrow(rule, { data: { status: 'Pending' } });
    expect(err.fieldErrors.note.code).toBe('conditional_required');
  });

  test('7. in: throws when sibling matches one of the listed values', async () => {
    const rule =
      'conditional_required(field=approver_id, when_field=status, when_in=[Pending, Approved])';
    await expect(
      runInvariant(rule, { data: { status: 'Rejected' } }),
    ).resolves.toBeUndefined();
    await expectThrow(rule, { data: { status: 'Pending' } });
    await expectThrow(rule, { data: { status: 'Approved' } });
  });

  test('8. not_in: throws when sibling is outside the listed values', async () => {
    const rule =
      'conditional_required(field=note, when_field=status, when_not_in=[Cancelled, Voided])';
    await expect(
      runInvariant(rule, { data: { status: 'Cancelled' } }),
    ).resolves.toBeUndefined();
    await expectThrow(rule, { data: { status: 'Pending' } });
  });

  test('9. is_set: throws when sibling has a value', async () => {
    const rule =
      'conditional_required(field=note, when_field=follow_up_at, when_is_set=true)';
    await expect(
      runInvariant(rule, { data: { follow_up_at: '' } }),
    ).resolves.toBeUndefined();
    await expectThrow(rule, { data: { follow_up_at: '2025-01-01' } });
  });

  test('10. is_unset: throws when sibling is empty', async () => {
    const rule =
      'conditional_required(field=note, when_field=resolved_at, when_is_unset=true)';
    await expect(
      runInvariant(rule, { data: { resolved_at: '2025-01-01' } }),
    ).resolves.toBeUndefined();
    await expectThrow(rule, { data: { resolved_at: '' } });
  });

  test('11. merges prevState for update operations', async () => {
    // status came from prev row; data has the new termination_date.
    const rule =
      'conditional_required(field=termination_date, when_field=status, when_equals=Terminated)';
    await expect(
      runInvariant(rule, {
        prevState: { status: 'Terminated' },
        data: { termination_date: '2025-01-01' },
      }),
    ).resolves.toBeUndefined();
    // Inverse: data flips status, prev had termination_date.
    const err = await expectThrow(rule, {
      prevState: { status: 'Active' },
      data: { status: 'Terminated' },
    });
    expect(err.fieldErrors.termination_date).toBeDefined();
  });

  test('12. missing comparator: silently returns (incomplete rule)', async () => {
    const rule = 'conditional_required(field=termination_date, when_field=status)';
    await expect(
      runInvariant(rule, { data: { status: 'Terminated' } }),
    ).resolves.toBeUndefined();
  });

  test('13. custom message arg: surfaced in field_errors', async () => {
    const rule =
      'conditional_required(field=termination_date, when_field=status, when_equals=Terminated, message=Termination date is required when status is Terminated)';
    const err = await expectThrow(rule, { data: { status: 'Terminated' } });
    expect(err.fieldErrors.termination_date.message).toContain('Termination date is required');
  });
});
