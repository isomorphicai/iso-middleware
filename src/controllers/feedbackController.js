const mongoose = require('mongoose');
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
        botId = 'isobot',
        tenantId = 'onestop',
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

      const feedbackType = type || (Number(rating) >= 3 ? 'like' : 'dislike');
      const numericRating = rating ? Number(rating) : (feedbackType === 'like' ? 5 : 1);

      const feedback = new Feedback({
        botId,
        tenantId,
        sessionId,
        messageId,
        type: feedbackType,
        rating: numericRating,
        query,
        response,
        comment
      });

      await feedback.save().catch(() => {});
      logger.info(`Recorded feedback '${feedbackType}' for sessionId='${sessionId}', botId='${botId}'`);

      // Update the turn document in master > conversationHistory
      if (sessionId) {
        try {
          const client = mongoose.connection?.client 
            || (mongoose.connection && typeof mongoose.connection.getClient === 'function' && mongoose.connection.getClient())
            || (mongoose.connections && mongoose.connections[0] && mongoose.connections[0].client);

          const masterDb = client ? client.db('master') : mongoose.connection.useDb('master').db;
          const convCol = masterDb.collection('conversationHistory');

          let queryFilter = { sessionId };
          if (messageId) {
            queryFilter = { 
              $or: [
                { sessionId, messageId }, 
                { sessionId, 'metadata.messageId': messageId }, 
                { sessionId }
              ] 
            };
          }

          // Find the matching or latest turn document in the session
          const turnDocs = await convCol.find(queryFilter).sort({ createdAt: -1 }).limit(1).toArray();
          const turnDoc = turnDocs[0];
          if (turnDoc) {
            await convCol.updateOne(
              { _id: turnDoc._id },
              { 
                $set: { 
                  userFeedback: feedbackType, 
                  feedbackType: feedbackType, 
                  feedbackAt: new Date(),
                  feedbackRating: numericRating,
                  feedbackComment: comment || '',
                  updatedAt: new Date()
                } 
              }
            );
            logger.info(`Attached userFeedback='${feedbackType}' to conversation turn ${turnDoc._id}`);
          }
        } catch (dbErr) {
          logger.warn(`Failed to update conversationHistory with feedback: ${dbErr.message}`);
        }
      }

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
