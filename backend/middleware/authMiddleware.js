// backend/middleware/authMiddleware.js

/**
 * backend/middleware/authMiddleware.js
 *
 * The only authentication check the API needs.
 *
 * There are no tokens, cookies or server-side sessions: after logging in the
 * browser stores the user details in localStorage and sends the signed-in
 * user's id in the `x-user-id` header. This middleware loads that row from MySQL
 * so the check is always against real data, and admin rules are decided by the
 * database instead of anything the browser claims about permissions.
 */

const { eq } = require('drizzle-orm');

const { db } = require('../config/db');
const { users } = require('../models/model');
const { HttpError, isAdmin } = require('../controllers/userControllers/userController');

/** The id the browser sent for the signed-in user, or null when missing/invalid. */
function readUserId(req) {
  const id = Number(req.get('x-user-id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function authMiddleware(req, res, next) {
  try {
    const id = readUserId(req);
    if (!id) throw new HttpError(401, 'You are not signed in.');

    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new HttpError(401, 'You are not signed in.');

    req.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Signed in AND designation is Admin. */
function adminMiddleware(req, res, next) {
  return authMiddleware(req, res, (error) => {
    if (error) return next(error);
    if (!isAdmin(req.currentUser)) {
      return next(new HttpError(403, 'Only admins can manage users.'));
    }
    return next();
  });
}

module.exports = { readUserId, authMiddleware, adminMiddleware };
