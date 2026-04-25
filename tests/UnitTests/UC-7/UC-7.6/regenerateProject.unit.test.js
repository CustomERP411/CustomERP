/**
 * UC-7.6 Preview / Change Request — controller-layer unit tests
 *
 * Covers TC-UC7.6-003, TC-UC7.6-004.
 * SUT: platform/backend/src/controllers/projectAiController.js (regenerateProject)
 *
 * regenerateProject is the "Request Changes" back-end endpoint invoked
 * from the Preview page. It must refuse to burn AI tokens when:
 *   - the change instructions are missing / too short, or
 *   - there is no existing SDF to transform.
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock(
  '../../../../platform/backend/src/services/moduleQuestionnaireService',
  () => ({
    getQuestionnaireState: jest.fn(),
  }),
);
jest.mock(
  '../../../../platform/backend/src/services/prefilledSdfService',
  () => ({ buildPrefilledFromQuestionnaireState: jest.fn() }),
);
jest.mock('../../../../platform/backend/src/services/aiGatewayClient', () => ({
  analyzeDescription: jest.fn(),
  clarifySdf: jest.fn(),
  chat: jest.fn(),
  editSdf: jest.fn(),
  getGenerationProgress: jest.fn(),
}));
jest.mock(
  '../../../../platform/backend/src/services/clarificationService',
  () => ({
    persistQuestions: jest.fn(),
    persistAnswers: jest.fn(),
    getCycleCount: jest.fn(),
  }),
);
jest.mock(
  '../../../../platform/backend/src/services/featureRequestService',
  () => ({ recordFeatures: jest.fn(), recordWarnings: jest.fn() }),
);
jest.mock('../../../../platform/backend/src/models/SDF', () => ({
  create: jest.fn(),
  findLatestByProject: jest.fn(),
}));
jest.mock(
  '../../../../platform/backend/src/models/ProjectConversation',
  () => ({
    create: jest.fn(),
    updateSdfVersion: jest.fn(),
    findByProject: jest.fn(),
  }),
);

const projectService = require(
  '../../../../platform/backend/src/services/projectService',
);
const aiGatewayClient = require(
  '../../../../platform/backend/src/services/aiGatewayClient',
);
const SDF = require('../../../../platform/backend/src/models/SDF');
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
    description: 'desc',
    language: 'en',
  });
});

describe('UC-7.6 / projectAiController.regenerateProject', () => {
  // TC-UC7.6-003
  test('TC-UC7.6-003 — returns 400 when change_instructions are missing or shorter than 3 chars', async () => {
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { change_instructions: 'ab' },
    };
    const res = mockRes();

    await controller.regenerateProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const err = res.json.mock.calls[0][0].error;
    expect(err).toMatch(/change_instructions/);
    expect(err).toMatch(/3/);
    expect(aiGatewayClient.analyzeDescription).not.toHaveBeenCalled();
  });

  // TC-UC7.6-004
  test('TC-UC7.6-004 — returns 400 when no existing SDF is found for the project', async () => {
    SDF.findLatestByProject.mockResolvedValueOnce({ sdf_json: null });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { change_instructions: 'Add a phone field to customers.' },
    };
    const res = mockRes();

    await controller.regenerateProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No existing SDF found for this project. Generate one first.',
    });
    expect(aiGatewayClient.analyzeDescription).not.toHaveBeenCalled();
  });
});
