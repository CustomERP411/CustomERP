/**
 * UC-11.2 Toggle Admin Status — controller-layer unit tests
 *
 * Covers TC-UC11.2-002, TC-UC11.2-003, TC-UC11.2-004.
 * SUT: platform/backend/src/controllers/adminController.js (setAdminStatus)
 *
 * Controller guards:
 *   1. is_admin must be a boolean.
 *   2. An admin cannot change their own admin status.
 *   3. Service 404 is forwarded to the HTTP response with the same status.
 */

jest.mock('../../../../platform/backend/src/services/adminService', () => ({
  setAdminStatus: jest.fn(),
  listUsers: jest.fn(),
  listAllProjects: jest.fn(),
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

describe('UC-11.2 / adminController.setAdminStatus', () => {
  // TC-UC11.2-002
  test("TC-UC11.2-002 — returns 400 when `is_admin` is missing or non-boolean", async () => {
    // Missing.
    let req = {
      user: { userId: 'admin-1' },
      params: { userId: 'u-1' },
      body: {},
    };
    let res = mockRes();
    await controller.setAdminStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'is_admin (boolean) is required',
    });

    // Non-boolean ('yes').
    req = {
      user: { userId: 'admin-1' },
      params: { userId: 'u-1' },
      body: { is_admin: 'yes' },
    };
    res = mockRes();
    await controller.setAdminStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);

    expect(adminService.setAdminStatus).not.toHaveBeenCalled();
  });

  // TC-UC11.2-003
  test('TC-UC11.2-003 — admins cannot toggle their own admin status', async () => {
    const req = {
      user: { userId: 'admin-1' },
      params: { userId: 'admin-1' },
      body: { is_admin: false },
    };
    const res = mockRes();

    await controller.setAdminStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'You cannot change your own admin status',
    });
    expect(adminService.setAdminStatus).not.toHaveBeenCalled();
  });

  // TC-UC11.2-004
  test('TC-UC11.2-004 — service 404 is forwarded as HTTP 404', async () => {
    adminService.setAdminStatus.mockRejectedValueOnce(
      Object.assign(new Error('User not found'), { statusCode: 404 }),
    );

    const req = {
      user: { userId: 'admin-1' },
      params: { userId: 'u-ghost' },
      body: { is_admin: true },
    };
    const res = mockRes();

    await controller.setAdminStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
  });
});
