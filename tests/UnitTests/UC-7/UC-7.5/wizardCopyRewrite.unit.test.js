// Plan D follow-up #7: wizard copy rewrite tests.
//
// Verifies that the rewritten SMB-owner wizard prompts in hr.v3 / invoice.v3 /
// inventory.v4 and their TR translation mirrors are valid:
//   - Every key in the English pack maps to a non-empty Turkish prompt.
//   - The rewrites are *not* the technical pre-rewrite phrasing.
//   - moduleQuestionRegistry resolves both en and tr variants.

const hrPack = require('../../../../platform/backend/src/defaultQuestions/packs/hr.v3');
const invPack = require('../../../../platform/backend/src/defaultQuestions/packs/invoice.v3');
const inventPack = require('../../../../platform/backend/src/defaultQuestions/packs/inventory.v4');
const hrTr = require('../../../../platform/backend/src/defaultQuestions/translations/hr.v3.tr');
const invTr = require('../../../../platform/backend/src/defaultQuestions/translations/invoice.v3.tr');
const inventTr = require('../../../../platform/backend/src/defaultQuestions/translations/inventory.v4.tr');

function findPrompt(pack, key) {
  const q = pack.getQuestions().find((qq) => qq.key === key);
  return q ? q.prompt : null;
}

describe('UC-7.5 / wizardCopyRewrite', () => {
  // TC-UC7.5-WCR-001
  test('TC-UC7.5-WCR-001 — HR rewritten prompts use SMB-owner voice (en)', () => {
    const leaveEngine = findPrompt(hrPack, 'hr_enable_leave_engine');
    const attendance = findPrompt(hrPack, 'hr_enable_attendance_time');
    const compLedger = findPrompt(hrPack, 'hr_enable_compensation_ledger');
    expect(leaveEngine).toBeTruthy();
    expect(leaveEngine).not.toMatch(/leave days each employee has remaining/i);
    expect(attendance).toMatch(/clock-in|daily hours/i);
    expect(compLedger).toMatch(/wages|extras|payroll/i);
  });

  // TC-UC7.5-WCR-002
  test('TC-UC7.5-WCR-002 — Invoice rewritten prompts use SMB-owner voice (en)', () => {
    const stockLink = findPrompt(invPack, 'invoice_stock_link');
    const apLink = findPrompt(invPack, 'invoice_ap_link');
    const calcEngine = findPrompt(invPack, 'invoice_enable_calc_engine');
    expect(stockLink).toMatch(/stock/i);
    expect(stockLink).not.toMatch(/issuing the invoice/i);
    expect(apLink).toMatch(/supplier/i);
    expect(calcEngine).toMatch(/discount|fee/i);
  });

  // TC-UC7.5-WCR-003
  test('TC-UC7.5-WCR-003 — Inventory rewritten prompts use SMB-owner voice (en)', () => {
    const reservations = findPrompt(inventPack, 'inv_enable_reservations');
    const inbound = findPrompt(inventPack, 'inv_enable_inbound');
    const cycle = findPrompt(inventPack, 'inv_enable_cycle_counting');
    const batch = findPrompt(inventPack, 'inv_batch_tracking');
    expect(reservations).not.toMatch(/before confirming/i);
    expect(inbound).toMatch(/supplier/i);
    expect(cycle).toMatch(/count|shelf|reality/i);
    expect(batch).toMatch(/batch|lot/i);
  });

  // TC-UC7.5-WCR-004
  test('TC-UC7.5-WCR-004 — every English question has a Turkish prompt', () => {
    for (const [pack, tr] of [
      [hrPack, hrTr],
      [invPack, invTr],
      [inventPack, inventTr],
    ]) {
      const questions = pack.getQuestions();
      for (const q of questions) {
        expect(typeof tr.prompts[q.key]).toBe('string');
        expect(tr.prompts[q.key].length).toBeGreaterThan(0);
      }
    }
  });

  // TC-UC7.5-WCR-005
  test('TC-UC7.5-WCR-005 — Turkish prompts do not retain the old technical phrasing', () => {
    expect(hrTr.prompts.hr_enable_attendance_time).not.toMatch(/giriş, çıkış ve çalıştıkları saatleri/i);
    expect(invTr.prompts.invoice_stock_link).not.toMatch(/Fatura satırı stoklu bir ürünse/i);
    expect(inventTr.prompts.inv_enable_inbound).not.toMatch(/Tedarikçilerden alım yapıp sipariş verilen ile teslim alınanı/i);
  });

  // TC-UC7.5-WCR-006
  test('TC-UC7.5-WCR-006 — module versions are still hr.v3 / invoice.v3 / inventory.v4', () => {
    expect(hrPack.version).toBe('hr.v3');
    expect(invPack.version).toBe('invoice.v3');
    expect(inventPack.version).toBe('inventory.v4');
  });
});
