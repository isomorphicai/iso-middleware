const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

// Conversation history & transcript retrieval
router.get('/conversations/:sessionId', (req, res, next) => conversationController.getConversation(req, res, next));
router.get('/conversations/:sessionId/transcript', (req, res, next) => conversationController.getTranscript(req, res, next));

module.exports = router;
