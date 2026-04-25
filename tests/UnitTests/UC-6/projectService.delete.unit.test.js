/**
 * UC-6 Delete Project — service-layer unit tests
 *
 * Covers TC-UC6-006, TC-UC6-007.
 * SUT: platform/backend/src/services/projectService.js (deleteProject)
 *
 * The service is a thin wrapper around the Project model. The only
 * real logic is translating a falsy return value into a
 * user-visible `Error('Project not found')`.
 */

jest.mock('../../../platform/backend/src/models/Project', () => ({
  create: jest.fn(),
  findByUser: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

const Project = require('../../../platform/backend/src/models/Project');
const projectService = require(
  '../../../platform/backend/src/services/projectService',
);

describe('UC-6 / projectService.deleteProject', () => {
  // TC-UC6-006
  test('delegates to Project.delete with (id, userId) and resolves true on success', async () => {
    Project.delete.mockResolvedValueOnce(true);

    const ok = await projectService.deleteProject('p-1', 'u-1');

    expect(Project.delete).toHaveBeenCalledWith('p-1', 'u-1');
    expect(ok).toBe(true);
  });

  // TC-UC6-007
  test("throws Error('Project not found') when the model returns false", async () => {
    Project.delete.mockResolvedValueOnce(false);

    await expect(
      projectService.deleteProject('p-missing', 'u-1'),
    ).rejects.toThrow('Project not found');
  });
});
