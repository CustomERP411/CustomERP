/**
 * UC-7.5 Edit SDF — controller-layer unit tests
 *
 * Covers TC-UC7.5-003 through TC-UC7.5-008.
 * SUT: platform/backend/src/controllers/projectSdfController.js
 *      (saveSdf, aiEditSdf)
 *
 * Focus:
 *   - saveSdf validates incoming SDF against validateGeneratorSdf
 *     (project_name required, entities non-empty array).
 *   - saveSdf chooses project status based on whether the SDF still
 *     carries clarifications_needed.
 *   - aiEditSdf requires non-empty instructions.
 *   - aiEditSdf requires a current SDF (from DB or request body).
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/aiGatewayClient', () => ({
  editSdf: jest.fn(),
  analyzeDescription: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/models/SDF', () => ({
  create: jest.fn(),
  findLatestByProject: jest.fn(),
}));

const projectService = require(
  '../../../../platform/backend/src/services/projectService',
);
const aiGatewayClient = require(
  '../../../../platform/backend/src/services/aiGatewayClient',
);
const SDF = require('../../../../platform/backend/src/models/SDF');
const controller = require(
  '../../../../platform/backend/src/controllers/projectSdfController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  projectService.getProject.mockResolvedValue({
    id: 'p-1',
    name: 'Acme',
    description: 'desc',
    language: 'en',
  });
  projectService.updateProject.mockImplementation((_p, _u, updates) =>
    Promise.resolve({ id: 'p-1', ...updates }),
  );
});

describe('UC-7.5 / projectSdfController.saveSdf', () => {
  // TC-UC7.5-003
  test('returns 400 when project_name is missing', async () => {
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { sdf: { entities: [{ slug: 'x', fields: [] }] } },
    };
    const res = mockRes();

    await controller.saveSdf(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'SDF.project_name is required' });
    expect(SDF.create).not.toHaveBeenCalled();
  });

  // TC-UC7.5-004
  test('returns 400 when entities is empty or not an array', async () => {
    // Empty array.
    let req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { sdf: { project_name: 'X', entities: [] } },
    };
    let res = mockRes();
    await controller.saveSdf(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/non-empty array/);

    // Non-array.
    req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { sdf: { project_name: 'X', entities: 'nope' } },
    };
    res = mockRes();
    await controller.saveSdf(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(SDF.create).not.toHaveBeenCalled();
  });

  // TC-UC7.5-005
  test("persists the SDF and transitions status to 'Ready' when there are no clarifications", async () => {
    SDF.create.mockResolvedValueOnce({ version: 2 });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: {
        sdf: {
          project_name: 'Acme',
          entities: [{ slug: 'products', fields: [{ name: 'n' }] }],
        },
      },
    };
    const res = mockRes();

    await controller.saveSdf(req, res);

    expect(SDF.create).toHaveBeenCalledTimes(1);
    // Last updateProject call sets the final status.
    const statuses = projectService.updateProject.mock.calls.map((c) => c[2]?.status);
    expect(statuses[statuses.length - 1]).toBe('Ready');
    expect(res.json.mock.calls[0][0]).toMatchObject({ sdf_version: 2 });
  });

  // TC-UC7.5-006
  test("transitions status to 'Clarifying' when the SDF still has clarifications_needed", async () => {
    SDF.create.mockResolvedValueOnce({ version: 3 });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: {
        sdf: {
          project_name: 'Acme',
          entities: [{ slug: 'products', fields: [{ name: 'n' }] }],
          clarifications_needed: [{ id: 'q1' }],
        },
      },
    };
    const res = mockRes();

    await controller.saveSdf(req, res);

    const statuses = projectService.updateProject.mock.calls.map((c) => c[2]?.status);
    expect(statuses[statuses.length - 1]).toBe('Clarifying');
  });
});

describe('UC-7.5 / projectSdfController.aiEditSdf', () => {
  // TC-UC7.5-007
  test('returns 400 when instructions are empty / whitespace', async () => {
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { instructions: '   ' },
    };
    const res = mockRes();

    await controller.aiEditSdf(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'instructions is required' });
    expect(aiGatewayClient.editSdf).not.toHaveBeenCalled();
  });

  // TC-UC7.5-008
  test('returns 400 when no current SDF can be resolved (DB empty + body omits current_sdf)', async () => {
    SDF.findLatestByProject.mockResolvedValueOnce(null);

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { instructions: 'Add a phone field to customers.' },
    };
    const res = mockRes();

    await controller.aiEditSdf(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No current SDF found for this project',
    });
    expect(aiGatewayClient.editSdf).not.toHaveBeenCalled();
  });
});
