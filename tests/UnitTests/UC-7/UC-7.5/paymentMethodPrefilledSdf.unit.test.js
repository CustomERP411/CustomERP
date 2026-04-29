/**
 * UC-7.5 / Plan I — prefilledSdfService emits the payment_method enum,
 * the conditionally-visible installments field, and the paired
 * conditional_required invariant on invoice_payments.
 *
 * SUT: platform/backend/src/services/prefilledSdfService.js
 *      (buildInvoiceEntities through buildPrefilledSdfDraft)
 *
 * Coverage:
 *   - Default trio (Cash/Credit Card/Debit Card) when the wizard answer
 *     is empty; payment_method is required + has a default.
 *   - installments field appears with visibility_when payment_method=
 *     "Credit Card" and the matching conditional_required invariant
 *     lives in invoice_payments.relations[].
 *   - When the wizard answer drops Credit Card (e.g. ['Cash']) the
 *     installments field AND the invariant are NOT emitted.
 *   - When payments are off the entity isn't emitted at all (sanity).
 */

const path = require('path');
const { buildPrefilledSdfDraft } = require(
  '../../../../platform/backend/src/services/prefilledSdfService.js'
);

function buildSdf(answers) {
  return buildPrefilledSdfDraft({
    projectName: 'Plan I Test',
    modules: ['invoice'],
    mandatoryAnswers: answers,
    templateVersions: {},
  });
}

function findEntity(sdf, slug) {
  return (sdf.entities || []).find((e) => e && e.slug === slug);
}
function findField(entity, name) {
  return (entity.fields || []).find((f) => f && f.name === name);
}

describe('Plan I — prefilledSdfService default payment-method trio', () => {
  const sdf = buildSdf({ invoice_enable_payments: 'yes' });
  const payments = findEntity(sdf, 'invoice_payments');

  test('1. invoice_payments entity is emitted when payments are on', () => {
    expect(payments).toBeDefined();
  });

  test('2. payment_method is a required string with the default trio + a default value', () => {
    const f = findField(payments, 'payment_method');
    expect(f).toBeDefined();
    expect(f.type).toBe('string');
    expect(f.required).toBe(true);
    expect(f.options).toEqual(['Cash', 'Credit Card', 'Debit Card']);
    expect(f.default).toBe('Cash');
  });

  test('3. installments field is emitted with visibility_when payment_method="Credit Card"', () => {
    const f = findField(payments, 'installments');
    expect(f).toBeDefined();
    expect(f.type).toBe('integer');
    expect(f.required === true).toBe(false);
    expect(f.min).toBe(1);
    expect(f.max).toBe(36);
    expect(f.visibility_when).toEqual({ field: 'payment_method', equals: 'Credit Card' });
  });

  test('4. paired conditional_required invariant lives on invoice_payments.relations[]', () => {
    expect(Array.isArray(payments.relations)).toBe(true);
    const invariant = payments.relations.find(
      (r) => r && r.kind === 'invariant' && /^conditional_required\(/.test(String(r.rule || '')),
    );
    expect(invariant).toBeDefined();
    expect(invariant.rule).toBe(
      'conditional_required(field=installments, when_field=payment_method, when_equals=Credit Card)',
    );
    expect(invariant.severity).toBe('block');
    expect(invariant.error_key).toBe('invoice_payments.installments_required_for_credit_card');
  });
});

describe('Plan I — wizard answer overrides the trio', () => {
  test('5. when Credit Card is dropped, installments and invariant disappear', () => {
    const sdf = buildSdf({
      invoice_enable_payments: 'yes',
      invoice_payment_methods: ['Cash'],
    });
    const payments = findEntity(sdf, 'invoice_payments');
    expect(payments).toBeDefined();
    const f = findField(payments, 'payment_method');
    expect(f.options).toEqual(['Cash']);
    expect(f.default).toBe('Cash');
    expect(findField(payments, 'installments')).toBeUndefined();
    const invariants = (payments.relations || []).filter(
      (r) => r && r.kind === 'invariant' && /conditional_required/.test(String(r.rule || '')),
    );
    expect(invariants.length).toBe(0);
  });

  test('6. multi_choice answer encoded as JSON string is parsed (matches questionnaire serializer)', () => {
    const sdf = buildSdf({
      invoice_enable_payments: 'yes',
      // moduleQuestionnaireService stores multi_choice as a JSON string;
      // parseMultiChoice in prefilledSdfService must decode it.
      invoice_payment_methods: '["Cash", "Credit Card"]',
    });
    const payments = findEntity(sdf, 'invoice_payments');
    const f = findField(payments, 'payment_method');
    expect(f.options).toEqual(['Cash', 'Credit Card']);
    // Credit Card is in the list -> installments + invariant present
    expect(findField(payments, 'installments')).toBeDefined();
    const invariant = (payments.relations || []).find(
      (r) => r && r.kind === 'invariant' && /conditional_required/.test(String(r.rule || '')),
    );
    expect(invariant).toBeDefined();
  });

  test('7. payments off → invoice_payments entity is not emitted', () => {
    const sdf = buildSdf({});
    expect(findEntity(sdf, 'invoice_payments')).toBeUndefined();
  });
});
