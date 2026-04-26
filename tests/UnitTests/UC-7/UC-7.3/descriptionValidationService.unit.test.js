/**
 * UC-7.3 Describe Business (AI validation) — service-layer unit tests
 *
 * Covers TC-UC7.3-004, TC-UC7.3-005.
 * SUT: platform/backend/src/services/descriptionValidationService.js
 *
 * The service is a thin wrapper over the AI gateway. It takes the
 * user's free-text Business Description, asks the AI whether the text
 * is usable (clear, on-topic, describes a business), and returns a
 * normalised verdict:
 *
 *   validate(text, { language }) ->
 *     Promise<{ valid: true,  reason: null }>
 *     Promise<{ valid: false, reason: string }>
 *
 * The AI gateway is mocked so these tests exercise the real service
 * normalization logic without making network calls.
 */

jest.mock(
  '../../../../platform/backend/src/services/aiGatewayClient',
  () => ({
    validateDescription: jest.fn(),
    analyzeDescription: jest.fn(),
  }),
);

const aiGatewayClient = require(
  '../../../../platform/backend/src/services/aiGatewayClient',
);
const descriptionValidationService = require(
  '../../../../platform/backend/src/services/descriptionValidationService',
);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UC-7.3 / descriptionValidationService.validate', () => {
  // TC-UC7.3-004
  test('TC-UC7.3-004 — returns { valid: true, reason: null } when the AI approves the description', async () => {
    aiGatewayClient.validateDescription.mockResolvedValueOnce({
      valid: true,
      reason: null,
    });

    const result = await descriptionValidationService.validate(
      'A warehouse company with 3 depots that distributes auto parts.',
      { language: 'en' },
    );

    expect(result).toEqual({ valid: true, reason: null });
    expect(aiGatewayClient.validateDescription).toHaveBeenCalledTimes(1);
    const [text, opts] = aiGatewayClient.validateDescription.mock.calls[0];
    expect(text).toMatch(/warehouse company/i);
    expect(opts.language).toBe('en');
  });

  // TC-UC7.3-005
  test('TC-UC7.3-005 — returns { valid: false, reason } when the AI rejects the description', async () => {
    aiGatewayClient.validateDescription.mockResolvedValueOnce({
      valid: false,
      reason: 'Please describe what your business does.',
    });

    const result = await descriptionValidationService.validate('idk just an app');

    expect(result.valid).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.reason).toMatch(/describe|details/i);
  });

  // Defensive extra: empty / whitespace-only input short-circuits
  // without burning an AI call.
  test('empty / whitespace input short-circuits and does not call the AI', async () => {
    for (const text of ['', '   ', null, undefined]) {
      const result = await descriptionValidationService.validate(text);
      expect(result.valid).toBe(false);
      expect(typeof result.reason).toBe('string');
    }
    expect(aiGatewayClient.validateDescription).not.toHaveBeenCalled();
  });
});
