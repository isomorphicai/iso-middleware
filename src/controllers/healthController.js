const os = require('os');
const { getDBStatus } = require('../config/database');
const env = require('../config/env');

class HealthController {
  /**
   * GET /health & GET /api/health
   * Docker healthcheck & Kubernetes liveness/readiness probe
   */
  getHealth(req, res) {
    const dbStatus = getDBStatus();
    const memoryUsage = process.memoryUsage();

    const health = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      nodeVersion: process.version,
      database: dbStatus,
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpuCores: os.cpus().length,
        freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
        totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024))
      },
      processMemory: {
        rssMB: Math.round(memoryUsage.rss / (1024 * 1024)),
        heapUsedMB: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(memoryUsage.heapTotal / (1024 * 1024))
      }
    };

    const isHealthy = dbStatus.readyState === 1 || dbStatus.readyState === 2;
    const statusCode = isHealthy ? 200 : 503;

    return res.status(statusCode).json(health);
  }
}

module.exports = new HealthController();
