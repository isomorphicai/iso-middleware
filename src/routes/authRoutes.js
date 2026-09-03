const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Auth endpoints
router.post('/login', (req, res, next) => authController.login(req, res, next));

// Tenant-scoped User CRUD
router.get('/users', (req, res, next) => authController.getUsers(req, res, next));
router.post('/users', (req, res, next) => authController.createUser(req, res, next));
router.delete('/users/:id', (req, res, next) => authController.deleteUser(req, res, next));

// Tenant-scoped Role Management
router.get('/roles', (req, res, next) => authController.getRoles(req, res, next));
router.post('/roles', (req, res, next) => authController.createOrUpdateRole(req, res, next));
router.delete('/roles/:id', (req, res, next) => authController.deleteRole(req, res, next));

module.exports = router;
