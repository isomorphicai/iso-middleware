const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Auth endpoints
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/auth/login', (req, res, next) => authController.login(req, res, next));

// Session Verification & Lifecycle (2-hour inactivity auto-expiry)
router.get('/verify-session', (req, res, next) => authController.verifySession(req, res, next));
router.post('/verify-session', (req, res, next) => authController.verifySession(req, res, next));
router.get('/auth/verify-session', (req, res, next) => authController.verifySession(req, res, next));
router.post('/auth/verify-session', (req, res, next) => authController.verifySession(req, res, next));
router.get('/auth/session', (req, res, next) => authController.verifySession(req, res, next));

// Heartbeat & Activity
router.post('/heartbeat', (req, res, next) => authController.heartbeat(req, res, next));
router.post('/auth/heartbeat', (req, res, next) => authController.heartbeat(req, res, next));
router.post('/auth/activity', (req, res, next) => authController.heartbeat(req, res, next));

// Logout (Terminate Session)
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.post('/auth/logout', (req, res, next) => authController.logout(req, res, next));

// Session Audit / Management
router.get('/auth/sessions', (req, res, next) => authController.getSessions(req, res, next));

// Tenant-scoped User CRUD
router.get('/users', (req, res, next) => authController.getUsers(req, res, next));
router.post('/users', (req, res, next) => authController.createUser(req, res, next));
router.put('/users/:id', (req, res, next) => authController.updateUser(req, res, next));
router.delete('/users/:id', (req, res, next) => authController.deleteUser(req, res, next));

// Tenant-scoped Role Management
router.get('/roles', (req, res, next) => authController.getRoles(req, res, next));
router.post('/roles', (req, res, next) => authController.createOrUpdateRole(req, res, next));
router.delete('/roles/:id', (req, res, next) => authController.deleteRole(req, res, next));

module.exports = router;
