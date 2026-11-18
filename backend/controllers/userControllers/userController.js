/**
 * backend/controllers/userControllers/userController.js
 *
 * User logic: registration (with profile picture upload) and login.
 *
 * No tokens, cookies or sessions. Login simply checks the user name and
 * password and returns the user object; the browser keeps it in localStorage.
 *
 * NOTE: passwords are stored and compared as plain text on purpose. This is a
 * local-development build; add password hashing before any real deployment.
 */

const path = require('path');
const { randomUUID } = require('crypto');
const { mkdir, writeFile } = require('fs/promises');

const multer = require('multer');
const { eq } = require('drizzle-orm');

const { db } = require('../../config/db');
const { users } = require('../../models/model');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_PICTURE_BYTES = 2 * 1024 * 1024; // 2 MB
const PICTURE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,30}$/;
const WORK_FIELDS = {
  factory: 'Factory',
  floor: 'Floor',
  department: 'Department',
  designation: 'Designation',
};

/** An error that should be sent to the client as-is (400, 401, 404, 409...). */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/** The `work` JSON column may come back as an object or as raw JSON text. */
function normalizeWork(value) {
  if (!value) return {};
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/** True when the user's designation is "Admin" (case-insensitive). */
const isAdmin = (row) => (normalizeWork(row.work).designation || '').toLowerCase() === 'admin';

/** Never send the password to the browser. */
function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    work: normalizeWork(row.work),
    profilePicture: row.profilePicture ?? null,
    createdAt: row.createdAt ?? null,
  };
}

/** Reads the multipart form; the image is kept in memory until saved. */
const uploadProfilePicture = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PICTURE_BYTES, files: 1 },
}).single('profilePicture');

/** Store the uploaded image in backend/uploads and return its public path. */
async function saveProfilePicture(file) {
  if (!file || !file.size) return null;

  if (file.size > MAX_PICTURE_BYTES) {
    throw new HttpError(400, 'Profile picture must be 2 MB or smaller.');
  }

  const extension = PICTURE_EXTENSIONS[file.mimetype];
  if (!extension) {
    throw new HttpError(400, 'Profile picture must be a JPG, PNG, WEBP or GIF image.');
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const fileName = `${randomUUID()}${extension}`;
  await writeFile(path.join(UPLOAD_DIR, fileName), file.buffer);

  return `/uploads/${fileName}`;
}

/** Validate the four dropdown values and return them as one object. */
function readWork(body) {
  const work = {};

  for (const [field, label] of Object.entries(WORK_FIELDS)) {
    const value = asText(body[field]);

    if (!value) throw new HttpError(400, `${label} is required.`);
    if (value.length > 80) throw new HttpError(400, `${label} is too long.`);

    work[field] = value;
  }

  return work;
}

/** POST /api/auth/register */
async function registerUser(req, res, next) {
  try {
    const body = req.body || {};
    const username = asText(body.username);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!USERNAME_PATTERN.test(username)) {
      throw new HttpError(
        400,
        'User name must be 3-30 characters and use only letters, numbers, dots, dashes or underscores.'
      );
    }
    if (password.length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters long.');
    }

    const work = readWork(body);

    // The designation picked in the form is stored as-is; "Admin" is allowed here.
    // The API still decides admin rights from the database row, so the browser
    // cannot grant itself admin by editing localStorage.
    if (work.designation.toLowerCase() === 'admin') work.designation = 'Admin';

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      throw new HttpError(409, 'That user name is already taken.');
    }

    const profilePicture = await saveProfilePicture(req.file);

    const [result] = await db.insert(users).values({
      username,
      password,
      profilePicture,
      work,
    });

    const [row] = await db.select().from(users).where(eq(users.id, result.insertId)).limit(1);

    // The browser stores this object in localStorage; no cookie or token.
    res.status(201).json({ user: toPublicUser(row) });
  } catch (error) {
    next(error);
  }
}

/** POST /api/auth/login */
async function loginUser(req, res, next) {
  try {
    const body = req.body || {};
    const username = asText(body.username);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      throw new HttpError(400, 'User name and password are required.');
    }

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || user.password !== password) {
      throw new HttpError(401, 'Incorrect user name or password.');
    }

    // The browser stores this object in localStorage; no cookie or token.
    res.json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  HttpError,
  asText,
  isAdmin,
  readWork,
  toPublicUser,
  USERNAME_PATTERN,
  uploadProfilePicture,
  registerUser,
  loginUser,
};
