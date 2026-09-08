const llmService = require('./llmService');
const genAISettingsService = require('./genAISettingsService');
const logger = require('../helpers/logger');

class QueryRewriterService {
  /**
   * Rewrites and expands a user query into multiple contextual search angles for vector search,
   * taking into account recent conversation turns from Mongo Atlas GenAI settings to resolve follow-ups.
   */
  async rewriteAndExpandQuery({ query, history = [], bot = {}, genAISettings = null, tenantId = '', botId = '' }) {
    if (!query || typeof query !== 'string') {
      return [query];
    }

    const cleanQuery = query.trim();
    let settings = genAISettings;

    try {
      // 1. Resolve genAISettings from tenant database if not passed
      if (!settings) {
        settings = await genAISettingsService.getSettings({
          tenantId: tenantId || bot?.tenantId,
          botId: botId || bot?.botId || bot?.code
        });
      }

      // 2. Extract "History Turns Limit" directly from genAISettings
      const historyTurnsLimit = parseInt(
        settings?.conversationHistoryLimit ?? 
        settings?.historyTurnsLimit ?? 
        settings?.historyLimit ?? 
        5
      );

      // If rewriter is explicitly disabled in genAISettings, return fallback
      if (settings?.improvedQueryRewriter === false || settings?.genAiEnabled === false) {
        return this.generateContextualFallback(cleanQuery, history, historyTurnsLimit);
      }

      // 3. Format limited conversation history turns based on settings
      const includeHistory = settings?.includeConversationHistoryInQueryRewriter !== false;
      let historyContext = 'None';

      if (includeHistory && Array.isArray(history) && history.length > 0) {
        historyContext = this.formatHistoryContext(history, historyTurnsLimit);
      }

      // 4. Interpolate prompt template from tenant genAISettings
      const rawPrompt = settings?.queryRewritePrompt || genAISettingsService.getDefaultSettings().queryRewritePrompt;
      const prompt = genAISettingsService.interpolate(rawPrompt, {
        chatHistory: historyContext || 'None',
        historyTurnsLimit,
        userQuery: cleanQuery,
        tenantFullName: settings?.tenantFullName || bot?.tenantName || 'Enterprise',
        botName: bot?.botName || bot?.name || 'Bot'
      });

      const response = await llmService.chatCompletion({
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.2,
        maxTokens: parseInt(settings?.maxTokens) || 160,
        model: settings?.textGenerationModel || bot?.model
      });

      const parsed = this.safeParseArrayOrJson(response?.content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Collect unique search queries starting with the standalone rewritten version
        const cleanedParsed = parsed.map(q => String(q).replace(/^["']|["']$/g, '').trim()).filter(Boolean);
        const unique = Array.from(new Set([...cleanedParsed, cleanQuery])).filter(q => q.length > 1);
        return unique.slice(0, 3);
      }
    } catch (err) {
      logger.warn(`[Query Rewriter] Rewriting fallback used: ${err.message}`);
    }

    const historyLimit = parseInt(
      settings?.conversationHistoryLimit ?? 
      settings?.historyTurnsLimit ?? 
      settings?.historyLimit ?? 
      5
    );
    return this.generateContextualFallback(cleanQuery, history, historyLimit);
  }

  /**
   * Formats up to N recent conversation turns into clean, readable text without HTML
   */
  formatHistoryContext(history = [], turnsLimit = 5) {
    if (!Array.isArray(history) || history.length === 0) return 'None';

    const turns = [];
    for (const item of history) {
      if (!item) continue;

      // Format 1: Paired exchange ({ userQuery, botResponse })
      if (item.userQuery || item.botResponse) {
        if (item.userQuery) turns.push(`User: ${String(item.userQuery).trim()}`);
        if (item.botResponse) {
          const cleanResp = String(item.botResponse).replace(/<[^>]*>?/gm, '').trim();
          turns.push(`Assistant: ${cleanResp}`);
        }
        continue;
      }

      // Format 2: Single turn message ({ role/sender, text/content/message/response })
      const isUser = item.role === 'user' || item.sender === 'user';
      const roleLabel = isUser ? 'User' : 'Assistant';
      const rawText = item.content || item.text || item.response || item.message || '';
      const cleanText = String(rawText).replace(/<[^>]*>?/gm, '').trim();

      if (cleanText) {
        turns.push(`${roleLabel}: ${cleanText}`);
      }
    }

    if (turns.length === 0) return 'None';

    // A turn is 1 user question + 1 bot reply (up to 2 messages per turn)
    const maxMessages = Math.max(1, turnsLimit) * 2;
    return turns.slice(-maxMessages).join('\n');
  }

  /**
   * Generates contextual search queries even when LLM is offline or falling back
   */
  generateContextualFallback(cleanQuery, history = [], turnsLimit = 5) {
    const fallback = [
      cleanQuery,
      cleanQuery.replace(/[?\.!]+/g, '').trim()
    ];

    if (!Array.isArray(history) || history.length === 0) {
      return Array.from(new Set(fallback)).filter(Boolean);
    }

    // Check if current query appears to be a follow-up (contains pronouns or is short)
    const isFollowUp = /\b(it|this|that|they|them|these|those|there|that\s+one|the\s+second\s+one|same|previous)\b/i.test(cleanQuery) ||
                       /^(what\s+about|how\s+about|and|can\s+i|how\s+much|where\s+is|when\s+is|why|how\s+do|how\s+can|how\s+to\s+apply|deadline|cost|fees|requirements|prerequisites|scholarships?)\b/i.test(cleanQuery) ||
                       cleanQuery.split(/\s+/).length <= 4;

    if (isFollowUp) {
      const prevTurns = history.slice(-Math.max(1, turnsLimit) * 2);
      let previousTopic = '';

      for (let i = prevTurns.length - 1; i >= 0; i--) {
        const item = prevTurns[i];
        const text = (item?.userQuery || item?.text || item?.content || item?.message || '').replace(/<[^>]*>?/gm, '').trim();
        
        if (text && text.length > 5 && !/^(hi|hello|hey|thanks|thank\s+you|ok|bye)\b/i.test(text)) {
          // Extract substantive keywords from topic
          const meaningful = text.replace(/\b(what|is|the|for|it|this|that|how|much|can|i|do|you|are|there|any|tell|me|about)\b/gi, '').replace(/[?\.!,]+/g, '').trim();
          if (meaningful.length > 3) {
            previousTopic = meaningful;
            break;
          }
        }
      }

      if (previousTopic) {
        const combined = `${previousTopic} ${cleanQuery}`.trim();
        fallback.unshift(combined);
      }
    }

    return Array.from(new Set(fallback)).filter(Boolean).slice(0, 3);
  }

  safeParseArrayOrJson(str) {
    if (!str || typeof str !== 'string') return null;
    try {
      // Direct array match
      const arrayMatch = str.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed;
      }
      
      // JSON object with standaloneQuestions or queries array
      const objMatch = str.match(/\{[\s\S]*?\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (Array.isArray(parsed.standaloneQuestions)) return parsed.standaloneQuestions;
        if (Array.isArray(parsed.queries)) return parsed.queries;
        if (Array.isArray(parsed.questions)) return parsed.questions;
        if (Array.isArray(parsed.expandedQueries)) return parsed.expandedQueries;
      }
    } catch (e) {
      return null;
    }
    return null;
  }
}

module.exports = new QueryRewriterService();

