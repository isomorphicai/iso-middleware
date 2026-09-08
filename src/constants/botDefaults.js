/**
 * Default Bot and UI Configurations
 * Directly mapped to ISO Chatbot requirements and MongoDB botUIConfigs schema.
 */

const DEFAULT_BOT_UI_CONFIGS = {
  botThemeColor: '#00306D',
  botChatStartImage: 'https://bbh-product-bucket.s3.us-east-2.amazonaws.com/a04ac944-0efc-4f92-84cd-9463c94f0505.png',
  botResponseBackgroundColor: '#EFEFEF',
  userQueryBackgroundColor: '#EFEFEF',
  botResponseFontColor: '#1F2937',
  userQueryFontColor: '#1F2937',
  bgColor: '#ffffff',
  logoUrl: 'https://bbh-product-bucket.s3.us-east-2.amazonaws.com/a04ac944-0efc-4f92-84cd-9463c94f0505.png',
  botHeaderText: 'ISO AI Assistant',
  DefaultEmptyMessage: 'Type your message...',
  helpNotificationRenderTime: 10000,
  helpNotificationRenderMsg: 'Hi! I am ISO AI Assistant. I can help answer your questions and resolve common issues.',
  idleStatMessages: [
    { message: 'I’m waiting for your next question', time: 180 },
    { message: 'Since there was no response, we are ending this chat session. Please re-initiate anytime.', time: 240 }
  ],
  chatPosition: 'fixed',
  chatPositionLeft: 'auto',
  chatAlignmentLeft: false,
  chatPositionRight: '30px',
  chatPositionTop: 'auto',
  chatPositionBottom: '20px',
  chatIconWidth: '90',
  chatIconHeight: '90',
  chatMobileIconWidth: '70',
  chatMobileIconHeight: '70',
  chatMobileVerticalIconWidth: '90',
  chatMobileVerticalIconHeight: '90',
  chatIconAltText: 'Chat with Us',
  chatIconTitleText: 'Chat with Us',
  allowMultiLangSupport: false,
  demoBackgroundUrl: '',
  likeIcon: 'https://bbh-product-bucket.s3.us-east-2.amazonaws.com/dba2acac-c841-47b7-be3f-106ed4b66fef.png',
  dislikeIcon: 'https://bbh-product-bucket.s3.us-east-2.amazonaws.com/a91652f3-c1f1-4396-8aab-45793777ef09.png',
  botChatSubmitButton: true,
  isChatOpened: false,
  transferFormDelay: 5,
  showThumbUpDownFeedbackform: true,
  showHelpButton: true,
  helpButtonUrl: 'https://vsc.blackbelthelp.com/help',
  poweredBy: 'AI powered by <span>Isomorphic</span>',
  welcomeMessage: 'Hi! I’m your AI assistant. How can I assist you today?',
  surveySubmitButtonText: 'Submit Feedback',
  surveySubmitButtonColor: '',
  surveySubmitButtonTextColor: '',
  notifications: []
};

const DEFAULT_GREETING_MESSAGE = [
  'Hi! I’m your ISO AI Assistant. I specialize in answering questions and assisting with support inquiries. How can I help you today?'
];

const DEFAULT_CUSTOM_FORMS = [
  {
    name: 'transferCall',
    title: 'Request a Live Agent Call',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'notes', label: 'Notes', type: 'textarea', required: false }
    ],
    submitText: 'Request Call',
    postbackUrl: '/api/chat/form-submit'
  },
  {
    name: 'survey',
    title: 'Chat Feedback Survey',
    fields: [
      { name: 'rating', label: 'Rating (1-5)', type: 'number', required: true, min: 1, max: 5 },
      { name: 'comments', label: 'Feedback Comments', type: 'textarea', required: false }
    ],
    submitText: 'Submit Feedback',
    postbackUrl: '/api/chat/form-submit'
  }
];

module.exports = {
  DEFAULT_BOT_UI_CONFIGS,
  DEFAULT_GREETING_MESSAGE,
  DEFAULT_CUSTOM_FORMS
};
