/**
 * UC-7.5 / Plan K §K4 + §K5 — bilingual feature_requests storage.
 *
 * SUT (backend):  platform/backend/src/services/featureRequestService.js
 *                 - _normalizeFeatureEntry (pure)
 *                 - recordFeatures        (writes to DB; we mock the
 *                                          `query` export and assert the
 *                                          INSERT params).
 *
 * Test IDs follow the UC-7.5 convention so dashboards stay aligned with
 * the rest of the suite (TC-UC7.5-FRBI-NNN).
 *
 * The frontend `resolveFeatureName` helper is covered separately by the
 * Vitest/Jest config that owns platform/frontend; here we focus on the
 * Node-side persistence contract.
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

const db = require('../../../../platform/backend/src/config/database');
const {
  _normalizeFeatureEntry,
  recordFeatures,
} = require('../../../../platform/backend/src/services/featureRequestService');

beforeEach(() => {
  db.query.mockReset();
  // Default: pretend the row was inserted, returning a stub.
  db.query.mockResolvedValue({ rows: [{ id: 'stub-row' }] });
});

// ---------------------------------------------------------------------------
// _normalizeFeatureEntry — pure shape contract
// ---------------------------------------------------------------------------

describe('Plan K — _normalizeFeatureEntry', () => {
  test('TC-UC7.5-FRBI-001: legacy string entry stays English', () => {
    const out = _normalizeFeatureEntry('Multi-currency invoicing', 'tr');
    expect(out).toEqual({
      featureName: 'Multi-currency invoicing',
      nameEn: 'Multi-currency invoicing',
      nameNative: 'Multi-currency invoicing',
      language: 'en',
    });
  });

  test('TC-UC7.5-FRBI-002: bilingual object adopts project language', () => {
    const out = _normalizeFeatureEntry(
      { name_en: 'Payroll', name_native: 'Bordro' },
      'tr'
    );
    expect(out).toEqual({
      featureName: 'Payroll',
      nameEn: 'Payroll',
      nameNative: 'Bordro',
      language: 'tr',
    });
  });

  test('TC-UC7.5-FRBI-003: missing name_native mirrors name_en', () => {
    const out = _normalizeFeatureEntry({ name_en: 'Approvals' }, 'tr');
    expect(out.nameNative).toBe('Approvals');
    expect(out.nameEn).toBe('Approvals');
    expect(out.language).toBe('tr');
  });

  test('TC-UC7.5-FRBI-004: empty / blank entries are dropped', () => {
    expect(_normalizeFeatureEntry('   ', 'en')).toBeNull();
    expect(_normalizeFeatureEntry({ name_en: '', name_native: '' }, 'tr')).toBeNull();
    expect(_normalizeFeatureEntry(null, 'en')).toBeNull();
  });

  test('TC-UC7.5-FRBI-005: project language defaults to "en" when omitted', () => {
    const out = _normalizeFeatureEntry({ name_en: 'X', name_native: 'X' });
    expect(out.language).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// recordFeatures — DB persistence (INSERT shape + parameter order)
// ---------------------------------------------------------------------------

describe('Plan K — recordFeatures persists bilingual columns', () => {
  test('TC-UC7.5-FRBI-010: legacy string list writes name_en=name_native, language=en', async () => {
    await recordFeatures({
      userId: 'u1',
      projectId: 'p1',
      features: ['Multi-warehouse stock'],
      source: 'chatbot',
      userPrompt: 'we need it',
      language: 'tr', // even with a TR project the legacy string lane stays EN
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO feature_requests/);
    expect(sql).toMatch(/name_en, name_native, language/);
    // Param order: feature_name, normalized, source, userId, projectId,
    // userPrompt, name_en, name_native, language
    expect(params[0]).toBe('Multi-warehouse stock');
    expect(params[6]).toBe('Multi-warehouse stock'); // name_en
    expect(params[7]).toBe('Multi-warehouse stock'); // name_native
    expect(params[8]).toBe('en');                    // language
  });

  test('TC-UC7.5-FRBI-011: bilingual object writes both labels and project language', async () => {
    await recordFeatures({
      userId: 'u1',
      projectId: 'p1',
      features: [{ name_en: 'Payroll', name_native: 'Bordro' }],
      source: 'chatbot',
      userPrompt: null,
      language: 'tr',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toBe('Payroll');   // canonical feature_name
    expect(params[6]).toBe('Payroll');   // name_en
    expect(params[7]).toBe('Bordro');    // name_native
    expect(params[8]).toBe('tr');        // language
  });

  test('TC-UC7.5-FRBI-012: empty features list does not query DB', async () => {
    await recordFeatures({
      userId: 'u1',
      projectId: 'p1',
      features: [],
      source: 'chatbot',
      language: 'en',
    });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('TC-UC7.5-FRBI-013: blank entries are skipped, valid ones persisted', async () => {
    await recordFeatures({
      userId: 'u1',
      projectId: 'p1',
      features: ['', { name_en: 'Approvals' }, '   '],
      source: 'chatbot',
      language: 'tr',
    });
    expect(db.query).toHaveBeenCalledTimes(1);
    const params = db.query.mock.calls[0][1];
    expect(params[0]).toBe('Approvals');
    expect(params[7]).toBe('Approvals'); // name_native mirrors name_en
    expect(params[8]).toBe('tr');
  });

  test('TC-UC7.5-FRBI-014: DB error on one feature does not block the next', async () => {
    db.query
      .mockRejectedValueOnce(new Error('uniqueness collision'))
      .mockResolvedValueOnce({ rows: [{ id: 'kept' }] });

    const inserted = await recordFeatures({
      userId: 'u1',
      projectId: 'p1',
      features: [
        { name_en: 'A', name_native: 'A' },
        { name_en: 'B', name_native: 'B' },
      ],
      source: 'chatbot',
      language: 'en',
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(inserted).toEqual([{ id: 'kept' }]);
  });
});
