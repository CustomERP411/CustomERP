/**
 * UC-7.4 Use Chatbot — controller-layer unit tests
 *
 * Covers TC-UC7.4-002 through TC-UC7.4-007.
 * SUT: platform/backend/src/controllers/projectAiController.js
 *      (chatWithProject)
 *
 * These tests are only about the in-app chatbot:
 *   - validate the user message,
 *   - send project context to the AI gateway,
 *   - preserve project language,
 *   - record unsupported chatbot feature requests,
 *   - surface project / AI errors clearly.
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/aiGatewayClient', () => ({
  analyzeDescription: jest.fn(),
  validateDescription: jest.fn(),
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
  '../../../../platform/backend/src/services/moduleQuestionnaireService',
  () => ({
    getQuestionnaireState: jest.fn(),
  }),
);
jest.mock(
  '../../../../platform/backend/src/services/prefilledSdfService',
  () => ({
    buildPrefilledFromQuestionnaireState: jest.fn(),
  }),
);
jest.mock(
  '../../../../platform/backend/src/services/featureRequestService',
  () => ({
    recordFeatures: jest.fn(),
    recordWarnings: jest.fn(),
  }),
);
jest.mock(
  '../../../../platform/backend/src/services/descriptionValidationService',
  () => ({
    validate: jest.fn(),
  }),
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
const featureRequestService = require(
  '../../../../platform/backend/src/services/featureRequestService',
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

function mockReq(body = {}) {
  return {
    user: { userId: 'u-1' },
    params: { id: 'p-1' },
    body,
  };
}

function setHappyDefaults({ language = 'en' } = {}) {
  projectService.getProject.mockResolvedValue({
    id: 'p-1',
    name: 'Acme ERP',
    description: 'A store that sells spare parts and tracks inventory.',
    language,
  });

  aiGatewayClient.chat.mockResolvedValue({
    reply: 'You can start by choosing the Inventory module.',
    unsupported_features: [],
  });

  featureRequestService.recordFeatures.mockResolvedValue(undefined);
}

describe('UC-7.4 / projectAiController.chatWithProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-UC7.4-002
  test('TC-UC7.4-002 — returns 400 when message is missing or empty', async () => {
    const res = mockRes();

    await controller.chatWithProject(mockReq({ message: '   ' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'message is required' });
    expect(projectService.getProject).not.toHaveBeenCalled();
    expect(aiGatewayClient.chat).not.toHaveBeenCalled();
  });

  // TC-UC7.4-003
  test('TC-UC7.4-003 — sends trimmed message and full project context to the chatbot AI', async () => {
    setHappyDefaults({ language: 'tr' });

    const body = {
      message: '  Which module should I choose?  ',
      conversation_history: [{ role: 'user', content: 'Hi' }],
      selected_modules: ['inventory', 'invoice'],
      business_answers: { business_type: 'retail' },
      current_step: 'module-selection',
      sdf_status: 'draft',
    };
    const res = mockRes();

    await controller.chatWithProject(mockReq(body), res);

    expect(aiGatewayClient.chat).toHaveBeenCalledTimes(1);
    expect(aiGatewayClient.chat).toHaveBeenCalledWith({
      businessDescription: 'A store that sells spare parts and tracks inventory.',
      message: 'Which module should I choose?',
      conversationHistory: [{ role: 'user', content: 'Hi' }],
      selectedModules: ['inventory', 'invoice'],
      businessAnswers: { business_type: 'retail' },
      currentStep: 'module-selection',
      sdfStatus: 'draft',
      language: 'tr',
    });
    expect(res.json).toHaveBeenCalledWith({
      reply: 'You can start by choosing the Inventory module.',
      unsupported_features: [],
    });
  });

  // TC-UC7.4-004
  test('TC-UC7.4-004 — uses safe defaults when optional chat context is missing or invalid', async () => {
    setHappyDefaults();

    const res = mockRes();
    await controller.chatWithProject(
      mockReq({
        message: 'What should I do next?',
        conversation_history: 'not-an-array',
        selected_modules: 'inventory',
      }),
      res,
    );

    expect(aiGatewayClient.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationHistory: [],
        selectedModules: [],
        businessAnswers: null,
        currentStep: null,
        sdfStatus: null,
      }),
    );
  });

  // TC-UC7.4-005
  test('TC-UC7.4-005 — records unsupported chatbot feature requests without failing the reply', async () => {
    setHappyDefaults();
    const unsupported = [{ label: 'Face recognition login', description: 'Not supported' }];
    aiGatewayClient.chat.mockResolvedValueOnce({
      reply: 'That feature is not supported yet.',
      unsupported_features: unsupported,
    });
    featureRequestService.recordFeatures.mockRejectedValueOnce(new Error('offline'));

    const res = mockRes();
    await controller.chatWithProject(
      mockReq({ message: 'Can I use face recognition login?' }),
      res,
    );

    // Plan K §K4 — controllers now thread project.language through so
    // chatbot-recorded features get persisted bilingually.
    expect(featureRequestService.recordFeatures).toHaveBeenCalledWith({
      userId: 'u-1',
      projectId: 'p-1',
      source: 'chatbot',
      features: unsupported,
      userPrompt: 'Can I use face recognition login?',
      language: 'en',
    });
    expect(res.json).toHaveBeenCalledWith({
      reply: 'That feature is not supported yet.',
      unsupported_features: unsupported,
    });
  });

  // TC-UC7.4-006
  test('TC-UC7.4-006 — returns 404 when the project cannot be found', async () => {
    projectService.getProject.mockRejectedValueOnce(new Error('Project not found'));

    const res = mockRes();
    await controller.chatWithProject(mockReq({ message: 'Help me choose modules.' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    expect(aiGatewayClient.chat).not.toHaveBeenCalled();
  });

  // TC-UC7.4-007
  test('TC-UC7.4-007 — AI gateway status errors are returned with the same HTTP status', async () => {
    setHappyDefaults();
    const busy = Object.assign(new Error('busy'), { statusCode: 503 });
    aiGatewayClient.chat.mockRejectedValueOnce(busy);

    const res = mockRes();
    await controller.chatWithProject(mockReq({ message: 'What should I do?' }), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'busy' });
  });
});
