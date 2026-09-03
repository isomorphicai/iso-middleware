const llmService = require('./llmService');
const logger = require('../helpers/logger');

class QueryRewriterService {
  /**
   * Rewrites and expands a user query into multiple search angles for vector search
   */
  async rewriteAndExpandQuery({ query, history = [], bot = {} }) {
    if (!query || typeof query !== 'string') {
      return [query];
    }

    const cleanQuery = query.trim();
    const fallbackQueries = [
      cleanQuery,
      cleanQuery.replace(/[?\.!]+/g, '').trim()
    ];

    try {
      const historyContext = history.length > 0 
        ? history.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')
        : 'None';

      const prompt = `You are an expert search query expansion system for a RAG vector database.
Given the conversation history and the user's latest query, generate 2-3 concise, high-recall search queries.
- Query 1: Standalone version of the user query resolving pronouns (e.g. replacing "it", "they" with the specific topic discussed).
- Query 2: Keyword-focused semantic search query emphasizing key concepts.
- Query 3: Alternative phrasing or synonym-based search query.

Respond ONLY with a valid JSON array of 2-3 strings. Do not add markdown or extra commentary.

Conversation History:
${historyContext}

Latest User Query: "${cleanQuery}"`;

      const response = await llmService.chatCompletion({
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.2,
        maxTokens: 150
      });

      const parsed = this.safeParseArray(response.content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure original query is included
        const unique = Array.from(new Set([cleanQuery, ...parsed.map(q => String(q).trim())])).filter(Boolean);
        return unique.slice(0, 3);
      }
    } catch (err) {
      logger.warn(`[Query Rewriter] Rewriting fallback used: ${err.message}`);
    }

    return fallbackQueries;
  }

  safeParseArray(str) {
    try {
      const match = str.match(/\[.*\]/s);
      return JSON.parse(match ? match[0] : str);
    } catch (e) {
      return null;
    }
  }
}

module.exports = new QueryRewriterService();
