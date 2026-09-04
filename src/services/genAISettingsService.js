const mongoose = require('mongoose');
const cacheService = require('./cacheService');
const logger = require('../helpers/logger');

const DEFAULT_SYSTEM_PROMPT = `You are $$tenantFullName virtual assistant ($$botName), a friendly, intelligent, and concise enterprise AI assistant. Answer user inquiries accurately and helpfully using the provided knowledge base context.`;

const DEFAULT_ANSWER_GENERATION_PROMPT = `<context>
$$context
</context>

User Question: $$userQuery

CHATBOT FORMATTING & STYLE RULES:
1. **Be Short & Crisp**: Answer in 2 to 4 concise bullet points or 1-2 short paragraphs. Avoid long walls of text or unnecessary essays.
2. **Formatting**:
   - Use **bold** for key concepts and product/feature names.
   - Use clean bullet points (• or -) for multiple items, steps, or features.
   - Include markdown links like [Website Title](url) when referring to source documents.
3. **Accuracy**: Base your answer on the knowledge documents above when available. If the answer is not in the documents, state what you know concisely and suggest contacting support.
4. **Tone**: Warm, helpful, and conversational like a professional customer support chatbot.

Answer:`;

const DEFAULT_QUERY_REWRITE_PROMPT = `You are an expert search query expansion system for a RAG vector database.
Given the conversation history and the user's latest query, generate 2-3 concise, high-recall search queries.
- Query 1: Standalone version of the user query resolving pronouns (e.g. replacing "it", "they" with the specific topic discussed).
- Query 2: Keyword-focused semantic search query emphasizing key concepts.
- Query 3: Alternative phrasing or synonym-based search query.

Respond ONLY with a valid JSON array of 2-3 strings. Do not add markdown or extra commentary.

Conversation History:
<conversation>
$$chatHistory
</conversation>

Latest User Query: "$$userQuery"

Output JSON:`;

const DEFAULT_INTENT_PROMPT = `You are an intent classification engine for an enterprise customer assistant.
Classify the user's query into EXACTLY ONE of these categories:
1. SMALLTALK: Greetings, pleasantries, thanking, social chit-chat, or asking who the bot is.
2. AMBIGUOUS: The query is too vague, underspecified, or unclear to look up specific documents (e.g. "tell me more", "how much is it?", "can I do that?").
3. INFORMATION_SEEKING: Specific questions about products, services, documentation, FAQs, procedures, or domain knowledge.

Output ONLY valid JSON with keys "intent" ("smalltalk" | "ambiguous" | "information_seeking") and "reason".

User Query: "$$userQuery"`;

const DEFAULT_SMALLTALK_PROMPT = `You are $$tenantFullName virtual assistant ($$botName), a helpful and polite AI assistant.
The user is engaging in friendly greeting or smalltalk. Respond warmly, concisely (1-2 sentences), and ask how you can help them today.`;

const DEFAULT_AMBIGUOUS_PROMPT = `You are $$tenantFullName virtual assistant ($$botName), a helpful AI assistant.
The user's query "$$userQuery" is ambiguous or needs more details. Politely ask for clarification or offer 2-3 specific topics they might be asking about.`;

const DEFAULT_FALLBACK_ANSWER = `<p class="msgcontent">I'm sorry; I do not have enough information in my knowledge base to answer that question accurately. Can you please rephrase or provide additional details? Alternatively, you may contact our support team for assistance.</p>`;

const DEFAULT_FALLBACK_TEXTS = [
  "I don't understand",
  "I cannot answer",
  "try rephrasing",
  "no information available",
  "I don't have information",
  "not enough information"
];

class GenAISettingsService {
  /**
   * Helper: Resolve tenant database name
   */
  resolveDbName(tenantId, tenantDbName) {
    if (tenantDbName) return tenantDbName;
    const raw = (tenantId || 'default').toString().trim().toLowerCase();
    return raw.startsWith('iso_') ? raw : `iso_${raw}`;
  }

  /**
   * Helper: Get tenant database connection
   */
  getTenantDb(tenantId, tenantDbName) {
    const dbName = this.resolveDbName(tenantId, tenantDbName);
    return mongoose.connection.useDb(dbName, { useCache: true });
  }

