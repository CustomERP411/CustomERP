/**
 * UC-3 Logout — authenticateToken middleware unit tests
 *
 * Covers TC-UC3-005.
 * SUT: platform/backend/src/middleware/auth.js
 *
 * Logout is a protected route (`router.post('/logout', authenticateToken, ...)`),
 * so the middleware guards it. We assert that a request without a
 * Bearer token is rejected with HTTP 401 and the canonical error
 * message, without the handler ever being invoked.
 */

jest.mock('../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

jest.mock('../../../platform/backend/src/utils/jwt', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
  decodeToken: jest.fn(),
}));

const { verifyToken } = require('../../../platform/backend/src/utils/jwt');
const { authenticateToken } = require(
  '../../../platform/backend/src/middleware/auth',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('UC-3 / middleware.authenticateToken (logout guard)', () => {
  // TC-UC3-005
  test('TC-UC3-005 — returns 401 when the Authorization header is absent', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
  });
});
