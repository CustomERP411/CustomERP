/**
 * UC-7.5 Plan D follow-up #8 — precheckController unit tests
 *
 * SUT: platform/backend/src/controllers/projectAiController.js
 *      (precheckModules)
 *
 * Focus:
 *   - 400 when description is missing/blank.
 *   - 404 when project doesn't exist (ownership check).
 *   - aiGatewayClient.precheckModules called with correct
 *     description + selectedModules + project language.
 *   - Successful pass-through of `{ inferred_modules: [...] }` shape.
 *   - Fails-open with empty list when the gateway client throws.
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/aiGatewayClient', () => ({
  precheckModules: jest.fn(),
  analyzeDescription: jest.fn(),
  editSdf: jest.fn(),
  chat: jest.fn(),
  validateDescription: jest.fn(),
  getGenerationProgress: jest.fn(),
  clarifySdf: jest.fn(),
  finalizeSdf: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/clarificationService', () => ({
  getStep: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/moduleQuestionnaireService', () => ({
  getQuestionnaireState: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/prefilledSdfService', () => ({
  buildPrefilledFromQuestionnaireState: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/featureRequestService', () => ({
  recordFeatures: jest.fn(),
  recordWarnings: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/descriptionValidationService', () => ({
  validate: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/models/SDF', () => ({
  create: jest.fn(),
  findLatestByProject: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/models/ProjectConversation', () => ({
  create: jest.fn(),
  findByProject: jest.fn(),
  updateSdfVersion: jest.fn(),
}));

const projectService = require(
  '../../../../platform/backend/src/services/projectService',
);
const aiGatewayClient = require(
  '../../../../platform/backend/src/services/aiGatewayClient',
);
const controller = require(
  '../../../../platform/backend/src/controllers/projectAiController',
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
    language: 'en',
    status: 'Draft',
  });
});

describe('UC-7.5 Plan D #8 / projectAiController.precheckModules', () => {
  test('TC-D3.6-A — returns 400 when description is missing', async () => {
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { selected_modules: ['hr'] },
    };
    const res = mockRes();

    await controller.precheckModules(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'description is required' });
    expect(aiGatewayClient.precheckModules).not.toHaveBeenCalled();
  });

  test('TC-D3.6-B — returns 400 when description is blank whitespace', async () => {
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: '   ', selected_modules: [] },
    };
    const res = mockRes();

    await controller.precheckModules(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(aiGatewayClient.precheckModules).not.toHaveBeenCalled();
  });

  test('TC-D3.6-C — returns 404 when project not found (ownership)', async () => {
    projectService.getProject.mockRejectedValue(new Error('Project not found'));
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-missing' },
      body: { description: 'we sell baked goods', selected_modules: ['inventory'] },
    };
    const res = mockRes();

    await controller.precheckModules(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    expect(aiGatewayClient.precheckModules).not.toHaveBeenCalled();
  });

  test('TC-D3.6-D — calls aiGatewayClient.precheckModules with description, selected modules, language', async () => {
    aiGatewayClient.precheckModules.mockResolvedValue({
      inferred_modules: [
        { module: 'hr', reason: 'mentions payroll', confidence: 'high' },
      ],
    });
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: {
        description: '  We manage payroll for 12 staff and sell pastries.  ',
        selected_modules: ['inventory'],
      },
    };
    const res = mockRes();

    await controller.precheckModules(req, res);

    expect(aiGatewayClient.precheckModules).toHaveBeenCalledTimes(1);
    const [desc, opts] = aiGatewayClient.precheckModules.mock.calls[0];
    // Description trimmed before forwarding.
    expect(desc).toBe('We manage payroll for 12 staff and sell pastries.');
    expect(opts).toMatchObject({
      selectedModules: ['inventory'],
      language: 'en',
    });
    expect(res.json).toHaveBeenCalledWith({
      inferred_modules: [
        { module: 'hr', reason: 'mentions payroll', confidence: 'high' },
      ],
    });
  });

  test('TC-D3.6-E — passes project language through to gateway client', async () => {
    projectService.getProject.mockResolvedValue({
      id: 'p-1',
      name: 'Acme',
      language: 'tr',
      status: 'Draft',
    });
    aiGatewayClient.precheckModules.mockResolvedValue({ inferred_modules: [] });
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'Pasta yapıyoruz', selected_modules: [] },
    };
    const res = mockRes();

    await controller.precheckModules(req, res);

    const [, opts] = aiGatewayClient.precheckModules.mock.calls[0];
    expect(opts.language).toBe('tr');
  });

  test('TC-D3.6-F — fails open with empty list when gateway throws', async () => {
    aiGatewayClient.precheckModules.mockRejectedValue(new Error('boom'));
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'we have lots of stock', selected_modules: ['inventory'] },
    };
    const res = mockRes();

    await controller.precheckModules(req, res);

    // No status() call (==200) and json with empty list. Advisory endpoint
    // must never block the wizard on transient gateway issues.
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ inferred_modules: [] });
  });
});
