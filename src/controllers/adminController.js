const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ApiResponse = require('../helpers/apiResponse');
const logger = require('../helpers/logger');
const { DEFAULT_BOT_UI_CONFIGS, DEFAULT_GREETING_MESSAGE, DEFAULT_CUSTOM_FORMS } = require('../constants/botDefaults');

class AdminController {
  /**
   * Helper: Get Master DB instance
   */
  getMasterDb() {
    return mongoose.connection.useDb('master', { useCache: true });
  }

  /**
   * Helper: Get Master TenantInfo Collection
   */
  getTenantInfoCollection() {
    return this.getMasterDb().collection('tenantInfo');
  }

  /**
   * Helper: Resolve dynamic Tenant Database
   */
  async resolveTenantDb(tenantIdentifier) {
    if (!tenantIdentifier) return null;

    const col = this.getTenantInfoCollection();
    let tenantDoc = null;

    if (mongoose.Types.ObjectId.isValid(tenantIdentifier)) {
      tenantDoc = await col.findOne({ _id: new mongoose.Types.ObjectId(tenantIdentifier) });
    }
    if (!tenantDoc) {
      tenantDoc = await col.findOne({
        $or: [
          { tenantId: tenantIdentifier },
          { tenantName: new RegExp(`^${tenantIdentifier}$`, 'i') },
          { tenantDbName: tenantIdentifier }
        ]
      });
    }

    const dbName = tenantDoc?.tenantDbName || (tenantIdentifier.startsWith('iso_') ? tenantIdentifier : `iso_${tenantIdentifier}`);
    return {
      tenantDoc,
      dbName,
      db: mongoose.connection.useDb(dbName, { useCache: true })
    };
  }

  // ==========================================
  // TENANTS API (master.tenantInfo)
  // ==========================================

  /**
   * GET /api/admin/tenants
   * Fetch all tenants from master > tenantInfo collection
   */
  async getTenants(req, res, next) {
    try {
      const col = this.getTenantInfoCollection();
      const rawTenants = await col.find({}).sort({ createdAt: -1 }).toArray();

      // Normalize tenant documents for UI consumption
      const tenants = rawTenants.map(t => ({
        _id: t._id.toString(),
        tenantId: t.tenantId || t.code || t._id.toString(),
        name: t.tenantName || t.name || t.tenantId || 'Unnamed Tenant',
        tenantName: t.tenantName || t.name || t.tenantId,
        code: t.tenantId || t.code || 'tenant',
        tenantDbName: t.tenantDbName || (t.tenantId ? `iso_${t.tenantId}` : 'iso_default'),
        Bots: t.Bots || [],
        tenantActive: t.tenantActive !== undefined ? t.tenantActive : true,
        tenantConfig: t.tenantConfig || {},
        createdAt: t.createdAt || new Date()
      }));

      logger.info(`Fetched ${tenants.length} tenants from master.tenantInfo`);
      return res.json(tenants);
    } catch (err) {
      logger.error(`Error fetching tenants from master.tenantInfo: ${err.message}`);
      next(err);
    }
  }

