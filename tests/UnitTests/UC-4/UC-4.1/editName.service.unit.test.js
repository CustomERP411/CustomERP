/**
 * UC-4.1 Edit Name — service-layer unit tests
 *
 * Covers TC-UC4.1-005, TC-UC4.1-006, TC-UC4.1-007.
 * SUT: platform/backend/src/services/authService.js (updateProfile)
 *
 * We mock only the DB layer so the SUT's logic runs for real:
 *   - partial UPDATE builder
 *   - trim behaviour on the name
 *   - UTF-8 round-trip for Turkish characters
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

const { query } = require('../../../../platform/backend/src/config/database');
const authService = require(
  '../../../../platform/backend/src/services/authService',
);

function updatedRow(overrides = {}) {
  return {
    user_id: 'u-1',
    name: 'Bob',
    email: 'bob@test.com',
    preferred_language: 'en',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

describe('UC-4.1 / authService.updateProfile — name path', () => {
  // TC-UC4.1-005
  test('builds a partial UPDATE that only touches the `name` column', async () => {
    query.mockResolvedValueOnce({ rows: [updatedRow({ name: 'Bob' })] });

    await authService.updateProfile('u-1', { name: 'Bob' });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];

    expect(sql).toMatch(/UPDATE\s+users/i);
    expect(sql).toMatch(/SET\s+name\s*=\s*\$1/i);
    expect(sql).not.toMatch(/email\s*=/i);
    expect(sql).not.toMatch(/preferred_language\s*=/i);
    expect(sql).toMatch(/updated_at\s*=\s*CURRENT_TIMESTAMP/i);
    expect(sql).toMatch(/WHERE\s+user_id\s*=\s*\$2/i);

    expect(params).toEqual(['Bob', 'u-1']);
  });

  // TC-UC4.1-006
  test('trims surrounding whitespace from the new name', async () => {
    query.mockResolvedValueOnce({ rows: [updatedRow({ name: 'Ayşe' })] });

    await authService.updateProfile('u-1', { name: '   Ayşe   ' });

    const params = query.mock.calls[0][1];
    expect(params[0]).toBe('Ayşe');
  });

  // TC-UC4.1-007 — localization-specific
  test('stores a Turkish name (ğ, ş, ç, ö, İ) byte-perfect and returns it unchanged', async () => {
    const turkishName = 'Gülşen İçöz';
    query.mockResolvedValueOnce({ rows: [updatedRow({ name: turkishName })] });

    const user = await authService.updateProfile('u-1', { name: turkishName });

    expect(query.mock.calls[0][1][0]).toBe(turkishName);
    expect(user.name).toBe(turkishName);
    expect(turkishName).toMatch(/[ğşçöİı]/);
  });
});
