/**
 * backend/routes/route.js
 *
 * Every API route of the project, defined in this single file.
 * Mounted at /api by server.js, so the paths below are relative to /api.
 */

const express = require('express');

const userController = require('../controllers/userControllers/userController');
const adminController = require('../controllers/userControllers/adminController');
const { adminMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ---- Authentication (login returns the user; the browser keeps it in localStorage) ----
router.post('/auth/register', userController.uploadProfilePicture, userController.registerUser);
router.post('/auth/login', userController.loginUser);

// ---- Admin only (designation = Admin), guarded by the x-user-id header ----
router.get('/users', adminMiddleware, adminController.listUsers);
router.patch('/users/:id', adminMiddleware, adminController.updateUser);
router.delete('/users/:id', adminMiddleware, adminController.deleteUser);

module.exports = router;
