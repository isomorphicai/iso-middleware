const mongoose = require('mongoose');
const { DEFAULT_BOT_UI_CONFIGS, DEFAULT_GREETING_MESSAGE, DEFAULT_CUSTOM_FORMS } = require('../constants/botDefaults');

const IngestionSourceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['url', 'file', 'text'], required: true },
  path: { type: String, required: true },
  size: { type: String, default: 'N/A' },
  status: { type: String, enum: ['synced', 'pending', 'failed'], default: 'pending' },
  content: { type: String, default: '' }, // Extracted text content for RAG
  updatedAt: { type: Date, default: Date.now }
});

const BotSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true }, // e.g. "ISOBot", "acme-support"
  description: { type: String, default: '' },
  model: { type: String, default: 'gpt-4-turbo' },
  temperature: { type: Number, default: 0.7, min: 0, max: 2 },
  systemPrompt: { 
    type: String, 
    default: 'You are an intelligent, friendly AI assistant. Answer the user queries accurately and helpfully.' 
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  
  // Chatbot Widget Specific Fields
  greetingMessage: { 
    type: [String], 
    default: DEFAULT_GREETING_MESSAGE 
  },
  welcomeMessage: { 
    type: String, 
    default: 'Hi! I’m your AI assistant. How can I assist you today?' 
  },
  quickReplies: [{ type: String }],
  customForms: { 
    type: [mongoose.Schema.Types.Mixed], 
    default: DEFAULT_CUSTOM_FORMS 
  },
  botUIConfigs: { 
    type: mongoose.Schema.Types.Mixed, 
    default: DEFAULT_BOT_UI_CONFIGS 
  },
  
  // Knowledge Base Ingestion
  ingestionSources: [IngestionSourceSchema],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Composite index for fast tenant + bot lookup
BotSchema.index({ tenantId: 1, code: 1 });

/**
 * Transforms the MongoDB document to the format expected by chatbot.js
 */
BotSchema.methods.toWidgetConfig = function() {
  const ui = { ...DEFAULT_BOT_UI_CONFIGS, ...(this.botUIConfigs || {}) };
  return {
    _id: this._id.toString(),
    botId: this.code,
    botName: this.name,
    botActive: this.status === 'active',
    updatedSince: this.updatedAt ? this.updatedAt.toISOString() : new Date().toISOString(),
    greetingMessage: (this.greetingMessage && this.greetingMessage.length) ? this.greetingMessage : DEFAULT_GREETING_MESSAGE,
    welcomeMessage: this.welcomeMessage || (this.greetingMessage && this.greetingMessage[0]) || ui.welcomeMessage,
    customForms: this.customForms || DEFAULT_CUSTOM_FORMS,
    quickReplies: this.quickReplies || [],
    botUIConfigs: {
      ...ui,
      botHeaderText: ui.botHeaderText || this.name,
      welcomeMessage: this.welcomeMessage || ui.welcomeMessage
    }
  };
};

const Bot = mongoose.models.Bot || mongoose.model('Bot', BotSchema);
module.exports = Bot;
