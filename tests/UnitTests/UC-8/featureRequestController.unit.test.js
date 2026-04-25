/**
 * UC-8 / UC-8.1 — featureRequestController unit tests
 *
 * Covers TC-UC8-004, TC-UC8.1-002, TC-UC8.1-003, TC-UC8.1-004.
 * SUT: platform/backend/src/controllers/featureRequestController.js
 *
 * The controller only orchestrates auth + service calls and wraps the
 * JSON response; all DB interaction is hidden behind the mocked
 * service.
 */

jest.mock(
  '../../../platform/backend/src/services/featureRequestService',
  () => ({
    listByUser: jest.fn(),
    getById: jest.fn(),
    getMessages: jest.fn(),
    addMessage: jest.fn(),
    listAll: jest.fn(),
    getStats: jest.fn(),
    updateStatus: jest.fn(),
  }),
);

const featureRequestService = require(
  '../../../platform/backend/src/services/featureRequestService',
);
const controller = require(
  '../../../platform/backend/src/controllers/featureRequestController',
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

describe('UC-8 / featureRequestController.listMine', () => {
  // TC-UC8-004
  test('returns { requests } from listByUser for the authenticated user', async () => {
    featureRequestService.listByUser.mockResolvedValueOnce([{ id: 'f1' }]);

    const req = { user: { userId: 'u-1' } };
    const res = mockRes();

    await controller.listMine(req, res);

    expect(featureRequestService.listByUser).toHaveBeenCalledWith('u-1');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ requests: [{ id: 'f1' }] });
  });
});

describe('UC-8.1 / featureRequestController.getMyDetail', () => {
  // TC-UC8.1-002
  test('returns HTTP 403 when the feature request is owned by a different user', async () => {
    featureRequestService.getById.mockResolvedValueOnce({
      id: 'fr-1',
      user_id: 'u-1',
      feature_name: 'X',
    });

    const req = { user: { userId: 'u-2' }, params: { id: 'fr-1' } };
    const res = mockRes();

    await controller.getMyDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
    expect(featureRequestService.getMessages).not.toHaveBeenCalled();
  });

  // TC-UC8.1-003
  test('returns the feature request merged with its messages when the caller is the owner', async () => {
    const fr = { id: 'fr-1', user_id: 'u-1', feature_name: 'X', status: 'recorded' };
    featureRequestService.getById.mockResolvedValueOnce(fr);
    featureRequestService.getMessages.mockResolvedValueOnce([
      { id: 'm1', body: 'hello' },
      { id: 'm2', body: 'world' },
    ]);

    const req = { user: { userId: 'u-1' }, params: { id: 'fr-1' } };
    const res = mockRes();

    await controller.getMyDetail(req, res);

    expect(featureRequestService.getMessages).toHaveBeenCalledWith('fr-1');
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      ...fr,
      messages: [
        { id: 'm1', body: 'hello' },
        { id: 'm2', body: 'world' },
      ],
    });
  });

  // TC-UC8.1-004
  test('propagates a service 404 as an HTTP 404 response', async () => {
    featureRequestService.getById.mockRejectedValueOnce(
      Object.assign(new Error('Feature request not found'), { statusCode: 404 }),
    );

    const req = { user: { userId: 'u-1' }, params: { id: 'missing' } };
    const res = mockRes();

    await controller.getMyDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Feature request not found' });
    expect(featureRequestService.getMessages).not.toHaveBeenCalled();
  });
});
