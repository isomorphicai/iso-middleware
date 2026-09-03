const express = require('express');
const router = express.Router();
const mongoController = require('../controllers/mongoController');

// Direct MongoDB Fetch & Management APIs
router.get('/mongo/status', (req, res, next) => mongoController.getStatus(req, res, next));
router.get('/mongo/collections', (req, res, next) => mongoController.getCollections(req, res, next));
router.get('/mongo/fetch/:collection', (req, res, next) => mongoController.fetchFromCollection(req, res, next));
router.post('/mongo/insert/:collection', (req, res, next) => mongoController.insertDocument(req, res, next));
router.put('/mongo/update/:collection/:id', (req, res, next) => mongoController.updateDocument(req, res, next));
router.delete('/mongo/delete/:collection/:id', (req, res, next) => mongoController.deleteDocument(req, res, next));

module.exports = router;
