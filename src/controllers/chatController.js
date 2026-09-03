const botService = require('../services/botService');
const aiService = require('../services/aiService');
const conversationService = require('../services/conversationService');
const analyticsService = require('../services/analyticsService');
const ApiResponse = require('../helpers/apiResponse');
const logger = require('../helpers/logger');

class ChatController {
  /**
   * POST /api/chat
   * Primary chat query endpoint for chatbot.js widget
   */
  async handleChat(req, res, next) {
    try {
      const {
        query,
        message,
        botId = 'ISOBot',
        tenantId = '',
        history = [],
        sessionId
      } = req.body;

      const userText = query || message;
      if (!userText || typeof userText !== 'string' || !userText.trim()) {
        return ApiResponse.badRequest(res, 'Message text is required in query or message field');
      }

      // 1. Resolve Bot from dynamic tenant DB
      const bot = await botService.findBotDocument(botId, tenantId);

      // Check if bot is disabled
      if (bot && bot.status === 'inactive') {
        const botName = bot.name || 'ISO AI';
        return res.json({
          response: `The bot "${botName}" is currently offline or inactive. Please contact support.`,
          reply: `The bot "${botName}" is currently offline or inactive. Please contact support.`,
          message: `The bot "${botName}" is currently offline or inactive. Please contact support.`,
          botName,
          timestamp: new Date().toISOString()
        });
      }

      // 2. Generate Response
      const result = await aiService.generateResponse({
        bot,
        query: userText.trim(),
        history,
        tenantId
      });

      const botName = bot?.name || 'ISO AI Assistant';

      // 3. Persist Exchange in Background
      const resolvedSessionId = sessionId || `session_${Date.now()}`;
      const resolvedBotId = (bot && (bot.botId || bot.code || bot._id?.toString())) || botId || 'ISOBot';
      const resolvedTenantId = tenantId || (bot && (bot.tenantId || bot.tenantName)) || 'default';

      conversationService.recordExchange({
        sessionId: resolvedSessionId,
        botId: resolvedBotId,
        tenantId: resolvedTenantId,
        userQuery: userText.trim(),
        botResponse: result.text,
        metadata: {
          model: result.model,
          tokens: result.tokens,
          latencyMs: result.latencyMs
        },
        clientInfo: {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          referer: req.get('referer')
        }
      }).catch(e => logger.error('Async conversation log error:', e));

      // 4. Record Analytics in Background
      analyticsService.recordQuery({
        botId: resolvedBotId,
        promptTokens: result.tokens?.prompt || 0,
        completionTokens: result.tokens?.completion || 0,
        latencyMs: result.latencyMs,
        query: userText.trim()
      }).catch(e => logger.error('Async analytics log error:', e));

      // 5. Return chatbot.js compatible response payload
      // chatbot.js looks for data.response || data.reply || data.message || data.answer
      return res.json({
        response: result.text,
        reply: result.text,
        message: result.text,
        botName,
        form: result.form || null,
        quickReplies: result.quickReplies || bot?.quickReplies || [],
        sessionId: resolvedSessionId,
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/chat/stream
   * Server-Sent Events (SSE) streaming chat endpoint
   */
  async streamChat(req, res, next) {
    try {
      const { query, message, botId = 'ISOBot', tenantId = '', history = [] } = req.body;
      const userText = query || message;
      if (!userText) {
        return ApiResponse.badRequest(res, 'Message text is required');
      }

      // Setup SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const bot = await botService.findBotDocument(botId, tenantId);
      const result = await aiService.generateResponse({
        bot,
        query: userText.trim(),
        history,
        tenantId
      });

      // Stream words with small delays to simulate realistic typing
      const words = result.text.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = (i === 0 ? '' : ' ') + words[i];
        res.write(`data: ${JSON.stringify({ chunk, done: false })}\n\n`);
        // Small interval
        await new Promise(r => setTimeout(r, 25));
      }

      // Finish event
      res.write(`data: ${JSON.stringify({ done: true, fullText: result.text, form: result.form })}\n\n`);
      res.end();
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ChatController();
