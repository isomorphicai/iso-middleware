const env = require('../config/env');
const logger = require('../helpers/logger');
const { buildSystemPrompt, formatMessagesForLLM } = require('../helpers/promptBuilder');

class AIService {
  /**
   * Main entrypoint to generate chat response
   */
  async generateResponse({ bot, query, history = [], tenantId = '' }) {
    const startTime = Date.now();
    const systemPrompt = buildSystemPrompt(bot, bot?.ingestionSources || []);
    
    // Check if OpenAI API key is configured
    if (env.OPENAI_API_KEY) {
      try {
        const response = await this.callOpenAI({
          apiKey: env.OPENAI_API_KEY,
          model: bot?.model || env.OPENAI_MODEL,
          temperature: bot?.temperature || 0.7,
          messages: formatMessagesForLLM(systemPrompt, history, query)
        });
        
        const latencyMs = Date.now() - startTime;
        return {
          text: response.content,
          tokens: response.tokens,
          latencyMs,
          model: bot?.model || env.OPENAI_MODEL,
          provider: 'openai'
        };
      } catch (err) {
        logger.warn(`OpenAI API failed, falling back to local engine: ${err.message}`);
      }
    }

    // Default intelligent local responder
    const fallbackResponse = this.generateIntelligentFallback(bot, query);
    const latencyMs = Date.now() - startTime;

    return {
      text: fallbackResponse.text,
      form: fallbackResponse.form,
      quickReplies: fallbackResponse.quickReplies,
      tokens: { prompt: query.length / 4, completion: fallbackResponse.text.length / 4 },
      latencyMs,
      model: bot?.model || 'iso-local-engine',
      provider: 'iso-engine'
    };
  }

  /**
   * Call OpenAI API using native fetch (Node.js 18+)
   */
  async callOpenAI({ apiKey, model, temperature, messages }) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model.includes('claude') ? 'gpt-4o-mini' : model, // Fallback to compatible model if configured model isn't OpenAI
        temperature,
        messages
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API returned status ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || 'No response generated.',
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Intelligent local fallback engine
   * Matches intents, system instructions, and knowledge sources
   */
  generateIntelligentFallback(bot, query) {
    const botName = bot?.name || 'ISO AI';
    const qLower = query.toLowerCase().trim();

    // Check for call transfer / live agent requests
    if (qLower.includes('human') || qLower.includes('transfer') || qLower.includes('live agent') || qLower.includes('representative') || qLower.includes('call me')) {
      return {
        text: `I'd be glad to connect you with one of our support representatives. Please fill out the quick transfer form below:`,
        form: 'transferCall',
        quickReplies: ['Cancel request', 'Help with something else']
      };
    }

    // Check for survey / feedback requests
    if (qLower.includes('survey') || qLower.includes('give feedback') || qLower.includes('review')) {
      return {
        text: `We would love to hear your thoughts! Please complete our quick survey below:`,
        form: 'survey',
        quickReplies: ['Done', 'Contact support']
      };
    }

    // Greetings
    if (/^(hi|hello|hey|good morning|good afternoon|greetings)/i.test(qLower)) {
      return {
        text: `Hello! I'm ${botName}. How can I assist you today?`,
        quickReplies: ['Check documentation', 'Contact support', 'What services are offered?']
      };
    }

    // Knowledge source queries
    if (bot?.ingestionSources && bot.ingestionSources.length > 0) {
      const matchedSource = bot.ingestionSources.find(s => 
        qLower.includes(s.name.toLowerCase().split('.')[0]) ||
        (s.content && s.content.toLowerCase().includes(qLower))
      );
      if (matchedSource) {
        return {
          text: `Based on **${matchedSource.name}**, here is the relevant information to address your question. If you need more specifics, feel free to ask!`,
          quickReplies: ['Tell me more', 'I have another question']
        };
      }
    }

    // Common query intents
    if (qLower.includes('password') || qLower.includes('reset')) {
      return {
        text: `To reset your credentials, visit the account settings portal and select "Forgot Password". A secure verification link will be sent to your registered email.`,
        quickReplies: ['Didn’t receive email', 'Contact admin']
      };
    }

    if (qLower.includes('help') || qLower.includes('support')) {
      return {
        text: `I can assist with account setup, navigation, documentation lookups, and troubleshooting. You can also request a live agent transfer at any time.`,
        quickReplies: ['Transfer to agent', 'View docs', 'Ask another question']
      };
    }

    // System prompt contextual response
    const snippet = bot?.systemPrompt ? bot.systemPrompt.slice(0, 120) : 'helpful AI assistant';
    return {
      text: `Thank you for your message. As ${botName}, I have processed your inquiry ("${query}"). Let me know how else I can assist!`,
      quickReplies: ['Tell me more', 'Request representative']
    };
  }
}

module.exports = new AIService();
