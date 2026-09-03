const mongoose = require('mongoose');
const logger = require('../helpers/logger');

class ExpiryWorker {
  constructor() {
    this.interval = null;
  }

  /**
   * Start periodic check for expiring knowledge URLs (every 30 minutes)
   */
  start(intervalMs = 30 * 60 * 1000) {
    if (this.interval) return;
    logger.info('[Expiry Worker] Starting background link expiry and notification worker...');
    
    // Initial check after 10s
    setTimeout(() => this.checkExpiringLinks().catch(() => {}), 10000);

    this.interval = setInterval(() => {
      this.checkExpiringLinks().catch(err => {
        logger.error(`[Expiry Worker] Error in check: ${err.message}`);
      });
    }, intervalMs);
  }

  /**
   * Stop background worker
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('[Expiry Worker] Background worker stopped.');
    }
  }

  /**
   * Scan all active tenant databases for expired knowledge sources
   */
  async checkExpiringLinks() {
    try {
      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      const tenants = await masterDb.collection('tenantInfo').find({ tenantActive: true }).toArray();

      const now = new Date();

      for (const t of tenants) {
        const dbName = t.tenantDbName || `iso_${t.tenantId}`;
        const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
        
        // Find sources where link is expired and notification is enabled but not yet sent
        const expiringSources = await tenantDb.collection('ingestion_sources').find({
          expiryNotificationEnabled: true,
          notificationSent: { $ne: true },
          linkExpiry: { $ne: null, $lte: now }
        }).toArray();

        for (const s of expiringSources) {
          logger.warn(`[Expiry Worker] 🚨 LINK EXPIRED: "${s.sourceUrl}" for Bot "${s.botName}" (${s.botId}) in Tenant "${s.tenantName}". Email Alert To: ${s.notificationEmail || 'N/A'}`);

          // Mark status as expired & notificationSent as true
          await tenantDb.collection('ingestion_sources').updateOne(
            { _id: s._id },
            { 
              $set: { 
                status: 'expired',
                notificationSent: true,
                notificationSentAt: new Date()
              }
            }
          );

          // Update chunks status to expired
          await tenantDb.collection('rag_chunks').updateMany(
            { sourceId: s._id },
            { $set: { 'metadata.status': 'expired' } }
          );
        }
      }
    } catch (err) {
      logger.error(`[Expiry Worker] checkExpiringLinks failed: ${err.message}`);
    }
  }
}

module.exports = new ExpiryWorker();
