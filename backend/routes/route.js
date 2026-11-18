/**
 * backend/routes/route.js
 *
 * Every API route of the project, defined in this single file.
 * Mounted at /api by server.js, so the paths below are relative to /api.
 */

const express = require('express');

const userController = require('../controllers/userControllers/userController');
const adminController = require('../controllers/userControllers/adminController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ---- Authentication ----
router.post('/auth/register', userController.uploadProfilePicture, userController.registerUser);
router.post('/auth/login', userController.loginUser);
router.post('/auth/logout', userController.logoutUser);

// ---- Protected ----
router.get('/auth/me', authMiddleware, userController.getCurrentUser);

// ---- Admin only (designation = Admin) ----
router.get('/users', authMiddleware, adminController.requireAdmin, adminController.listUsers);
router.patch('/users/:id', authMiddleware, adminController.requireAdmin, adminController.updateUser);
router.delete('/users/:id', authMiddleware, adminController.requireAdmin, adminController.deleteUser);

module.exports = router;