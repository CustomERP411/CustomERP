/**
 * UC-7.5 / Plan C — dependencyGraph tests.
 *
 * SUT: platform/backend/src/defaultQuestions/dependencyGraph.js
 *
 * Cases:
 *   1. Integrity — every key referenced in HARD_REQUIRES / FEEDS_HINTS / LINK_TOGGLES
 *      resolves to a real question key in an active pack (or a module-presence pseudo-key).
 *   2. No cycle in HARD_REQUIRES (load-time guard succeeds).
 *   3. Forward auto-enable — turning downstream on flips upstream on.
 *   4. Backward cascade-off — turning upstream off flips downstream off.
 *   5. Multi-step cascade reaches fixed point.
 *   6. Idempotent — running twice produces the same answer map and no new coerced rows.
 *   7. Module-presence pseudo-rules (INVOICE_MODULE / INVENTORY_MODULE) recognized.
 *   8. Link-toggle defaults seeded only when both ends are on; never override explicit answers.
 *   9. serializeForApi shape stable.
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const dependencyGraph = require(path.join(
  REPO_ROOT,
  'platform/backend/src/defaultQuestions/dependencyGraph.js',
));
const moduleQuestionRegistry = require(path.join(
  REPO_ROOT,
  'platform/backend/src/services/moduleQuestionRegistry.js',
));

describe('Plan C — dependencyGraph', () => {
  test('1. integrity: every referenced key resolves to a real question key or pseudo-rule', () => {
    const payload = moduleQuestionRegistry.getQuestionTemplatePayload(
      ['hr', 'invoice', 'inventory'],
      { language: 'en' },
    );
    const questionKeys = new Set(payload.questions.map((q) => q.key));
    const pseudoKeys = new Set(Object.keys(dependencyGraph.MODULE_PRESENCE_KEYS));

    const isKnown = (key) => questionKeys.has(key) || pseudoKeys.has(key);

    for (const edge of dependencyGraph.HARD_REQUIRES) {
      expect(isKnown(edge.downstream)).toBe(true);
      expect(isKnown(edge.upstream)).toBe(true);
    }
    for (const edge of dependencyGraph.FEEDS_HINTS) {
      expect(isKnown(edge.from)).toBe(true);
      expect(isKnown(edge.to)).toBe(true);
    }
    for (const link of dependencyGraph.LINK_TOGGLES) {
      // The link key itself must exist as a question (we just added them in v3).
      expect(questionKeys.has(link.key)).toBe(true);
      for (const token of link.requires_both) {
        expect(isKnown(token)).toBe(true);
      }
    }
  });

  test('2. no cycle in HARD_REQUIRES (load-time guard already succeeded)', () => {
    // The module loaded; if HARD_REQUIRES had a cycle, requiring it would have thrown.
    expect(Array.isArray(dependencyGraph.HARD_REQUIRES)).toBe(true);
  });

  test('3. forward auto-enable: downstream yes flips upstream yes', () => {
    const { answers, coerced } = dependencyGraph.applyDependencyCoercion(
      { hr_enable_leave_approvals: 'yes' },
      ['hr'],
    );
    expect(answers.hr_enable_leave_engine).toBe('yes');
    expect(coerced.find((c) => c.key === 'hr_enable_leave_engine' && c.direction === 'auto_enable')).toBeTruthy();
  });

  test('4. backward cascade-off: upstream explicit no flips downstream off', () => {
    const { answers, coerced } = dependencyGraph.applyDependencyCoercion(
      { hr_enable_leave_engine: 'no', hr_enable_leave_approvals: 'yes' },
      ['hr'],
    );
    expect(answers.hr_enable_leave_approvals).toBe('no');
    expect(coerced.find((c) => c.key === 'hr_enable_leave_approvals' && c.direction === 'cascade_off')).toBeTruthy();
  });

  test('5. multi-step cascade reaches fixed point (idempotent on second run)', () => {
    const first = dependencyGraph.applyDependencyCoercion(
      { hr_enable_leave_approvals: 'yes' },
      ['hr'],
    );
    const second = dependencyGraph.applyDependencyCoercion(first.answers, ['hr']);
    expect(second.answers.hr_enable_leave_engine).toBe('yes');
    // No new coerced rows on the second pass.
    const newAutoEnable = second.coerced.filter((c) => c.direction === 'auto_enable');
    expect(newAutoEnable).toEqual([]);
  });

  test('6. idempotent: running twice produces the same answer map', () => {
    const first = dependencyGraph.applyDependencyCoercion(
      { hr_enable_leave_approvals: 'yes', hr_enable_attendance_time: 'yes' },
      ['hr'],
    );
    const second = dependencyGraph.applyDependencyCoercion(first.answers, ['hr']);
    expect(second.answers).toEqual(first.answers);
  });

  test('7. module-presence: invoice_stock_link defaulted only when both modules present', () => {
    const noBoth = dependencyGraph.applyDependencyCoercion({}, ['invoice']);
    expect(noBoth.answers.invoice_stock_link).toBeUndefined();

    const both = dependencyGraph.applyDependencyCoercion({}, ['invoice', 'inventory']);
    // default_on = false on this link, so default seed is 'no'
    expect(both.answers.invoice_stock_link).toBe('no');
  });

  test('8. link-toggle defaults: respect explicit user answer; default only when missing', () => {
    const explicit = dependencyGraph.applyDependencyCoercion(
      {
        hr_enable_leave_engine: 'yes',
        hr_enable_attendance_time: 'yes',
        hr_leave_attendance_link: 'no', // user said no
      },
      ['hr'],
    );
    expect(explicit.answers.hr_leave_attendance_link).toBe('no');

    const defaulted = dependencyGraph.applyDependencyCoercion(
      {
        hr_enable_leave_engine: 'yes',
        hr_enable_attendance_time: 'yes',
      },
      ['hr'],
    );
    // default_on = true on this link
    expect(defaulted.answers.hr_leave_attendance_link).toBe('yes');
  });

  test('9. serializeForApi: stable shape with the expected fields', () => {
    const ser = dependencyGraph.serializeForApi();
    expect(ser).toHaveProperty('hard_requires');
    expect(ser).toHaveProperty('feeds_hints');
    expect(ser).toHaveProperty('link_toggles');
    expect(ser).toHaveProperty('actor_driven_packs');
    expect(ser).toHaveProperty('module_presence_keys');
    expect(Array.isArray(ser.hard_requires)).toBe(true);
    expect(Array.isArray(ser.link_toggles)).toBe(true);
    for (const link of ser.link_toggles) {
      expect(link).toHaveProperty('key');
      expect(link).toHaveProperty('requires_both');
      expect(link).toHaveProperty('sdf_target');
      expect(typeof link.default_on).toBe('boolean');
    }
  });
});
