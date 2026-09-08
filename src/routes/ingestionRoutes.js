const express = require('express');
const router = express.Router();
const ingestionController = require('../controllers/ingestionController');

// Ingestion Routes
router.post('/scrape', (req, res, next) => ingestionController.scrapeAndIngest(req, res, next));
router.post('/crawl', (req, res, next) => ingestionController.crawlWebsite(req, res, next));
router.post('/batch-ingest', (req, res, next) => ingestionController.batchIngest(req, res, next));
router.get('/jobs/active', (req, res, next) => ingestionController.getActiveJobs(req, res, next));
router.post('/jobs/clear-completed', (req, res, next) => ingestionController.clearCompletedJobs(req, res, next));
router.get('/jobs/:jobId', (req, res, next) => ingestionController.getJobById(req, res, next));
router.post('/jobs/:jobId/cancel', (req, res, next) => ingestionController.cancelJob(req, res, next));
router.delete('/jobs/:jobId', (req, res, next) => ingestionController.deleteJob(req, res, next));
router.get('/sources', (req, res, next) => ingestionController.getSources(req, res, next));
router.get('/chunks/:sourceId', (req, res, next) => ingestionController.getSourceChunks(req, res, next));
router.post('/rescrape/:sourceId', (req, res, next) => ingestionController.rescrapeSource(req, res, next));
router.delete('/sources/:sourceId', (req, res, next) => ingestionController.deleteSource(req, res, next));
router.post('/search', (req, res, next) => ingestionController.searchKnowledge(req, res, next));

module.exports = router;
