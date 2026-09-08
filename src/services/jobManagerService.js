const logger = require('../helpers/logger');

class JobManagerService {
  constructor() {
    this.jobs = new Map();
    this.MAX_SAVED_JOBS = 100;
  }

  /**
   * Create a new tracked background job
   * @param {Object} params
   * @returns {Object} job
   */
  createJob({ type = 'crawl', tenantId = 'default', botId = 'default', title = '', params = {} }) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const abortController = new AbortController();

    const job = {
      jobId,
      type, // 'crawl' | 'ingest' | 'batch_ingest' | 'rescrape'
      title: title || `${type.toUpperCase()} Task`,
      status: 'pending', // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
      tenantId,
      botId,
      params,
      progress: {
        current: 0,
        total: 0,
        percentage: 0
      },
      stats: {
        startUrl: params.startUrl || '',
        activeUrl: '',
        currentDepth: 1,
        maxDepth: params.maxDepth || 2,
        discoveredCount: 0,
        ingestedCount: 0,
        failedCount: 0
      },
      logs: [
        {
          time: new Date().toISOString(),
          message: `Job initialized: ${title || type}`,
          level: 'info'
        }
      ],
      result: null,
      error: null,
      startTime: new Date().toISOString(),
      endTime: null,
      abortController
    };

    this.jobs.set(jobId, job);
    this._pruneOldJobs();

    logger.info(`[JobManager] Created ${type} job "${jobId}" for tenant "${tenantId}" / bot "${botId}"`);
    return this.serializeJob(job);
  }

  /**
   * Update job progress and statistics
   */
  updateJob(jobId, updates = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    if (updates.status) job.status = updates.status;
    if (updates.error) job.error = updates.error;
    if (updates.result) job.result = updates.result;
    if (updates.title) job.title = updates.title;

    if (updates.progress) {
      job.progress = { ...job.progress, ...updates.progress };
      if (job.progress.total > 0) {
        job.progress.percentage = Math.min(100, Math.round((job.progress.current / job.progress.total) * 100));
      }
    }

    if (updates.stats) {
      job.stats = { ...job.stats, ...updates.stats };
    }

    if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
      if (!job.endTime) job.endTime = new Date().toISOString();
    }

    return this.serializeJob(job);
  }

  /**
   * Add a timestamped log to the job
   */
  addLog(jobId, message, level = 'info') {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.logs.push({
      time: new Date().toISOString(),
      message,
      level
    });

    // Limit logs array length
    if (job.logs.length > 200) {
      job.logs = job.logs.slice(-200);
    }
  }

  /**
   * Cancel / Abort a running job
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'running' || job.status === 'pending') {
      try {
        job.abortController.abort();
      } catch (e) {}

      job.status = 'cancelled';
      job.endTime = new Date().toISOString();
      this.addLog(jobId, 'Job cancelled by user request.', 'warn');
      logger.info(`[JobManager] Job "${jobId}" cancelled.`);
      return true;
    }

    return false;
  }

  /**
   * Get single job by ID
   */
  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return this.serializeJob(job);
  }

  /**
   * Get active and recent jobs for a tenant/bot
   */
  getJobs({ tenantId, botId, limit = 20 } = {}) {
    const all = Array.from(this.jobs.values());
    let filtered = all;

    if (tenantId && tenantId !== 'all') {
      filtered = filtered.filter(j => j.tenantId === tenantId || j.tenantId === 'default');
    }
    if (botId && botId !== 'all') {
      filtered = filtered.filter(j => j.botId === botId || j.botId === 'default');
    }

    // Sort: running/pending first, then by startTime desc
    filtered.sort((a, b) => {
      const aActive = a.status === 'running' || a.status === 'pending';
      const bActive = b.status === 'running' || b.status === 'pending';
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    return filtered.slice(0, limit).map(j => this.serializeJob(j));
  }

  /**
   * Delete a single job by ID
   */
  deleteJob(jobId) {
    return this.jobs.delete(jobId);
  }

  /**
   * Clear all completed, cancelled, or failed jobs for a tenant/bot
   */
  clearCompletedJobs({ tenantId, botId } = {}) {
    let count = 0;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        if (tenantId && tenantId !== 'all' && job.tenantId !== tenantId && job.tenantId !== 'default') {
          continue;
        }
        this.jobs.delete(jobId);
        count++;
      }
    }
    return count;
  }

  /**
   * Helper: Strip private properties like abortController
   */
  serializeJob(job) {
    if (!job) return null;
    const { abortController, ...rest } = job;
    return rest;
  }

  _pruneOldJobs() {
    if (this.jobs.size > this.MAX_SAVED_JOBS) {
      const sorted = Array.from(this.jobs.entries()).sort((a, b) => {
        return new Date(a[1].startTime).getTime() - new Date(b[1].startTime).getTime();
      });

      while (this.jobs.size > this.MAX_SAVED_JOBS) {
        const oldest = sorted.shift();
        if (oldest) this.jobs.delete(oldest[0]);
      }
    }
  }
}

module.exports = new JobManagerService();
