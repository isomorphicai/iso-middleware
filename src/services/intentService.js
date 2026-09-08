const llmService = require('./llmService');
const genAISettingsService = require('./genAISettingsService');
const logger = require('../helpers/logger');

class IntentService {
  /**
   * Classify user query into: 'smalltalk' | 'end_chat' | 'ambiguous' | 'information_seeking'
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

    const enabledIntents = Array.isArray(settings?.intentEnabled) 
      ? settings.intentEnabled 
      : ['smalltalk', 'end_chat', 'ambiguous', 'information_seeking'];
    
    const isSmalltalkEnabled = enabledIntents.some(i => i.toLowerCase().includes('smalltalk') || i.toLowerCase().includes('greetings'));
    const isEndChatEnabled = enabledIntents.some(i => i.toLowerCase().includes('end_chat') || i.toLowerCase().includes('endchat') || i.toLowerCase().includes('bye') || i.toLowerCase().includes('exit'));
    const isAmbiguousEnabled = enabledIntents.some(i => i.toLowerCase().includes('ambiguous'));

    // 1. Fast Rule-Based Match for End Chat / Farewells
    if (isEndChatEnabled) {
      const endChatPatterns = [
        /^(bye|goodbye|bye\s+bye|good\s+bye|cya|see\s+you(\s+later)?|take\s+care|talk\s+to\s+you\s+later)\b/i,
        /^(end|close|exit|quit|stop|terminate|leave)\s*(chat|conversation|session)?$/i,
        /^(i('m| am)?\s*(done|leaving|good|finished|heading out))\b/i,
        /^(that('s| is)?\s*(all|everything)(\s+for\s+now)?|nothing\s+else(\s+thanks)?)\b/i,
        /^(have\s+a\s+(good|great|nice|wonderful)\s+(day|night|evening|weekend))\b/i,
        /^(no\s+(more\s+)?questions?|i\s+got\s+what\s+i\s+needed)\b/i
      ];

      for (const pattern of endChatPatterns) {
        if (pattern.test(cleanQuery)) {
          return { intent: 'end_chat', confidence: 0.95, reason: 'Matched end chat / farewell pattern' };
        }
      }
    }

    // 2. Fast Rule-Based Match for Common Smalltalk & Conversational Chit-chat
    if (isSmalltalkEnabled) {
      const smalltalkPatterns = [
        /^(hi|hello|hey|heya|howdy|hola|greetings|yo|morning|afternoon|evening)(\s+there|\s+bot)?\b/i,
        /^(good\s+(morning|afternoon|evening|day|night))\b/i,
        /^(how\s+are\s+you|how's\s+it\s+going|how\s+r\s+u|what's\s+up|sup|how\s+do\s+you\s+do)\b/i,
        /^(thank\s+you|thanks|thx|thank\s+u|appreciate\s+it|many\s+thanks|much\s+appreciated)\b/i,
        /^(who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|what\s+are\s+you|tell\s+me\s+about\s+yourself)\b/i,
        /^(ok|okay|cool|nice|great|awesome|got\s+it|alright|fine|perfect|understood|sure)$/i,
        /^(nice\s+to\s+meet\s+you|pleased\s+to\s+meet\s+you|glad\s+to\s+meet\s+you)\b/i,
        /^(you('re| are)?\s*(awesome|great|helpful|smart|the best|cool|good|amazing))\b/i
      ];

      for (const pattern of smalltalkPatterns) {
        if (pattern.test(cleanQuery)) {
          return { intent: 'smalltalk', confidence: 0.95, reason: 'Matched smalltalk conversational pattern' };
        }
      }
    }

    // 3. Fast Rule-Based Match for Ambiguous / Vague Queries
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

    // 4. LLM Intent Classifier for nuanced queries using tenant's genAISettings
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
        const detected = parsed.intent.toLowerCase().trim();
        // Check if detected intent is enabled in settings
        if (detected === 'end_chat' && !isEndChatEnabled) {
          return { intent: 'information_seeking', reason: 'End chat disabled by genAISettings' };
        }
        if (detected === 'smalltalk' && !isSmalltalkEnabled) {
          return { intent: 'information_seeking', reason: 'Smalltalk disabled by genAISettings' };
        }
        if (detected === 'ambiguous' && !isAmbiguousEnabled) {
          return { intent: 'information_seeking', reason: 'Ambiguous handler disabled by genAISettings' };
        }

        if (['smalltalk', 'end_chat', 'ambiguous', 'information_seeking'].includes(detected)) {
          return {
            intent: detected,
            reason: parsed.reason || 'LLM classified',
            confidence: 0.85
          };
        }
      }
    } catch (err) {
      logger.warn(`[Intent Service] LLM intent classification skipped: ${err.message}`);
    }

    // Default fallback
    return { intent: 'information_seeking', confidence: 0.75, reason: 'Default information seeking' };
  }

  /**
   * Formats chat history into standardized array of { role, content } objects
   */
  formatHistoryForLLM(history = []) {
    if (!Array.isArray(history)) return [];
    return history.slice(-4).map(item => {
      if (item.role && (item.content || item.text)) {
        return { role: item.role === 'bot' || item.role === 'assistant' ? 'assistant' : 'user', content: item.content || item.text };
      }
      if (item.userQuery) {
        return { role: 'user', content: item.userQuery };
      }
      if (item.botResponse) {
        return { role: 'assistant', content: item.botResponse };
      }
      return null;
    }).filter(Boolean);
  }

