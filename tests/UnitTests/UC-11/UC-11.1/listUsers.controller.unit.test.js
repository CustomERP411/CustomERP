/**
 * UC-11.1 View All Users — controller-layer unit test
 *
 * Covers TC-UC11.1-004.
 * SUT: platform/backend/src/controllers/adminController.js (listUsers)
 */

jest.mock('../../../../platform/backend/src/services/adminService', () => ({
  listUsers: jest.fn(),
  listAllProjects: jest.fn(),
  setAdminStatus: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
}));

const adminService = require(
  '../../../../platform/backend/src/services/adminService',
);
const controller = require(
  '../../../../platform/backend/src/controllers/adminController',
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

describe('UC-11.1 / adminController.listUsers', () => {
  // TC-UC11.1-004
  test('TC-UC11.1-004 — wraps the service result as { users }', async () => {
    adminService.listUsers.mockResolvedValueOnce([
      { id: 'u-1', name: 'Alice', is_admin: false },
    ]);

    const req = {};
    const res = mockRes();

    await controller.listUsers(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      users: [{ id: 'u-1', name: 'Alice', is_admin: false }],
    });
  });
});
