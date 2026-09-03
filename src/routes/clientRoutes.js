const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.get('/client/bots/:id/analytics', (req, res, next) => clientController.getAnalytics(req, res, next));
router.post('/client/bots/:id/ingest', (req, res, next) => clientController.ingestSource(req, res, next));
router.delete('/client/bots/:id/ingest/:sourceId', (req, res, next) => clientController.deleteSource(req, res, next));
router.post('/client/bots/:id/chat', (req, res, next) => clientController.testChat(req, res, next));

module.exports = router;
