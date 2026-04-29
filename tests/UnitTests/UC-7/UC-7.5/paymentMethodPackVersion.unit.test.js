/**
 * UC-7.5 / Plan I — invoice.v4 pack version + invoice_payment_methods question.
 *
 * SUT: platform/backend/src/services/moduleQuestionRegistry.js
 *      platform/backend/src/defaultQuestions/packs/invoice.v4.js
 *
 * Cases:
 *   1. Active invoice pack version is invoice.v4.
 *   2. invoice.v4 ships invoice_payment_methods with the expected default
 *      options and gating condition (invoice_enable_payments=yes).
 *   3. v3 stays loadable for backward compatibility (and does NOT yet have
 *      the new question).
 *   4. The question is multi_choice and maps to the payment_method options
 *      sdf path.
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const moduleQuestionRegistry = require(path.join(
  REPO_ROOT,
  'platform/backend/src/services/moduleQuestionRegistry.js',
));
const invoiceV3Pack = require(path.join(
  REPO_ROOT,
  'platform/backend/src/defaultQuestions/packs/invoice.v3.js',
));
const invoiceV4Pack = require(path.join(
  REPO_ROOT,
  'platform/backend/src/defaultQuestions/packs/invoice.v4.js',
));

describe('Plan I — invoice.v4 pack version', () => {
  test('1. active invoice pack version is invoice.v4', () => {
    const payload = moduleQuestionRegistry.getQuestionTemplatePayload(
      ['invoice'],
      { language: 'en' },
    );
    expect(payload.template_versions.invoice.version).toBe('invoice.v4');
  });

  test('2. invoice.v4 ships invoice_payment_methods with default trio + extras', () => {
    const questions = invoiceV4Pack.getQuestions();
    const q = questions.find((entry) => entry.key === 'invoice_payment_methods');
    expect(q).toBeTruthy();
    expect(q.type).toBe('multi_choice');
    expect(q.options).toEqual(
      expect.arrayContaining(['Cash', 'Credit Card', 'Debit Card']),
    );
    expect(q.allow_custom).toBe(true);
    expect(q.condition).toBeTruthy();
    expect(q.condition.op).toBe('all');
    const gatingRule = q.condition.rules.find(
      (r) => r.question_key === 'invoice_enable_payments',
    );
    expect(gatingRule).toBeTruthy();
    expect(gatingRule.equals).toBe('yes');
  });

  test('3. invoice.v3 still loadable and does NOT carry the new question', () => {
    expect(invoiceV3Pack.version).toBe('invoice.v3');
    const v3Keys = invoiceV3Pack.getQuestions().map((entry) => entry.key);
    expect(v3Keys).not.toContain('invoice_payment_methods');
  });

  test('4. invoice_payment_methods sdf_mapping targets the payment_method options array', () => {
    const q = invoiceV4Pack
      .getQuestions()
      .find((entry) => entry.key === 'invoice_payment_methods');
    expect(q.sdf_mapping).toBeTruthy();
    expect(q.sdf_mapping.target).toBe(
      'entities.invoice_payments.fields.payment_method.options',
    );
  });

  test('5. invoice.v4 is registered with TR translations for prompts and option labels', () => {
    const payload = moduleQuestionRegistry.getQuestionTemplatePayload(
      ['invoice'],
      { language: 'tr' },
    );
    const q = payload.questions.find(
      (entry) => entry.module === 'invoice' && entry.key === 'invoice_payment_methods',
    );
    expect(q).toBeTruthy();
    expect(q.prompt).toMatch(/ödeme/i);
    expect(q.option_labels).toBeTruthy();
    expect(q.option_labels['Credit Card']).toBe('Kredi Kartı');
    expect(q.option_labels['Cash']).toBe('Nakit');
  });
});
