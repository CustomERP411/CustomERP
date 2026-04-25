/**
 * UC-8 / UC-8.1 — featureRequestService unit tests
 *
 * Covers TC-UC8-003, TC-UC8.1-005, TC-UC8.1-006.
 * SUT: platform/backend/src/services/featureRequestService.js
 *
 * All queries go through the shared `database` helper, which we mock
 * to observe the exact SQL text and parameter list.
 */

jest.mock('../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../../platform/backend/src/config/database');
const svc = require(
  '../../../platform/backend/src/services/featureRequestService',
);

beforeEach(() => {
  db.query.mockReset();
});

describe('UC-8 / featureRequestService.listByUser', () => {
  // TC-UC8-003
  test('scopes by user_id and orders created_at DESC', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'f1' }, { id: 'f2' }],
    });

    const rows = await svc.listByUser('u-1');

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/WHERE\s+fr\.user_id\s*=\s*\$1/);
    expect(sql).toMatch(/ORDER BY\s+fr\.created_at\s+DESC/);
    expect(params).toEqual(['u-1']);
    expect(rows).toEqual([{ id: 'f1' }, { id: 'f2' }]);
  });
});

describe('UC-8.1 / featureRequestService.getById', () => {
  // TC-UC8.1-005
  test('rejects with a 404-carrying Error when the row cannot be found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(svc.getById('missing')).rejects.toMatchObject({
      message: 'Feature request not found',
      statusCode: 404,
    });
  });

  test('returns the row unchanged when found', async () => {
    const row = { id: 'f1', user_id: 'u-1', feature_name: 'Biometric login' };
    db.query.mockResolvedValueOnce({ rows: [row] });

    await expect(svc.getById('f1')).resolves.toEqual(row);
  });
});

describe('UC-8.1 / featureRequestService.getMessages', () => {
  // TC-UC8.1-006
  test('queries messages with ORDER BY created_at ASC', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'm1', body: 'first', created_at: '2026-01-01' },
        { id: 'm2', body: 'second', created_at: '2026-01-02' },
      ],
    });

    const rows = await svc.getMessages('fr-1');

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/feature_request_messages/);
    expect(sql).toMatch(/ORDER BY\s+m\.created_at\s+ASC/);
    expect(params).toEqual(['fr-1']);
    expect(rows).toHaveLength(2);
  });
});
