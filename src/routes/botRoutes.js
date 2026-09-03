const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');
const { configLimiter } = require('../middlewares/rateLimiter');

// Direct chatbot.js widget config endpoint (/api/bot-config and /api/bots/:botId/config)
router.get('/bot-config', configLimiter, (req, res, next) => botController.getBotConfig(req, res, next));
router.get('/bots/:botId/config', configLimiter, (req, res, next) => botController.getBotConfig(req, res, next));

// Bot Management APIs
router.get('/bots', (req, res, next) => botController.getBots(req, res, next));
router.get('/bots/:id', (req, res, next) => botController.getBotById(req, res, next));
router.post('/bots', (req, res, next) => botController.createBot(req, res, next));
router.put('/bots/:id', (req, res, next) => botController.updateBot(req, res, next));
router.delete('/bots/:id', (req, res, next) => botController.deleteBot(req, res, next));

module.exports = router;
