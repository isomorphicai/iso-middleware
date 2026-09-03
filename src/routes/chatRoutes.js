const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { chatLimiter } = require('../middlewares/rateLimiter');

// Primary chat query endpoint for chatbot.js widget (/api/chat)
router.post('/chat', chatLimiter, (req, res, next) => chatController.handleChat(req, res, next));

// End chat session endpoint (/api/chat/session-end)
router.post('/chat/session-end', (req, res, next) => chatController.handleEndSession(req, res, next));
router.post('/chat/end-session', (req, res, next) => chatController.handleEndSession(req, res, next));

// Streaming SSE chat endpoint (/api/chat/stream)
router.post('/chat/stream', chatLimiter, (req, res, next) => chatController.streamChat(req, res, next));

module.exports = router;
