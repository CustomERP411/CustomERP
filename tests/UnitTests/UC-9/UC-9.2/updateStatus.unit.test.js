/**
 * UC-9.2 — Admin: Update Feature Request Status
 *
 * Covers TC-UC9.2-002 through TC-UC9.2-005.
 *
 * SUTs:
 *   - platform/backend/src/controllers/featureRequestController.js
 *       (updateStatus — validates the status enum)
 *   - platform/backend/src/services/featureRequestService.js
 *       (updateStatus — persists the change and throws 404 when missing)
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
    return { ...actual, updateStatus: jest.fn() };
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

describe('UC-9.2 / featureRequestController.updateStatus — validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-UC9.2-002
  test('TC-UC9.2-002 — returns 400 for an unknown status value', async () => {
    const req = { params: { id: 'fr-1' }, body: { status: 'rejected' } };
    const res = mockRes();

    await controller.updateStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(
      /recorded.*denied.*in_progress.*completed/,
    );
    expect(featureRequestService.updateStatus).not.toHaveBeenCalled();
  });

  // TC-UC9.2-003
  test('TC-UC9.2-003 — returns 400 when status is missing entirely', async () => {
    const req = { params: { id: 'fr-1' }, body: {} };
    const res = mockRes();

    await controller.updateStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(featureRequestService.updateStatus).not.toHaveBeenCalled();
  });

  test('accepts each of the four allowed statuses and calls the service', async () => {
    featureRequestService.updateStatus.mockResolvedValue({ id: 'fr-1' });
    for (const status of ['recorded', 'denied', 'in_progress', 'completed']) {
      const req = { params: { id: 'fr-1' }, body: { status } };
      const res = mockRes();
      await controller.updateStatus(req, res);
      expect(res.status).not.toHaveBeenCalled(); // success path, no status() call
    }
    expect(featureRequestService.updateStatus).toHaveBeenCalledTimes(4);
  });
});

describe('UC-9.2 / featureRequestService.updateStatus — persistence', () => {
  const realSvc = jest.requireActual(
    '../../../../platform/backend/src/services/featureRequestService',
  );

  beforeEach(() => {
    db.query.mockReset();
  });

  // TC-UC9.2-004
  test('TC-UC9.2-004 — issues an UPDATE that sets status, admin_notes, and updated_at=NOW()', async () => {
    const row = { id: 'fr-1', status: 'in_progress', admin_notes: 'reviewing' };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const out = await realSvc.updateStatus('fr-1', {
      status: 'in_progress',
      adminNotes: 'reviewing',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE\s+feature_requests/i);
    expect(sql).toMatch(/updated_at\s*=\s*NOW\(\)/i);
    expect(params).toEqual(['fr-1', 'in_progress', 'reviewing']);
    expect(out).toEqual(row);
  });

  // TC-UC9.2-005
  test('TC-UC9.2-005 — throws 404 error when the id does not match any row', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      realSvc.updateStatus('missing', { status: 'denied', adminNotes: null }),
    ).rejects.toMatchObject({
      message: 'Feature request not found',
      statusCode: 404,
    });
  });
});
