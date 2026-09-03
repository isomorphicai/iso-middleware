const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'bot', 'system'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: {
    model: { type: String },
    tokens: { type: Number },
    latencyMs: { type: Number },
    intent: { type: String }
  }
}, { _id: true });

const ConversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  botId: { type: String, required: true, index: true },
  tenantId: { type: String, required: true, index: true },
  messages: [MessageSchema],
  status: { type: String, enum: ['active', 'closed', 'transferred'], default: 'active' },
  metadata: {
    ip: { type: String },
    userAgent: { type: String },
    referer: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

ConversationSchema.index({ sessionId: 1, botId: 1 });

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
module.exports = Conversation;
