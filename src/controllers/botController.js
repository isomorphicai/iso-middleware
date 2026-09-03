const botService = require('../services/botService');
const ApiResponse = require('../helpers/apiResponse');
const logger = require('../helpers/logger');

class BotController {
  /**
   * GET /api/bot-config
   * Direct integration with chatbot.js config fetch
   * Query params: ?botId=...&tenantId=...
   */
  async getBotConfig(req, res, next) {
    try {
      const botId = req.query.botId || req.params.botId || 'ISOBot';
      const tenantId = req.query.tenantId || req.query.tenant || req.query.tenantName || req.query.teanantId || null;

      logger.info(`Fetching widget config for botId='${botId}', tenant='${tenantId}'`);
      const widgetConfig = await botService.getWidgetConfig(botId, tenantId);

      // chatbot.js expects the direct JSON object with botUIConfigs, botId, greetingMessage, etc.
      return res.json(widgetConfig);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/bots
   * List all bots for tenant
   */
  async getBots(req, res, next) {
    try {
      const tenantId = req.query.tenantId || req.query.tenant || req.query.tenantName || 'default';
      const bots = await botService.getBots(tenantId);
      return ApiResponse.success(res, bots, 'Bots retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/bots/:id
   * Get single bot details
   */
  async getBotById(req, res, next) {
    try {
      const bot = await botService.getBotById(req.params.id);
      if (!bot) {
        return ApiResponse.notFound(res, 'Bot not found');
      }
      return ApiResponse.success(res, bot);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/bots
   * Create a new bot
   */
  async createBot(req, res, next) {
    try {
      const { tenantId, name, code, description, model, temperature, systemPrompt, botUIConfigs } = req.body;
      if (!name || !code) {
        return ApiResponse.badRequest(res, 'Bot name and code are required');
      }

      const bot = await botService.createBot({
        tenantId,
        name,
        code: code.toLowerCase(),
        description,
        model,
        temperature,
        systemPrompt,
        botUIConfigs
      });

      return ApiResponse.created(res, bot, 'Bot created successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/bots/:id
   * Update bot configuration
   */
  async updateBot(req, res, next) {
    try {
      const bot = await botService.updateBot(req.params.id, req.body);
      if (!bot) {
        return ApiResponse.notFound(res, 'Bot not found');
      }
      return ApiResponse.success(res, bot, 'Bot updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/bots/:id
   * Delete bot
   */
  async deleteBot(req, res, next) {
    try {
      const bot = await botService.deleteBot(req.params.id);
      if (!bot) {
        return ApiResponse.notFound(res, 'Bot not found');
      }
      return ApiResponse.success(res, null, 'Bot deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BotController();
