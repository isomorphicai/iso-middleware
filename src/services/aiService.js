const intentService = require('./intentService');
const queryRewriterService = require('./queryRewriterService');
const ragSearchService = require('./ragSearchService');
const llmService = require('./llmService');
const genAISettingsService = require('./genAISettingsService');
const logger = require('../helpers/logger');

class AIService {
  /**
   * Main entrypoint to process chat queries through Intent Classification,
   * Query Rewriter, KNN Vector Search, and Groq/LLM generation, fully configured
   * via dynamic tenant genAISettings in MongoDB Atlas.
   */
  async generateResponse({ bot, query, history = [], tenantId = '', botId = '' }) {
    const startTime = Date.now();
    const resolvedBotId = botId || (bot && (bot.botId || bot.code || bot._id?.toString())) || 'ISOBot';
    const resolvedTenantId = tenantId || (bot && (bot.tenantId || bot.tenantName)) || 'default';

    logger.info(`[AI Service] Processing query for tenant "${resolvedTenantId}", bot "${resolvedBotId}": "${query}"`);

    // =========================================================================
    // STEP 0: FETCH GEN AI SETTINGS FROM TENANT DATABASE
    // =========================================================================
    const genAISettings = await genAISettingsService.getSettings({
      tenantId: resolvedTenantId,
      botId: resolvedBotId
    });

    const botName = bot?.botName || bot?.name || 'ISO AI Assistant';
    const tenantFullName = genAISettings.tenantFullName || bot?.tenantName || resolvedTenantId;

    // Check if GenAI is disabled for this tenant/bot
    if (genAISettings.genAiEnabled === false) {
      logger.info(`[AI Service] GenAI is disabled for bot "${resolvedBotId}". Returning default fallback.`);
      return {
        text: genAISettings.defaultFallbackAnswer || 'Generative AI is currently disabled.',
        intent: 'fallback',
        retrievedChunksCount: 0,
        retrievedChunks: [],
        sources: [],
        tokens: { prompt: 0, completion: 0 },
        latencyMs: Date.now() - startTime,
        model: 'rule-based',
        provider: 'system'
      };
    }

    // =========================================================================
    // STEP 1: INTENT CLASSIFICATION (using tenant genAISettings)
    // =========================================================================
    const classification = await intentService.classifyIntent({
      query,
      history,
      bot,
      genAISettings,
      tenantId: resolvedTenantId,
      botId: resolvedBotId
    });

    logger.info(`[AI Service] Intent detected: "${classification.intent}" (${classification.reason || 'N/A'})`);

    // 1A. Smalltalk Handler
    if (classification.intent === 'smalltalk') {
      const smalltalkRes = await intentService.handleSmalltalk({
        query,
        bot,
        history,
        genAISettings
      });
      const latencyMs = Date.now() - startTime;
      return {
        text: smalltalkRes.text,
        intent: 'smalltalk',
        retrievedChunks: [],
        sources: [],
        tokens: smalltalkRes.tokens || { prompt: 20, completion: 30 },
        latencyMs,
        model: smalltalkRes.model || genAISettings.textGenerationModel || bot?.model || 'openai/gpt-oss-120b',
        provider: 'groq/llm'
      };
    }

    // 1B. Ambiguous Query Handler
    if (classification.intent === 'ambiguous') {
      const ambiguousRes = await intentService.handleAmbiguousQuery({
        query,
        bot,
        history,
        genAISettings
      });
      const latencyMs = Date.now() - startTime;
      return {
        text: ambiguousRes.text,
        intent: 'ambiguous',
        retrievedChunks: [],
        sources: [],
        tokens: ambiguousRes.tokens || { prompt: 20, completion: 40 },
        latencyMs,
        model: ambiguousRes.model || genAISettings.textGenerationModel || bot?.model || 'openai/gpt-oss-120b',
        provider: 'groq/llm'
      };
    }

    // =========================================================================
    // STEP 2: QUERY REWRITER & EXPANSION (using tenant genAISettings)
    // =========================================================================
    const expandedQueries = await queryRewriterService.rewriteAndExpandQuery({
      query,
      history,
      bot,
      genAISettings,
      tenantId: resolvedTenantId,
      botId: resolvedBotId
    });
    logger.info(`[AI Service] Expanded queries for KNN: ${JSON.stringify(expandedQueries)}`);

    // =========================================================================
    // STEP 3: KNN VECTOR RAG SEARCH (using tenant genAISettings)
    // =========================================================================
    const retrievedChunks = await ragSearchService.performKnnSearch({
      queries: expandedQueries,
      tenantId: resolvedTenantId,
      botId: resolvedBotId,
      topK: parseInt(genAISettings.topK) || 4,
      scoreThreshold: parseFloat(genAISettings.scoreThreshold) || 0.05
    });

    // =========================================================================
    // STEP 4: PROMPT ASSEMBLY & LLM GENERATION (using tenant genAISettings)
    // =========================================================================
    let contextText = '';
    const uniqueSources = [];

    if (retrievedChunks.length > 0) {
      contextText = retrievedChunks.map((c, i) => {
        if (c.sourceUrl && !uniqueSources.includes(c.sourceUrl)) {
          uniqueSources.push(c.sourceUrl);
        }
        return `[Document ${i + 1} - Title: ${c.title} (Source: ${c.sourceUrl || 'Internal Knowledge'})]\n${c.text}`;
      }).join('\n\n');
    } else {
      contextText = 'No specific knowledge base documents retrieved.';
    }

    // Format chat history according to genAISettings
    let historyContext = '';
    const includeHistory = genAISettings.includeConversationHistoryInAnswerGeneration !== false;
    const historyLimit = parseInt(genAISettings.conversationHistoryLimit) || 4;

    const historyMessages = [];
    if (includeHistory && Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-historyLimit);
      recentHistory.forEach(h => {
        historyMessages.push({
          role: h.role === 'user' || h.sender === 'user' ? 'user' : 'assistant',
          content: h.content || h.text || h.response || ''
        });
      });
      historyContext = recentHistory.map(h => `${h.role === 'user' || h.sender === 'user' ? 'User' : 'Assistant'}: ${h.content || h.text || h.response || ''}`).join('\n');
    }