  /**
   * POST /api/admin/tenants
   * Create a new tenant document in master > tenantInfo and initialize its dynamic DB collections
   */
  async createTenant(req, res, next) {
    try {
      const { name, tenantName, code, tenantId, tenantDbName, tenantActive, tenantConfig, Bots } = req.body;
      const finalName = (tenantName || name || '').trim();
      const finalCode = (tenantId || code || '').toLowerCase().trim();

      if (!finalName || !finalCode) {
        return res.status(400).json({ error: 'Tenant Name and Tenant ID (Code) are required.' });
      }

      const col = this.getTenantInfoCollection();
      const existing = await col.findOne({
        $or: [
          { tenantId: finalCode },
          { tenantName: new RegExp(`^${finalName}$`, 'i') }
        ]
      });

      if (existing) {
        return res.status(400).json({ error: `Tenant with ID "${finalCode}" or Name "${finalName}" already exists.` });
      }

      const finalDbName = (tenantDbName || (finalCode.startsWith('iso_') ? finalCode : `iso_${finalCode}`)).trim();
      const initialBots = Array.isArray(Bots) ? Bots : [];

      const mergedTenantConfig = {
        instituteName: finalName,
        timeZone: 'America/New_York',
        loginBackgroundColor: '#fdf7f7',
        ButtonandLeftBarColor: '#00306D',
        buttonFontColor: '#ffffff',
        BordersColor: '#578b96',
        disableButtonColor: '#c1c1c1',
        forgotFontColor: '#373737',
        allHeaderFontSize: '1.2rem',
        allTitleFontSize: '1rem',
        backgroudImageUrl: '',
        logoBigUrl: '',
        logoSmallUrl: '',
        faviconUrl: '',
        showIntegrationTypeInChatHistory: true,
        showJobQueueNotificationIcon: true,
        ...(tenantConfig || {})
      };

      const newTenant = {
        tenantId: finalCode,
        tenantName: finalName,
        tenantDbName: finalDbName,
        Bots: initialBots,
        tenantActive: tenantActive !== undefined ? Boolean(tenantActive) : true,
        tenantConfig: mergedTenantConfig,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await col.insertOne(newTenant);
      const created = {
        _id: result.insertedId.toString(),
        ...newTenant,
        name: finalName,
        code: finalCode
      };

      logger.info(`Created new tenant "${finalName}" in master.tenantInfo with db "${finalDbName}"`);

      // =========================================================================
      // Initialize dynamic tenant DB collections (chatClientSettings, chatClients, genAISettings)
      // =========================================================================
      try {
        const dynamicDb = mongoose.connection.useDb(finalDbName, { useCache: true });
        logger.info(`Initializing dynamic database "${finalDbName}" collections...`);

        // Ensure collections exist
        await dynamicDb.createCollection('chatClientSettings').catch(() => {});
        await dynamicDb.createCollection('chatClients').catch(() => {});
        await dynamicDb.createCollection('genAISettings').catch(() => {});

        // If bots were specified, seed them
        if (initialBots.length > 0) {
          for (const botId of initialBots) {
            const botDoc = {
              botId,
              botName: `${finalName} Assistant`,
              code: botId,
              name: `${finalName} Assistant`,
              description: `Primary conversational AI assistant for ${finalName}.`,
              model: 'gpt-4-turbo',
              temperature: 0.7,
              systemPrompt: `You are ${finalName} Assistant, a helpful AI assistant for ${finalName}.`,
              status: 'active',
              botActive: true,
              chatApiUrl: '',
              greetingMessage: [`Hi! I’m ${finalName} Assistant. How can I assist you today?`],
              quickReplies: ['What can you do?', 'Customer Support', 'Contact Live Agent', 'End Session'],
              customForms: DEFAULT_CUSTOM_FORMS,
              botUIConfigs: {
                ...DEFAULT_BOT_UI_CONFIGS,
                botHeaderText: `${finalName} AI`,
                botThemeColor: mergedTenantConfig.ButtonandLeftBarColor || '#00306D',
                bgColor: '#ffffff'
              },
              updatedSince: new Date(),
              createdAt: new Date()
            };
            await dynamicDb.collection('chatClientSettings').insertOne(botDoc).catch(() => {});
            await dynamicDb.collection('chatClients').insertOne(botDoc).catch(() => {});
          }
        }

        // Initialize genAISettings in tenant database
        const existingGenAI = await dynamicDb.collection('genAISettings').findOne({});
        if (!existingGenAI) {
          await dynamicDb.collection('genAISettings').insertOne({
            tenantFullName: finalName,
            textGenerationModel: 'us.meta.llama3-3-70b-instruct-v1:0',
            embeddingsGenerationModel: 'amazon.titan-embed-text-v2:0',
            embeddingsModelDimentions: 1024,
            chunkSize: 3000,
            chunkOverlapSize: 1000,
            maxTokens: 300,
            fallbackTexts: ['I don\'t understand', 'I cannot answer', 'try rephrasing'],
            defaultFallbackAnswer: `<p class="msgcontent">I'm sorry; I don't understand your question. Can you try rephrasing it?</p>`,
            queryRewritePrompt: "You are an expert at rewriting questions for an enterprise chatbot.\n\nRules:\n- Return ONLY a valid JSON object matching this schema: {\"standaloneQuestions\": [...], \"error\": null}\n- If smalltalk, output {\"error\": \"smalltalk\"}\n- Output must be only raw minified JSON.",
            createdAt: new Date()
          });
          logger.info(`Initialized "${finalDbName}.genAISettings" collection`);
        }
      } catch (dbErr) {
        logger.error(`Warning: could not fully initialize tenant db collections for "${finalDbName}": ${dbErr.message}`);
      }

      return res.status(201).json(created);
    } catch (err) {
      logger.error(`Error creating tenant in master.tenantInfo: ${err.message}`);
      next(err);
    }
  }

  /**
   * PUT /api/admin/tenants/:id
   * Update tenant document in master > tenantInfo
   */
  async updateTenant(req, res, next) {
    try {
      const { id } = req.params;
      const { name, tenantName, code, tenantId, tenantDbName, tenantActive, tenantConfig, Bots } = req.body;

      const col = this.getTenantInfoCollection();
      let filter = {};
      if (mongoose.Types.ObjectId.isValid(id)) {
        filter = { _id: new mongoose.Types.ObjectId(id) };
      } else {
        filter = { tenantId: id };
      }

      const existingTenant = await col.findOne(filter);
      if (!existingTenant) {
        return res.status(404).json({ error: 'Tenant document not found in master.tenantInfo' });
      }

      const updateFields = { updatedAt: new Date() };
      if (tenantName || name) {
        updateFields.tenantName = (tenantName || name).trim();
      }
      if (tenantId || code) {
        updateFields.tenantId = (tenantId || code).toLowerCase().trim();
      }
      if (tenantDbName) {
        updateFields.tenantDbName = tenantDbName.trim();
      }
      if (tenantActive !== undefined) {
        updateFields.tenantActive = Boolean(tenantActive);
      }
      if (Array.isArray(Bots)) {
        updateFields.Bots = Bots;
      }
      if (tenantConfig && typeof tenantConfig === 'object') {
        updateFields.tenantConfig = {
          ...(existingTenant.tenantConfig || {}),
          ...tenantConfig
        };
      }

      const result = await col.findOneAndUpdate(
        filter,
        { $set: updateFields },
        { returnDocument: 'after' }
      );

      const updated = result.value || result || { ...existingTenant, ...updateFields };

      // Ensure collections exist in the tenant database
      const targetDbName = updated.tenantDbName || (updated.tenantId ? `iso_${updated.tenantId}` : 'iso_default');
      try {
        const dynamicDb = mongoose.connection.useDb(targetDbName, { useCache: true });
        const collections = await dynamicDb.db.listCollections().toArray();
        const colNames = collections.map(c => c.name);

        if (!colNames.includes('chatClientSettings')) {
          await dynamicDb.createCollection('chatClientSettings').catch(() => {});
        }
        if (!colNames.includes('chatClients')) {
          await dynamicDb.createCollection('chatClients').catch(() => {});
        }
        if (!colNames.includes('genAISettings')) {
          await dynamicDb.createCollection('genAISettings').catch(() => {});
        }
      } catch (dbErr) {
        logger.error(`Warning checking collections in "${targetDbName}": ${dbErr.message}`);
      }

      const normalized = {
        _id: updated._id.toString(),
        ...updated,
        name: updated.tenantName || updated.name,
        code: updated.tenantId || updated.code
      };

      logger.info(`Updated tenant "${normalized.name}" in master.tenantInfo`);
      return res.json(normalized);
    } catch (err) {
      logger.error(`Error updating tenant in master.tenantInfo: ${err.message}`);
      next(err);
    }
  }

  /**
   * DELETE /api/admin/tenants/:id
   * Delete tenant document from master > tenantInfo
   */
  async deleteTenant(req, res, next) {
    try {
      const { id } = req.params;
      const col = this.getTenantInfoCollection();

      let filter = {};
      if (mongoose.Types.ObjectId.isValid(id)) {
        filter = { _id: new mongoose.Types.ObjectId(id) };
      } else {
        filter = { tenantId: id };
      }

      const tenantToDelete = await col.findOne(filter);
      if (!tenantToDelete) {
        return res.status(404).json({ error: 'Tenant document not found.' });
      }

      await col.deleteOne(filter);
      logger.info(`Deleted tenant "${tenantToDelete.tenantName || tenantToDelete.tenantId}" from master.tenantInfo`);
      return res.json({ message: `Tenant "${tenantToDelete.tenantName || tenantToDelete.tenantId}" deleted successfully.` });
    } catch (err) {
      logger.error(`Error deleting tenant: ${err.message}`);
      next(err);
    }
  }

  // ==========================================
  // BOTS API (Dynamic tenantDbName > chatClients / chatClientSettings)
  // ==========================================

  /**
   * GET /api/admin/bots
   * Fetch all chatbots/chatClients for the tenant's dynamic database (tenantDbName)
   */
  async getBots(req, res, next) {
    try {
      const tenantId = req.query.tenantId || req.query.tenantDbName || req.query.tenantCode || req.query.code;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId or tenantDbName query parameter is required.' });
      }

      const resolved = await this.resolveTenantDb(tenantId);
      if (!resolved || !resolved.db) {
        return res.json([]);
      }

      const { db, dbName, tenantDoc } = resolved;
      logger.info(`Querying tenant database "${dbName}" for chatClients & chatClientSettings...`);

      // Query both 'chatClients' and 'chatClientSettings'
      const [chatClients, chatSettings] = await Promise.all([
        db.collection('chatClients').find({}).toArray().catch(() => []),
        db.collection('chatClientSettings').find({}).toArray().catch(() => [])
      ]);

      // Combine unique bot documents by botId / _id
      const combinedMap = new Map();

      [...chatClients, ...chatSettings].forEach(doc => {
        const idKey = (doc.botId || doc._id || '').toString();
        if (!combinedMap.has(idKey)) {
          combinedMap.set(idKey, doc);
        }
      });

      const rawBots = Array.from(combinedMap.values());

      // Normalize bot documents for the Admin UI
      const bots = rawBots.map(b => {
        const botCode = b.botId || b.code || (b._id ? b._id.toString() : 'bot');
        const botName = b.botName || b.name || b.botId || 'Chatbot Instance';
        const isActive = b.botActive !== undefined ? b.botActive : (b.status === 'active' || b.status !== 'inactive');

        return {
          _id: (b._id ? b._id.toString() : botCode),
          tenantId: tenantDoc?._id ? tenantDoc._id.toString() : tenantId,
          tenantDbName: dbName,
          name: botName,
          botName: botName,
          code: botCode,
          botId: botCode,
          description: b.description || '',
          model: b.model || 'gpt-4-turbo',
          temperature: b.temperature !== undefined ? b.temperature : 0.7,
          systemPrompt: b.systemPrompt || '',
          status: isActive ? 'active' : 'inactive',
          botActive: isActive,
          chatApiUrl: b.chatApiUrl || b.apiEndpoint || '',
          greetingMessage: Array.isArray(b.greetingMessage) ? b.greetingMessage : (b.greetingMessage ? [b.greetingMessage] : DEFAULT_GREETING_MESSAGE),
          quickReplies: b.quickReplies || ['What can you do?', 'Technology Support', 'Transfer to Live Agent', 'End Chat Session'],
          customForms: b.customForms || DEFAULT_CUSTOM_FORMS,
          botUIConfigs: {
            ...DEFAULT_BOT_UI_CONFIGS,
            botHeaderText: botName,
            ...(b.botUIConfigs || {})
          },
          ingestionSources: b.ingestionSources || [],
          updatedSince: b.updatedSince || b.updatedAt || new Date()
        };
      });

      logger.info(`Found ${bots.length} bot documents in tenant DB "${dbName}"`);
      return res.json(bots);
    } catch (err) {
      logger.error(`Error fetching bots for tenant: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/admin/bots/:id
   * Fetch single bot configuration from tenant DB
   */
  async getBotById(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.query.tenantId || req.query.tenantDbName;

      let resolved = null;
      if (tenantId) {
        resolved = await this.resolveTenantDb(tenantId);
      }

      let doc = null;
      let targetDbName = resolved?.dbName;

      if (resolved?.db) {
        doc = await resolved.db.collection('chatClientSettings').findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : []),
            { botId: id },
            { code: id }
          ]
        }) || await resolved.db.collection('chatClients').findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : []),
            { botId: id },
            { code: id }
          ]
        });
      }

      if (!doc) {
        return res.status(404).json({ error: `Bot "${id}" not found in tenant database.` });
      }

      const botName = doc.botName || doc.name || doc.botId || id;
      const botCode = doc.botId || doc.code || id;

      return res.json({
        _id: doc._id.toString(),
        tenantId: tenantId || targetDbName,
        tenantDbName: targetDbName,
        name: botName,
        botName: botName,
        code: botCode,
        botId: botCode,
        description: doc.description || '',
        model: doc.model || 'gpt-4-turbo',
        temperature: doc.temperature !== undefined ? doc.temperature : 0.7,
        systemPrompt: doc.systemPrompt || '',
        status: doc.botActive !== false ? 'active' : 'inactive',
        botActive: doc.botActive !== false,
        chatApiUrl: doc.chatApiUrl || doc.apiEndpoint || '',
        greetingMessage: doc.greetingMessage || DEFAULT_GREETING_MESSAGE,
        quickReplies: doc.quickReplies || [],
        customForms: doc.customForms || DEFAULT_CUSTOM_FORMS,
        botUIConfigs: {
          ...DEFAULT_BOT_UI_CONFIGS,
          botHeaderText: botName,
          ...(doc.botUIConfigs || {})
        },
        updatedSince: doc.updatedSince || new Date()
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/bots
   * Add a new chatbot document into dynamic tenant DB (chatClients & chatClientSettings)
   */
  async createBot(req, res, next) {
    try {
      const tenantId = req.query.tenantId || req.body.tenantId || req.query.tenantDbName;
      const { 
        name, code, description, model, temperature, 
        systemPrompt, status, botActive, botUIConfigs, 
        greetingMessage, quickReplies, customForms, chatApiUrl 
      } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required.' });
      }
      if (!name || !code) {
        return res.status(400).json({ error: 'Bot Name and Code/Slug are required.' });
      }

      const resolved = await this.resolveTenantDb(tenantId);
      if (!resolved || !resolved.db) {
        return res.status(404).json({ error: 'Tenant database could not be resolved.' });
      }

      const { db, dbName, tenantDoc } = resolved;
      const botCode = code.trim();
      const botName = name.trim();

      const newBotDoc = {
        botId: botCode,
        botName: botName,
        code: botCode,
        name: botName,
        description: description || '',
        model: model || 'gpt-4-turbo',
        temperature: temperature !== undefined ? temperature : 0.7,
        systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
        botActive: botActive !== undefined ? botActive : (status === 'active'),
        status: (botActive !== false && status !== 'inactive') ? 'active' : 'inactive',
        chatApiUrl: chatApiUrl || '',
        greetingMessage: greetingMessage || [`Hi! I’m ${botName}. How can I assist you today?`],
        quickReplies: quickReplies || ['What can you do?', 'Technology Support', 'Transfer to Live Agent', 'End Chat Session'],
        customForms: customForms || DEFAULT_CUSTOM_FORMS,
        botUIConfigs: {
          ...DEFAULT_BOT_UI_CONFIGS,
          botHeaderText: botName,
          ...(botUIConfigs || {})
        },
        updatedSince: new Date(),
        createdAt: new Date()
      };

      // Save into both chatClientSettings and chatClients in tenant DB
      const result = await db.collection('chatClientSettings').insertOne(newBotDoc);
      await db.collection('chatClients').insertOne({ ...newBotDoc, _id: result.insertedId }).catch(() => {});

      // Append botId to master.tenantInfo.Bots array
      if (tenantDoc) {
        await this.getTenantInfoCollection().updateOne(
          { _id: tenantDoc._id },
          { $addToSet: { Bots: botCode } }
        ).catch(() => {});
      }

      logger.info(`Provisioned new bot "${botName}" in tenant DB "${dbName}"`);
      return res.status(201).json({ _id: result.insertedId.toString(), ...newBotDoc });
    } catch (err) {
      logger.error(`Error creating bot in tenant DB: ${err.message}`);
      next(err);
    }
  }

  /**
   * PUT /api/admin/bots/:id
   * Update chatbot document in dynamic tenant DB (chatClients & chatClientSettings)
   */
  async updateBot(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.query.tenantId || req.body.tenantId || req.query.tenantDbName;
      const updateData = { ...req.body };
      delete updateData._id;

      let resolved = null;
      if (tenantId) {
        resolved = await this.resolveTenantDb(tenantId);
      }

      // If tenantId not provided, search across databases
      if (!resolved || !resolved.db) {
        const col = this.getTenantInfoCollection();
        const allTenants = await col.find({}).toArray();
        for (const t of allTenants) {
          const tDb = mongoose.connection.useDb(t.tenantDbName || `iso_${t.tenantId}`);
          const found = await tDb.collection('chatClientSettings').findOne({
            $or: [
              ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : []),
              { botId: id }
            ]
          });
          if (found) {
            resolved = { db: tDb, dbName: t.tenantDbName || `iso_${t.tenantId}`, tenantDoc: t };
            break;
          }
        }
      }

      if (!resolved || !resolved.db) {
        return res.status(404).json({ error: 'Bot document not found in tenant database.' });
      }

      const { db, dbName } = resolved;
      updateData.updatedSince = new Date();

      if (updateData.name) updateData.botName = updateData.name;
      if (updateData.botName) updateData.name = updateData.botName;
      if (updateData.code) updateData.botId = updateData.code;
      if (updateData.botId) updateData.code = updateData.botId;
      if (updateData.status) updateData.botActive = updateData.status === 'active';
      if (updateData.botActive !== undefined) updateData.status = updateData.botActive ? 'active' : 'inactive';

      let filter = {};
      if (mongoose.Types.ObjectId.isValid(id)) {
        filter = { _id: new mongoose.Types.ObjectId(id) };
      } else {
        filter = { $or: [{ botId: id }, { code: id }] };
      }

      const result = await db.collection('chatClientSettings').findOneAndUpdate(
        filter,
        { $set: updateData },
        { returnDocument: 'after' }
      );

      // Mirror update in chatClients
      await db.collection('chatClients').updateOne(filter, { $set: updateData }).catch(() => {});

      const updated = result.value || result || updateData;
      logger.info(`Updated bot "${id}" in tenant DB "${dbName}"`);
      return res.json(updated);
    } catch (err) {
      logger.error(`Error updating bot: ${err.message}`);
      next(err);
    }
  }

  /**
   * DELETE /api/admin/bots/:id
   * Delete chatbot document from dynamic tenant DB
   */
  async deleteBot(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.query.tenantId || req.query.tenantDbName;

      let resolved = null;
      if (tenantId) {
        resolved = await this.resolveTenantDb(tenantId);
      }

      if (!resolved || !resolved.db) {
        const col = this.getTenantInfoCollection();
        const allTenants = await col.find({}).toArray();
        for (const t of allTenants) {
          const tDb = mongoose.connection.useDb(t.tenantDbName || `iso_${t.tenantId}`);
          const found = await tDb.collection('chatClientSettings').findOne({
            $or: [
              ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : []),
              { botId: id }
            ]
          });
          if (found) {
            resolved = { db: tDb, dbName: t.tenantDbName || `iso_${t.tenantId}`, tenantDoc: t };
            break;
          }
        }
      }

      if (!resolved || !resolved.db) {
        return res.status(404).json({ error: 'Bot not found.' });
      }

      const { db, dbName, tenantDoc } = resolved;
      let filter = {};
      if (mongoose.Types.ObjectId.isValid(id)) {
        filter = { _id: new mongoose.Types.ObjectId(id) };
      } else {
        filter = { $or: [{ botId: id }, { code: id }] };
      }

      const botToDelete = await db.collection('chatClientSettings').findOne(filter);
      await db.collection('chatClientSettings').deleteOne(filter);
      await db.collection('chatClients').deleteOne(filter).catch(() => {});

      if (tenantDoc && botToDelete) {
        const botCode = botToDelete.botId || botToDelete.code || id;
        await this.getTenantInfoCollection().updateOne(
          { _id: tenantDoc._id },
          { $pull: { Bots: botCode } }
        ).catch(() => {});
      }

      logger.info(`Deleted bot "${id}" from tenant DB "${dbName}"`);
      return res.json({ message: 'Bot deleted successfully.' });
    } catch (err) {
      logger.error(`Error deleting bot: ${err.message}`);
      next(err);
    }
  }

  /**
   * GET /api/admin/genai-settings
   * Fetch Gen AI settings from tenant database > genAISettings collection
   */
  async getGenAISettings(req, res, next) {
    try {
      const { tenantId, tenantDbName, botId } = req.query;
      const targetDb = tenantDbName || (tenantId ? `iso_${tenantId}` : 'iso_default');
      const dynamicDb = mongoose.connection.useDb(targetDb, { useCache: true });
      const col = dynamicDb.collection('genAISettings');
      
      let filter = {};
      if (botId) {
        filter = { botId };
      }
      let settings = await col.findOne(filter);
      if (!settings && botId) {
        // Fallback to first if not yet created for this specific botId
        settings = await col.findOne({});
      }

      if (!settings) {
        settings = {
          botId: botId || 'ISOBot',
          tenantFullName: '',
          genAiEnabled: true,
          intentEnabled: ['transfer_call', 'smalltalk.greetings.bye'],
          chatBotFlag: true,
          conversationHistoryLimit: 5,
          includeConversationHistoryInAnswerGeneration: true,
          includeConversationHistoryInQueryRewriter: true,
          textGenerationModel: 'us.meta.llama3-3-70b-instruct-v1:0',
          embeddingsGenerationModel: 'amazon.titan-embed-text-v2:0',
          embeddingsModelDimentions: 1024,
          chunkSize: 3000,
          chunkOverlapSize: 1000,
          maxTokens: 300,
          fallbackTexts: ["I don't understand", "I cannot answer", "try rephrasing", "no information available"],
          defaultFallbackAnswer: "<p class=\"msgcontent\">I'm sorry; I don't understand your question. Can you try rephrasing it?</p>",
          queryRewritePrompt: "You are an expert at rewriting questions for an enterprise chatbot.\n\nRules:\n- Return ONLY a valid JSON object matching this schema: {\"standaloneQuestions\": [...], \"error\": null}\n- If smalltalk, output {\"error\": \"smalltalk\"}\n- Output must be only raw minified JSON.",
          systemPrompt: "You are a helpful and polite AI assistant.",
          answerGenerationPrompt: "<context>\n$$context\n</context>\n\nUsers Original Question: $$userQuery\n\nAnswer:",
          improvedQueryRewriter: true,
          improvedQueryRewriterPrompt: "You are a query planning assistant for a Retrieval Augmented Generation system."
        };
      } else {
        settings._id = settings._id.toString();
      }

      return res.json(settings);
    } catch (err) {
      logger.error(`Error fetching genAISettings: ${err.message}`);
      next(err);
    }
  }

  /**
   * PUT /api/admin/genai-settings
   * Update Gen AI settings in tenant database > genAISettings collection
   */
  async updateGenAISettings(req, res, next) {
    try {
      const { tenantId, tenantDbName, botId } = req.query;
      const targetDb = tenantDbName || (tenantId ? `iso_${tenantId}` : 'iso_default');
      const dynamicDb = mongoose.connection.useDb(targetDb, { useCache: true });
      const col = dynamicDb.collection('genAISettings');

      const updateData = { ...req.body };
      delete updateData._id;
      if (botId && !updateData.botId) {
        updateData.botId = botId;
      }
      updateData.updatedAt = new Date();

      let filter = {};
      if (botId) {
        filter = { botId };
      } else if (updateData.botId) {
        filter = { botId: updateData.botId };
      }

      const existing = await col.findOne(filter);
      if (existing) {
        await col.updateOne({ _id: existing._id }, { $set: updateData });
        const updated = await col.findOne({ _id: existing._id });
        updated._id = updated._id.toString();
        return res.json(updated);
      } else {
        updateData.createdAt = new Date();
        const result = await col.insertOne(updateData);
        return res.json({ _id: result.insertedId.toString(), ...updateData });
      }
    } catch (err) {
      logger.error(`Error updating genAISettings: ${err.message}`);
      next(err);
    }
  }

  // =========================================================================
  // MENUS CRUD (master > menus)
  // =========================================================================

  async getMenus(req, res, next) {
    try {
      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      const menus = await masterDb.collection('menus').find({}).sort({ sortOrder: 1 }).toArray();
      const mapped = menus.map(m => ({ ...m, _id: m._id.toString() }));
      return res.json(mapped);
    } catch (err) {
      logger.error(`Error fetching menus: ${err.message}`);
      next(err);
    }
  }

  async createMenu(req, res, next) {
    try {
      const { menuId, label, icon, path, sortOrder, active, description } = req.body;
      if (!menuId || !label) {
        return res.status(400).json({ error: 'Menu ID and Label are required.' });
      }

      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      const existing = await masterDb.collection('menus').findOne({ menuId: menuId.trim() });
      if (existing) {
        return res.status(409).json({ error: `Menu with ID "${menuId}" already exists.` });
      }

      const newMenu = {
        menuId: menuId.trim(),
        label: label.trim(),
        icon: icon || 'Building2',
        path: path || menuId.trim(),
        sortOrder: Number(sortOrder) || 1,
        active: active !== false,
        description: description || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await masterDb.collection('menus').insertOne(newMenu);
      return res.status(201).json({ _id: result.insertedId.toString(), ...newMenu });
    } catch (err) {
      logger.error(`Error creating menu: ${err.message}`);
      next(err);
    }
  }

  async updateMenu(req, res, next) {
    try {
      const { id } = req.params;
      const { label, icon, path, sortOrder, active, description, menuId } = req.body;

      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      let query = {};
      try {
        query = { _id: new mongoose.Types.ObjectId(id) };
      } catch (e) {
        query = { menuId: id };
      }

      const updateFields = {
        updatedAt: new Date()
      };
      if (label !== undefined) updateFields.label = label;
      if (icon !== undefined) updateFields.icon = icon;
      if (path !== undefined) updateFields.path = path;
      if (sortOrder !== undefined) updateFields.sortOrder = Number(sortOrder);
      if (active !== undefined) updateFields.active = Boolean(active);
      if (description !== undefined) updateFields.description = description;
      if (menuId !== undefined) updateFields.menuId = menuId.trim();

      await masterDb.collection('menus').updateOne(query, { $set: updateFields });
      const updated = await masterDb.collection('menus').findOne(query);
      if (!updated) return res.status(404).json({ error: 'Menu not found.' });

      updated._id = updated._id.toString();
      return res.json(updated);
    } catch (err) {
      logger.error(`Error updating menu: ${err.message}`);
      next(err);
    }
  }

  async deleteMenu(req, res, next) {
    try {
      const { id } = req.params;
      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      let query = {};
      try {
        query = { _id: new mongoose.Types.ObjectId(id) };
      } catch (e) {
        query = { menuId: id };
      }

      const result = await masterDb.collection('menus').deleteOne(query);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Menu not found.' });
      }
      return res.json({ success: true, message: 'Menu deleted.' });
    } catch (err) {
      logger.error(`Error deleting menu: ${err.message}`);
      next(err);
    }
  }

  // =========================================================================
  // ROLES CRUD (master > roles)
  // =========================================================================

  async getRoles(req, res, next) {
    try {
      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      const roles = await masterDb.collection('roles').find({}).toArray();
      const mapped = roles.map(r => ({ ...r, _id: r._id.toString() }));
      return res.json(mapped);
    } catch (err) {
      logger.error(`Error fetching roles: ${err.message}`);
      next(err);
    }
  }

  async createRole(req, res, next) {
    try {
      const { roleId, roleName, description, allowedMenus, isSystemRole } = req.body;
      if (!roleId || !roleName) {
        return res.status(400).json({ error: 'Role ID and Role Name are required.' });
      }

      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      const existing = await masterDb.collection('roles').findOne({ roleId: roleId.trim() });
      if (existing) {
        return res.status(409).json({ error: `Role with ID "${roleId}" already exists.` });
      }

      const newRole = {
        roleId: roleId.trim(),
        roleName: roleName.trim(),
        description: description || '',
        allowedMenus: Array.isArray(allowedMenus) ? allowedMenus : [],
        isSystemRole: Boolean(isSystemRole),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await masterDb.collection('roles').insertOne(newRole);
      return res.status(201).json({ _id: result.insertedId.toString(), ...newRole });
    } catch (err) {
      logger.error(`Error creating role: ${err.message}`);
      next(err);
    }
  }

  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const { roleName, description, allowedMenus } = req.body;

      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      let query = {};
      try {
        query = { _id: new mongoose.Types.ObjectId(id) };
      } catch (e) {
        query = { roleId: id };
      }

      const updateFields = {
        updatedAt: new Date()
      };
      if (roleName !== undefined) updateFields.roleName = roleName.trim();
      if (description !== undefined) updateFields.description = description;
      if (allowedMenus !== undefined && Array.isArray(allowedMenus)) updateFields.allowedMenus = allowedMenus;

      await masterDb.collection('roles').updateOne(query, { $set: updateFields });
      const updated = await masterDb.collection('roles').findOne(query);
      if (!updated) return res.status(404).json({ error: 'Role not found.' });

      updated._id = updated._id.toString();
      return res.json(updated);
    } catch (err) {
      logger.error(`Error updating role: ${err.message}`);
      next(err);
    }
  }

  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      const masterDb = mongoose.connection.useDb('master', { useCache: true });
      let query = {};
      try {
        query = { _id: new mongoose.Types.ObjectId(id) };
      } catch (e) {
        query = { roleId: id };
      }

      const targetRole = await masterDb.collection('roles').findOne(query);
      if (targetRole && targetRole.isSystemRole) {
        return res.status(403).json({ error: 'Cannot delete a built-in system role.' });
      }

      const result = await masterDb.collection('roles').deleteOne(query);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Role not found.' });
      }
      return res.json({ success: true, message: 'Role deleted.' });
    } catch (err) {
      logger.error(`Error deleting role: ${err.message}`);
      next(err);
    }
  }

  // =========================================================================
  // TENANT USERS CRUD (tenantDb > users)
  // =========================================================================

  async getTenantUsers(req, res, next) {
    try {
      const { tenantId, tenantDbName } = req.query;
      const targetDb = tenantDbName || (tenantId ? `iso_${tenantId}` : 'iso_default');
      const dynamicDb = mongoose.connection.useDb(targetDb, { useCache: true });
      const users = await dynamicDb.collection('users').find({}, { projection: { password: 0 } }).toArray();
      const mapped = users.map(u => ({ ...u, _id: u._id.toString() }));
      return res.json(mapped);
    } catch (err) {
      logger.error(`Error fetching tenant users: ${err.message}`);
      next(err);
    }
  }

  async createTenantUser(req, res, next) {
    try {
      const { tenantId, tenantDbName } = req.query;
      const { username, password, role, fullName, email, status } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      const targetDb = tenantDbName || (tenantId ? `iso_${tenantId}` : 'iso_default');
      const dynamicDb = mongoose.connection.useDb(targetDb, { useCache: true });
      const col = dynamicDb.collection('users');

      const existing = await col.findOne({ username: username.trim() });
      if (existing) {
        return res.status(409).json({ error: `User "${username}" already exists in this tenant.` });
      }

      // Hash password securely with bcrypt
      const hashedPassword = bcrypt.hashSync(password.trim(), 10);

      const newUser = {
        username: username.trim(),
        password: hashedPassword,
        role: role || 'tenant_admin',
        fullName: fullName || username.trim(),
        email: email || `${username.trim()}@${tenantId || 'tenant'}.com`,
        status: status || 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await col.insertOne(newUser);
      
      // Never send password back in payload
      const responseUser = { ...newUser, _id: result.insertedId.toString() };
      delete responseUser.password;

      return res.status(201).json(responseUser);
    } catch (err) {
      logger.error(`Error creating tenant user: ${err.message}`);
      next(err);
    }
  }

  async updateTenantUser(req, res, next) {
    try {
      const { id } = req.params;
      const { tenantId, tenantDbName } = req.query;
      const { password, role, fullName, email, status } = req.body;

      const targetDb = tenantDbName || (tenantId ? `iso_${tenantId}` : 'iso_default');
      const dynamicDb = mongoose.connection.useDb(targetDb, { useCache: true });
      const col = dynamicDb.collection('users');

      let query = {};
      try {
        query = { _id: new mongoose.Types.ObjectId(id) };
      } catch (e) {
        query = { username: id };
      }

      const updateFields = { updatedAt: new Date() };
      if (password && password.trim()) {
        updateFields.password = bcrypt.hashSync(password.trim(), 10);
      }
      if (role !== undefined) updateFields.role = role;
      if (fullName !== undefined) updateFields.fullName = fullName;
      if (email !== undefined) updateFields.email = email;
      if (status !== undefined) updateFields.status = status;

      await col.updateOne(query, { $set: updateFields });
      const updated = await col.findOne(query, { projection: { password: 0 } });
      if (!updated) return res.status(404).json({ error: 'User not found in tenant database.' });

      updated._id = updated._id.toString();
      return res.json(updated);
    } catch (err) {
      logger.error(`Error updating tenant user: ${err.message}`);
      next(err);
    }
  }

  async deleteTenantUser(req, res, next) {
    try {
      const { id } = req.params;
      const { tenantId, tenantDbName } = req.query;

      const targetDb = tenantDbName || (tenantId ? `iso_${tenantId}` : 'iso_default');
      const dynamicDb = mongoose.connection.useDb(targetDb, { useCache: true });
      const col = dynamicDb.collection('users');

      let query = {};
      try {
        query = { _id: new mongoose.Types.ObjectId(id) };
      } catch (e) {
        query = { username: id };
      }

      const result = await col.deleteOne(query);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }
      return res.json({ success: true, message: 'User deleted.' });
    } catch (err) {
      logger.error(`Error deleting tenant user: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new AdminController();

