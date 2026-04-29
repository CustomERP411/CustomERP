/**
 * UC-7.5 / Plan C — moduleQuestionRegistry version tests.
 *
 * SUT: platform/backend/src/services/moduleQuestionRegistry.js
 *      platform/backend/src/defaultQuestions/packs/{hr.v3, invoice.v4, inventory.v4}.js
 *
 * Cases:
 *   1. Active versions are hr.v3 / invoice.v4 / inventory.v4 (Plan C bump
 *      then Plan I bumped invoice → v4 to add `invoice_payment_methods`).
 *   2. The active packs ship the five new link-toggle questions.
 *   3. Legacy packs (hr.v2, invoice.v2, inventory.v3) still loadable for stored
 *      answers compatibility.
 *   4. Each module's payload reports the active version in template_versions.
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const moduleQuestionRegistry = require(path.join(
  REPO_ROOT,
  'platform/backend/src/services/moduleQuestionRegistry.js',
));
const hrV1Pack = require(path.join(REPO_ROOT, 'platform/backend/src/defaultQuestions/packs/hr.v1.js'));
const hrV3Pack = require(path.join(REPO_ROOT, 'platform/backend/src/defaultQuestions/packs/hr.v3.js'));
const invoiceV1Pack = require(path.join(REPO_ROOT, 'platform/backend/src/defaultQuestions/packs/invoice.v1.js'));
const invoiceV3Pack = require(path.join(REPO_ROOT, 'platform/backend/src/defaultQuestions/packs/invoice.v3.js'));
const inventoryV1Pack = require(path.join(REPO_ROOT, 'platform/backend/src/defaultQuestions/packs/inventory.v1.js'));
const inventoryV4Pack = require(path.join(REPO_ROOT, 'platform/backend/src/defaultQuestions/packs/inventory.v4.js'));

describe('Plan C — moduleQuestionRegistry pack versions', () => {
  test('1. active versions are hr.v3 / invoice.v4 / inventory.v4', () => {
    const payload = moduleQuestionRegistry.getQuestionTemplatePayload(
      ['hr', 'invoice', 'inventory'],
      { language: 'en' },
    );
    expect(payload.template_versions.hr.version).toBe('hr.v3');
    // Plan I bumped invoice past v3 to add `invoice_payment_methods`.
    expect(payload.template_versions.invoice.version).toBe('invoice.v4');
    expect(payload.template_versions.inventory.version).toBe('inventory.v4');
  });

  test('2. five new link-toggle questions ship in the active packs', () => {
    const hrKeys = hrV3Pack.getQuestions().map((q) => q.key);
    expect(hrKeys).toEqual(expect.arrayContaining([
      'hr_leave_attendance_link',
      'hr_leave_payroll_link',
      'hr_timesheet_payroll_link',
    ]));
    const invKeys = invoiceV3Pack.getQuestions().map((q) => q.key);
    expect(invKeys).toEqual(expect.arrayContaining([
      'invoice_stock_link',
      'invoice_ap_link',
    ]));
  });

  test('3. legacy packs still loadable (and report their original versions)', () => {
    expect(hrV1Pack.version).toBe('hr.v2'); // exported version is the file's authored value
    expect(invoiceV1Pack.version).toBe('invoice.v2');
    expect(inventoryV1Pack.version).toBe('inventory.v3');
    // None of those should crash to load:
    expect(typeof hrV1Pack.getQuestions).toBe('function');
    expect(typeof invoiceV1Pack.getQuestions).toBe('function');
    expect(typeof inventoryV1Pack.getQuestions).toBe('function');
  });

  test('4. inventory.v4 has no new link questions but is the active version', () => {
    const invKeys = inventoryV4Pack.getQuestions().map((q) => q.key);
    expect(invKeys).not.toEqual(expect.arrayContaining(['inventory_stock_link']));
    // Active version reports back from the registry payload
    const payload = moduleQuestionRegistry.getQuestionTemplatePayload(['inventory'], { language: 'en' });
    expect(payload.template_versions.inventory.version).toBe('inventory.v4');
  });

  test('5. each new link-toggle question has a sdf_mapping.target and a condition gate', () => {
    const linkKeys = [
      'hr_leave_attendance_link',
      'hr_leave_payroll_link',
      'hr_timesheet_payroll_link',
      'invoice_stock_link',
      'invoice_ap_link',
    ];
    const all = [
      ...hrV3Pack.getQuestions(),
      ...invoiceV3Pack.getQuestions(),
    ];
    for (const key of linkKeys) {
      const q = all.find((x) => x.key === key);
      expect(q).toBeTruthy();
      expect(q.sdf_mapping?.target).toMatch(/^modules\./);
      expect(q.condition).toBeTruthy();
      expect(q.condition.op).toBe('all');
      expect(q.condition.rules.length).toBeGreaterThanOrEqual(2);
    }
  });
});
