/**
 * UC-7.5 / Plan I — runtime conditional_required invariant accepts the
 * "Credit Card" enum value with an embedded space.
 *
 * SUT: brick-library/backend-bricks/mixins/relationRuleLibrary.js
 *      (_relInv_conditional_required + _relUtil_evalVisibilityPredicate)
 *      brick-library/backend-bricks/mixins/relationRuleParser.js
 *
 * Coverage:
 *   - The DSL parser preserves whitespace inside arg values, so
 *     `when_equals=Credit Card` parses to the string "Credit Card".
 *   - When payment_method = "Credit Card" AND installments is missing,
 *     the invariant throws a 400 with a field error on `installments`.
 *   - When payment_method = "Cash" the invariant is a no-op even when
 *     installments is missing.
 *   - When payment_method = "Credit Card" AND installments has a value,
 *     the invariant is a no-op.
 *   - prevState merging works (status arrives from the prior row, the
 *     update payload only carries installments).
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

const RULE =
  'conditional_required(field=installments, when_field=payment_method, when_equals=Credit Card)';

function makeSelf() {
  return {
    slug: 'invoice_payments',
    _relUtil_evalVisibilityPredicate: LIBRARY_PROTO._relUtil_evalVisibilityPredicate,
    _relUtil_fieldError: LIBRARY_PROTO._relUtil_fieldError,
  };
}

async function runInvariant({ data = {}, prevState = null } = {}) {
  const parsedRule = parseRelationRule(RULE);
  expect(parsedRule).not.toBeNull();
  const ctx = { rel: {}, parsedRule, data, prevState, op: 'create' };
  return LIBRARY_PROTO._relInv_conditional_required.call(makeSelf(), ctx);
}

async function expectThrow(opts) {
  let caught;
  try {
    await runInvariant(opts);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeDefined();
  return caught;
}

describe('Plan I — DSL parser preserves whitespace inside enum values', () => {
  test('1. parser yields when_equals = "Credit Card" with the space intact', () => {
    const parsed = parseRelationRule(RULE);
    expect(parsed).not.toBeNull();
    expect(parsed.name).toBe('conditional_required');
    expect(parsed.args.field).toBe('installments');
    expect(parsed.args.when_field).toBe('payment_method');
    expect(parsed.args.when_equals).toBe('Credit Card');
  });
});

describe('Plan I — _relInv_conditional_required for installments', () => {
  test('2. predicate matches AND installments empty: throws 400 with field_errors.installments', async () => {
    const err = await expectThrow({ data: { payment_method: 'Credit Card' } });
    expect(err.statusCode).toBe(400);
    expect(err.fieldErrors).toBeDefined();
    expect(err.fieldErrors.installments).toBeDefined();
    expect(err.fieldErrors.installments.code).toBe('conditional_required');
  });

  test('3. predicate matches AND installments set: no-op', async () => {
    await expect(
      runInvariant({ data: { payment_method: 'Credit Card', installments: 6 } }),
    ).resolves.toBeUndefined();
  });

  test('4. predicate does not match (Cash): no-op even when installments empty', async () => {
    await expect(
      runInvariant({ data: { payment_method: 'Cash' } }),
    ).resolves.toBeUndefined();
  });

  test('5. predicate does not match (Debit Card): no-op even when installments empty', async () => {
    await expect(
      runInvariant({ data: { payment_method: 'Debit Card' } }),
    ).resolves.toBeUndefined();
  });

  test('6. predicate matches AND installments whitespace-only: throws (treated as empty)', async () => {
    const err = await expectThrow({
      data: { payment_method: 'Credit Card', installments: '   ' },
    });
    expect(err.statusCode).toBe(400);
    expect(err.fieldErrors.installments).toBeDefined();
  });

  test('7. update payload: payment_method comes from prevState, no installments → throws', async () => {
    const err = await expectThrow({
      prevState: { payment_method: 'Credit Card' },
      data: { note: 'updating note only' },
    });
    expect(err.fieldErrors.installments).toBeDefined();
  });

  test('8. update payload flips Cash → Credit Card without supplying installments → throws', async () => {
    const err = await expectThrow({
      prevState: { payment_method: 'Cash', installments: undefined },
      data: { payment_method: 'Credit Card' },
    });
    expect(err.fieldErrors.installments).toBeDefined();
  });

  test('9. INVARIANT_NAMES still advertises conditional_required for runner dispatch', () => {
    expect(INVARIANT_NAMES).toContain('conditional_required');
  });
});
