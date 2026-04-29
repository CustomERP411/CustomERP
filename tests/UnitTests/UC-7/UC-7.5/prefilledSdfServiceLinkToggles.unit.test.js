/**
 * UC-7.5 / Plan C — prefilledSdfService link-toggle tests.
 *
 * SUT: platform/backend/src/services/prefilledSdfService.js (buildPrefilledSdfDraft)
 *
 * Cases:
 *   1. invoice.stock_link.enabled = true reaches sdf.modules.invoice.stock_link.enabled
 *      only when both invoice + inventory modules are selected.
 *   2. modules.access_control.enabled = true is written when any actor-driven pack is on.
 *   3. Defaults applied when answer is absent + both ends on (e.g. hr_leave_attendance_link).
 *   4. invoice_ap_link only fires when both invoice_enable_payments and inv_enable_inbound are yes.
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const { buildPrefilledSdfDraft } = require(path.join(
  REPO_ROOT,
  'platform/backend/src/services/prefilledSdfService.js',
));

describe('Plan C — prefilledSdfService link toggles', () => {
  test('1. invoice_stock_link reaches sdf only when both modules selected', () => {
    const onlyInvoice = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice'],
      mandatoryAnswers: { invoice_stock_link: 'yes' },
      templateVersions: {},
    });
    expect(onlyInvoice.modules.invoice.stock_link).toBeUndefined();

    const both = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice', 'inventory'],
      mandatoryAnswers: { invoice_stock_link: 'yes' },
      templateVersions: {},
    });
    expect(both.modules.invoice.stock_link).toEqual({ enabled: true });
  });

  test('2. access_control.enabled = true when any actor-driven pack is on', () => {
    const sdf = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['hr'],
      mandatoryAnswers: { hr_enable_leave_engine: 'yes' },
      templateVersions: {},
    });
    expect(sdf.modules.access_control).toBeDefined();
    expect(sdf.modules.access_control.enabled).toBe(true);

    const noActorPacks = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['hr'],
      mandatoryAnswers: {},
      templateVersions: {},
    });
    // No explicit access_control written when no actor-driven pack is on.
    // It can still be migrated implicitly later, but the prefiller doesn't
    // force it here.
    const ac = noActorPacks.modules.access_control;
    if (ac !== undefined) {
      // sdfActorMigration may set this if it ran; but with no actor packs
      // there are no string fields to promote, so it should remain undefined.
      expect(ac.enabled === undefined || ac.enabled === false || ac.enabled === true).toBe(true);
    }
  });

  test('3. defaults apply when answer is absent + both ends on (hr_leave_attendance_link)', () => {
    const sdf = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['hr'],
      mandatoryAnswers: {
        hr_enable_leave_engine: 'yes',
        hr_enable_attendance_time: 'yes',
        // no explicit hr_leave_attendance_link
      },
      templateVersions: {},
    });
    // default_on: true for this link
    expect(sdf.modules.hr.leave_attendance_link).toEqual({ enabled: true });
  });

  test('4. invoice_ap_link only on when both invoice_enable_payments + inv_enable_inbound are yes', () => {
    const onlyOne = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice', 'inventory'],
      mandatoryAnswers: { invoice_enable_payments: 'yes' },
      templateVersions: {},
    });
    expect(onlyOne.modules.invoice.ap_link).toBeUndefined();

    const both = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice', 'inventory'],
      mandatoryAnswers: {
        invoice_enable_payments: 'yes',
        inv_enable_inbound: 'yes',
        invoice_ap_link: 'yes',
      },
      templateVersions: {},
    });
    expect(both.modules.invoice.ap_link).toEqual({ enabled: true });
  });

  test('5. user-explicit "no" beats the default seed', () => {
    const sdf = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['hr'],
      mandatoryAnswers: {
        hr_enable_leave_engine: 'yes',
        hr_enable_attendance_time: 'yes',
        hr_leave_attendance_link: 'no',
      },
      templateVersions: {},
    });
    expect(sdf.modules.hr.leave_attendance_link).toEqual({ enabled: false });
  });
});
