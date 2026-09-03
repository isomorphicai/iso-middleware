const ragService = require('../services/ragService');
const logger = require('../helpers/logger');

class IngestionController {
  /**
   * POST /api/ingestion/scrape
   */
  async scrapeAndIngest(req, res, next) {
    try {
      const { 
        url, 
        tenantId, 
        tenantName, 
        botId, 
        botName, 
        linkExpiry, 
        expiryNotificationEnabled, 
        notificationEmail,
        tenantDbName
      } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
      }
      if (!tenantId || !botId) {
        return res.status(400).json({ error: 'Both tenantId and botId are required to build the partitioned index (${tenantId}_${botId}).' });
      }

      const result = await ragService.ingestUrl({
        url,
        tenantId,
        tenantName,
        botId,
        botName,
        linkExpiry,
        expiryNotificationEnabled,
        notificationEmail,
        tenantDbName
      });

      return res.status(201).json(result);
    } catch (err) {
      logger.error(`[Ingestion Controller] Scrape error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ingestion/sources
   */
  async getSources(req, res, next) {
    try {
      const { tenantId, botId, tenantDbName } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required.' });
      }

      const sources = await ragService.getSources({ tenantId, botId, tenantDbName });
      return res.json(sources);
    } catch (err) {
      logger.error(`[Ingestion Controller] Get sources error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ingestion/chunks/:sourceId
   */
  async getSourceChunks(req, res, next) {
    try {
      const { sourceId } = req.params;
      const { tenantId, tenantDbName } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required.' });
      }

      const chunks = await ragService.getSourceChunks({ sourceId, tenantId, tenantDbName });
      return res.json(chunks);
    } catch (err) {
      logger.error(`[Ingestion Controller] Get chunks error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ingestion/rescrape/:sourceId
   */
  async rescrapeSource(req, res, next) {
    try {
      const { sourceId } = req.params;
      const { tenantId, tenantDbName } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required.' });
      }

      // Look up existing source details
      const tenantDb = ragService.getTenantDb(tenantId, tenantDbName);
      const mongoose = require('mongoose');
      let sId;
      try {
        sId = new mongoose.Types.ObjectId(sourceId);
      } catch (e) {
        sId = sourceId;
      }

      const source = await tenantDb.collection('ingestion_sources').findOne({ _id: sId });
      if (!source) {
        return res.status(404).json({ error: 'Knowledge source not found.' });
      }

      const result = await ragService.ingestUrl({
        url: source.sourceUrl,
        tenantId: source.tenantId,
        tenantName: source.tenantName,
        botId: source.botId,
        botName: source.botName,
        linkExpiry: source.linkExpiry,
        expiryNotificationEnabled: source.expiryNotificationEnabled,
        notificationEmail: source.notificationEmail,
        tenantDbName
      });

      return res.json(result);
    } catch (err) {
      logger.error(`[Ingestion Controller] Rescrape error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * DELETE /api/ingestion/sources/:sourceId
   */
  async deleteSource(req, res, next) {
    try {
      const { sourceId } = req.params;
      const { tenantId, tenantDbName } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required.' });
      }

      const result = await ragService.deleteSource({ sourceId, tenantId, tenantDbName });
      return res.json(result);
    } catch (err) {
      logger.error(`[Ingestion Controller] Delete source error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ingestion/search
   */
  async searchKnowledge(req, res, next) {
    try {
      const { query, tenantId, botId, topK, tenantDbName } = req.body;
      if (!query || !tenantId || !botId) {
        return res.status(400).json({ error: 'query, tenantId, and botId are required.' });
      }

      const results = await ragService.searchKnowledge({ query, tenantId, botId, topK, tenantDbName });
      return res.json(results);
    } catch (err) {
      logger.error(`[Ingestion Controller] Search error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new IngestionController();
