/**
 * UC-13.2 Submit Feature Request — recordWarnings unit tests
 *
 * Covers TC-UC13.2-007 through TC-UC13.2-011.
 * SUT: platform/backend/src/services/featureRequestService.js
 *
 * recordWarnings() filters post-generation warnings that look like
 * "unsupported"/"desteklenmiyor" (bilingual: EN + TR) and inserts them
 * as feature requests with source='sdf_generation'.
 *
 * Name-shaping rules:
 *   - Module-tagged warnings ("Module `name` ...") → "Module: <name>"
 *   - Feature-tagged ("Feature `x` on entity `y` ...") → "Feature: x (y)"
 *   - Anything else → first 100 chars + "..." (if longer than 100)
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../../../platform/backend/src/config/database');
const frs = require(
  '../../../../platform/backend/src/services/featureRequestService',
);

beforeEach(() => {
  db.query.mockReset();
});

describe('UC-13.2 / recordWarnings — filtering', () => {
  // TC-UC13.2-007
  test('TC-UC13.2-007 — non-unsupported warnings are ignored entirely', async () => {
    const out = await frs.recordWarnings({
      userId: 'u-1',
      projectId: 'p-1',
      warnings: ['just FYI: low confidence', 42, null],
      userPrompt: 'desc',
    });

    expect(out).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  // TC-UC13.2-008
  test("TC-UC13.2-008 — Turkish 'desteklenmiyor' warnings match and are recorded", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await frs.recordWarnings({
      userId: 'u-1',
      projectId: 'p-1',
      warnings: ['Module `barcode` şu an desteklenmiyor'],
      userPrompt: 'desc',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT\s+INTO\s+feature_requests/i);
    expect(sql).toMatch(/'sdf_generation'/);
    // With Module tagging the feature_name is "Module: <name>".
    expect(params[0]).toBe('Module: barcode');
  });
});

describe('UC-13.2 / recordWarnings — name shaping', () => {
  // TC-UC13.2-009
  test("TC-UC13.2-009 — Module-tagged warnings shape feature_name as 'Module: <name>'", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await frs.recordWarnings({
      userId: 'u-1',
      projectId: 'p-1',
      warnings: ['Module `barcode` is not supported by the generator'],
      userPrompt: 'desc',
    });

    const [, params] = db.query.mock.calls[0];
    expect(params[0]).toBe('Module: barcode');
    expect(params[1]).toBe('module: barcode'); // normalized
  });

  // TC-UC13.2-010
  test("TC-UC13.2-010 — Feature+entity warnings shape feature_name as 'Feature: <x> (<y>)'", async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await frs.recordWarnings({
      userId: 'u-1',
      projectId: 'p-1',
      warnings: ['Feature `scan` on entity `product` is not supported'],
      userPrompt: 'desc',
    });

    const [, params] = db.query.mock.calls[0];
    expect(params[0]).toBe('Feature: scan (product)');
  });

  // TC-UC13.2-011
  test('TC-UC13.2-011 — unstructured warnings > 100 chars are truncated to 100 + "..."', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });

    // 300 chars of filler + a suffix that matches /not supported/i so
    // the warning is accepted by the bilingual filter.
    const filler = 'a'.repeat(300);
    const warning = `${filler} is not supported`;

    await frs.recordWarnings({
      userId: 'u-1',
      projectId: 'p-1',
      warnings: [warning],
      userPrompt: 'desc',
    });

    const [, params] = db.query.mock.calls[0];
    expect(params[0]).toHaveLength(103);
    expect(params[0].endsWith('...')).toBe(true);
  });
});
