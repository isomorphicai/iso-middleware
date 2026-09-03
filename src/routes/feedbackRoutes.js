const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');

// Submit thumbs up/down rating (/api/chat/feedback or /api/feedback)
router.post('/chat/feedback', (req, res, next) => feedbackController.submitFeedback(req, res, next));
router.post('/feedback', (req, res, next) => feedbackController.submitFeedback(req, res, next));
router.get('/feedback', (req, res, next) => feedbackController.getFeedback(req, res, next));

module.exports = router;
