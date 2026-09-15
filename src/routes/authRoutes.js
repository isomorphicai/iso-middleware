const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Auth endpoints
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/auth/login', (req, res, next) => authController.login(req, res, next));

// Password Reset Flow (Free, Tenant-Scoped)
router.post('/auth/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/forgot-password', (req, res, next) => authController.forgotPassword(req, res, next));
router.get('/auth/verify-reset-token', (req, res, next) => authController.verifyResetToken(req, res, next));
router.get('/verify-reset-token', (req, res, next) => authController.verifyResetToken(req, res, next));
router.post('/auth/reset-password', (req, res, next) => authController.resetPassword(req, res, next));
router.post('/reset-password', (req, res, next) => authController.resetPassword(req, res, next));

// Public Tenant Branding (for dynamic /login/:tenant screens)
router.get('/tenant/branding/:identifier?', (req, res, next) => authController.getTenantPublicBranding(req, res, next));
router.get('/tenant/branding', (req, res, next) => authController.getTenantPublicBranding(req, res, next));
router.get('/auth/tenant-branding/:identifier?', (req, res, next) => authController.getTenantPublicBranding(req, res, next));
router.get('/auth/tenant-branding', (req, res, next) => authController.getTenantPublicBranding(req, res, next));

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

// User Profile Management
router.get('/auth/profile', (req, res, next) => authController.getProfile(req, res, next));
router.put('/auth/profile', (req, res, next) => authController.updateProfile(req, res, next));
router.post('/auth/profile', (req, res, next) => authController.updateProfile(req, res, next));
router.get('/profile', (req, res, next) => authController.getProfile(req, res, next));
router.put('/profile', (req, res, next) => authController.updateProfile(req, res, next));
router.post('/profile', (req, res, next) => authController.updateProfile(req, res, next));

module.exports = router;

