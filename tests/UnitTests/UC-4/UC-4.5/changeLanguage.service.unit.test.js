/**
 * UC-4.5 Change Language Preference — service-layer unit tests
 *
 * Budget reallocated from the cancelled "UC-13 Select Language" use case.
 * Covers TC-UC4-LANG-006, TC-UC4-LANG-007, TC-UC4-LANG-008.
 * SUT: platform/backend/src/services/authService.js (updateProfile)
 *
 * NOTE: These tests originally used the TC-UC4.4-* prefix which
 * collided with UC-4.4 Delete Account. They have been re-keyed to
 * TC-UC4-LANG-* so the language-preference sub-use-case has its own
 * test-ID namespace.
 *
 * updateProfile(userId, { ..., preferred_language }):
 *   - When `preferred_language !== undefined`, appends
 *     `preferred_language = $N` to the dynamic UPDATE and pushes the
 *     NORMALIZED value (e.g. 'TR-tr' → 'tr') into the params.
 *   - Re-normalizes the DB-returned value on the way back out so the
 *     API shape is always `'en' | 'tr'`.
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

const { query } = require('../../../../platform/backend/src/config/database');
const authService = require(
  '../../../../platform/backend/src/services/authService',
);

beforeEach(() => {
  query.mockReset();
});

describe('UC-4.5 / authService.updateProfile — preferred_language', () => {
  // TC-UC4-LANG-006
  test('TC-UC4-LANG-006 — issues UPDATE users SET preferred_language = $N when provided', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        user_id: 'u-1',
        name: 'Ayşe',
        email: 'a@b.com',
        preferred_language: 'tr',
        created_at: new Date(),
        updated_at: new Date(),
      }],
    });

    await authService.updateProfile('u-1', { preferred_language: 'tr' });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/UPDATE\s+users\s+SET/i);
    expect(sql).toMatch(/preferred_language\s*=\s*\$1/);
    expect(sql).toMatch(/WHERE\s+user_id\s*=\s*\$\d+\s+AND\s+deleted_at\s+IS\s+NULL/i);
    // params = [preferred_language, userId]
    expect(params[0]).toBe('tr');
    expect(params[params.length - 1]).toBe('u-1');
  });

  // TC-UC4-LANG-007
  test("TC-UC4-LANG-007 — normalizes locale-tagged input ('TR-tr') to 'tr' before persisting", async () => {
    query.mockResolvedValueOnce({
      rows: [{
        user_id: 'u-1',
        name: 'Ayşe',
        email: 'a@b.com',
        preferred_language: 'tr',
        created_at: new Date(),
        updated_at: new Date(),
      }],
    });

    await authService.updateProfile('u-1', { preferred_language: 'TR-tr' });

    const [, params] = query.mock.calls[0];
    expect(params[0]).toBe('tr');
  });

  // TC-UC4-LANG-008
  test("TC-UC4-LANG-008 — re-normalizes the stored value on the way back out ('TR' → 'tr')", async () => {
    query.mockResolvedValueOnce({
      rows: [{
        user_id: 'u-1',
        name: 'Ayşe',
        email: 'a@b.com',
        // Simulate a legacy row where the stored value is upper-case.
        preferred_language: 'TR',
        created_at: new Date(),
        updated_at: new Date(),
      }],
    });

    const result = await authService.updateProfile('u-1', { preferred_language: 'tr' });

    expect(result.preferred_language).toBe('tr');
    expect(result.id).toBe('u-1');
  });
});
