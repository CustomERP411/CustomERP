/**
 * UC-13.2 Submit Feature Request (<<include>> from UC-13) —
 * recordFeatures + normalize unit tests.
 *
 * Covers TC-UC13.2-001 through TC-UC13.2-006.
 * SUT: platform/backend/src/services/featureRequestService.js
 *
 * normalize():
 *   - lower-cases, trims, collapses runs of whitespace into a single
 *     space. Used for the unique index on feature_name_normalized.
 *
 * recordFeatures():
 *   - no-ops (returns []) when given an empty/non-array input;
 *   - inserts each non-empty feature with ON CONFLICT DO NOTHING,
 *     so duplicates per (feature_name_normalized, user_id, project_id)
 *     are idempotent;
 *   - only returns rows that were actually inserted (conflict rows
 *     yield no `result.rows[0]`);
 *   - logs and continues past per-row DB errors instead of aborting
 *     the whole batch.
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

describe('UC-13.2 / normalize', () => {
  // TC-UC13.2-001
  // normalize is not exported directly, but its behavior is observable
  // through the normalized column in the INSERT params.
  test('TC-UC13.2-001 — lowercases, trims, and collapses whitespace in feature names', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await frs.recordFeatures({
      userId: 'u-1',
      projectId: 'p-1',
      features: ['  Barcode   Scanner  '],
      source: 'chatbot',
      userPrompt: 'q',
    });

    const [, params] = db.query.mock.calls[0];
    // params: [featureName, normalized, source, userId, projectId, userPrompt]
    expect(params[0]).toBe('Barcode   Scanner'); // original minus outer trim
    expect(params[1]).toBe('barcode scanner'); // normalized
  });
});

describe('UC-13.2 / recordFeatures — no-op cases', () => {
  // TC-UC13.2-002
  test('TC-UC13.2-002 — empty or non-array input returns [] and makes no query', async () => {
    const a = await frs.recordFeatures({
      userId: 'u-1', projectId: 'p-1', features: [], source: 'chatbot',
    });
    const b = await frs.recordFeatures({
      userId: 'u-1', projectId: 'p-1', features: null, source: 'chatbot',
    });

    expect(a).toEqual([]);
    expect(b).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  // TC-UC13.2-005
  test('TC-UC13.2-005 — blank / whitespace-only feature names are silently skipped', async () => {
    const out = await frs.recordFeatures({
      userId: 'u-1',
      projectId: 'p-1',
      features: [' ', '', '\t\n'],
      source: 'chatbot',
    });

    expect(out).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('UC-13.2 / recordFeatures — SQL contract', () => {
  // TC-UC13.2-003
  test('TC-UC13.2-003 — INSERT uses ON CONFLICT DO NOTHING for idempotent recording', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await frs.recordFeatures({
      userId: 'u-1',
      projectId: 'p-1',
      features: ['Barcode'],
      source: 'chatbot',
      userPrompt: 'need barcode',
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT\s+INTO\s+feature_requests/i);
    expect(sql).toMatch(/ON CONFLICT/i);
    expect(sql).toMatch(/DO NOTHING/i);
    // Plan K §K4 — three additional bilingual columns are appended.
    // Legacy string-shaped feature inputs default name_en = name_native
    // = the original label and language = 'en'.
    expect(params).toEqual([
      'Barcode',         // $1 feature_name
      'barcode',         // $2 normalized
      'chatbot',         // $3 source
      'u-1',             // $4 user_id
      'p-1',             // $5 project_id
      'need barcode',    // $6 user_prompt
      'Barcode',         // $7 name_en
      'Barcode',         // $8 name_native
      'en',              // $9 language
    ]);
  });

  // TC-UC13.2-004
  test('TC-UC13.2-004 — returns only rows where INSERT actually produced a row (conflict filtered)', async () => {
    db.query
      // First feature is new → RETURNING produces a row.
      .mockResolvedValueOnce({ rows: [{ id: 1, feature_name: 'A' }] })
      // Second feature conflicts → RETURNING produces no row.
      .mockResolvedValueOnce({ rows: [] });

    const out = await frs.recordFeatures({
      userId: 'u-1',
      projectId: 'p-1',
      features: ['A', 'B'],
      source: 'chatbot',
    });

    expect(out).toHaveLength(1);
    expect(out[0].feature_name).toBe('A');
  });

  // TC-UC13.2-006
  test('TC-UC13.2-006 — per-row DB error does NOT abort the batch', async () => {
    db.query
      .mockRejectedValueOnce(new Error('unique violation race'))
      .mockResolvedValueOnce({ rows: [{ id: 2, feature_name: 'OK' }] });

    const out = await frs.recordFeatures({
      userId: 'u-1',
      projectId: 'p-1',
      features: ['Broken', 'OK'],
      source: 'chatbot',
    });

    expect(out).toHaveLength(1);
    expect(out[0].feature_name).toBe('OK');
    expect(db.query).toHaveBeenCalledTimes(2);
  });
});
