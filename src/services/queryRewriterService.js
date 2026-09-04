const llmService = require('./llmService');
const genAISettingsService = require('./genAISettingsService');
const logger = require('../helpers/logger');

class QueryRewriterService {
  /**
   * Rewrites and expands a user query into multiple search angles for vector search
   */
  async rewriteAndExpandQuery({ query, history = [], bot = {}, genAISettings = null, tenantId = '', botId = '' }) {
    if (!query || typeof query !== 'string') {
      return [query];
    }

    const cleanQuery = query.trim();
    const fallbackQueries = [
      cleanQuery,
      cleanQuery.replace(/[?\.!]+/g, '').trim()
    ];

    try {
      // 1. Resolve genAISettings from tenant database if not passed
      let settings = genAISettings;
      if (!settings) {
        settings = await genAISettingsService.getSettings({
          tenantId: tenantId || bot?.tenantId,
          botId: botId || bot?.botId || bot?.code
        });
      }

      // If rewriter is explicitly disabled in genAISettings, return fallback
      if (settings?.improvedQueryRewriter === false || settings?.genAiEnabled === false) {
        return fallbackQueries;
      }

      // 2. Format history context based on settings
      let historyContext = 'None';
      const includeHistory = settings?.includeConversationHistoryInQueryRewriter !== false;
      const historyLimit = parseInt(settings?.conversationHistoryLimit) || 4;

      if (includeHistory && Array.isArray(history) && history.length > 0) {
        historyContext = history.slice(-historyLimit).map(h => {
          const role = h.role === 'user' || h.sender === 'user' ? 'User' : 'Assistant';
          const content = h.content || h.text || h.response || '';
          return `${role}: ${content}`;
        }).join('\n');
      }

      // 3. Interpolate prompt template from tenant genAISettings
      const rawPrompt = settings?.queryRewritePrompt || genAISettingsService.getDefaultSettings().queryRewritePrompt;
      const prompt = genAISettingsService.interpolate(rawPrompt, {
        chatHistory: historyContext,
        userQuery: cleanQuery,
        tenantFullName: settings?.tenantFullName || 'Enterprise',
        botName: bot?.botName || bot?.name || 'Bot'
      });

      const response = await llmService.chatCompletion({
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.2,
        maxTokens: parseInt(settings?.maxTokens) || 150,
        model: settings?.textGenerationModel || bot?.model
      });

      const parsed = this.safeParseArrayOrJson(response.content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const unique = Array.from(new Set([cleanQuery, ...parsed.map(q => String(q).trim())])).filter(Boolean);
        return unique.slice(0, 3);
      }
    } catch (err) {
      logger.warn(`[Query Rewriter] Rewriting fallback used: ${err.message}`);
    }

    return fallbackQueries;
  }

  safeParseArrayOrJson(str) {
    if (!str || typeof str !== 'string') return null;
    try {
      // Direct array match
      const arrayMatch = str.match(/\[.*\]/s);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed;
      }
      
      // JSON object with standaloneQuestions or queries array
      const objMatch = str.match(/\{.*\}/s);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (Array.isArray(parsed.standaloneQuestions)) return parsed.standaloneQuestions;
        if (Array.isArray(parsed.queries)) return parsed.queries;
        if (Array.isArray(parsed.questions)) return parsed.questions;
      }
    } catch (e) {
      return null;
    }
    return null;
  }
}

module.exports = new QueryRewriterService();
