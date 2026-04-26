/**
 * descriptionValidationService
 *
 * Lightweight AI-backed check that runs BEFORE the heavy
 * aiGatewayClient.analyzeDescription() call. It asks the AI whether
 * the user's Business Description is actually usable (clear enough,
 * on-topic, describes a business), and returns a normalised verdict:
 *
 *   validate(text, { language }) ->
 *     Promise<{ valid: true,  reason: null }>
 *     Promise<{ valid: false, reason: string }>
 *
 * Contract chosen to match UC-7.3 test cases TC-UC7.3-004 and
 * TC-UC7.3-005, and to be consumed by projectAiController.analyzeProject.
 *
 * Degradation policy: if the underlying AI gateway call fails for any
 * reason (endpoint not implemented yet, 5xx, network, etc.) we
 * FAIL OPEN — i.e. return { valid: true, reason: null } — so a broken
 * validator can never fully block ERP generation. Rejections must be
 * explicit decisions from the AI, not side effects of infrastructure.
 */

const logger = require('../utils/logger');
const aiGatewayClient = require('./aiGatewayClient');

const FALLBACK_REJECTION_MESSAGE =
  'Please add more details about your business.';

async function validate(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    return { valid: false, reason: 'description is required' };
  }

  const language =
    options && typeof options.language === 'string' ? options.language : 'en';

  if (typeof aiGatewayClient.validateDescription !== 'function') {
    // Endpoint not wired up yet — fail open.
    return { valid: true, reason: null };
  }

  let verdict;
  try {
    verdict = await aiGatewayClient.validateDescription(text.trim(), {
      language,
    });
  } catch (err) {
    logger.warn &&
      logger.warn(
        'descriptionValidationService: AI gateway call failed, failing open:',
        err && err.message ? err.message : err,
      );
    return { valid: true, reason: null };
  }

  if (verdict && verdict.valid === true) {
    return { valid: true, reason: null };
  }

  return {
    valid: false,
    reason:
      (verdict && typeof verdict.reason === 'string' && verdict.reason.trim()) ||
      FALLBACK_REJECTION_MESSAGE,
  };
}

module.exports = { validate };