  /**
   * Get default settings object
   */
  getDefaultSettings(botId = 'ISOBot', tenantName = 'Default Organization') {
    return {
      botId,
      tenantFullName: tenantName,
      genAiEnabled: true,
      chatBotFlag: true,
      intentEnabled: [
        'smalltalk',
        'ambiguous',
        'information_seeking',
        'transfer_call',
        'billing',
        'troubleshooting'
      ],
      conversationHistoryLimit: 5,
      includeConversationHistoryInAnswerGeneration: true,
      includeConversationHistoryInQueryRewriter: true,
      textGenerationModel: 'openai/gpt-oss-120b',
      embeddingsGenerationModel: 'amazon.titan-embed-text-v2:0',
      embeddingsModelDimentions: 1024,
      chunkSize: 600,
      chunkOverlapSize: 100,
      maxTokens: 350,
      temperature: 0.3,
      topK: 4,
      scoreThreshold: 0.05,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      answerGenerationPrompt: DEFAULT_ANSWER_GENERATION_PROMPT,
      queryRewritePrompt: DEFAULT_QUERY_REWRITE_PROMPT,
      improvedQueryRewriter: true,
      improvedQueryRewriterPrompt: 'You are a query planning assistant for a Retrieval Augmented Generation system.',
      intentClassificationPrompt: DEFAULT_INTENT_PROMPT,
      smalltalkPrompt: DEFAULT_SMALLTALK_PROMPT,
      ambiguousPrompt: DEFAULT_AMBIGUOUS_PROMPT,
      fallbackTexts: DEFAULT_FALLBACK_TEXTS,
      defaultFallbackAnswer: DEFAULT_FALLBACK_ANSWER,
      searchConfig: {
        type: 'knn_vector',
        weights: { knn: 0.8, text: 0.2 }
      },
      firecrawlConfigs: { proxy: 'basic' }
    };
  }

  /**
   * Retrieve Gen AI settings directly from Redis Cloud / tenant database > genAISettings collection
   * Cached in Redis for 10 minutes (Cache-Aside pattern).
   */
  async getSettings({ tenantId, botId, tenantDbName }) {
    const cleanTenant = this.resolveDbName(tenantId, tenantDbName);
    const cleanBot = (botId || 'isobot').toString().trim().toLowerCase();
    const cacheKey = `genai:settings:${cleanTenant}:${cleanBot}`;

    return cacheService.wrap(cacheKey, async () => {
      try {
        const tenantDb = this.getTenantDb(tenantId, tenantDbName);
        const col = tenantDb.collection('genAISettings');

        logger.info(`[Mongo Query] Fetching genAISettings from "${cleanTenant}.genAISettings" for bot "${botId}"`);

        let query = {};
        if (botId) {
          query = {
            $or: [
              { botId },
              { botId: new RegExp(`^${botId}$`, 'i') },
              { code: botId },
              { chatBotFlag: botId }
            ]
          };
        }

        let doc = await col.findOne(query);

        if (!doc && botId) {
          doc = await col.findOne({});
        }

        const defaults = this.getDefaultSettings(botId, tenantId);

        if (!doc) {
          return defaults;
        }

        return {
          ...defaults,
          ...doc,
          _id: doc._id?.toString()
        };
      } catch (err) {
        logger.error(`[GenAI Settings] Error fetching settings for tenant "${tenantId}", bot "${botId}": ${err.message}`);
        return this.getDefaultSettings(botId, tenantId);
      }
    });
  }

  /**
   * Invalidate settings cache in Redis on update
   */
  async invalidateSettings(tenantId, botId) {
    const cleanTenant = this.resolveDbName(tenantId);
    await cacheService.delPattern(`genai:settings:${cleanTenant}:*`);
  }

  /**
   * Interpolate template placeholders ($$tenantFullName, $$botName, $$context, $$userQuery, $$chatHistory)
   */
  interpolate(template, variables = {}) {
    if (!template || typeof template !== 'string') return '';
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\$${key}`, 'g');
      result = result.replace(regex, value !== undefined && value !== null ? String(value) : '');
    }
    return result;
  }
}

module.exports = new GenAISettingsService();
