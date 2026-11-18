/**
 * backend/controllers/userControllers/adminController.js
 *
 * Admin-only user management: list users and edit/delete a user.
 *
 * Admin = work.designation is "Admin". The check happens in
 * middleware/authMiddleware.js (adminMiddleware), which loads the signed-in user
 * from MySQL and attaches it as req.currentUser.
 */

const path = require('path');
const { unlink } = require('fs/promises');

const { eq } = require('drizzle-orm');

const { db } = require('../../config/db');
const { users } = require('../../models/model');
const {
  HttpError,
  asText,
  readWork,
  toPublicUser,
  USERNAME_PATTERN,
} = require('./userController');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

/** GET /api/users */
async function listUsers(req, res, next) {
  try {
    const rows = await db.select().from(users).orderBy(users.id);
    res.json({ users: rows.map(toPublicUser) });
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/users/:id  — body: username, password (optional), factory, floor, department, designation */
async function updateUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid user id.');

    const body = req.body || {};
    const username = asText(body.username);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpError(
        400,
        'User name must be 3-30 characters and use only letters, numbers, dots, dashes or underscores.'
      );
    }
    // Blank password = keep the current one.
    if (password && password.length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters long.');
    }

    const work = readWork(body);

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new HttpError(404, 'User not found.');

    // Stops the last admin from locking everyone out by demoting themselves.
    if (target.id === req.currentUser.id && work.designation.toLowerCase() !== 'admin') {
      throw new HttpError(400, 'You cannot remove your own Admin designation.');
    }

    if (username !== target.username) {
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (taken.length > 0) throw new HttpError(409, 'That user name is already taken.');
    }

    const changes = { username, work };
    if (password) changes.password = password;

    await db.update(users).set(changes).where(eq(users.id, id));

    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    res.json({ user: toPublicUser(row) });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/users/:id */
async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid user id.');

    if (id === req.currentUser.id) {
      throw new HttpError(400, 'You cannot delete your own account.');
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new HttpError(404, 'User not found.');

    await db.delete(users).where(eq(users.id, id));

    // Remove the uploaded profile picture too (ignore if the file is already gone).
    if (target.profilePicture) {
      await unlink(path.join(UPLOAD_DIR, path.basename(target.profilePicture))).catch(() => {});
    }

    res.json({ ok: true, id });
  } catch (error) {
    next(error);
  }
}

module.exports = { listUsers, updateUser, deleteUser };
