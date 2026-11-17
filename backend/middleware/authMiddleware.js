/**
 * backend/middleware/authMiddleware.js
 *
 * One simple authentication check for the Express API.
 *
 * A session is just an httpOnly cookie holding { id, username }. No token
 * library and no server-side session store: `authMiddleware` only needs to know
 * whether the cookie is present and valid, and controllers that need the real
 * user read that row from MySQL by id.
 */

const SESSION_COOKIE = 'erp_session';

/** Build the cookie value for a signed-in user. */
function createSessionValue(user) {
  return encodeURIComponent(JSON.stringify({ id: user.id, username: user.username }));
}

/** Read a cookie value back. Returns null when it is missing or malformed. */
function readSessionValue(value) {
  if (!value) return null;

  try {
    const session = JSON.parse(decodeURIComponent(value));
    if (!session || !Number.isInteger(session.id) || typeof session.username !== 'string') {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Blocks any request that has no valid session cookie.
 * Usage: router.get('/auth/me', authMiddleware, userController.getCurrentUser)
 */
function authMiddleware(req, res, next) {
  const session = readSessionValue(req.cookies?.[SESSION_COOKIE]);

  if (!session) {
    return res.status(401).json({ error: 'You are not signed in.' });
  }

  req.session = session;
  return next();
}

module.exports = {
  SESSION_COOKIE,
  createSessionValue,
  readSessionValue,
  authMiddleware,
};
