/**
 * UC-7.3 Generate SDF — controller-layer unit tests
 *
 * Covers TC-UC7.3-003 through TC-UC7.3-008.
 * SUT: platform/backend/src/controllers/projectAiController.js (analyzeProject)
 *
 * analyzeProject orchestrates the AI SDF generation pipeline:
 *   1) Validate description (≥10 chars).
 *   2) Resolve project (scoped by caller).
 *   3) Resolve the module questionnaire; reject early if incomplete.
 *   4) Call the AI gateway with language + prefilled SDF.
 *   5) Persist the resulting SDF, any clarifications, and unsupported features.
 *   6) Transition project status to 'Clarifying' or 'Ready'.
 *
 * All external collaborators are mocked so the controller's branching
 * logic can be exercised deterministically.
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
  () => ({
    buildPrefilledFromQuestionnaireState: jest.fn(),
  }),
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
  () => ({
    recordFeatures: jest.fn(),
    recordWarnings: jest.fn(),
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
const moduleQuestionnaireService = require(
  '../../../../platform/backend/src/services/moduleQuestionnaireService',
);
const prefilledSdfService = require(
  '../../../../platform/backend/src/services/prefilledSdfService',
);
const aiGatewayClient = require(
  '../../../../platform/backend/src/services/aiGatewayClient',
);
const clarificationService = require(
  '../../../../platform/backend/src/services/clarificationService',
);
const featureRequestService = require(
  '../../../../platform/backend/src/services/featureRequestService',
);
const SDF = require('../../../../platform/backend/src/models/SDF');
const ProjectConversation = require(
  '../../../../platform/backend/src/models/ProjectConversation',
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

function setHappyDefaults({ language = 'en', clarifications = [], unsupported = [] } = {}) {
  projectService.getProject.mockResolvedValue({
    id: 'p-1',
    name: 'Acme',
    description: null,
    language,
  });
  projectService.updateProject.mockImplementation((_pid, _uid, updates) =>
    Promise.resolve({ id: 'p-1', name: 'Acme', language, ...updates }),
  );

  moduleQuestionnaireService.getQuestionnaireState.mockResolvedValue({
    modules: ['inventory'],
    template_versions: { inventory: { version: 'v1' } },
    language,
    questions: [],
    completion: {
      total_required_visible: 0,
      answered_required_visible: 0,
      is_complete: true,
      missing_required_question_ids: [],
      missing_required_question_keys: [],
    },
    mandatory_answers: { inv_multi_location: 'yes' },
  });

  prefilledSdfService.buildPrefilledFromQuestionnaireState.mockReturnValue({
    prefilled_sdf: { project_name: 'Acme', entities: [] },
    validation: { valid: true },
  });

  aiGatewayClient.analyzeDescription.mockResolvedValue({
    project_name: 'Acme',
    entities: [{ slug: 'products', fields: [] }],
    clarifications_needed: clarifications,
    unsupported_features: unsupported,
    warnings: [],
    sdf_complete: !clarifications.length,
  });

  clarificationService.persistQuestions.mockResolvedValue(clarifications);

  SDF.create.mockResolvedValue({ version: 1 });
  ProjectConversation.create.mockResolvedValue({ id: 'c-1' });
  ProjectConversation.updateSdfVersion.mockResolvedValue(undefined);

  featureRequestService.recordFeatures.mockResolvedValue(undefined);
  featureRequestService.recordWarnings.mockResolvedValue(undefined);
}

describe('UC-7.3 / projectAiController.analyzeProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-UC7.3-003
  test("returns 400 when description is missing or shorter than 10 characters", async () => {
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'short' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'description is required' });
    expect(aiGatewayClient.analyzeDescription).not.toHaveBeenCalled();
  });

  // TC-UC7.3-004
  test('returns 400 with missing_required_question_ids when the questionnaire is incomplete', async () => {
    setHappyDefaults();
    moduleQuestionnaireService.getQuestionnaireState.mockResolvedValueOnce({
      modules: ['inventory'],
      template_versions: { inventory: { version: 'v1' } },
      language: 'en',
      questions: [],
      completion: {
        total_required_visible: 2,
        answered_required_visible: 1,
        is_complete: false,
        missing_required_question_ids: ['q-1'],
        missing_required_question_keys: ['inv_multi_location'],
      },
      mandatory_answers: {},
    });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'A business that sells widgets and tracks inventory.' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/incomplete/i);
    expect(body.missing_required_question_ids).toEqual(['q-1']);
    expect(body.missing_required_question_keys).toEqual(['inv_multi_location']);
    expect(aiGatewayClient.analyzeDescription).not.toHaveBeenCalled();
  });

  // TC-UC7.3-005
  test("passes project.language through to the AI gateway (Turkish)", async () => {
    setHappyDefaults({ language: 'tr' });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'Küçük bir işletme için envanter sistemi.' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(aiGatewayClient.analyzeDescription).toHaveBeenCalledTimes(1);
    const callArgs = aiGatewayClient.analyzeDescription.mock.calls[0];
    // Signature: (description, _unused, options)
    const options = callArgs[2];
    expect(options).toBeDefined();
    expect(options.language).toBe('tr');
  });

  // TC-UC7.3-006
  test("sets status 'Clarifying' when AI returns clarifications_needed, else 'Ready'", async () => {
    // Run 1 — AI returns one clarification question.
    setHappyDefaults({
      clarifications: [{ id: 'q-cl-1', question: 'Which currency?' }],
    });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'A business description long enough.' },
    };
    let res = mockRes();
    await controller.analyzeProject(req, res);

    // The last updateProject call decides final status.
    const run1Status = projectService.updateProject.mock.calls
      .map((c) => c[2]?.status)
      .filter(Boolean);
    expect(run1Status[run1Status.length - 1]).toBe('Clarifying');

    // Run 2 — no clarifications.
    jest.clearAllMocks();
    setHappyDefaults({ clarifications: [] });

    res = mockRes();
    await controller.analyzeProject(req, res);

    const run2Status = projectService.updateProject.mock.calls
      .map((c) => c[2]?.status)
      .filter(Boolean);
    expect(run2Status[run2Status.length - 1]).toBe('Ready');
  });

  // TC-UC7.3-007
  test('forwards unsupported_features to featureRequestService (fire-and-forget)', async () => {
    setHappyDefaults({
      unsupported: [{ label: 'Biometric punch clock', description: 'X' }],
    });
    // Make the feature recorder reject to prove we don't fail the request.
    featureRequestService.recordFeatures.mockRejectedValueOnce(new Error('offline'));

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'A business description long enough.' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(featureRequestService.recordFeatures).toHaveBeenCalledTimes(1);
    expect(featureRequestService.recordFeatures.mock.calls[0][0]).toMatchObject({
      source: 'sdf_generation',
      features: [{ label: 'Biometric punch clock', description: 'X' }],
    });
    // The main response still succeeds.
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  // TC-UC7.3-008
  test('AI 503 back-pressure errors bubble through as HTTP 503 (not 500)', async () => {
    setHappyDefaults();
    const busy = Object.assign(new Error('busy'), { statusCode: 503 });
    aiGatewayClient.analyzeDescription.mockRejectedValueOnce(busy);

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'A business description long enough.' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'busy' });
  });
});
