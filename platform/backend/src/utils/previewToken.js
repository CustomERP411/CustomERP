const crypto = require('crypto');
const { JWT_SECRET } = require('./jwt');

// Short-lived HMAC token scoped to a (userId, previewId) pair. Used to gate
// access to the /preview/:id/* iframe + proxied asset requests without
// requiring the child ERP to understand our JWT auth.
//
// Format: base64url(userId).base64url(previewId).hexExpMs.hexSignature
//
// Signature = HMAC-SHA256(JWT_SECRET, `${userId}|${previewId}|${exp}`)

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes — matches preview TTL
const COOKIE_NAME_PREFIX = 'preview_token_';

function b64url(input) {
  return Buffer.from(String(input)).toString('base64url');
}

function fromB64url(input) {
  return Buffer.from(String(input), 'base64url').toString('utf8');
}

function hmac(userId, previewId, exp) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${userId}|${previewId}|${exp}`)
    .digest('hex');
}

function signIframeToken({ userId, previewId, ttlMs = DEFAULT_TTL_MS }) {
  const exp = Date.now() + ttlMs;
  const sig = hmac(userId, previewId, exp);
  return [b64url(userId), b64url(previewId), exp.toString(16), sig].join('.');
}

function verifyIframeToken(token, { previewId } = {}) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [uidPart, pidPart, expHex, sig] = parts;

  let userId;
  let tokenPreviewId;
  try {
    userId = fromB64url(uidPart);
    tokenPreviewId = fromB64url(pidPart);
  } catch (_) {
    return null;
  }

  const exp = parseInt(expHex, 16);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;

  if (previewId && tokenPreviewId !== previewId) return null;

  const expected = hmac(userId, tokenPreviewId, exp);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return { userId, previewId: tokenPreviewId, exp };
}

function cookieNameFor(previewId) {
  return `${COOKIE_NAME_PREFIX}${previewId}`;
}

module.exports = {
  signIframeToken,
  verifyIframeToken,
  cookieNameFor,
  DEFAULT_TTL_MS,
};
