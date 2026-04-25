/**
 * UC-9.3 — Admin: Respond to Users via Messages
 *
 * Covers TC-UC9.3-002 through TC-UC9.3-006.
 *
 * SUTs:
 *   - platform/backend/src/controllers/featureRequestController.js (addMessage)
 *   - platform/backend/src/services/featureRequestService.js (addMessage)
 *
 * addMessage is shared between admin and the original requesting
 * user, so the same endpoint handles:
 *   - admin reply (is_admin=true, any request)
 *   - owner reply (fr.user_id === caller)
 *   - non-owner non-admin → 403
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
    return {
      ...actual,
      getById: jest.fn(),
      addMessage: jest.fn(),
    };
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UC-9.3 / featureRequestController.addMessage — authorization', () => {
  // TC-UC9.3-002
  test('returns 400 when body is empty / whitespace', async () => {
    const req = {
      user: { userId: 'u-1', is_admin: false },
      params: { id: 'fr-1' },
      body: { body: '   ' },
    };
    const res = mockRes();

    await controller.addMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'body is required' });
    expect(featureRequestService.addMessage).not.toHaveBeenCalled();
    expect(featureRequestService.getById).not.toHaveBeenCalled();
  });

  // TC-UC9.3-003
  test('admin callers can reply to any user\'s request (senderRole = admin)', async () => {
    featureRequestService.getById.mockResolvedValueOnce({
      id: 'fr-1',
      user_id: 'u-other',
    });
    featureRequestService.addMessage.mockResolvedValueOnce({
      id: 'm-1',
      body: 'Thanks for the report',
    });

    const req = {
      user: { userId: 'admin-1', is_admin: true },
      params: { id: 'fr-1' },
      body: { body: 'Thanks for the report' },
    };
    const res = mockRes();

    await controller.addMessage(req, res);

    expect(featureRequestService.addMessage).toHaveBeenCalledWith({
      featureRequestId: 'fr-1',
      senderId: 'admin-1',
      senderRole: 'admin',
      body: 'Thanks for the report',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'm-1', body: 'Thanks for the report' });
  });

  // TC-UC9.3-004
  test('non-admin callers get 403 when replying to someone else\'s request', async () => {
    featureRequestService.getById.mockResolvedValueOnce({
      id: 'fr-1',
      user_id: 'u-owner',
    });

    const req = {
      user: { userId: 'u-other', is_admin: false },
      params: { id: 'fr-1' },
      body: { body: 'Hello' },
    };
    const res = mockRes();

    await controller.addMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
    expect(featureRequestService.addMessage).not.toHaveBeenCalled();
  });

  // TC-UC9.3-005
  test('message body is trimmed before persistence', async () => {
    featureRequestService.getById.mockResolvedValueOnce({
      id: 'fr-1',
      user_id: 'u-1',
    });
    featureRequestService.addMessage.mockResolvedValueOnce({ id: 'm-2' });

    const req = {
      user: { userId: 'u-1', is_admin: false },
      params: { id: 'fr-1' },
      body: { body: '   hello   ' },
    };
    const res = mockRes();

    await controller.addMessage(req, res);

    expect(featureRequestService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'hello' }),
    );
  });
});

describe('UC-9.3 / featureRequestService.addMessage — persistence', () => {
  const realSvc = jest.requireActual(
    '../../../../platform/backend/src/services/featureRequestService',
  );

  beforeEach(() => {
    db.query.mockReset();
  });

  // TC-UC9.3-006
  test('INSERTs into feature_request_messages and returns the new row', async () => {
    const row = {
      id: 'm-100',
      feature_request_id: 'fr-1',
      sender_id: 'u-1',
      sender_role: 'user',
      body: 'hi',
    };
    db.query.mockResolvedValueOnce({ rows: [row] });

    const out = await realSvc.addMessage({
      featureRequestId: 'fr-1',
      senderId: 'u-1',
      senderRole: 'user',
      body: 'hi',
    });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT\s+INTO\s+feature_request_messages/i);
    expect(sql).toMatch(/RETURNING\s+\*/i);
    expect(params).toEqual(['fr-1', 'u-1', 'user', 'hi']);
    expect(out).toEqual(row);
  });
});
