const { Feedback } = require('../models');
const ApiResponse = require('../helpers/apiResponse');
const logger = require('../helpers/logger');

class FeedbackController {
  /**
   * POST /api/chat/feedback
   * Record user thumbs-up, thumbs-down, or rating feedback
   */
  async submitFeedback(req, res, next) {
    try {
      const {
        botId = 'ISOBot',
        tenantId = '',
        sessionId = '',
        messageId = '',
        type, // 'like' | 'dislike' | 'rating'
        rating,
        query = '',
        response = '',
        comment = ''
      } = req.body;

      if (!type && !rating) {
        return ApiResponse.badRequest(res, 'Feedback type (like/dislike) or rating is required');
      }

      const feedback = new Feedback({
        botId,
        tenantId,
        sessionId,
        messageId,
        type: type || (rating >= 3 ? 'like' : 'dislike'),
        rating: rating ? Number(rating) : (type === 'like' ? 5 : 1),
        query,
        response,
        comment
      });

      await feedback.save();
      logger.info(`Recorded feedback '${feedback.type}' for botId='${botId}'`);

      return ApiResponse.created(res, feedback, 'Feedback recorded successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/chat/feedback
   * Get feedback records (for analytics/audit)
   */
  async getFeedback(req, res, next) {
    try {
      const { botId, type, page = 1, limit = 50 } = req.query;
      const filter = {};
      if (botId) filter.botId = botId;
      if (type) filter.type = type;

      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        Feedback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        Feedback.countDocuments(filter)
      ]);

      return ApiResponse.success(res, items, 'Feedback fetched successfully', 200, {
        pagination: { total, page: Number(page), limit: Number(limit) }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FeedbackController();
