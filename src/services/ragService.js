const mongoose = require('mongoose');
const scraperService = require('./scraperService');
const chunkerService = require('./chunkerService');
const embeddingService = require('./embeddingService');
const logger = require('../helpers/logger');

class RagService {
  /**
   * Helper: Resolve canonical tenantId string slug from tenantInfo
   */
  async resolveCanonicalTenantId(tenantIdentifier) {
    if (!tenantIdentifier) return 'default';
    const str = String(tenantIdentifier).trim();
    if (mongoose.Types.ObjectId.isValid(str) && str.length === 24) {
      try {
        const masterDb = mongoose.connection.useDb('master', { useCache: true });
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
   * Helper: Resolve tenant database connection
   */
  getTenantDb(tenantId, tenantDbName) {
    const dbName = tenantDbName || (tenantId ? (tenantId.startsWith('iso_') ? tenantId : `iso_${tenantId}`) : 'iso_default');
    return mongoose.connection.useDb(dbName, { useCache: true });
  }

  /**
   * Scrapes, chunks, generates vector embeddings, and stores in MongoDB Atlas under unique partition `${tenantId}_${botId}`
   */
  async ingestUrl({
    url,
    tenantId,
    tenantName,
    botId,
    botName,
    linkExpiry,
    expiryNotificationEnabled = false,
    notificationEmail = '',
    tenantDbName
  }) {
    if (!url || !tenantId || !botId) {
      throw new Error('URL, tenantId, and botId are required for RAG ingestion.');
    }

    // Resolve clean canonical tenantId and botId (never raw ObjectId)
    const cleanTenantId = await this.resolveCanonicalTenantId(tenantId);
    const tenantDb = this.getTenantDb(cleanTenantId, tenantDbName);
    const cleanBotId = await this.resolveCanonicalBotId(botId, tenantDb);

    const sourcesCol = tenantDb.collection('ingestion_sources');
    const chunksCol = tenantDb.collection('rag_chunks');

    // Canonical vectorIndexName: strictly `${tenantId}_${botId}`
    const vectorIndexName = `${cleanTenantId.replace(/\s+/g, '_')}_${cleanBotId.replace(/\s+/g, '_')}`;

    // 1. Scrape webpage content
    const scraped = await scraperService.scrapeUrl(url);

    // 2. Fetch bot's genAISettings to get chunking and embedding configurations
    let chunkSize = 600;
    let chunkOverlap = 100;
    let embeddingModel = 'amazon.titan-embed-text-v2:0';
    let embeddingDimensions = 1024;

    try {
      const genAISettings = await tenantDb.collection('genAISettings').findOne({
        $or: [{ botId: cleanBotId }, { chatBotFlag: cleanBotId }, { botId }]
      });
      if (genAISettings) {
        if (genAISettings.chunkSize) chunkSize = parseInt(genAISettings.chunkSize);
        if (genAISettings.chunkOverlapSize) chunkOverlap = parseInt(genAISettings.chunkOverlapSize);
        if (genAISettings.embeddingsGenerationModel) embeddingModel = genAISettings.embeddingsGenerationModel;
        if (genAISettings.embeddingsModelDimentions) embeddingDimensions = parseInt(genAISettings.embeddingsModelDimentions);
      }
    } catch (e) {
      logger.warn(`[RAG Service] Using default genAISettings: ${e.message}`);
    }

    // 3. Chunk the extracted text
    const chunks = chunkerService.chunkText(scraped.cleanText, chunkSize, chunkOverlap);
    if (chunks.length === 0) {
      throw new Error('Failed to generate chunks from scraped content.');
    }

    logger.info(`[RAG Service] Generating ${embeddingDimensions}-dim vector embeddings for ${chunks.length} chunks using model "${embeddingModel}"...`);

    // 4. Generate dense vector embeddings for all chunks
    const embeddings = await embeddingService.generateBatchEmbeddings(chunks, embeddingModel, embeddingDimensions);

    // 5. Create or update the ingestion source document in MongoDB Atlas
    const now = new Date();
    const sourceDoc = {
      sourceUrl: scraped.url,
      title: scraped.title || url,
      description: scraped.description || '',
      tenantId: cleanTenantId,
      tenantName: tenantName || cleanTenantId,
      botId: cleanBotId,
      botName: botName || cleanBotId,
      vectorIndexName,
      status: 'indexed',
      totalChunks: chunks.length,
      charCount: scraped.charCount,
      embeddingModel,
      embeddingDimensions,
      linkExpiry: linkExpiry ? new Date(linkExpiry) : null,
      expiryNotificationEnabled: Boolean(expiryNotificationEnabled),
      notificationEmail: notificationEmail ? notificationEmail.trim() : '',
      notificationSent: false,
      lastScrapedAt: now,
      updatedAt: now
    };

    // Upsert by sourceUrl + botId in this tenant
    const existingSource = await sourcesCol.findOne({
      sourceUrl: scraped.url,
      $or: [{ botId: cleanBotId }, { botId }]
    });

    let sourceId = null;
    if (existingSource) {
      sourceId = existingSource._id;
      await sourcesCol.updateOne({ _id: sourceId }, { $set: sourceDoc });
      // Remove old chunks
      await chunksCol.deleteMany({ sourceId });
    } else {
      sourceDoc.createdAt = now;
      const insertRes = await sourcesCol.insertOne(sourceDoc);
      sourceId = insertRes.insertedId;
    }

    // 6. Store chunk documents with embeddings and rich metadata in MongoDB Atlas
    const chunkDocs = chunks.map((chunk, idx) => ({
      sourceId,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunks.length,
      text: chunk.text,
      charCount: chunk.charCount,
      embedding: embeddings[idx],
      vectorIndexName,
      metadata: {
        sourceUrl: scraped.url,
        title: scraped.title || url,
        tenantId: cleanTenantId,
        tenantName: tenantName || cleanTenantId,
        botId: cleanBotId,
        botName: botName || cleanBotId,
        linkExpiry: linkExpiry ? new Date(linkExpiry) : null,
        expiryNotificationEnabled: Boolean(expiryNotificationEnabled),
        notificationEmail: notificationEmail ? notificationEmail.trim() : '',
        embeddingModel,
        status: 'active'
      },
      createdAt: now
    }));

    if (chunkDocs.length > 0) {
      await chunksCol.insertMany(chunkDocs);
    }

    logger.info(`[RAG Service] Successfully saved ${chunkDocs.length} chunks with vector embeddings in MongoDB Atlas under index "${vectorIndexName}"`);

    return {
      _id: sourceId.toString(),
      ...sourceDoc,
      chunksCount: chunkDocs.length
    };
  }

  /**
   * List all ingested sources for a specific tenant and bot
   */
  async getSources({ tenantId, botId, tenantDbName }) {
    const cleanTenantId = await this.resolveCanonicalTenantId(tenantId);
    const tenantDb = this.getTenantDb(cleanTenantId, tenantDbName);
    const cleanBotId = botId ? await this.resolveCanonicalBotId(botId, tenantDb) : null;

    const filter = {};
    if (cleanBotId) {
      filter.$or = [{ botId: cleanBotId }, { botId }];
    }

    const sources = await tenantDb.collection('ingestion_sources')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return sources.map(s => ({
      ...s,
      _id: s._id.toString()
    }));
  }

  /**
   * Retrieve all text chunks for a given source
   */
  async getSourceChunks({ sourceId, tenantId, tenantDbName }) {
    const cleanTenantId = await this.resolveCanonicalTenantId(tenantId);
    const tenantDb = this.getTenantDb(cleanTenantId, tenantDbName);
    let sId;
    try {
      sId = new mongoose.Types.ObjectId(sourceId);
    } catch (e) {
      sId = sourceId;
    }

    const chunks = await tenantDb.collection('rag_chunks')
      .find({ sourceId: sId })
      .sort({ chunkIndex: 1 })
      .toArray();

    return chunks.map(c => ({
      ...c,
      _id: c._id.toString(),
      sourceId: c.sourceId.toString(),
      hasEmbedding: Array.isArray(c.embedding) && c.embedding.length > 0,
      embeddingDimensions: Array.isArray(c.embedding) ? c.embedding.length : 0
    }));
  }

  /**
   * Delete an ingestion source and all its associated vector chunks
   */
  async deleteSource({ sourceId, tenantId, tenantDbName }) {
    const cleanTenantId = await this.resolveCanonicalTenantId(tenantId);
    const tenantDb = this.getTenantDb(cleanTenantId, tenantDbName);
    let sId;
    try {
      sId = new mongoose.Types.ObjectId(sourceId);
    } catch (e) {
      sId = sourceId;
    }

    const source = await tenantDb.collection('ingestion_sources').findOne({ _id: sId });
    if (!source) {
      throw new Error('Knowledge source not found.');
    }

    await tenantDb.collection('rag_chunks').deleteMany({ sourceId: sId });
    await tenantDb.collection('ingestion_sources').deleteOne({ _id: sId });

    return { success: true, message: 'Source and associated vector chunks deleted from Atlas.' };
  }

  /**
   * Perform vector similarity search querying the partition `${tenantId}_${botId}`
   */
  async searchKnowledge({ query, tenantId, botId, topK = 5, tenantDbName }) {
    if (!query || !tenantId || !botId) {
      throw new Error('Query, tenantId, and botId are required for RAG search.');
    }

    const cleanTenantId = await this.resolveCanonicalTenantId(tenantId);
    const tenantDb = this.getTenantDb(cleanTenantId, tenantDbName);
    const cleanBotId = await this.resolveCanonicalBotId(botId, tenantDb);
    const vectorIndexName = `${cleanTenantId.replace(/\s+/g, '_')}_${cleanBotId.replace(/\s+/g, '_')}`;

    // 1. Fetch bot's genAISettings to get dimensions & model
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

    // 2. Generate vector embedding for the search query
    const queryEmbedding = await embeddingService.generateEmbedding(query, embeddingModel, embeddingDimensions);

    // 3. Fetch candidate chunks for this vector index partition
    const chunks = await tenantDb.collection('rag_chunks').find({
      vectorIndexName,
      'metadata.status': { $ne: 'expired' }
    }).toArray();

    if (chunks.length === 0) {
      return [];
    }

    // 4. Compute Vector Cosine Similarity against each chunk embedding
    const scoredChunks = chunks.map(chunk => {
      let similarity = 0;
      if (Array.isArray(chunk.embedding) && chunk.embedding.length > 0) {
        similarity = embeddingService.cosineSimilarity(queryEmbedding, chunk.embedding);
      } else {
        similarity = chunk.text.toLowerCase().includes(query.toLowerCase()) ? 0.8 : 0.2;
      }

      return {
        _id: chunk._id.toString(),
        sourceId: chunk.sourceId.toString(),
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        metadata: chunk.metadata,
        score: parseFloat((similarity * 100).toFixed(2))
      };
    });

    // 5. Rank and return top-K
    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, parseInt(topK) || 5);
  }
}

module.exports = new RagService();