    // 1. Interpolate System Persona Prompt
    const systemPromptTemplate = genAISettings.systemPrompt || genAISettingsService.getDefaultSettings().systemPrompt;
    const systemPersona = genAISettingsService.interpolate(systemPromptTemplate, {
      tenantFullName,
      botName,
      userQuery: query
    });

    // 2. Interpolate Answer Generation Template
    const answerGenTemplate = genAISettings.answerGenerationPrompt || genAISettingsService.getDefaultSettings().answerGenerationPrompt;
    const userPromptContent = genAISettingsService.interpolate(answerGenTemplate, {
      context: contextText,
      userQuery: query,
      chatHistory: historyContext,
      tenantFullName,
      botName
    });

    const messages = [
      { role: 'system', content: systemPersona },
      ...historyMessages,
      { role: 'user', content: userPromptContent }
    ];

    const llmResult = await llmService.chatCompletion({
      messages,
      temperature: parseFloat(genAISettings.temperature) || 0.3,
      maxTokens: parseInt(genAISettings.maxTokens) || 350,
      model: genAISettings.textGenerationModel || bot?.model
    });

    const latencyMs = Date.now() - startTime;
    let finalAnswer = llmResult.content;

    // Check fallback texts if answer appears empty or matched fallback patterns
    const fallbackTexts = Array.isArray(genAISettings.fallbackTexts) ? genAISettings.fallbackTexts : [];
    const isExplicitFallback = fallbackTexts.some(fb => fb && finalAnswer.toLowerCase().includes(fb.toLowerCase()));
    
    if (isExplicitFallback && retrievedChunks.length === 0 && genAISettings.defaultFallbackAnswer) {
      logger.info('[AI Service] LLM indicated no information and 0 chunks retrieved. Using defaultFallbackAnswer.');
      finalAnswer = genAISettings.defaultFallbackAnswer;
    }

    return {
      text: finalAnswer,
      intent: 'information_seeking',
      retrievedChunksCount: retrievedChunks.length,
      retrievedChunks,
      sources: uniqueSources,
      tokens: llmResult.tokens || { prompt: query.length / 4, completion: finalAnswer.length / 4 },
      latencyMs,
      model: llmResult.model,
      provider: llmResult.provider
    };
  }
}

module.exports = new AIService();
