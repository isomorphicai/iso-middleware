const assert = require('assert');
const app = require('../src/app');
const { DEFAULT_BOT_UI_CONFIGS } = require('../src/constants/botDefaults');
const { buildSystemPrompt, formatMessagesForLLM } = require('../src/helpers/promptBuilder');
const aiService = require('../src/services/aiService');

async function runTests() {
  console.log('Running ISO Middleware unit tests...');

  // 1. Test Bot UI Config Defaults
  assert(DEFAULT_BOT_UI_CONFIGS.botThemeColor === '#00306D', 'Default theme color should match');
  assert(typeof DEFAULT_BOT_UI_CONFIGS.botHeaderText === 'string', 'Header text should be a string');
  console.log('✔ Bot defaults test passed');

  // 2. Test Prompt Builder
  const botMock = {
    name: 'TestBot',
    systemPrompt: 'You are a test assistant.',
    ingestionSources: [
      { name: 'faq.pdf', type: 'file', path: '/uploads/faq.pdf', status: 'synced', content: 'Support hours are 9-5.' }
    ]
  };
  const prompt = buildSystemPrompt(botMock, botMock.ingestionSources);
  assert(prompt.includes('Support hours are 9-5'), 'Prompt should include synced ingestion source');
  console.log('✔ Prompt builder test passed');

  // 3. Test LLM Message Formatting
  const historyMock = [
    { sender: 'user', text: 'Hello' },
    { sender: 'bot', text: 'Hi, how can I help?' }
  ];
  const messages = formatMessagesForLLM(prompt, historyMock, 'What are your hours?');
  assert(messages.length === 4, `Expected 4 messages, got ${messages.length}`);
  assert(messages[0].role === 'system', 'First message should be system');
  assert(messages[messages.length - 1].content === 'What are your hours?', 'Last message should be current query');
  console.log('✔ Message formatting test passed');

  // 4. Test AI Engine Fallback & Intent Handling
  const transferRes = await aiService.generateResponse({
    bot: botMock,
    query: 'I want to speak with a human agent'
  });
  assert(transferRes.form === 'transferCall', 'Should trigger transferCall form for human agent request');
  console.log('✔ AI intent detection test passed');

  console.log('\nAll tests passed successfully! 🎉');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
