const llmService = require('./llmService');
const genAISettingsService = require('./genAISettingsService');
const logger = require('../helpers/logger');

class IntentService {
  /**
   * Classify user query into: 'smalltalk' | 'ambiguous' | 'information_seeking'
   */
  async classifyIntent({ query, history = [], bot = {}, genAISettings = null, tenantId = '', botId = '' }) {
    if (!query || typeof query !== 'string') {
      return { intent: 'ambiguous', reason: 'Empty query' };
    }

    const cleanQuery = query.trim().toLowerCase();
    const wordCount = cleanQuery.split(/\s+/).length;

    // Resolve genAISettings
    let settings = genAISettings;
    if (!settings) {
      settings = await genAISettingsService.getSettings({
        tenantId: tenantId || bot?.tenantId,
        botId: botId || bot?.botId || bot?.code
      });
    }

    const enabledIntents = Array.isArray(settings?.intentEnabled) ? settings.intentEnabled : ['smalltalk', 'ambiguous', 'information_seeking'];
    const isSmalltalkEnabled = enabledIntents.some(i => i.toLowerCase().includes('smalltalk') || i.toLowerCase().includes('greetings'));
    const isAmbiguousEnabled = enabledIntents.some(i => i.toLowerCase().includes('ambiguous'));

    // 1. Fast Rule-Based Match for Common Smalltalk
    if (isSmalltalkEnabled) {
      const smalltalkPatterns = [
        /^(hi|hello|hey|heya|howdy|hola|greetings)(\s+there|\s+bot)?\b/i,
        /^(good\s+(morning|afternoon|evening|day|night))\b/i,
        /^(how\s+are\s+you|how's\s+it\s+going|how\s+r\s+u|what's\s+up|sup)\b/i,
        /^(thank\s+you|thanks|thx|thank\s+u|appreciate\s+it)\b/i,
        /^(bye|goodbye|see\s+you|cya|take\s+care)\b/i,
        /^(who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do)\b/i,
        /^(ok|okay|cool|nice|great|awesome|got\s+it|alright|fine)$/i
      ];

      for (const pattern of smalltalkPatterns) {
        if (pattern.test(cleanQuery)) {
          return { intent: 'smalltalk', confidence: 0.95, reason: 'Matched smalltalk conversational pattern' };
        }
      }
    }

    // 2. Fast Rule-Based Match for Ambiguous / Vague Queries
    if (isAmbiguousEnabled && wordCount <= 2) {
      const ambiguousPatterns = [
        /^(help|info|tell\s+me|details|more|what|why|how|where|when|can\s+i|is\s+it)$/i,
        /^(what\s+about\s+that|tell\s+me\s+more|explain\s+that|and\s+then|what\s+else)$/i,
        /^(price|cost|fees|features|plans|support|contact)$/i
      ];

      for (const pattern of ambiguousPatterns) {
        if (pattern.test(cleanQuery)) {
          return { 
            intent: 'ambiguous', 
            confidence: 0.90, 
            reason: 'Query is underspecified or lacking domain context' 
          };
        }
      }
    }

    // 3. LLM Intent Classifier for nuanced queries using tenant's genAISettings
    try {
      const rawPrompt = settings?.intentClassificationPrompt || genAISettingsService.getDefaultSettings().intentClassificationPrompt;
      const classificationPrompt = genAISettingsService.interpolate(rawPrompt, {
        userQuery: query,
        tenantFullName: settings?.tenantFullName || 'Enterprise',
        botName: bot?.botName || bot?.name || 'Bot'
      });

      const response = await llmService.chatCompletion({
        messages: [{ role: 'system', content: classificationPrompt }],
        temperature: 0.1,
        maxTokens: 100,
        model: settings?.textGenerationModel || bot?.model
      });

      const parsed = this.safeParseJSON(response.content);
      if (parsed?.intent) {
        const detected = parsed.intent.toLowerCase();
        // Check if detected intent is enabled in settings
        if (detected === 'smalltalk' && !isSmalltalkEnabled) {
          return { intent: 'information_seeking', reason: 'Smalltalk disabled by genAISettings' };
        }
        if (detected === 'ambiguous' && !isAmbiguousEnabled) {
          return { intent: 'information_seeking', reason: 'Ambiguous handler disabled by genAISettings' };
        }

        return {
          intent: detected,
          reason: parsed.reason || 'LLM classified',
          confidence: 0.85
        };
      }
    } catch (err) {
      logger.warn(`[Intent Service] LLM intent classification skipped: ${err.message}`);
    }

    // Default fallback
    return { intent: 'information_seeking', confidence: 0.75, reason: 'Default information seeking' };
  }

  /**
   * Generates a conversational smalltalk answer using LLM & tenant genAISettings
   */
  async handleSmalltalk({ query, bot = {}, history = [], genAISettings = null }) {
    const botName = bot?.botName || bot?.name || 'Assistant';
    const tenantName = genAISettings?.tenantFullName || bot?.tenantName || 'Enterprise';

    const rawPrompt = genAISettings?.smalltalkPrompt || genAISettingsService.getDefaultSettings().smalltalkPrompt;
    const prompt = genAISettingsService.interpolate(rawPrompt, {
      userQuery: query,
      tenantFullName: tenantName,
      botName
    });

    const messages = [
      { role: 'system', content: prompt },
      ...history.slice(-3),
      { role: 'user', content: query }
    ];

    const response = await llmService.chatCompletion({
      messages,
      temperature: 0.7,
      maxTokens: 150,
      model: genAISettings?.textGenerationModel || bot?.model
    });

    return {
      text: response.content,
      intent: 'smalltalk',
      tokens: response.tokens,
      model: response.model
    };
  }

  /**
   * Generates a clarification question when the query is ambiguous using tenant genAISettings
   */
  async handleAmbiguousQuery({ query, bot = {}, history = [], genAISettings = null }) {
    const botName = bot?.botName || bot?.name || 'Assistant';
    const tenantName = genAISettings?.tenantFullName || bot?.tenantName || 'Enterprise';

    const rawPrompt = genAISettings?.ambiguousPrompt || genAISettingsService.getDefaultSettings().ambiguousPrompt;
    const prompt = genAISettingsService.interpolate(rawPrompt, {
      userQuery: query,
      tenantFullName: tenantName,
      botName
    });

    const messages = [
      { role: 'system', content: prompt },
      ...history.slice(-3),
      { role: 'user', content: query }
    ];

    const response = await llmService.chatCompletion({
      messages,
      temperature: 0.5,
      maxTokens: 200,
      model: genAISettings?.textGenerationModel || bot?.model
    });

    return {
      text: response.content,
      intent: 'ambiguous',
      tokens: response.tokens,
      model: response.model
    };
  }

  safeParseJSON(str) {
    if (!str || typeof str !== 'string') return null;
    try {
      const match = str.match(/\{.*\}/s);
      return JSON.parse(match ? match[0] : str);
    } catch (e) {
      return null;
    }
  }
}

module.exports = new IntentService();
