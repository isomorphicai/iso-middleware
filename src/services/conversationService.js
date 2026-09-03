const { Conversation } = require('../models');
const logger = require('../helpers/logger');

class ConversationService {
  /**
   * Add message exchange (user query + bot response) to a conversation session
   */
  async recordExchange({ sessionId, botId, tenantId, userQuery, botResponse, metadata = {}, clientInfo = {} }) {
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    try {
      let conversation = await Conversation.findOne({ sessionId, botId });

      if (!conversation) {
        conversation = new Conversation({
          sessionId,
          botId,
          tenantId: tenantId || 'default',
          messages: [],
          metadata: {
            ip: clientInfo.ip || '',
            userAgent: clientInfo.userAgent || '',
            referer: clientInfo.referer || ''
          }
        });
      }

      // Add user message
      conversation.messages.push({
        sender: 'user',
        text: userQuery,
        timestamp: new Date()
      });

      // Add bot message
      conversation.messages.push({
        sender: 'bot',
        text: botResponse,
        timestamp: new Date(),
        metadata: {
          model: metadata.model || '',
          tokens: metadata.tokens ? (metadata.tokens.completion || 0) : 0,
          latencyMs: metadata.latencyMs || 0
        }
      });

      await conversation.save();
      return conversation;
    } catch (err) {
      logger.error('Failed to record conversation exchange:', err);
      return null;
    }
  }

  /**
   * Fetch conversation history by session ID
   */
  async getHistory(sessionId, limit = 20) {
    const conversation = await Conversation.findOne({ sessionId }).lean();
    if (!conversation) {
      return [];
    }
    return (conversation.messages || []).slice(-limit);
  }

  /**
   * Export plain text transcript
   */
  async generateTranscript(sessionId) {
    const conversation = await Conversation.findOne({ sessionId }).lean();
    if (!conversation) {
      return null;
    }

    let transcript = `==============================================\n`;
    transcript += `CHAT TRANSCRIPT: Session ${sessionId}\n`;
    transcript += `Bot ID: ${conversation.botId} | Tenant: ${conversation.tenantId}\n`;
    transcript += `Date: ${new Date(conversation.createdAt).toLocaleString()}\n`;
    transcript += `==============================================\n\n`;

    (conversation.messages || []).forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const speaker = msg.sender.toUpperCase();
      transcript += `[${time}] ${speaker}: ${msg.text}\n\n`;
    });

    return transcript;
  }
}

module.exports = new ConversationService();
