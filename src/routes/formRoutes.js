const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');

// Submit dynamic custom forms (/api/chat/form-submit and /api/forms/submit)
router.post('/chat/form-submit', (req, res, next) => formController.submitForm(req, res, next));
router.post('/forms/submit', (req, res, next) => formController.submitForm(req, res, next));
router.get('/forms/submissions', (req, res, next) => formController.getSubmissions(req, res, next));

module.exports = router;
