/**
 * UC-13.1 Chat With Assistant — controller unit tests
 *
 * Covers TC-UC13.1-002 through TC-UC13.1-009.
 * SUT: platform/backend/src/controllers/projectAiController.js (chatWithProject)
 *
 * chatWithProject:
 *   - validates `message` is a non-empty string (400 otherwise);
 *   - loads the project for ownership (404 if the service reports
 *     "Project not found");
 *   - forwards `project.language` to aiGatewayClient.chat so the
 *     assistant replies in the right language (Turkish support);
 *   - replies with the AI response body verbatim;
 *   - if the AI returns unsupported_features, fires a FIRE-AND-FORGET
 *     recordFeatures call with source='chatbot' and must not fail the
 *     HTTP response even if the recording rejects.
 */

jest.mock('../../../../platform/backend/src/services/projectService', () => ({
  getProject: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/aiGatewayClient', () => ({
  chat: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/services/featureRequestService', () => ({
  recordFeatures: jest.fn(),
}));
// Unused by chatWithProject but required by the controller module.
jest.mock('../../../../platform/backend/src/services/clarificationService', () => ({}));
jest.mock('../../../../platform/backend/src/services/moduleQuestionnaireService', () => ({}));
jest.mock('../../../../platform/backend/src/services/prefilledSdfService', () => ({}));
jest.mock('../../../../platform/backend/src/models/SDF', () => ({}));
jest.mock('../../../../platform/backend/src/models/ProjectConversation', () => ({}));

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

function mkReqRes({ message, language = 'en' } = {}) {
  const req = {
    user: { userId: 'u-1' },
    params: { id: 'p-1' },
    body: message === undefined ? {} : { message },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  projectService.getProject.mockResolvedValue({
    id: 'p-1',
    user_id: 'u-1',
    description: 'biz',
    language,
  });
  return { req, res };
}

beforeEach(() => {
  projectService.getProject.mockReset();
  aiGatewayClient.chat.mockReset();
  featureRequestService.recordFeatures.mockReset();
});

describe('UC-13.1 / chatWithProject — validation', () => {
  // TC-UC13.1-002
  test('empty message returns 400 without calling the AI', async () => {
    const { req, res } = mkReqRes({ message: '' });

    await controller.chatWithProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(aiGatewayClient.chat).not.toHaveBeenCalled();
  });

  // TC-UC13.1-003
  test('whitespace-only message returns 400', async () => {
    const { req, res } = mkReqRes({ message: '   ' });

    await controller.chatWithProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(aiGatewayClient.chat).not.toHaveBeenCalled();
  });

  // TC-UC13.1-004
  test('missing `message` key returns 400', async () => {
    const req = { user: { userId: 'u-1' }, params: { id: 'p-1' }, body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    await controller.chatWithProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(aiGatewayClient.chat).not.toHaveBeenCalled();
  });
});

describe('UC-13.1 / chatWithProject — happy path', () => {
  // TC-UC13.1-005
  test("forwards project.language ('tr') to the AI gateway", async () => {
    const { req, res } = mkReqRes({ message: 'Merhaba', language: 'tr' });
    aiGatewayClient.chat.mockResolvedValue({ reply: 'Selam', confidence: 0.9 });

    await controller.chatWithProject(req, res);

    expect(aiGatewayClient.chat).toHaveBeenCalledTimes(1);
    const arg = aiGatewayClient.chat.mock.calls[0][0];
    expect(arg.language).toBe('tr');
    expect(arg.message).toBe('Merhaba');
    expect(arg.businessDescription).toBe('biz');
  });

  // TC-UC13.1-006
  test('returns the AI response body verbatim as JSON', async () => {
    const { req, res } = mkReqRes({ message: 'hi' });
    const aiBody = { reply: 'ok', confidence: 0.9, unsupported_features: [] };
    aiGatewayClient.chat.mockResolvedValue(aiBody);

    await controller.chatWithProject(req, res);

    expect(res.json).toHaveBeenCalledWith(aiBody);
  });
});

describe('UC-13.1 / chatWithProject — errors', () => {
  // TC-UC13.1-007
  test("projectService throwing 'Project not found' yields 404", async () => {
    const req = { user: { userId: 'u-1' }, params: { id: 'p-1' }, body: { message: 'hi' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    projectService.getProject.mockRejectedValue(new Error('Project not found'));

    await controller.chatWithProject(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(aiGatewayClient.chat).not.toHaveBeenCalled();
  });
});

describe('UC-13.1 / chatWithProject — UC-14 include', () => {
  // TC-UC13.1-008
  test("unsupported_features trigger recordFeatures with source='chatbot'", async () => {
    const { req, res } = mkReqRes({ message: '   Barcode scanner   ' });
    aiGatewayClient.chat.mockResolvedValue({
      reply: 'noted',
      unsupported_features: ['Barcode scanner'],
    });
    featureRequestService.recordFeatures.mockResolvedValue([]);

    await controller.chatWithProject(req, res);

    expect(featureRequestService.recordFeatures).toHaveBeenCalledTimes(1);
    const arg = featureRequestService.recordFeatures.mock.calls[0][0];
    expect(arg.source).toBe('chatbot');
    expect(arg.features).toEqual(['Barcode scanner']);
    // The controller trims the prompt before persisting it.
    expect(arg.userPrompt).toBe('Barcode scanner');
    expect(arg.userId).toBe('u-1');
    expect(arg.projectId).toBe('p-1');
  });

  // TC-UC13.1-009
  test('recordFeatures rejection does NOT break the 200 response', async () => {
    const { req, res } = mkReqRes({ message: 'hi' });
    aiGatewayClient.chat.mockResolvedValue({
      reply: 'ok',
      unsupported_features: ['Something'],
    });
    // The controller uses `.catch(...)`, so the rejection must be
    // swallowed and not propagate to the response handler.
    featureRequestService.recordFeatures.mockRejectedValue(new Error('db down'));

    await controller.chatWithProject(req, res);

    // Wait one microtask cycle so the fire-and-forget .catch() runs
    // before the test ends (prevents Jest "unhandled rejection" noise).
    await Promise.resolve();

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'ok' }),
    );
  });
});
