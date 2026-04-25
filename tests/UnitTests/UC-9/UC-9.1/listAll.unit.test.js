/**
 * UC-9.1 — Admin: View All Feature Requests (list + filters + pagination)
 *
 * Covers TC-UC9.1-003 through TC-UC9.1-006.
 *
 * SUTs:
 *   - platform/backend/src/services/featureRequestService.js (listAll)
 *   - platform/backend/src/controllers/featureRequestController.js (listAll)
 *
 * listAll issues two SQL statements: a COUNT(*) scoped by the WHERE
 * clause, followed by a paginated SELECT using the same clause plus
 * LIMIT / OFFSET. We mock the shared db helper to observe both calls.
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));
jest.mock(
  '../../../../platform/backend/src/services/featureRequestService',
  () => {
    const actual = jest.requireActual(
      '../../../../platform/backend/src/services/featureRequestService',
    );
    return { ...actual, listAll: jest.fn() };
  },
);

const db = require('../../../../platform/backend/src/config/database');
const featureRequestService = require(
  '../../../../platform/backend/src/services/featureRequestService',
);
const controller = require(
  '../../../../platform/backend/src/controllers/featureRequestController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('UC-9.1 / featureRequestService.listAll (real)', () => {
  const realSvc = jest.requireActual(
    '../../../../platform/backend/src/services/featureRequestService',
  );

  /**
   * The SUT pushes `limit` and `offset` into the same `params` array
   * it handed to the first (COUNT) query, so capturing by reference
   * would leak later mutations back into the earlier assertion. We
   * snapshot (shallow-clone) each call's params at invocation time.
   */
  function installSnapshottingMock(responses) {
    const calls = [];
    db.query.mockImplementation(async (sql, params) => {
      calls.push({ sql, params: Array.isArray(params) ? [...params] : params });
      return responses.shift();
    });
    return calls;
  }

  beforeEach(() => {
    db.query.mockReset();
  });

  // TC-UC9.1-003
  test('builds WHERE clauses when both status and source are supplied', async () => {
    const calls = installSnapshottingMock([
      { rows: [{ total: '3' }] }, // COUNT
      { rows: [{ id: 'fr-1' }, { id: 'fr-2' }, { id: 'fr-3' }] },
    ]);

    await realSvc.listAll({ status: 'recorded', source: 'chatbot' });

    expect(calls).toHaveLength(2);

    expect(calls[0].sql).toMatch(/SELECT COUNT\(\*\)/i);
    expect(calls[0].sql).toMatch(/WHERE\s+fr\.status\s*=\s*\$1\s+AND\s+fr\.source\s*=\s*\$2/i);
    expect(calls[0].params).toEqual(['recorded', 'chatbot']);

    expect(calls[1].sql).toMatch(/ORDER BY\s+fr\.created_at\s+DESC/i);
    expect(calls[1].sql).toMatch(/LIMIT\s+\$3\s+OFFSET\s+\$4/i);
    expect(calls[1].params).toEqual(['recorded', 'chatbot', 50, 0]);
  });

  // TC-UC9.1-004
  test('omits the WHERE clause when no filters are provided', async () => {
    const calls = installSnapshottingMock([
      { rows: [{ total: '0' }] },
      { rows: [] },
    ]);

    await realSvc.listAll({});

    expect(calls[0].sql).not.toMatch(/WHERE/i);
    expect(calls[0].params).toEqual([]);

    expect(calls[1].sql).not.toMatch(/WHERE/i);
    expect(calls[1].params).toEqual([50, 0]);
  });

  // TC-UC9.1-005
  test('returns a numeric total and raw request rows', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total: '42' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'a' }, { id: 'b' }] });

    const out = await realSvc.listAll({});

    expect(out).toEqual({
      total: 42, // parsed to number
      requests: [{ id: 'a' }, { id: 'b' }],
    });
    expect(typeof out.total).toBe('number');
  });
});

describe('UC-9.1 / featureRequestController.listAll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-UC9.1-006
  test('parses limit and offset query params as integers before calling the service', async () => {
    featureRequestService.listAll.mockResolvedValueOnce({
      total: 0,
      requests: [],
    });

    const req = { query: { limit: '10', offset: '20' } };
    const res = mockRes();

    await controller.listAll(req, res);

    expect(featureRequestService.listAll).toHaveBeenCalledWith({
      status: undefined,
      source: undefined,
      limit: 10,
      offset: 20,
    });
    expect(res.json).toHaveBeenCalledWith({ total: 0, requests: [] });
  });
});
