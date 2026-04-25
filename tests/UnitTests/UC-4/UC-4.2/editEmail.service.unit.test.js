/**
 * UC-4.2 Edit Email — service-layer unit tests
 *
 * Covers TC-UC4.2-004, TC-UC4.2-005, TC-UC4.2-006, TC-UC4.2-007.
 * SUT: platform/backend/src/services/authService.js (updateProfile)
 *
 * Business rules:
 *   - Changing email to one owned by a DIFFERENT user → HTTP 409.
 *   - Changing email to the CALLER'S OWN current email → allowed.
 *   - Empty payload → no UPDATE issued, returns current user.
 *   - Stored preferred_language is normalized (locale tags like
 *     `tr-TR` collapse to `tr`) before being returned to the API
 *     client.
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

const { query } = require('../../../../platform/backend/src/config/database');
const authService = require(
  '../../../../platform/backend/src/services/authService',
);

function emailRow(overrides = {}) {
  return {
    user_id: 'u-1',
    name: 'Alice',
    email: 'alice@test.com',
    password_hash: '$2a$10$abc',
    is_admin: false,
    preferred_language: 'en',
    deleted_at: null,
    blocked_at: null,
    block_reason: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function updatedRow(overrides = {}) {
  return {
    user_id: 'u-1',
    name: 'Alice',
    email: 'new@test.com',
    preferred_language: 'en',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  };
}

describe('UC-4.2 / authService.updateProfile — email path', () => {
  // TC-UC4.2-004
  test('TC-UC4.2-004 — changing email to one owned by a different user throws HTTP 409', async () => {
    query.mockResolvedValueOnce({
      rows: [emailRow({ user_id: 'u-OTHER', email: 'taken@test.com' })],
    });

    await expect(
      authService.updateProfile('u-1', { email: 'taken@test.com' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'This email is already in use by another account.',
    });

    expect(query).toHaveBeenCalledTimes(1);
  });

  // TC-UC4.2-005
  test("TC-UC4.2-005 — changing email to the user's own current email is allowed", async () => {
    query
      .mockResolvedValueOnce({ rows: [emailRow({ user_id: 'u-1' })] })
      .mockResolvedValueOnce({ rows: [updatedRow({ email: 'same@test.com' })] });

    const user = await authService.updateProfile('u-1', { email: 'same@test.com' });

    expect(user).toMatchObject({ id: 'u-1', email: 'same@test.com' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toMatch(/UPDATE\s+users/i);
  });

  // TC-UC4.2-006
  test('TC-UC4.2-006 — no UPDATE is issued when the payload has no updatable fields', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'u-1',
          name: 'Alice',
          email: 'alice@test.com',
          is_admin: false,
          preferred_language: 'en',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    });

    const user = await authService.updateProfile('u-1', {});

    expect(user).toMatchObject({ id: 'u-1', name: 'Alice', email: 'alice@test.com' });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/SELECT/i);
    // Use a specific anti-match: the `updated_at` COLUMN in the SELECT list
    // would otherwise match /UPDATE/i. We want to assert there is no
    // `UPDATE users` STATEMENT.
    expect(query.mock.calls[0][0]).not.toMatch(/UPDATE\s+users/i);
  });

  // TC-UC4.2-007 — localization-specific
  test('TC-UC4.2-007 — returned preferred_language is normalized when stored value is "tr-TR"', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // no conflict
      .mockResolvedValueOnce({
        rows: [updatedRow({ preferred_language: 'tr-TR', email: 'new@test.com' })],
      });

    const user = await authService.updateProfile('u-1', { email: 'new@test.com' });

    expect(user.preferred_language).toBe('tr');
  });
});
