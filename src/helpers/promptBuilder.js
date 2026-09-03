/**
 * Prompt Builder Helper
 * Assembles system instructions, RAG context, and chat history
 */

function buildSystemPrompt(bot, knowledgeSources = []) {
  let basePrompt = bot?.systemPrompt || 'You are an intelligent, helpful AI assistant.';
  
  // Inject knowledge base context if available
  if (knowledgeSources && knowledgeSources.length > 0) {
    const validSources = knowledgeSources.filter(s => s.status === 'synced');
    if (validSources.length > 0) {
      basePrompt += '\n\n### Ingested Knowledge Sources:\n';
      validSources.forEach((src, idx) => {
        basePrompt += `Source ${idx + 1} [${src.type.toUpperCase()}: ${src.name}]: ${src.content || src.path}\n`;
      });
      basePrompt += '\nWhen relevant, reference the above knowledge sources in your answers.';
    }
  }

  return basePrompt;
}

function formatMessagesForLLM(systemPrompt, history = [], currentQuery = '') {
  const messages = [{ role: 'system', content: systemPrompt }];

  // Include recent history (up to last 10 messages)
  if (Array.isArray(history)) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.sender === 'user' || item.role === 'user') {
        messages.push({ role: 'user', content: item.text || item.content || item.query || '' });
      } else if (item.sender === 'bot' || item.role === 'assistant') {
        messages.push({ role: 'assistant', content: item.text || item.content || item.response || '' });
      }
    });
  }

  // Ensure current query is the final user message if not already included
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== currentQuery) {
    if (currentQuery) {
      messages.push({ role: 'user', content: currentQuery });
    }
  }

  return messages;
}

module.exports = {
  buildSystemPrompt,
  formatMessagesForLLM
};
