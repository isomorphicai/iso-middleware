const mongoose = require('mongoose');
const embeddingService = require('./embeddingService');
const logger = require('../helpers/logger');

class RagSearchService {
  /**
   * Helper: Resolve native MongoDB tenant database connection
   */
  getTenantDb(tenantId, tenantDbName) {
    const dbName = tenantDbName || (tenantId ? (tenantId.startsWith('iso_') ? tenantId : `iso_${tenantId}`) : 'iso_default');
    
    // Check primary mongoose connection
    if (mongoose.connection) {
      if (typeof mongoose.connection.getClient === 'function') {
        const client = mongoose.connection.getClient();
        if (client && typeof client.db === 'function') {
          return client.db(dbName);
        }
      }
      if (mongoose.connection.client && typeof mongoose.connection.client.db === 'function') {
        return mongoose.connection.client.db(dbName);
      }
    }

    if (mongoose.connections && mongoose.connections[0] && mongoose.connections[0].client) {
      return mongoose.connections[0].client.db(dbName);
    }

    const conn = mongoose.connection.useDb(dbName, { useCache: true });
    return (conn && conn.client && typeof conn.client.db === 'function') ? conn.client.db(dbName) : conn;
  }

  /**
   * Helper: Resolve canonical tenantId string slug from tenantInfo
   */
  async resolveCanonicalTenantId(tenantIdentifier) {
    if (!tenantIdentifier) return 'default';
    const str = String(tenantIdentifier).trim();
    if (mongoose.Types.ObjectId.isValid(str) && str.length === 24) {
      try {
        const masterDb = this.getTenantDb('master', 'master');
        const tenantDoc = await masterDb.collection('tenantInfo').findOne({ _id: new mongoose.Types.ObjectId(str) });
        if (tenantDoc && (tenantDoc.tenantId || tenantDoc.code)) {
          return (tenantDoc.tenantId || tenantDoc.code).toLowerCase();
        }
      } catch (e) {}
    }
    return str.toLowerCase();
  }

  /**
   * Helper: Resolve canonical botId string slug
   */
  async resolveCanonicalBotId(botIdentifier, tenantDb) {
    if (!botIdentifier) return 'default_bot';
    const str = String(botIdentifier).trim();
    if (mongoose.Types.ObjectId.isValid(str) && str.length === 24) {
      try {
        const botDoc = await tenantDb.collection('chatClientSettings').findOne({ _id: new mongoose.Types.ObjectId(str) });
        if (botDoc && (botDoc.botId || botDoc.code)) {
          return (botDoc.botId || botDoc.code).toLowerCase();
        }
      } catch (e) {}
    }
    return str.toLowerCase();
  }

  /**
   * Perform KNN Vector Search across multiple expanded queries
   */
  async performKnnSearch({
    queries = [],
    tenantId,
    botId,
    topK = 4,
    scoreThreshold = 0.05,
    tenantDbName
  }) {
    if (!tenantId || !botId || !queries || queries.length === 0) {
      return [];
    }

    const cleanTenantId = await this.resolveCanonicalTenantId(tenantId);
    const tenantDb = this.getTenantDb(cleanTenantId, tenantDbName);
    const cleanBotId = await this.resolveCanonicalBotId(botId, tenantDb);

    const vectorIndexName = `${cleanTenantId.replace(/\s+/g, '_')}_${cleanBotId.replace(/\s+/g, '_')}`;

    // 1. Fetch bot's genAISettings to get embedding model & dimensions
    let embeddingDimensions = 1024;
    let embeddingModel = 'amazon.titan-embed-text-v2:0';
    try {
      const genAISettings = await tenantDb.collection('genAISettings').findOne({
        $or: [{ botId: cleanBotId }, { chatBotFlag: cleanBotId }, { botId }]
      });
      if (genAISettings?.embeddingsModelDimentions) {
        embeddingDimensions = parseInt(genAISettings.embeddingsModelDimentions);
      }
      if (genAISettings?.embeddingsGenerationModel) {
        embeddingModel = genAISettings.embeddingsGenerationModel;
      }
    } catch (e) {}

    // 2. Fetch all active chunks for this vector index partition from MongoDB Atlas
    const chunks = await tenantDb.collection('rag_chunks').find({
      $or: [
        { vectorIndexName: vectorIndexName.toLowerCase() },
        { vectorIndexName: new RegExp(`^${cleanTenantId}_${cleanBotId}$`, 'i') },
        { 'metadata.botId': new RegExp(`^${cleanBotId}$`, 'i') }
      ],
      'metadata.status': { $ne: 'expired' }
    }).toArray();

    if (chunks.length === 0) {
      logger.info(`[RAG Search] No chunks found under index partition "${vectorIndexName}"`);
      return [];
    }

    // 3. Generate embeddings for all search queries (original + rewritten variations)
    const queryEmbeddings = [];
    for (const q of queries) {
      if (q && q.trim()) {
        const vec = await embeddingService.generateEmbedding(q.trim(), embeddingModel, embeddingDimensions);
        queryEmbeddings.push({ query: q.trim(), embedding: vec });
      }
    }

    // 4. Calculate KNN Cosine Similarity across all queries and find best match for each chunk
    const chunkScoreMap = new Map();

    for (const chunk of chunks) {
      const chunkId = chunk._id.toString();
      let bestScore = 0;
      let matchedQuery = '';

      if (Array.isArray(chunk.embedding) && chunk.embedding.length > 0) {
        for (const qObj of queryEmbeddings) {
          const sim = embeddingService.cosineSimilarity(qObj.embedding, chunk.embedding);
          const scorePercent = parseFloat((sim * 100).toFixed(2));
          if (scorePercent > bestScore) {
            bestScore = scorePercent;
            matchedQuery = qObj.query;
          }
        }
      } else {
        // Text keyword fallback
        for (const qObj of queryEmbeddings) {
          if (chunk.text.toLowerCase().includes(qObj.query.toLowerCase())) {
            bestScore = Math.max(bestScore, 50.0);
          }
        }
      }

      chunkScoreMap.set(chunkId, {
        _id: chunkId,
        sourceId: chunk.sourceId?.toString(),
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        title: chunk.metadata?.title || 'Knowledge Document',
        sourceUrl: chunk.metadata?.sourceUrl || '',
        score: bestScore,
        matchedQuery
      });
    }

    // 5. Filter by threshold and sort by highest similarity
    const results = Array.from(chunkScoreMap.values())
      .filter(item => item.score >= scoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    logger.info(`[RAG Search] Retrieved ${results.length} chunks (best score: ${results[0]?.score || 0}%) for index "${vectorIndexName}"`);
    return results;
  }
}

module.exports = new RagSearchService();
