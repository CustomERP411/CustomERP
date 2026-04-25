/**
 * UC-11.3 Block / Unblock User — controller-layer unit tests
 *
 * Covers TC-UC11.3-002, TC-UC11.3-003.
 * SUT: platform/backend/src/controllers/adminController.js (blockUser)
 *
 * Controller guards:
 *   - Admins cannot block themselves.
 *   - Missing / empty reason is normalized to `null` before
 *     delegating to the service.
 */

jest.mock('../../../../platform/backend/src/services/adminService', () => ({
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
  setAdminStatus: jest.fn(),
  listUsers: jest.fn(),
  listAllProjects: jest.fn(),
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

describe('UC-11.3 / adminController.blockUser', () => {
  // TC-UC11.3-002
  test('admins cannot block themselves', async () => {
    const req = {
      user: { userId: 'admin-1' },
      params: { userId: 'admin-1' },
      body: { reason: 'reorg' },
    };
    const res = mockRes();

    await controller.blockUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You cannot block your own account',
    });
    expect(adminService.blockUser).not.toHaveBeenCalled();
  });

  // TC-UC11.3-003
  test('missing or empty reason is passed to the service as null', async () => {
    adminService.blockUser.mockResolvedValue({ id: 'u-1', blocked: true });

    // Missing reason.
    await controller.blockUser(
      { user: { userId: 'admin-1' }, params: { userId: 'u-1' }, body: {} },
      mockRes(),
    );
    expect(adminService.blockUser).toHaveBeenLastCalledWith('u-1', null);

    // Empty-string reason.
    await controller.blockUser(
      { user: { userId: 'admin-1' }, params: { userId: 'u-1' }, body: { reason: '' } },
      mockRes(),
    );
    expect(adminService.blockUser).toHaveBeenLastCalledWith('u-1', null);
  });
});
