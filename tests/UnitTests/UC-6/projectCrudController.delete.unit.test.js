/**
 * UC-6 Delete Project — controller-layer unit tests
 *
 * Covers TC-UC6-003, TC-UC6-004, TC-UC6-005.
 * SUT: platform/backend/src/controllers/projectCrudController.js (deleteProject)
 *
 * Error-mapping contract:
 *   - success            → 204 + empty body (res.send())
 *   - 'Project not found'→ 404 + { error: 'Project not found' }
 *   - anything else      → 500 + { error: 'Internal server error' }
 *                          (original error message must NOT leak)
 */

jest.mock('../../../platform/backend/src/services/projectService', () => ({
  getUserProjects: jest.fn(),
  createProject: jest.fn(),
  getProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
}));
jest.mock(
  '../../../platform/backend/src/services/moduleQuestionnaireService',
  () => ({
    getQuestionnaireState: jest.fn(),
    saveQuestionnaireAnswers: jest.fn(),
  }),
);
jest.mock(
  '../../../platform/backend/src/services/prefilledSdfService',
  () => ({ buildPrefilledFromQuestionnaireState: jest.fn() }),
);
jest.mock('../../../platform/backend/src/models/SDF', () => ({
  create: jest.fn(),
}));

const projectService = require(
  '../../../platform/backend/src/services/projectService',
);
const controller = require(
  '../../../platform/backend/src/controllers/projectCrudController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe('UC-6 / projectCrudController.deleteProject', () => {
  // TC-UC6-003
  test('returns HTTP 204 with an empty body on success', async () => {
    projectService.deleteProject.mockResolvedValueOnce(true);

    const req = { params: { id: 'p-1' }, user: { userId: 'u-1' } };
    const res = mockRes();

    await controller.deleteProject(req, res);

    expect(projectService.deleteProject).toHaveBeenCalledWith('p-1', 'u-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
    const sendArg = res.send.mock.calls[0][0];
    expect(sendArg === undefined || sendArg === null || sendArg === '').toBe(true);
    // A 204 must not also send a JSON body.
    expect(res.json).not.toHaveBeenCalled();
  });

  // TC-UC6-004
  test("returns HTTP 404 when the project cannot be found (or is not owned by caller)", async () => {
    projectService.deleteProject.mockRejectedValueOnce(new Error('Project not found'));

    const req = { params: { id: 'p-missing' }, user: { userId: 'u-1' } };
    const res = mockRes();

    await controller.deleteProject(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
  });

  // TC-UC6-005
  test('unknown errors are reported as HTTP 500 without leaking the underlying message', async () => {
    projectService.deleteProject.mockRejectedValueOnce(new Error('Something blew up'));

    const req = { params: { id: 'p-1' }, user: { userId: 'u-1' } };
    const res = mockRes();

    await controller.deleteProject(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    // The original error message must NEVER appear in the response body.
    const body = JSON.stringify(res.json.mock.calls[0][0] || {});
    expect(body).not.toMatch(/Something blew up/);
  });
});
