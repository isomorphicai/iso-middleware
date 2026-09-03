const mongoose = require('mongoose');
const env = require('../config/env');
const { DEFAULT_BOT_UI_CONFIGS, DEFAULT_GREETING_MESSAGE, DEFAULT_CUSTOM_FORMS } = require('../constants/botDefaults');
const logger = require('../helpers/logger');

class BotService {
  /**
   * Resolve dynamic database name: "iso_${tenantName}"
   */
  resolveDbName(tenantName) {
    const raw = (tenantName || env.DEFAULT_TENANT_CODE || 'default').toString().trim().toLowerCase();
    // If it already starts with "iso_", use as is; otherwise prepend "iso_"
    return raw.startsWith('iso_') ? raw : `iso_${raw}`;
  }

  /**
   * Get dynamic tenant database instance from MongoDB connection
   */
  getTenantDb(tenantName) {
    const dbName = this.resolveDbName(tenantName);
    return mongoose.connection.useDb(dbName, { useCache: true });
  }

  /**
   * Fetch bot document from dynamic db `iso_${tenantName}` in collection `chatClientSettings`
   */
  async findBotDocument(botId, tenantName) {
    if (mongoose.connection.readyState !== 1) {
      const { ensureConnected } = require('../config/database');
      const reconnected = await ensureConnected();
      if (!reconnected) {
        logger.warn(`MongoDB is not connected (readyState: ${mongoose.connection.readyState})`);
        return null;
      }
    }

    try {
      const dbName = this.resolveDbName(tenantName);
      const tenantDb = this.getTenantDb(tenantName);
      const collection = tenantDb.collection('chatClientSettings');

      logger.info(`Querying database '${dbName}', collection 'chatClientSettings' for botId='${botId}'`);

      let query = {};
      if (botId && botId !== 'default') {
        const orConditions = [
          { botId: botId },
          { botId: new RegExp(`^${botId}$`, 'i') },
          { code: botId },
          { botName: botId },
          { name: botId }
        ];

        if (mongoose.Types.ObjectId.isValid(botId)) {
          orConditions.push({ _id: new mongoose.Types.ObjectId(botId) });
        }

        query = { $or: orConditions };
      }

      // Find the bot configuration document
      let doc = await collection.findOne(query);

      // If not found with specific query and botId was given, try fallback to first document in the collection
      if (!doc && botId) {
        logger.warn(`Bot '${botId}' not found in '${dbName}.chatClientSettings', fetching first available bot in collection...`);
        doc = await collection.findOne({});
      }

      return doc;
    } catch (err) {
      logger.error(`Error querying dynamic tenant DB: ${err.message}`);
      return null;
    }
  }

  /**
   * Default fallback widget configuration if DB is offline or document not found
   */
  getDefaultWidgetConfig(botId, tenantName) {
    return {
      _id: 'default-iso-bot',
      botId: botId || 'ISOBot',
      botName: 'ISO AI Assistant',
      tenantId: tenantName || 'default',
      botActive: true,
      updatedSince: new Date().toISOString(),
      greetingMessage: DEFAULT_GREETING_MESSAGE,
      welcomeMessage: 'Hi! I’m your AI assistant. How can I assist you today?',
      customForms: DEFAULT_CUSTOM_FORMS,
      quickReplies: ['What can you do?', 'Contact support', 'Documentation'],
      botUIConfigs: {
        ...DEFAULT_BOT_UI_CONFIGS,
        botHeaderText: 'ISO AI Assistant'
      }
    };
  }

  /**
   * Get widget configuration directly from MongoDB Atlas
   */
  async getWidgetConfig(botId, tenantName) {
    try {
      // Fetch document directly from dynamic database and chatClientSettings collection
      const doc = await this.findBotDocument(botId, tenantName);

      if (doc) {
        logger.info(`Successfully fetched bot document from MongoDB Atlas for botId='${botId}' in DB '${this.resolveDbName(tenantName)}'`);
        
        // Ensure standard fields expected by chatbot.js are present
        if (!doc.botId && doc._id) doc.botId = doc._id.toString();
        if (!doc.botName && doc.name) doc.botName = doc.name;
        if (doc.botActive === undefined && doc.status !== undefined) {
          doc.botActive = doc.status === 'active';
        }

        return doc;
      }

      logger.warn(`No bot document found in MongoDB Atlas. Serving fallback defaults.`);
      return this.getDefaultWidgetConfig(botId, tenantName);
    } catch (err) {
      logger.error(`Error in getWidgetConfig: ${err.message}. Serving fallback defaults.`);
      return this.getDefaultWidgetConfig(botId, tenantName);
    }
  }

  /**
   * List all bots for a given tenant database
   */
  async getBots(tenantName) {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    const tenantDb = this.getTenantDb(tenantName);
    const collection = tenantDb.collection('chatClientSettings');
    return collection.find({}).toArray();
  }
}

module.exports = new BotService();
