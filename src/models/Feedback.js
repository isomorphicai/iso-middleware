const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  botId: { type: String, required: true, index: true },
  tenantId: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  messageId: { type: String, default: '' },
  type: { type: String, enum: ['like', 'dislike', 'rating'], required: true },
  rating: { type: Number, min: 1, max: 5 },
  query: { type: String, default: '' },
  response: { type: String, default: '' },
  comment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', FeedbackSchema);
module.exports = Feedback;
