/**
 * UC-7.1 Select Modules — unit tests
 *
 * Covers TC-UC7.1-002 through TC-UC7.1-005.
 * SUT: platform/backend/src/controllers/projectHelpers.js (parseModulesInput)
 *
 * parseModulesInput is the gatekeeper that turns raw user / HTTP input
 * into a whitelisted, de-duplicated module list the rest of the
 * pipeline can trust. Allowed keys: 'inventory', 'invoice', 'hr'.
 */

const { parseModulesInput } = require(
  '../../../../platform/backend/src/controllers/projectHelpers',
);

describe('UC-7.1 / parseModulesInput', () => {
  // TC-UC7.1-002
  test('array input filters out unsupported module names', () => {
    expect(parseModulesInput(['inventory', 'payroll', 'hr', 'marketing'])).toEqual([
      'inventory',
      'hr',
    ]);
  });

  // TC-UC7.1-003
  test('comma-separated string input is split, trimmed, and lower-cased', () => {
    expect(parseModulesInput(' Inventory , INVOICE,,HR ')).toEqual([
      'inventory',
      'invoice',
      'hr',
    ]);
  });

  // TC-UC7.1-004
  test('duplicates are collapsed while first-seen order is preserved', () => {
    expect(
      parseModulesInput(['hr', 'inventory', 'hr', 'invoice', 'inventory']),
    ).toEqual(['hr', 'inventory', 'invoice']);
  });

  // TC-UC7.1-005
  test('null, undefined, numbers, and plain objects all yield an empty array', () => {
    expect(parseModulesInput(null)).toEqual([]);
    expect(parseModulesInput(undefined)).toEqual([]);
    expect(parseModulesInput(42)).toEqual([]);
    expect(parseModulesInput({ hr: true })).toEqual([]);
  });
});