  /**
   * Generates a conversational, interactive smalltalk answer using LLM & tenant genAISettings
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

    const formattedHistory = this.formatHistoryForLLM(history);
    const messages = [
      { role: 'system', content: prompt },
      ...formattedHistory,
      { role: 'user', content: query }
    ];

    try {
      const response = await llmService.chatCompletion({
        messages,
        temperature: 0.7,
        maxTokens: 180,
        model: genAISettings?.textGenerationModel || bot?.model
      });

      if (response && response.content && response.content.trim()) {
        return {
          text: response.content.trim(),
          intent: 'smalltalk',
          tokens: response.tokens,
          model: response.model
        };
      }
    } catch (err) {
      logger.warn(`[Intent Service] LLM smalltalk call failed: ${err.message}`);
    }

    // Interactive fallback generation based on specific smalltalk category
    const interactiveReply = this.generateInteractiveSmalltalkFallback({ query, botName, tenantName });
    return {
      text: interactiveReply,
      intent: 'smalltalk',
      tokens: { prompt: 20, completion: 25 },
      model: 'interactive-fallback'
    };
  }

  /**
   * Generates interactive, contextual fallback replies for smalltalk
   */
  generateInteractiveSmalltalkFallback({ query, botName, tenantName }) {
    const clean = (query || '').toLowerCase().trim();

    if (/^(how\s+are\s+you|how's\s+it\s+going|how\s+r\s+u|what's\s+up|sup)\b/i.test(clean)) {
      const options = [
        `I'm doing great, thank you for asking! How can I assist you with ${tenantName} today?`,
        `All systems running smoothly! What can I help you explore or find today?`,
        `Doing wonderful and ready to help! What questions do you have for me today?`
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    if (/^(who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|tell\s+me\s+about\s+yourself)\b/i.test(clean)) {
      return `I am ${botName}, your virtual AI assistant for ${tenantName}! I can answer questions, look up knowledge base information, guide you through services, and help resolve common issues. What would you like to know?`;
    }

    if (/^(thank\s+you|thanks|thx|appreciate\s+it|many\s+thanks)\b/i.test(clean)) {
      const options = [
        `You're very welcome! Let me know if there is anything else I can help you with.`,
        `Happy to help! Feel free to ask if you have any other questions.`,
        `Glad I could assist! Is there anything else you'd like to know?`
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    if (/^(you('re| are)?\s*(awesome|great|helpful|smart|the best|cool|good|amazing))\b/i.test(clean)) {
      return `Thank you so much for the kind words! 😊 I'm always here to help you with any questions.`;
    }

    if (/^(ok|okay|cool|nice|great|awesome|got\s+it|alright|fine|perfect|understood)$/i.test(clean)) {
      const options = [
        `Sounds good! What would you like to check out next?`,
        `Great! Let me know if you need any further information.`,
        `Awesome! Feel free to ask whenever you have another question.`
      ];
      return options[Math.floor(Math.random() * options.length)];
    }

    if (/^(good\s+morning)\b/i.test(clean)) {
      return `Good morning! ☀️ How can I assist you with ${tenantName} today?`;
    }

    if (/^(good\s+afternoon)\b/i.test(clean)) {
      return `Good afternoon! How can I help you today?`;
    }

    if (/^(good\s+evening)\b/i.test(clean)) {
      return `Good evening! How can I assist you tonight?`;
    }

    // Default friendly interactive greeting
    const greetings = [
      `Hello! I'm ${botName}, your assistant for ${tenantName}. How can I help you today?`,
      `Hi there! What questions can I answer for you today?`,
      `Hey! Welcome to ${tenantName}. How can I assist you?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Handles user wanting to end the chat session, outputs goodbye and triggers end chat form
   */
  async handleEndChat({ query, bot = {}, history = [], genAISettings = null }) {
    const botName = bot?.botName || bot?.name || 'Assistant';
    const tenantName = genAISettings?.tenantFullName || bot?.tenantName || 'Enterprise';

    const rawPrompt = genAISettings?.endChatPrompt || genAISettingsService.getDefaultSettings().endChatPrompt;
    const prompt = genAISettingsService.interpolate(rawPrompt, {
      userQuery: query,
      tenantFullName: tenantName,
      botName
    });

    const formattedHistory = this.formatHistoryForLLM(history);
    const messages = [
      { role: 'system', content: prompt },
      ...formattedHistory,
      { role: 'user', content: query }
    ];

    try {
      const response = await llmService.chatCompletion({
        messages,
        temperature: 0.6,
        maxTokens: 120,
        model: genAISettings?.textGenerationModel || bot?.model
      });

      if (response && response.content && response.content.trim()) {
        return {
          text: response.content.trim(),
          intent: 'end_chat',
          isEndChat: true,
          form: 'survey',
          tokens: response.tokens,
          model: response.model
        };
      }
    } catch (err) {
      logger.warn(`[Intent Service] LLM end_chat call failed: ${err.message}`);
    }

    // Fallback warm goodbye messages
    const goodbyes = [
      `Thank you for chatting with ${botName} today! Have a wonderful day ahead. Goodbye! 👋`,
      `It was a pleasure assisting you! Have a great day and feel free to reach out anytime. Goodbye! 👋`,
      `Thank you for reaching out to ${tenantName}. Take care and have a wonderful day! 👋`
    ];
    const goodbyeText = goodbyes[Math.floor(Math.random() * goodbyes.length)];

    return {
      text: goodbyeText,
      intent: 'end_chat',
      isEndChat: true,
      form: 'survey',
      tokens: { prompt: 15, completion: 20 },
      model: 'farewell-fallback'
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

    const formattedHistory = this.formatHistoryForLLM(history);
    const messages = [
      { role: 'system', content: prompt },
      ...formattedHistory,
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

