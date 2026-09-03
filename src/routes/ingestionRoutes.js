const express = require('express');
const router = express.Router();
const ingestionController = require('../controllers/ingestionController');

// Ingestion Routes
router.post('/scrape', (req, res, next) => ingestionController.scrapeAndIngest(req, res, next));
router.get('/sources', (req, res, next) => ingestionController.getSources(req, res, next));
router.get('/chunks/:sourceId', (req, res, next) => ingestionController.getSourceChunks(req, res, next));
router.post('/rescrape/:sourceId', (req, res, next) => ingestionController.rescrapeSource(req, res, next));
router.delete('/sources/:sourceId', (req, res, next) => ingestionController.deleteSource(req, res, next));
router.post('/search', (req, res, next) => ingestionController.searchKnowledge(req, res, next));

module.exports = router;
