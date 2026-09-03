const intentService = require('./intentService');
const queryRewriterService = require('./queryRewriterService');
const ragSearchService = require('./ragSearchService');
const llmService = require('./llmService');
const logger = require('../helpers/logger');

class AIService {
  /**
   * Main entrypoint to process chat queries through Intent Classification,
   * Query Rewriter, KNN Vector Search, and Groq/LLM generation.
   */
  async generateResponse({ bot, query, history = [], tenantId = '', botId = '' }) {
    const startTime = Date.now();
    const resolvedBotId = botId || (bot && (bot.botId || bot.code || bot._id?.toString())) || 'ISOBot';
    const resolvedTenantId = tenantId || (bot && (bot.tenantId || bot.tenantName)) || 'default';

    logger.info(`[AI Service] Processing query for tenant "${resolvedTenantId}", bot "${resolvedBotId}": "${query}"`);

    // =========================================================================
    // STEP 1: INTENT CLASSIFICATION
    // =========================================================================
    const classification = await intentService.classifyIntent({
      query,
      history,
      bot
    });

    logger.info(`[AI Service] Intent detected: "${classification.intent}" (${classification.reason || 'N/A'})`);

    // 1A. Smalltalk Handler (Direct LLM Response)
    if (classification.intent === 'smalltalk') {
      const smalltalkRes = await intentService.handleSmalltalk({ query, bot, history });
      const latencyMs = Date.now() - startTime;
      return {
        text: smalltalkRes.text,
        intent: 'smalltalk',
        retrievedChunks: [],
        sources: [],
        tokens: smalltalkRes.tokens || { prompt: 20, completion: 30 },
        latencyMs,
        model: smalltalkRes.model || bot?.model || 'openai/gpt-oss-120b',
        provider: 'groq/llm'
      };
    }

    // 1B. Ambiguous Query Handler (Ask for Clarification)
    if (classification.intent === 'ambiguous') {
      const ambiguousRes = await intentService.handleAmbiguousQuery({ query, bot, history });
      const latencyMs = Date.now() - startTime;
      return {
        text: ambiguousRes.text,
        intent: 'ambiguous',
        retrievedChunks: [],
        sources: [],
        tokens: ambiguousRes.tokens || { prompt: 20, completion: 40 },
        latencyMs,
        model: ambiguousRes.model || bot?.model || 'openai/gpt-oss-120b',
        provider: 'groq/llm'
      };
    }

    // =========================================================================
    // STEP 2: QUERY REWRITER & EXPANSION
    // =========================================================================
    const expandedQueries = await queryRewriterService.rewriteAndExpandQuery({
      query,
      history,
      bot
    });
    logger.info(`[AI Service] Expanded queries for KNN: ${JSON.stringify(expandedQueries)}`);

    // =========================================================================
    // STEP 3: KNN VECTOR RAG SEARCH ON INDEX PARTITION ${tenantId}_${botId}
    // =========================================================================
    const retrievedChunks = await ragSearchService.performKnnSearch({
      queries: expandedQueries,
      tenantId: resolvedTenantId,
      botId: resolvedBotId,
      topK: 4,
      scoreThreshold: 0.05
    });

    // =========================================================================
    // STEP 4: PROMPT ASSEMBLY & GROQ / LLM GENERATION
    // =========================================================================
    const botName = bot?.botName || bot?.name || 'ISO AI Assistant';
    const basePersona = bot?.systemPrompt || `You are ${botName}, a friendly, intelligent, and concise enterprise AI chatbot assistant.`;

    let contextSection = '';
    const uniqueSources = [];

    if (retrievedChunks.length > 0) {
      contextSection = `\n\n=== RETRIEVED KNOWLEDGE BASE DOCUMENTS ===\n` +
        retrievedChunks.map((c, i) => {
          if (c.sourceUrl && !uniqueSources.includes(c.sourceUrl)) {
            uniqueSources.push(c.sourceUrl);
          }
          return `[Document ${i + 1} - Title: ${c.title} (Source: ${c.sourceUrl || 'Internal'})]\n${c.text}`;
        }).join('\n\n') +
        `\n===========================================\n`;
    }

    const formattingInstructions = `
CHATBOT FORMATTING & STYLE RULES:
1. **Be Short & Crisp**: Answer in 2 to 4 concise bullet points or 1-2 short paragraphs. Avoid long walls of text or unnecessary essays.
2. **Formatting**:
   - Use **bold** for key concepts and product/feature names.
   - Use clean bullet points (• or -) for multiple items, steps, or features.
   - Include markdown links like [Website Title](url) when referring to source documents.
3. **Accuracy**: Base your answer on the knowledge documents above when available. If the answer is not in the documents, state what you know concisely and suggest contacting support.
4. **Tone**: Warm, helpful, and conversational like a professional customer support chatbot.`;

    const messages = [
      {
        role: 'system',
        content: `${basePersona}${contextSection}\n${formattingInstructions}`
      },
      ...history.slice(-4),
      {
        role: 'user',
        content: query
      }
    ];

    const llmResult = await llmService.chatCompletion({
      messages,
      temperature: 0.3,
      maxTokens: 350,
      model: bot?.model
    });

    const latencyMs = Date.now() - startTime;

    return {
      text: llmResult.content,
      intent: 'information_seeking',
      retrievedChunksCount: retrievedChunks.length,
      retrievedChunks,
      sources: uniqueSources,
      tokens: llmResult.tokens || { prompt: query.length / 4, completion: llmResult.content.length / 4 },
      latencyMs,
      model: llmResult.model,
      provider: llmResult.provider
    };
  }
}

module.exports = new AIService();
