/**
 * UC-5 Create Project — controller-layer unit tests
 *
 * Covers TC-UC5-004, TC-UC5-005, TC-UC5-006.
 * SUT: platform/backend/src/controllers/projectCrudController.js (createProject)
 *
 * The controller is a thin HTTP layer; the meaningful behaviour is how
 * it translates service errors to status codes:
 *   - Service success                → 201
 *   - 'Project name is required'     → 400
 *   - Postgres FK violation (23503 /
 *     projects_owner_user_id_fkey)   → 401 (stale session user)
 *
 * We mock the whole service module so no DB / AI modules are pulled
 * in at require-time.
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
  () => ({
    buildPrefilledFromQuestionnaireState: jest.fn(),
  }),
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

describe('UC-5 / projectCrudController.createProject', () => {
  // TC-UC5-004
  test('returns 201 and the created project on success', async () => {
    const created = {
      id: 'p-1',
      name: 'My ERP',
      status: 'Draft',
      mode: 'chat',
      language: 'en',
      description: null,
      created_at: new Date('2026-04-01T00:00:00Z'),
      updated_at: new Date('2026-04-01T00:00:00Z'),
    };
    projectService.createProject.mockResolvedValueOnce(created);

    const req = { user: { userId: 'u-1' }, body: { name: 'My ERP' } };
    const res = mockRes();

    await controller.createProject(req, res);

    expect(projectService.createProject).toHaveBeenCalledWith('u-1', { name: 'My ERP' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  // TC-UC5-005
  test("returns 400 when the service throws 'Project name is required'", async () => {
    projectService.createProject.mockRejectedValueOnce(new Error('Project name is required'));

    const req = { user: { userId: 'u-1' }, body: {} };
    const res = mockRes();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Project name is required' });
  });

  // TC-UC5-006
  test('returns 401 when Postgres rejects the FK for the session user', async () => {
    const fkErr = Object.assign(new Error('insert or update on table "projects"...'), {
      code: '23503',
      constraint: 'projects_owner_user_id_fkey',
    });
    projectService.createProject.mockRejectedValueOnce(fkErr);

    const req = { user: { userId: 'u-stale' }, body: { name: 'Ghost ERP' } };
    const res = mockRes();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid session user. Please log out and log in again.',
    });
  });
});
