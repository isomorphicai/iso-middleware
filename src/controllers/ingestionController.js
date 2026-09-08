const ragService = require('../services/ragService');
const crawlerService = require('../services/crawlerService');
const jobManagerService = require('../services/jobManagerService');
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

  /**
   * POST /api/ingestion/crawl
   * Recursively crawls a website up to specified depth, proxy, and include/exclude patterns
   */
  async crawlWebsite(req, res, next) {
    let activeJobId = req.body.jobId;
    try {
      const {
        startUrl,
        maxDepth = 2,
        maxPages = 50,
        includePatterns = [],
        excludePatterns = [],
        proxy = '',
        allowSubdomains = false,
        tenantId = 'default',
        botId = 'default'
      } = req.body;

      if (!startUrl) {
        return res.status(400).json({ error: 'Starting URL is required for crawling.' });
      }

      if (!activeJobId) {
        const job = jobManagerService.createJob({
          type: 'crawl',
          tenantId,
          botId,
          title: `Crawling ${startUrl}`,
          params: { startUrl, maxDepth, maxPages, proxy: !!proxy, allowSubdomains }
        });
        activeJobId = job.jobId;
      }

      const results = await crawlerService.crawl({
        startUrl,
        maxDepth,
        maxPages,
        includePatterns,
        excludePatterns,
        proxy,
        allowSubdomains,
        jobId: activeJobId
      });

      return res.json({ jobId: activeJobId, ...results });
    } catch (err) {
      if (activeJobId) {
        jobManagerService.updateJob(activeJobId, {
          status: 'failed',
          error: err.message
        });
        jobManagerService.addLog(activeJobId, `Crawl failed: ${err.message}`, 'error');
      }
      logger.error(`[Ingestion Controller] Crawl error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ingestion/batch-ingest
   * Ingests an array of discovered URLs into RAG vector index with progress tracking
   */
  async batchIngest(req, res, next) {
    let activeJobId = req.body.jobId;
    try {
      const {
        urls = [],
        tenantId,
        tenantName,
        botId,
        botName,
        linkExpiry,
        expiryNotificationEnabled,
        notificationEmail,
        tenantDbName
      } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'At least one URL is required for batch ingestion.' });
      }
      if (!tenantId || !botId) {
        return res.status(400).json({ error: 'Both tenantId and botId are required.' });
      }

      if (!activeJobId) {
        const job = jobManagerService.createJob({
          type: 'batch_ingest',
          tenantId,
          botId,
          title: `Ingesting ${urls.length} URLs for ${botName || botId}`,
          params: { totalUrls: urls.length, tenantName, botName }
        });
        activeJobId = job.jobId;
      }

      jobManagerService.updateJob(activeJobId, {
        status: 'running',
        progress: { current: 0, total: urls.length },
        stats: {
          ingestedCount: 0,
          failedCount: 0,
          discoveredCount: urls.length,
          activeUrl: ''
        }
      });
      jobManagerService.addLog(activeJobId, `Batch ingestion started for ${urls.length} documents.`, 'info');

      const results = [];
      const errors = [];

      for (let i = 0; i < urls.length; i++) {
        // Check if job was cancelled
        const currentJob = jobManagerService.getJob(activeJobId);
        if (currentJob && currentJob.status === 'cancelled') {
          logger.info(`[Ingestion Controller] Batch ingestion job "${activeJobId}" aborted due to cancellation.`);
          break;
        }

        const item = urls[i];
        const targetUrl = typeof item === 'string' ? item : item.url;
        if (!targetUrl) continue;

        jobManagerService.updateJob(activeJobId, {
          progress: { current: i + 1, total: urls.length },
          stats: { activeUrl: targetUrl }
        });

        try {
          const result = await ragService.ingestUrl({
            url: targetUrl,
            tenantId,
            tenantName,
            botId,
            botName,
            linkExpiry,
            expiryNotificationEnabled,
            notificationEmail,
            tenantDbName
          });
          results.push(result);

          jobManagerService.updateJob(activeJobId, {
            stats: { ingestedCount: results.length }
          });
          jobManagerService.addLog(activeJobId, `Ingested: ${targetUrl} (${result.totalChunks || 0} chunks)`, 'success');
        } catch (err) {
          logger.warn(`[Ingestion Controller] Batch item failed for "${targetUrl}": ${err.message}`);
          errors.push({ url: targetUrl, error: err.message });

          jobManagerService.updateJob(activeJobId, {
            stats: { failedCount: errors.length }
          });
          jobManagerService.addLog(activeJobId, `Failed to ingest: ${targetUrl} (${err.message})`, 'warn');
        }
      }

      const finalStatus = errors.length === urls.length ? 'failed' : 'completed';
      const batchResult = {
        jobId: activeJobId,
        total: urls.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      };

      jobManagerService.updateJob(activeJobId, {
        status: finalStatus,
        progress: { current: urls.length, total: urls.length, percentage: 100 },
        stats: { activeUrl: '' },
        result: batchResult
      });
      jobManagerService.addLog(activeJobId, `Batch ingestion finished: ${results.length} succeeded, ${errors.length} failed.`, 'info');

      return res.status(200).json(batchResult);
    } catch (err) {
      if (activeJobId) {
        jobManagerService.updateJob(activeJobId, {
          status: 'failed',
          error: err.message
        });
        jobManagerService.addLog(activeJobId, `Batch ingestion failed: ${err.message}`, 'error');
      }
      logger.error(`[Ingestion Controller] Batch ingest error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ingestion/jobs/active
   * Returns active and recent ingestion/crawler operations for real-time polling
   */
  async getActiveJobs(req, res, next) {
    try {
      const { tenantId, botId, limit } = req.query;
      const jobs = jobManagerService.getJobs({
        tenantId,
        botId,
        limit: limit ? parseInt(limit) : 20
      });

      const activeCount = jobs.filter(j => j.status === 'running' || j.status === 'pending').length;

      return res.json({
        activeCount,
        totalTracked: jobs.length,
        jobs
      });
    } catch (err) {
      logger.error(`[Ingestion Controller] Get active jobs error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ingestion/jobs/:jobId
   * Returns status and full log stream of a specific job
   */
  async getJobById(req, res, next) {
    try {
      const { jobId } = req.params;
      const job = jobManagerService.getJob(jobId);
      if (!job) {
        return res.status(404).json({ error: `Job not found: ${jobId}` });
      }
      return res.json(job);
    } catch (err) {
      logger.error(`[Ingestion Controller] Get job error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ingestion/jobs/:jobId/cancel
   * Cancels / aborts an active running job
   */
  async cancelJob(req, res, next) {
    try {
      const { jobId } = req.params;
      const cancelled = jobManagerService.cancelJob(jobId);
      return res.json({
        success: cancelled,
        jobId,
        message: cancelled ? 'Job cancelled successfully.' : 'Job could not be cancelled or is not running.'
      });
    } catch (err) {
      logger.error(`[Ingestion Controller] Cancel job error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * DELETE /api/ingestion/jobs/:jobId
   * Deletes a single job from history
   */
  async deleteJob(req, res, next) {
    try {
      const { jobId } = req.params;
      const deleted = jobManagerService.deleteJob(jobId);
      return res.json({ success: deleted, jobId });
    } catch (err) {
      logger.error(`[Ingestion Controller] Delete job error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ingestion/jobs/clear-completed
   * Clears all completed, failed, or cancelled jobs
   */
  async clearCompletedJobs(req, res, next) {
    try {
      const { tenantId, botId } = req.body;
      const count = jobManagerService.clearCompletedJobs({ tenantId, botId });
      return res.json({ success: true, clearedCount: count });
    } catch (err) {
      logger.error(`[Ingestion Controller] Clear completed jobs error: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new IngestionController();
