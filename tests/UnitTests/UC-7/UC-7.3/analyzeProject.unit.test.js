/**
 * UC-7.3 Enter Business Description (AI-validated) — controller-layer unit tests
 *
 * Covers TC-UC7.3-006 through TC-UC7.3-010.
 * SUT: platform/backend/src/controllers/projectAiController.js (analyzeProject)
 *
 * --- What changed in this rewrite ---
 *
 * The Business Description flow now goes through a SEPARATE AI service
 * (`descriptionValidationService`) that approves or rejects the user's
 * free-text description before the heavy generation gateway is called.
 *
 *   analyzeProject now performs, in order:
 *     1) Reject empty / missing descriptions with HTTP 400.
 *     2) Ask descriptionValidationService.validate(text, { language })
 *        whether the description is usable.
 *           - If { valid: false, reason } → respond HTTP 400 with the
 *             AI-supplied reason ("description rejected") and STOP.
 *             aiGatewayClient.analyzeDescription must NOT be called.
 *           - If { valid: true }          → proceed with the rest of
 *             the original pipeline (questionnaire → gateway → save).
 *     3) Pass project.language to BOTH the validator and the gateway.
 *
 * `descriptionValidationService` is mocked at the module boundary so these
 * tests can focus on controller behavior without calling the AI gateway.
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock(
  '../../../../platform/backend/src/services/descriptionValidationService',
  () => ({
    validate: jest.fn(),
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
const descriptionValidationService = require(
  '../../../../platform/backend/src/services/descriptionValidationService',
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

function setHappyDefaults({ language = 'en' } = {}) {
  projectService.getProject.mockResolvedValue({
    id: 'p-1',
    name: 'Acme',
    description: null,
    language,
  });
  projectService.updateProject.mockImplementation((_pid, _uid, updates) =>
    Promise.resolve({ id: 'p-1', name: 'Acme', language, ...updates }),
  );

  // NEW: AI description validator approves by default.
  descriptionValidationService.validate.mockResolvedValue({
    valid: true,
    reason: null,
  });

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
    clarifications_needed: [],
    unsupported_features: [],
    warnings: [],
    sdf_complete: true,
  });

  clarificationService.persistQuestions.mockResolvedValue([]);

  SDF.create.mockResolvedValue({ version: 1 });
  ProjectConversation.create.mockResolvedValue({ id: 'c-1' });
  ProjectConversation.updateSdfVersion.mockResolvedValue(undefined);

  featureRequestService.recordFeatures.mockResolvedValue(undefined);
  featureRequestService.recordWarnings.mockResolvedValue(undefined);
}

describe('UC-7.3 / projectAiController.analyzeProject (AI-validated description)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-UC7.3-006
  test('TC-UC7.3-006 — returns 400 when description is missing or empty', async () => {
    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: '' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'description is required' });
    // Neither the description validator nor the main generator is called.
    expect(descriptionValidationService.validate).not.toHaveBeenCalled();
    expect(aiGatewayClient.analyzeDescription).not.toHaveBeenCalled();
  });

  // TC-UC7.3-007
  test('TC-UC7.3-007 — returns 400 with the AI-supplied reason when the validator rejects the description', async () => {
    setHappyDefaults();
    descriptionValidationService.validate.mockResolvedValueOnce({
      valid: false,
      reason: 'Please describe what you sell.',
    });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'my business' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(descriptionValidationService.validate).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);

    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('description rejected');
    expect(body.reason).toBe('Please describe what you sell.');

    // The main generator must NOT be called when the validator rejects.
    expect(aiGatewayClient.analyzeDescription).not.toHaveBeenCalled();
  });

  // TC-UC7.3-008
  test('TC-UC7.3-008 — when the validator approves, the controller continues and calls analyzeDescription', async () => {
    setHappyDefaults();

    // Record call order across the two collaborators.
    const callOrder = [];
    descriptionValidationService.validate.mockImplementationOnce(async () => {
      callOrder.push('validate');
      return { valid: true, reason: null };
    });
    aiGatewayClient.analyzeDescription.mockImplementationOnce(async () => {
      callOrder.push('analyzeDescription');
      return {
        project_name: 'Acme',
        entities: [{ slug: 'products', fields: [] }],
        clarifications_needed: [],
        unsupported_features: [],
        warnings: [],
        sdf_complete: true,
      };
    });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'A small shop that sells spare parts and tracks stock.' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(descriptionValidationService.validate).toHaveBeenCalledTimes(1);
    expect(aiGatewayClient.analyzeDescription).toHaveBeenCalledTimes(1);
    // validator MUST come before the generator.
    expect(callOrder).toEqual(['validate', 'analyzeDescription']);
    // Happy-path response is not a 400 / 500.
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  // TC-UC7.3-009
  test("TC-UC7.3-009 — passes project.language through to BOTH the validator and the AI gateway (Turkish)", async () => {
    setHappyDefaults({ language: 'tr' });

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'Küçük bir işletme için envanter sistemi.' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    // Validator receives the language.
    expect(descriptionValidationService.validate).toHaveBeenCalledTimes(1);
    const validateArgs = descriptionValidationService.validate.mock.calls[0];
    // Signature: validate(text, options)
    const validateOptions = validateArgs[1];
    expect(validateOptions).toBeDefined();
    expect(validateOptions.language).toBe('tr');

    // Generator also receives the language.
    expect(aiGatewayClient.analyzeDescription).toHaveBeenCalledTimes(1);
    const analyzeArgs = aiGatewayClient.analyzeDescription.mock.calls[0];
    // Signature: analyzeDescription(description, priorContext, options)
    const analyzeOptions = analyzeArgs[2];
    expect(analyzeOptions).toBeDefined();
    expect(analyzeOptions.language).toBe('tr');
  });

  // TC-UC7.3-010
  test('TC-UC7.3-010 — AI 503 back-pressure errors bubble through as HTTP 503 (not 500)', async () => {
    setHappyDefaults();
    const busy = Object.assign(new Error('busy'), { statusCode: 503 });
    aiGatewayClient.analyzeDescription.mockRejectedValueOnce(busy);

    const req = {
      user: { userId: 'u-1' },
      params: { id: 'p-1' },
      body: { description: 'A valid, long-enough business description.' },
    };
    const res = mockRes();

    await controller.analyzeProject(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'busy' });
  });
});
