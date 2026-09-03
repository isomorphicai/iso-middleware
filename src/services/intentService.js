const llmService = require('./llmService');
const logger = require('../helpers/logger');

class IntentService {
  /**
   * Classify user query into: 'smalltalk' | 'ambiguous' | 'information_seeking'
   */
  async classifyIntent({ query, history = [], bot = {} }) {
    if (!query || typeof query !== 'string') {
      return { intent: 'ambiguous', reason: 'Empty query' };
    }

    const cleanQuery = query.trim().toLowerCase();
    const wordCount = cleanQuery.split(/\s+/).length;

    // 1. Fast Rule-Based Match for Common Smalltalk
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

    // 2. Fast Rule-Based Match for Ambiguous / Vague Queries
    const ambiguousPatterns = [
      /^(help|info|tell\s+me|details|more|what|why|how|where|when|can\s+i|is\s+it)$/i,
      /^(what\s+about\s+that|tell\s+me\s+more|explain\s+that|and\s+then|what\s+else)$/i,
      /^(price|cost|fees|features|plans|support|contact)$/i
    ];

    if (wordCount <= 2) {
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

    // 3. LLM Intent Classifier for nuanced queries
    try {
      const classificationPrompt = `You are an intent classification engine for an enterprise customer assistant.
Classify the user's query into EXACTLY ONE of these categories:
1. SMALLTALK: Greetings, pleasantries, thanking, social chit-chat, or asking who the bot is.
2. AMBIGUOUS: The query is too vague, underspecified, or unclear to look up specific documents (e.g. "tell me more", "how much is it?", "can I do that?").
3. INFORMATION_SEEKING: Specific questions about products, services, documentation, FAQs, procedures, or domain knowledge.

Output ONLY valid JSON with keys "intent" ("smalltalk" | "ambiguous" | "information_seeking") and "reason".

User Query: "${query}"`;

      const response = await llmService.chatCompletion({
        messages: [{ role: 'system', content: classificationPrompt }],
        temperature: 0.1,
        maxTokens: 100
      });

      const parsed = this.safeParseJSON(response.content);
      if (parsed?.intent) {
        return {
          intent: parsed.intent.toLowerCase(),
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
   * Generates a conversational smalltalk answer using LLM
   */
  async handleSmalltalk({ query, bot = {}, history = [] }) {
    const botName = bot?.botName || bot?.name || 'Assistant';
    const persona = bot?.systemPrompt || `You are ${botName}, a helpful and polite AI assistant.`;

    const messages = [
      { 
        role: 'system', 
        content: `${persona}
The user is engaging in friendly greeting or smalltalk. Respond warmly, concisely (1-2 sentences), and ask how you can help them today.` 
      },
      ...history.slice(-3),
      { role: 'user', content: query }
    ];

    const response = await llmService.chatCompletion({
      messages,
      temperature: 0.7,
      maxTokens: 150
    });

    return {
      text: response.content,
      intent: 'smalltalk',
      tokens: response.tokens,
      model: response.model
    };
  }

  /**
   * Generates a clarification question when the query is ambiguous
   */
  async handleAmbiguousQuery({ query, bot = {}, history = [] }) {
    const botName = bot?.botName || bot?.name || 'Assistant';
    const persona = bot?.systemPrompt || `You are ${botName}, a helpful AI assistant.`;

    const messages = [
      { 
        role: 'system', 
        content: `${persona}
The user's query "${query}" is ambiguous or needs more details. Politely ask for clarification or offer 2-3 specific topics they might be asking about.` 
      },
      ...history.slice(-3),
      { role: 'user', content: query }
    ];

    const response = await llmService.chatCompletion({
      messages,
      temperature: 0.5,
      maxTokens: 200
    });

    return {
      text: response.content,
      intent: 'ambiguous',
      tokens: response.tokens,
      model: response.model
    };
  }

  safeParseJSON(str) {
    try {
      const match = str.match(/\{.*\}/s);
      return JSON.parse(match ? match[0] : str);
    } catch (e) {
      return null;
    }
  }
}

module.exports = new IntentService();
