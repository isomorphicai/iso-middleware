const mongoose = require('mongoose');
const logger = require('../helpers/logger');

class ExpiryWorker {
  constructor() {
    this.interval = null;
  }

  /**
   * Start periodic check for expiring knowledge URLs (every 30 minutes)
   * and inactive sessions older than 20 minutes (every 60 seconds)
   */
  start(intervalMs = 30 * 60 * 1000) {
    if (this.interval) return;
    logger.info('[Expiry Worker] Starting background link expiry & 20-min session auto-closer worker...');
    
    // Initial checks after 10s
    setTimeout(() => {
      this.checkExpiringLinks().catch(() => {});
      this.checkInactiveSessions().catch(() => {});
    }, 10000);

    // Periodic check for expiring knowledge links
    this.interval = setInterval(() => {
      this.checkExpiringLinks().catch(err => {
        logger.error(`[Expiry Worker] Error in link expiry check: ${err.message}`);
      });
    }, intervalMs);

    // Periodic check for 20-min inactive chat sessions (every 60 seconds)
    this.sessionInterval = setInterval(() => {
      this.checkInactiveSessions().catch(err => {
        logger.error(`[Expiry Worker] Error in session auto-closer: ${err.message}`);
      });
    }, 60 * 1000);
  }

  /**
   * Stop background worker
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
    logger.info('[Expiry Worker] Background worker stopped.');
  }

  /**
   * Automatically end chat sessions that have been idle for more than 20 minutes
   */
  async checkInactiveSessions() {
    try {
      const client = mongoose.connection?.client 
        || (mongoose.connection && typeof mongoose.connection.getClient === 'function' && mongoose.connection.getClient())
        || (mongoose.connections && mongoose.connections[0] && mongoose.connections[0].client);

      const masterDb = client ? client.db('master') : mongoose.connection.useDb('master').db;
      const col = masterDb.collection('conversationHistory');

      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

      // Find distinct active sessions with last activity older than 20 minutes
      const inactiveSessions = await col.aggregate([
        { $match: { sessionStatus: 'active' } },
        {
          $group: {
            _id: '$sessionId',
            lastActivityAt: { $max: '$createdAt' }
          }
        },
        { $match: { lastActivityAt: { $lte: twentyMinutesAgo } } }
      ]).toArray();

      if (inactiveSessions.length > 0) {
        for (const s of inactiveSessions) {
          const autoEndAt = new Date(s.lastActivityAt.getTime() + 20 * 60 * 1000);
          await col.updateMany(
            { sessionId: s._id, sessionStatus: 'active' },
            { 
              $set: { 
                sessionStatus: 'ended', 
                sessionEndAt: autoEndAt,
                'metadata.endReason': 'auto_inactivity_20m',
                updatedAt: new Date()
              } 
            }
          );
          logger.info(`[Expiry Worker] Auto-closed session "${s._id}" after 20 minutes of inactivity.`);
        }
      }
    } catch (err) {
      logger.error(`[Expiry Worker] checkInactiveSessions failed: ${err.message}`);
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
