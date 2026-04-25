/**
 * UC-10 View All Projects — controller-layer unit tests
 *
 * Covers TC-UC10-006.
 * SUT: platform/backend/src/controllers/adminController.js (listAllProjects)
 *
 * The admin route-level auth (`is_admin` guard) is enforced by the
 * route middleware, not this controller; this test focuses on the
 * happy-path response shape and the error-to-HTTP mapping.
 */

jest.mock('../../../platform/backend/src/services/adminService', () => ({
  listAllProjects: jest.fn(),
}));

const adminService = require(
  '../../../platform/backend/src/services/adminService',
);
const controller = require(
  '../../../platform/backend/src/controllers/adminController',
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

describe('UC-10 / adminController.listAllProjects', () => {
  // TC-UC10-006 (happy path)
  test('TC-UC10-006 — wraps the service result as { projects }', async () => {
    adminService.listAllProjects.mockResolvedValueOnce([
      { id: 'p-1', name: 'A', owner: { id: 'u-1' } },
    ]);

    const req = {};
    const res = mockRes();

    await controller.listAllProjects(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      projects: [{ id: 'p-1', name: 'A', owner: { id: 'u-1' } }],
    });
  });

  // TC-UC10-006 (error path)
  test('TC-UC10-006 — forwards unknown service errors as HTTP 500', async () => {
    adminService.listAllProjects.mockRejectedValueOnce(new Error('db down'));

    const req = {};
    const res = mockRes();

    await controller.listAllProjects(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'db down' });
  });
});
