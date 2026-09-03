const conversationService = require('../services/conversationService');
const ApiResponse = require('../helpers/apiResponse');

class ConversationController {
  /**
   * GET /api/conversations/:sessionId
   * Retrieve chat history for session
   */
  async getConversation(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { limit } = req.query;

      const history = await conversationService.getHistory(sessionId, limit ? Number(limit) : 50);
      return ApiResponse.success(res, history, 'Conversation history retrieved');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/conversations/:sessionId/transcript
   * Export or download plain-text transcript
   */
  async getTranscript(req, res, next) {
    try {
      const { sessionId } = req.params;
      const transcript = await conversationService.generateTranscript(sessionId);

      if (!transcript) {
        return ApiResponse.notFound(res, 'No conversation found for this session');
      }

      const download = req.query.download === 'true';
      if (download) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="transcript-${sessionId}.txt"`);
        return res.send(transcript);
      }

      return res.json({
        sessionId,
        transcript
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConversationController();
