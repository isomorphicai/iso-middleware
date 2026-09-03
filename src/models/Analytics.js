const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  botId: { type: mongoose.Schema.Types.Mixed, required: true, unique: true, index: true },
  summary: {
    totalConversations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    userSatisfaction: { type: Number, default: 100 },
    activeUsers: { type: Number, default: 0 }
  },
  tokenUsage: {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 }
  },
  dailyActivity: [{
    date: { type: String },
    messages: { type: Number, default: 0 },
    conversations: { type: Number, default: 0 }
  }],
  topQueries: [{
    query: { type: String },
    count: { type: Number, default: 1 },
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' }
  }]
}, {
  timestamps: true
});

const Analytics = mongoose.models.Analytics || mongoose.model('Analytics', AnalyticsSchema);
module.exports = Analytics;
