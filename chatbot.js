/**
 * ISO Chatbot - Embeddable Customizable Widget
 * Built by Isomorphic.
 * 
 * Simply add: <script src="chatbot.js"></script>
 * The script calls the configuration API first, applies botUIConfigs,
 * and renders the customizable welcome message as soon as the bot opens.
 */

(function () {
  // Prevent double loading
  if (window.IsoChatbotInitialized) return;
  window.IsoChatbotInitialized = true;

  // Default API Endpoints (points to iso-middleware on port 5000)
  const DEFAULT_CONFIG_API_URL = "http://localhost:5000/api/bot-config";
  const DEFAULT_CHAT_API_URL = "http://localhost:5000/api/chat";

  // Isometric SVG Logo
  const ISO_LOGO_SVG = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#isoGrad1)" stroke="rgba(255,255,255,0.4)" stroke-width="0.75" stroke-linejoin="round"/>
      <path d="M2 7V17L12 22V12L2 7Z" fill="url(#isoGrad2)" stroke="rgba(255,255,255,0.4)" stroke-width="0.75" stroke-linejoin="round"/>
      <path d="M12 12V22L22 17V7L12 12Z" fill="url(#isoGrad3)" stroke="rgba(255,255,255,0.4)" stroke-width="0.75" stroke-linejoin="round"/>
      <defs>
        <linearGradient id="isoGrad1" x1="2" y1="2" x2="22" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#C5A059"/>
          <stop offset="100%" stop-color="#EFE6D1"/>
        </linearGradient>
        <linearGradient id="isoGrad2" x1="2" y1="7" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0A2240"/>
          <stop offset="100%" stop-color="#16365C"/>
        </linearGradient>
        <linearGradient id="isoGrad3" x1="12" y1="12" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#C5A059"/>
          <stop offset="100%" stop-color="#0A2240"/>
        </linearGradient>
      </defs>
    </svg>
  `;

  // --------------------------------------------------------
  // 1. DEFAULT CONFIGURATION (Based on MongoDB Atlas Schema)
  // --------------------------------------------------------
  const DEFAULT_CONFIG = {
    _id: "6a97bb88eabe0901e52bb290",
    botId: "ISOBot",
    tenantId: "onestop",
    teanantId: "onestop",
    botName: "ISO Bot",
    chatApiUrl: DEFAULT_CHAT_API_URL,
    updatedSince: "2026-09-01T07:45:06.258Z",
    greetingMessage: [
      "Hi! I’m ISO, your AI assistant. I specialize in helping students with their questions and solving common academic or technology-related issues. How can I assist you today?"
    ],
    botActive: true,
    customForms: [
      {
        type: "form",
        name: "transferCall",
        intent: ["transfer_call"],
        status: "enabled",
        title: "Please provide the information",
        showCancelledButton: false,
        payload: {
          fields: [
            { title: "Full Name", name: "FullName", type: "text", validate: { required: true } },
            { title: "Email", name: "Email", type: "text", validate: { required: true, email: true } },
            { title: "Phone", name: "Phone", type: "text", validate: { required: true } },
            { title: "Additional Information", name: "AdditionalInformation", type: "text", validate: { required: false } },
            { title: "Username / Student ID {optional}", name: "username", type: "text", validate: { required: false } },
            { title: "Escalated", name: "status", type: "hidden", validate: { required: false } }
          ],
          submitButtonTitle: "Submit",
          postbackUrl: "",
          method: "POST"
        }
      },
      {
        type: "form",
        name: "survey",
        intent: ["smalltalk.greetings.bye", "end_chat"],
        status: "enabled",
        title: "Post Survey",
        showCancelledButton: false,
        showDownloadButton: true,
        payload: {
          fields: [
            { title: "Rating", name: "rating", type: "rating", validate: { required: true } },
            { title: "Feedback", name: "feedback", type: "textarea", validate: { required: true } },
            { title: "Closed", name: "status", type: "hidden", validate: { required: false } }
          ],
          submitButtonTitle: "Submit",
          downloadTranscriptButtonTitle: "Download Transcript",
          postbackUrl: "",
          method: "POST"
        }
      }
    ],
    botUIConfigs: {
      botThemeColor: "#0A2240",
      botAccentColor: "#C5A059",
      botChatStartImage: "https://bbh-product-bucket.s3.us-east-2.amazonaws.com/a04ac944-0efc-4f92-84cd-9463c94f0505.png",
      botResponseBackgroundColor: "#FFFFFF",
      userQueryBackgroundColor: "#0A2240",
      botResponseFontColor: "#0F172A",
      userQueryFontColor: "#FFFFFF",
      bgColor: "#F8FAFC",
      logoUrl: "https://bbh-product-bucket.s3.us-east-2.amazonaws.com/a04ac944-0efc-4f92-84cd-9463c94f0505.png",
      botHeaderText: "Isomorphic AI",
      DefaultEmptyMessage: "",
      helpNotificationRenderTime: 10000,
      helpNotificationRenderMsg: "Hi! I am CoolBot, an AI chatbot. I can provide answers to your technology questions and resources to resolve some of the most common issues.",
      idleStatMessages: [
        {
          message: "I’m waiting for your next question",
          time: 180
        },
        {
          message: "Since there was no response from your end, hence we are ending the chat session. Please re initiate the chat for further support.",
          time: 240
        }
      ],
      chatPosition: "fixed",
      chatPositionLeft: "auto",
      chatAlignmentLeft: false,
      chatPositionRight: "30px",
      chatPositionTop: "auto",
      chatPositionBottom: "20px",
      chatIconWidth: "90",
      chatIconHeight: "90",
      chatMobileIconWidth: "70",
      chatMobileIconHeight: "70",
      chatMobileVerticalIconWidth: "90",
      chatMobileVerticalIconHeight: "90",
      chatIconAltText: "Chat with Us",
      chatIconTitleText: "Chat with Us",
      allowMultiLangSupport: false,
      demoBackgroundUrl: "",
      likeIcon: "https://bbh-product-bucket.s3.us-east-2.amazonaws.com/dba2acac-c841-47b7-be3f-106ed4b66fef.png",
      dislikeIcon: "https://bbh-product-bucket.s3.us-east-2.amazonaws.com/a91652f3-c1f1-4396-8aab-45793777ef09.png",
      botChatSubmitButton: false,
      isChatOpened: false,
      transferFormDelay: 5,
      showThumbUpDownFeedbackform: true,
      showHelpButton: true,
      helpButtonUrl: "https://vsc.blackbelthelp.com/help",
      poweredBy: "AI powered by <span>Isomorphic</span>",
      notifications: []
    },
    apiEndpoint: "",
    configEndpoint: "",
    persistHistory: false,
    quickReplies: [
      "Academic Assistance",
      "Technology Support",
      "Transfer to Live Agent",
      "End Chat Session"
    ]
  };

  // State Management
  let config = deepMerge({}, DEFAULT_CONFIG);
  let isChatOpen = false;
  let isMinimized = false;
  let isTyping = false;
  let chatHistory = [];
  let isSessionEnded = false;

  // Timers
  let helpNotificationTimer = null;
  let helpNotificationDismissed = false;
  let idleCheckInterval = null;
  let idleSeconds = 0;
  let idleMessagesSentCount = 0;

  // DOM References
  let widgetContainer = null;
  let chatToggle = null;
  let chatWindow = null;
  let chatBody = null;
  let textInput = null;
  let sendButton = null;
  let helpNotificationEl = null;

  // --------------------------------------------------------
  // 2. HELPER UTILITIES
  // --------------------------------------------------------
  function parseMongoNumber(val, defaultVal = 0) {
    if (val === null || val === undefined) return defaultVal;
    if (typeof val === "number") return val;
    if (typeof val === "object") {
      if (val.$numberInt !== undefined) return parseInt(val.$numberInt, 10);
      if (val.$numberLong !== undefined) return parseInt(val.$numberLong, 10);
    }
    if (typeof val === "string") {
      const cleaned = val.replace(/NumberInt\(['"]?(\d+)['"]?\)/, "$1");
      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? defaultVal : parsed;
    }
    return defaultVal;
  }

  function normalizeUnit(val, defaultVal = "auto") {
    if (val === null || val === undefined) return defaultVal;
    val = String(val).trim();
    if (val === "" || val === "auto") return "auto";
    if (/^\d+$/.test(val)) return `${val}px`;
    return val;
  }

  function getContrastColor(hexColor, fallbackLight = "#ffffff", fallbackDark = "#1E293B") {
    if (!hexColor || typeof hexColor !== "string" || !hexColor.startsWith("#")) {
      return fallbackDark;
    }
    const hex = hexColor.replace("#", "");
    if (hex.length !== 6 && hex.length !== 3) return fallbackDark;
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? fallbackDark : fallbackLight;
  }

  function sanitizeBsonString(str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/ObjectId\(['"]([0-9a-fA-F]+)['"]\)/g, '"$1"')
      .replace(/NumberInt\(['"]?([0-9]+)['"]?\)/g, "$1")
      .replace(/NumberLong\(['"]?([0-9]+)['"]?\)/g, "$1")
      .replace(/ISODate\(['"]([^'"]+)['"]\)/g, '"$1"');
  }

  function deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (Array.isArray(source[key])) {
          output[key] = source[key].slice();
        } else if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  function isObject(item) {
    return (item && typeof item === "object" && !Array.isArray(item));
  }

  function normalizeConfigs(cfg) {
    if (!cfg || !cfg.botUIConfigs) return cfg;
    const ui = cfg.botUIConfigs;
    if (ui.helpNotificationRenderTime !== undefined) {
      ui.helpNotificationRenderTime = parseMongoNumber(ui.helpNotificationRenderTime, 10000);
    }
    if (ui.transferFormDelay !== undefined) {
      ui.transferFormDelay = parseMongoNumber(ui.transferFormDelay, 5);
    }
    if (Array.isArray(ui.idleStatMessages)) {
      ui.idleStatMessages.forEach(item => {
        item.time = parseMongoNumber(item.time, 180);
      });
      ui.idleStatMessages.sort((a, b) => a.time - b.time);
    }
    return cfg;
  }

  function applyLoadedConfig(loadedData) {
    if (!loadedData) return;
    if (loadedData.botUIConfigs) {
      config = deepMerge(config, loadedData);
    } else {
      config.botUIConfigs = deepMerge(config.botUIConfigs, loadedData);
      if (loadedData.botName) config.botName = loadedData.botName;
      if (loadedData.botId) config.botId = loadedData.botId;
    }

    // Explicitly sync greetingMessage from loaded document (MongoDB sends it at root level)
    if (loadedData.greetingMessage) {
      config.greetingMessage = loadedData.greetingMessage;
      if (!config.botUIConfigs) config.botUIConfigs = {};
      config.botUIConfigs.greetingMessage = Array.isArray(loadedData.greetingMessage) ? loadedData.greetingMessage : [loadedData.greetingMessage];
      config.botUIConfigs.welcomeMessage = Array.isArray(loadedData.greetingMessage) ? loadedData.greetingMessage[0] : loadedData.greetingMessage;
    }

    if (loadedData.tenantId || loadedData.teanantId) {
      config.tenantId = loadedData.tenantId || loadedData.teanantId;
      config.teanantId = config.tenantId;
    }
    if (loadedData.chatApiUrl || loadedData.apiEndpoint) {
      config.chatApiUrl = loadedData.chatApiUrl || loadedData.apiEndpoint;
      config.apiEndpoint = config.chatApiUrl;
    }

    // Ensure welcomeMessage and greetingMessage stay synchronized in botUIConfigs
    const ui = config.botUIConfigs || {};
    if (ui.welcomeMessage && (!ui.greetingMessage || ui.greetingMessage.length === 0)) {
      ui.greetingMessage = Array.isArray(ui.welcomeMessage) ? ui.welcomeMessage : [ui.welcomeMessage];
    } else if (ui.greetingMessage && ui.greetingMessage.length > 0 && !ui.welcomeMessage) {
      ui.welcomeMessage = Array.isArray(ui.greetingMessage) ? ui.greetingMessage[0] : ui.greetingMessage;
    }
  }

  // --------------------------------------------------------
  // 3. API CALLER INSIDE CHATBOT.JS (Executes First)
  // --------------------------------------------------------
  async function fetchConfigFromAPI() {
    const currentScript = document.currentScript;
    let botId = config.botId;
    let tenantId = config.tenantId;
    let apiEndpoint = DEFAULT_CONFIG_API_URL;

    if (currentScript) {
      botId = currentScript.getAttribute("data-bot-id") || botId;
      tenantId = currentScript.getAttribute("data-tenant-id") ||
                 currentScript.getAttribute("data-teanant-id") ||
                 tenantId;
      apiEndpoint = currentScript.getAttribute("data-api-url") ||
                    currentScript.getAttribute("data-config-endpoint") ||
                    apiEndpoint;

      const chatApi = currentScript.getAttribute("data-chat-api") ||
                      currentScript.getAttribute("data-chat-endpoint") ||
                      currentScript.getAttribute("data-query-api");
      if (chatApi) {
        config.chatApiUrl = chatApi;
        config.apiEndpoint = chatApi;
      }

      // Handle any inline JSON on the script tag as early override
      try {
        const scriptText = currentScript.innerHTML.trim();
        if (scriptText) {
          const sanitized = sanitizeBsonString(scriptText);
          const parsed = JSON.parse(sanitized);
          applyLoadedConfig(parsed);
        }
      } catch (e) {
        // Continue if no inline JSON
      }
    }

    config.botId = botId;
    config.tenantId = tenantId;
    config.teanantId = tenantId;

    // Check if client provided window.botSettings or window.botUIConfigs
    if (window.botSettings) {
      applyLoadedConfig(window.botSettings);
    } else if (window.botUIConfigs) {
      applyLoadedConfig({ botUIConfigs: window.botUIConfigs });
    }

    if (window.tenantId || window.teanantId) {
      config.tenantId = window.tenantId || window.teanantId;
      config.teanantId = config.tenantId;
    }

    // Call the config API endpoint
    if (apiEndpoint) {
      try {
        const separator = apiEndpoint.includes("?") ? "&" : "?";
        const fetchUrl = `${apiEndpoint}${separator}botId=${encodeURIComponent(botId)}&tenantId=${encodeURIComponent(config.tenantId)}`;
        const response = await fetch(fetchUrl);
        if (response.ok) {
          const apiConfig = await response.json();
          applyLoadedConfig(apiConfig);
        } else {
          console.warn(`[ISO Chatbot] Config API responded with status ${response.status}. Using defaults.`);
        }
      } catch (err) {
        console.warn("[ISO Chatbot] Config API not reachable, using fallback defaults.", err);
      }
    }

    normalizeConfigs(config);
  }

  // --------------------------------------------------------
  // 4. STYLE INJECTION (Unique "iso-" CSS namespace)
  // --------------------------------------------------------
  function injectStyles() {
    const styleId = "iso-theme-styles";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const ui = config.botUIConfigs || {};

    const primaryColor = ui.botThemeColor || "#00306D";
    const bgColor = ui.bgColor || "#ffffff";
    const botMsgBg = ui.botResponseBackgroundColor || "#EFEFEF";
    const userMsgBg = ui.userQueryBackgroundColor || "#EFEFEF";

    const botMsgColor = ui.botResponseFontColor && ui.botResponseFontColor.trim() !== ""
      ? ui.botResponseFontColor
      : getContrastColor(botMsgBg);

    const userMsgColor = ui.userQueryFontColor && ui.userQueryFontColor.trim() !== ""
      ? ui.userQueryFontColor
      : getContrastColor(userMsgBg);

    const posBottom = normalizeUnit(ui.chatPositionBottom, "20px");
    const posTop = ui.chatPositionTop && ui.chatPositionTop !== "auto" ? normalizeUnit(ui.chatPositionTop) : "auto";
    const isAlignLeft = ui.chatAlignmentLeft === true || (ui.chatPositionLeft && ui.chatPositionLeft !== "auto");
    const posLeft = isAlignLeft ? normalizeUnit(ui.chatPositionLeft || "30px") : "auto";
    const posRight = !isAlignLeft ? normalizeUnit(ui.chatPositionRight || "30px") : "auto";

    const iconWidth = normalizeUnit(ui.chatIconWidth, "90px");
    const iconHeight = normalizeUnit(ui.chatIconHeight, "90px");
    const mobileIconWidth = normalizeUnit(ui.chatMobileIconWidth, "70px");
    const mobileIconHeight = normalizeUnit(ui.chatMobileIconHeight, "70px");

    const submitBtnDisplay = ui.botChatSubmitButton === true ? "flex" : (ui.botChatSubmitButton === false ? "none" : "flex");

    styleEl.innerHTML = `
      :root {
        --iso-primary: ${primaryColor};
        --iso-bg: ${bgColor};
        --iso-bot-msg-bg: ${botMsgBg};
        --iso-bot-msg-color: ${botMsgColor};
        --iso-user-msg-bg: ${userMsgBg};
        --iso-user-msg-color: ${userMsgColor};
        --iso-font: "Inter", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
        --iso-pos-bottom: ${posBottom};
        --iso-pos-top: ${posTop};
        --iso-pos-left: ${posLeft};
        --iso-pos-right: ${posRight};
        --iso-icon-w: ${iconWidth};
        --iso-icon-h: ${iconHeight};
        --iso-mobile-icon-w: ${mobileIconWidth};
        --iso-mobile-icon-h: ${mobileIconHeight};
        --iso-accent: #C5A059;
      }

      .iso-scope * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: var(--iso-font);
        -webkit-font-smoothing: antialiased;
      }

      .iso-container {
        position: ${ui.chatPosition || "fixed"};
        bottom: var(--iso-pos-bottom);
        top: var(--iso-pos-top);
        left: var(--iso-pos-left);
        right: var(--iso-pos-right);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: ${isAlignLeft ? "flex-start" : "flex-end"};
      }

      /* Help Notification Callout Bubble */
      .iso-help-callout {
        position: absolute;
        bottom: calc(100% + 14px);
        ${isAlignLeft ? "left: 0;" : "right: 0;"}
        width: 300px;
        max-width: calc(100vw - 40px);
        background: #ffffff;
        color: #1E293B;
        border-radius: 14px;
        padding: 14px 34px 14px 16px;
        box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.08);
        font-size: 13px;
        line-height: 1.45;
        cursor: pointer;
        z-index: 1000000;
        animation: iso-callout-anim 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: transform 0.2s ease;
      }

      .iso-help-callout:hover {
        transform: translateY(-2px);
      }

      .iso-help-callout::after {
        content: '';
        position: absolute;
        bottom: -7px;
        ${isAlignLeft ? "left: 32px;" : "right: 32px;"}
        width: 14px;
        height: 14px;
        background: #ffffff;
        transform: rotate(45deg);
        border-right: 1px solid rgba(0, 0, 0, 0.08);
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .iso-callout-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: transparent;
        border: none;
        width: 22px;
        height: 22px;
        font-size: 16px;
        line-height: 1;
        color: #94A3B8;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s, color 0.2s;
      }

      .iso-callout-close:hover {
        background: #F1F5F9;
        color: #1E293B;
      }

      @keyframes iso-callout-anim {
        from { opacity: 0; transform: translateY(8px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Customizable Launcher Toggle */
      .iso-toggle {
        width: var(--iso-icon-w);
        height: var(--iso-icon-h);
        border-radius: 50%;
        background-color: var(--iso-primary);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 26px rgba(0, 0, 0, 0.2);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
        position: relative;
        overflow: hidden;
        padding: 0;
      }

      .iso-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28);
      }

      .iso-toggle:active {
        transform: scale(0.96);
      }

      .iso-start-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        transition: transform 0.3s ease, opacity 0.25s ease;
        display: block;
      }

      .iso-chat-icon {
        width: 50%;
        height: 50%;
        color: #ffffff;
        transition: transform 0.3s ease, opacity 0.25s ease;
      }

      .iso-close-icon {
        position: absolute;
        width: 40%;
        height: 40%;
        color: #ffffff;
        opacity: 0;
        transform: rotate(-90deg) scale(0.5);
        transition: transform 0.3s ease, opacity 0.25s ease;
      }

      .iso-active .iso-toggle .iso-start-img,
      .iso-active .iso-toggle .iso-chat-icon {
        opacity: 0;
        transform: rotate(90deg) scale(0.4);
      }

      .iso-active .iso-toggle .iso-close-icon {
        opacity: 1;
        transform: rotate(0) scale(1);
      }

      /* Chat Window */
      .iso-window {
        width: 380px;
        height: 580px;
        max-height: calc(100vh - 120px);
        background-color: var(--iso-bg);
        border-radius: 16px;
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.05);
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: translateY(16px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: ${isAlignLeft ? "bottom left" : "bottom right"};
      }

      .iso-active .iso-window {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      /* Header */
      .iso-header {
        background-color: var(--iso-primary);
        color: #ffffff;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }

      .iso-header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .iso-avatar-wrapper {
        position: relative;
        width: 40px;
        height: 40px;
        flex-shrink: 0;
      }

      .iso-header-logo {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.12);
      }

      .iso-header-logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .iso-header-logo svg {
        width: 24px;
        height: 24px;
      }

      .iso-status-indicator {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: ${config.botActive !== false ? "#10B981" : "#94A3B8"};
        border: 2px solid var(--iso-primary);
        position: absolute;
        bottom: 0;
        right: 0;
      }

      .iso-header-text {
        display: flex;
        flex-direction: column;
      }

      .iso-bot-name {
        font-weight: 600;
        font-size: 15px;
        color: #ffffff;
        letter-spacing: -0.2px;
      }

      .iso-bot-status {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.75);
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 1px;
      }

      .iso-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .iso-header-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.8);
        transition: background-color 0.2s, color 0.2s;
        text-decoration: none;
      }

      .iso-header-btn:hover {
        background-color: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }

      .iso-header-btn svg {
        width: 18px;
        height: 18px;
      }

      /* Body */
      .iso-body {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
        background-color: ${ui.demoBackgroundUrl ? "transparent" : "#F8FAFC"};
        ${ui.demoBackgroundUrl ? `background-image: url(${ui.demoBackgroundUrl}); background-size: cover; background-position: center;` : ""}
        scroll-behavior: smooth;
      }

      .iso-body::-webkit-scrollbar {
        width: 5px;
      }
      .iso-body::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.12);
        border-radius: 3px;
      }

      /* Message Items */
      .iso-message {
        display: flex;
        gap: 10px;
        max-width: 88%;
        opacity: 0;
        transform: translateY(6px);
        animation: iso-fade-in-up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }

      @keyframes iso-fade-in-up {
        to { opacity: 1; transform: translateY(0); }
      }

      .iso-message-bot {
        align-self: flex-start;
      }

      .iso-message-user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      .iso-msg-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex-shrink: 0;
        align-self: flex-end;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: #E2E8F0;
      }

      .iso-msg-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .iso-msg-avatar svg {
        width: 18px;
        height: 18px;
      }

      .iso-bubble-wrapper {
        display: flex;
        flex-direction: column;
        max-width: 100%;
      }

      
      /* Markdown Elements inside Bot Message */
      .iso-msg-bubble .iso-table-wrapper {
        width: 100%;
        overflow-x: auto;
        margin: 10px 0;
        border-radius: 6px;
        border: 1px solid #CBD5E1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .iso-msg-bubble .iso-md-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        text-align: left;
        background: #FFFFFF;
      }
      .iso-msg-bubble .iso-md-table th {
        background-color: #0A2240;
        color: #FFFFFF;
        font-weight: 600;
        padding: 8px 11px;
        border-bottom: 2px solid #C5A059;
        white-space: nowrap;
      }
      .iso-msg-bubble .iso-md-table td {
        padding: 8px 11px;
        border-bottom: 1px solid #E2E8F0;
        color: #1E293B;
        vertical-align: top;
        line-height: 1.45;
      }
      .iso-msg-bubble .iso-md-table tr:nth-child(even) td {
        background-color: #F8FAFC;
      }
      .iso-msg-bubble .iso-md-table tr:hover td {
        background-color: #F1F5F9;
      }
      .iso-msg-bubble .iso-md-h2 {
        font-size: 15px;
        font-weight: 700;
        color: #0A2240;
        margin: 12px 0 6px 0;
        padding-bottom: 4px;
        border-bottom: 1px solid #E2E8F0;
      }
      .iso-msg-bubble .iso-md-h3 {
        font-size: 14px;
        font-weight: 600;
        color: #0A2240;
        margin: 10px 0 4px 0;
      }
      .iso-msg-bubble .iso-md-h4 {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
        margin: 8px 0 3px 0;
      }
      .iso-msg-bubble .iso-md-ul, .iso-msg-bubble .iso-md-ol {
        margin: 6px 0 6px 18px;
        padding-left: 0;
      }
      .iso-msg-bubble .iso-md-ul li, .iso-msg-bubble .iso-md-ol li {
        margin-bottom: 4px;
        line-height: 1.45;
      }
      .iso-msg-bubble .iso-md-hr {
        border: none;
        border-top: 1px solid #E2E8F0;
        margin: 12px 0;
      }
      .iso-msg-bubble .iso-md-link {
        color: #C5A059;
        text-decoration: underline;
        font-weight: 500;
      }
      .iso-msg-bubble .iso-md-link:hover {
        color: #0A2240;
      }
      .iso-msg-bubble .iso-md-pre {
        background: #0F172A;
        color: #F8FAFC;
        padding: 9px 12px;
        border-radius: 6px;
        overflow-x: auto;
        font-size: 11.5px;
        margin: 8px 0;
      }
      .iso-msg-bubble .iso-md-inline-code {
        background: rgba(10, 34, 64, 0.07);
        color: #0A2240;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
      }

      .iso-msg-bubble {
        padding: 11px 15px;
        border-radius: 14px;
        font-size: 13.5px;
        line-height: 1.5;
        position: relative;
        word-break: break-word;
      }

      .iso-message-bot 
      /* Markdown Elements inside Bot Message */
      .iso-msg-bubble .iso-table-wrapper {
        width: 100%;
        overflow-x: auto;
        margin: 10px 0;
        border-radius: 6px;
        border: 1px solid #CBD5E1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .iso-msg-bubble .iso-md-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        text-align: left;
        background: #FFFFFF;
      }
      .iso-msg-bubble .iso-md-table th {
        background-color: #0A2240;
        color: #FFFFFF;
        font-weight: 600;
        padding: 8px 11px;
        border-bottom: 2px solid #C5A059;
        white-space: nowrap;
      }
      .iso-msg-bubble .iso-md-table td {
        padding: 8px 11px;
        border-bottom: 1px solid #E2E8F0;
        color: #1E293B;
        vertical-align: top;
        line-height: 1.45;
      }
      .iso-msg-bubble .iso-md-table tr:nth-child(even) td {
        background-color: #F8FAFC;
      }
      .iso-msg-bubble .iso-md-table tr:hover td {
        background-color: #F1F5F9;
      }
      .iso-msg-bubble .iso-md-h2 {
        font-size: 15px;
        font-weight: 700;
        color: #0A2240;
        margin: 12px 0 6px 0;
        padding-bottom: 4px;
        border-bottom: 1px solid #E2E8F0;
      }
      .iso-msg-bubble .iso-md-h3 {
        font-size: 14px;
        font-weight: 600;
        color: #0A2240;
        margin: 10px 0 4px 0;
      }
      .iso-msg-bubble .iso-md-h4 {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
        margin: 8px 0 3px 0;
      }
      .iso-msg-bubble .iso-md-ul, .iso-msg-bubble .iso-md-ol {
        margin: 6px 0 6px 18px;
        padding-left: 0;
      }
      .iso-msg-bubble .iso-md-ul li, .iso-msg-bubble .iso-md-ol li {
        margin-bottom: 4px;
        line-height: 1.45;
      }
      .iso-msg-bubble .iso-md-hr {
        border: none;
        border-top: 1px solid #E2E8F0;
        margin: 12px 0;
      }
      .iso-msg-bubble .iso-md-link {
        color: #C5A059;
        text-decoration: underline;
        font-weight: 500;
      }
      .iso-msg-bubble .iso-md-link:hover {
        color: #0A2240;
      }
      .iso-msg-bubble .iso-md-pre {
        background: #0F172A;
        color: #F8FAFC;
        padding: 9px 12px;
        border-radius: 6px;
        overflow-x: auto;
        font-size: 11.5px;
        margin: 8px 0;
      }
      .iso-msg-bubble .iso-md-inline-code {
        background: rgba(10, 34, 64, 0.07);
        color: #0A2240;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
      }

      .iso-msg-bubble {
        background-color: var(--iso-bot-msg-bg);
        color: var(--iso-bot-msg-color);
        border-bottom-left-radius: 3px;
        border: 1px solid rgba(0, 0, 0, 0.04);
      }

      .iso-message-user 
      /* Markdown Elements inside Bot Message */
      .iso-msg-bubble .iso-table-wrapper {
        width: 100%;
        overflow-x: auto;
        margin: 10px 0;
        border-radius: 6px;
        border: 1px solid #CBD5E1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .iso-msg-bubble .iso-md-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        text-align: left;
        background: #FFFFFF;
      }
      .iso-msg-bubble .iso-md-table th {
        background-color: #0A2240;
        color: #FFFFFF;
        font-weight: 600;
        padding: 8px 11px;
        border-bottom: 2px solid #C5A059;
        white-space: nowrap;
      }
      .iso-msg-bubble .iso-md-table td {
        padding: 8px 11px;
        border-bottom: 1px solid #E2E8F0;
        color: #1E293B;
        vertical-align: top;
        line-height: 1.45;
      }
      .iso-msg-bubble .iso-md-table tr:nth-child(even) td {
        background-color: #F8FAFC;
      }
      .iso-msg-bubble .iso-md-table tr:hover td {
        background-color: #F1F5F9;
      }
      .iso-msg-bubble .iso-md-h2 {
        font-size: 15px;
        font-weight: 700;
        color: #0A2240;
        margin: 12px 0 6px 0;
        padding-bottom: 4px;
        border-bottom: 1px solid #E2E8F0;
      }
      .iso-msg-bubble .iso-md-h3 {
        font-size: 14px;
        font-weight: 600;
        color: #0A2240;
        margin: 10px 0 4px 0;
      }
      .iso-msg-bubble .iso-md-h4 {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
        margin: 8px 0 3px 0;
      }
      .iso-msg-bubble .iso-md-ul, .iso-msg-bubble .iso-md-ol {
        margin: 6px 0 6px 18px;
        padding-left: 0;
      }
      .iso-msg-bubble .iso-md-ul li, .iso-msg-bubble .iso-md-ol li {
        margin-bottom: 4px;
        line-height: 1.45;
      }
      .iso-msg-bubble .iso-md-hr {
        border: none;
        border-top: 1px solid #E2E8F0;
        margin: 12px 0;
      }
      .iso-msg-bubble .iso-md-link {
        color: #C5A059;
        text-decoration: underline;
        font-weight: 500;
      }
      .iso-msg-bubble .iso-md-link:hover {
        color: #0A2240;
      }
      .iso-msg-bubble .iso-md-pre {
        background: #0F172A;
        color: #F8FAFC;
        padding: 9px 12px;
        border-radius: 6px;
        overflow-x: auto;
        font-size: 11.5px;
        margin: 8px 0;
      }
      .iso-msg-bubble .iso-md-inline-code {
        background: rgba(10, 34, 64, 0.07);
        color: #0A2240;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
      }

      .iso-msg-bubble {
        background-color: var(--iso-user-msg-bg);
        color: var(--iso-user-msg-color);
        border-bottom-right-radius: 3px;
      }

      .iso-msg-time {
        font-size: 10px;
        color: #94A3B8;
        margin-top: 4px;
        align-self: flex-start;
        padding-left: 2px;
      }

      .iso-message-user .iso-msg-time {
        align-self: flex-end;
        padding-right: 2px;
      }

      /* Thumbs Feedback */
      .iso-feedback-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 5px;
        padding-left: 2px;
      }

      .iso-feedback-btn {
        background: transparent;
        border: 1px solid transparent;
        cursor: pointer;
        padding: 3px 6px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        opacity: 0.65;
      }

      .iso-feedback-btn:hover:not(:disabled) {
        opacity: 1;
        background-color: rgba(0, 0, 0, 0.04);
      }

      .iso-feedback-btn.iso-voted {
        opacity: 1;
        background-color: rgba(0, 48, 109, 0.08);
        border-color: rgba(0, 48, 109, 0.2);
      }

      .iso-feedback-btn:disabled {
        cursor: default;
      }

      .iso-feedback-icon {
        width: 16px;
        height: 16px;
        object-fit: contain;
      }

      .iso-feedback-note {
        font-size: 11px;
        color: #64748B;
        margin-left: 4px;
        animation: iso-fade-in-up 0.2s ease;
      }

      /* Custom Forms */
      .iso-form-container {
        background: #ffffff;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 14px;
        margin-top: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .iso-form-title {
        font-size: 13.5px;
        font-weight: 600;
        color: #1E293B;
        border-bottom: 1px solid #F1F5F9;
        padding-bottom: 8px;
      }

      .iso-form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .iso-form-label {
        font-size: 11.5px;
        font-weight: 500;
        color: #475569;
      }

      .iso-form-input,
      .iso-form-textarea {
        width: 100%;
        border: 1px solid #CBD5E1;
        border-radius: 6px;
        padding: 7px 10px;
        font-size: 12.5px;
        color: #1E293B;
        background-color: #F8FAFC;
        transition: border-color 0.2s;
        outline: none;
      }

      .iso-form-input:focus,
      .iso-form-textarea:focus {
        border-color: var(--iso-primary);
        background-color: #ffffff;
      }

      /* 5-Star Interactive Rating */
      .iso-rating-group {
        display: flex;
        gap: 6px;
        align-items: center;
        padding: 4px 0;
      }

      .iso-star-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 24px;
        line-height: 1;
        color: #CBD5E1;
        transition: transform 0.15s, color 0.15s;
        padding: 0 2px;
      }

      .iso-star-btn:hover,
      .iso-star-btn.iso-star-active {
        color: #F59E0B;
        transform: scale(1.1);
      }

      .iso-form-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 6px;
      }

      .iso-form-submit {
        background-color: var(--iso-primary);
        color: #ffffff;
        border: none;
        padding: 9px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .iso-form-submit:hover {
        opacity: 0.92;
      }

      .iso-form-download {
        background-color: #F1F5F9;
        color: #334155;
        border: 1px solid #CBD5E1;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      .iso-form-download:hover {
        background-color: #E2E8F0;
      }

      .iso-form-cancel {
        background: transparent;
        border: none;
        color: #94A3B8;
        font-size: 12px;
        cursor: pointer;
        text-align: center;
        padding: 4px;
      }

      .iso-form-cancel:hover {
        color: #475569;
      }

      /* Quick Replies */
      .iso-quick-replies {
        display: flex;
        gap: 6px;
        padding: 0 16px 12px 16px;
        overflow-x: auto;
        background-color: #F8FAFC;
        scrollbar-width: none;
      }

      .iso-quick-replies::-webkit-scrollbar {
        display: none;
      }

      .iso-quick-reply-btn {
        background-color: #ffffff;
        border: 1px solid #E2E8F0;
        color: #475569;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        font-weight: 500;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      }

      .iso-quick-reply-btn:hover {
        background-color: var(--iso-primary);
        color: #ffffff;
        border-color: var(--iso-primary);
      }

      /* Input */
      .iso-input-area {
        padding: 12px 16px;
        border-top: 1px solid #E2E8F0;
        background-color: #ffffff;
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .iso-input-wrapper {
        flex: 1;
        position: relative;
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 22px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        padding: 0 14px;
      }

      .iso-input-wrapper:focus-within {
        border-color: var(--iso-primary);
        background-color: #ffffff;
      }

      .iso-input-wrapper input {
        width: 100%;
        border: none;
        background: transparent;
        padding: 9px 0;
        font-size: 13.5px;
        color: #1E293B;
        outline: none;
      }

      .iso-input-wrapper input::placeholder {
        color: #94A3B8;
      }

      .iso-send-btn {
        background-color: var(--iso-primary);
        color: #ffffff;
        border: none;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        display: ${submitBtnDisplay};
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: opacity 0.2s, transform 0.1s;
      }

      .iso-send-btn:hover:not(:disabled) {
        opacity: 0.9;
        transform: scale(1.05);
      }

      .iso-send-btn:disabled {
        background-color: #F1F5F9;
        color: #94A3B8;
        cursor: not-allowed;
      }

      .iso-send-btn svg {
        width: 16px;
        height: 16px;
      }

      /* Typing Indicator */
      .iso-typing-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background-color: var(--iso-bot-msg-bg);
        border-radius: 14px;
        border-bottom-left-radius: 3px;
        width: fit-content;
        align-self: flex-start;
      }

      .iso-typing-dot {
        width: 6px;
        height: 6px;
        background-color: #94A3B8;
        border-radius: 50%;
        animation: iso-typing 1.4s infinite ease-in-out both;
      }

      .iso-typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .iso-typing-dot:nth-child(2) { animation-delay: -0.16s; }

      @keyframes iso-typing {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1.0); }
      }

      /* Session Ended Banner */
      .iso-session-ended {
        background: #F8FAFC;
        border: 1px dashed #CBD5E1;
        border-radius: 8px;
        padding: 12px;
        text-align: center;
        margin-top: 8px;
      }

      .iso-restart-btn {
        background-color: var(--iso-primary);
        color: #ffffff;
        border: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        margin-top: 6px;
      }

      /* Footer Branding */
      .iso-branding {
        font-size: 10px;
        color: #94A3B8;
        text-align: center;
        padding: 6px 12px 10px 12px;
        background-color: #ffffff;
      }

      .iso-branding span, .iso-branding a {
        color: var(--iso-primary);
        font-weight: 600;
        text-decoration: none;
      }

      /* Mobile Overrides */
      @media (max-width: 480px) {
        .iso-container {
          bottom: 16px !important;
          right: 16px !important;
          left: auto !important;
        }

        .iso-container-left {
          left: 16px !important;
          right: auto !important;
        }

        .iso-toggle {
          width: var(--iso-mobile-icon-w) !important;
          height: var(--iso-mobile-icon-h) !important;
        }

        .iso-window {
          width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
          border-radius: 0 !important;
          margin-bottom: 0 !important;
          position: fixed;
          top: 0;
          left: 0;
          border: none;
        }
      }
    `;
  }

  // --------------------------------------------------------
  // 5. ICON RENDERING HELPERS
  // --------------------------------------------------------
  function renderLogoHtml(logoUrl, altName) {
    if (logoUrl && typeof logoUrl === "string" && logoUrl.trim() !== "") {
      const clean = logoUrl.trim();
      if (clean.startsWith("<svg") || clean.includes("xmlns")) {
        return clean;
      }
      return `<img src="${clean}" alt="${altName || "Bot"}" />`;
    }
    return ISO_LOGO_SVG;
  }

  function renderFeedbackIcon(iconUrl, type) {
    if (iconUrl && typeof iconUrl === "string" && iconUrl.trim() !== "") {
      return `<img src="${iconUrl}" class="iso-feedback-icon" alt="${type}" />`;
    }
    if (type === "like") {
      return `
        <svg class="iso-feedback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>
      `;
    }
    return `
      <svg class="iso-feedback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
      </svg>
    `;
  }

  // --------------------------------------------------------
  // 6. HTML MARKUP BUILDER & DOM INITIALIZATION
  // --------------------------------------------------------
  function createChatbotDOM() {
    const ui = config.botUIConfigs || {};

    widgetContainer = document.createElement("div");
    widgetContainer.className = "iso-scope iso-container";
    if (ui.chatAlignmentLeft === true || (ui.chatPositionLeft && ui.chatPositionLeft !== "auto")) {
      widgetContainer.classList.add("iso-container-left");
    }

    const headerTitle = ui.botHeaderText || config.botName || "ISO AI";
    const headerLogo = ui.logoUrl || config.botLogo || ISO_LOGO_SVG;

    const closeIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;

    const minimizeIcon = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;

    const helpIcon = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;

    const sendIcon = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    const inputPlaceholder = ui.DefaultEmptyMessage || config.placeholderText || "Message ISO Bot...";

    // Launcher icon
    let launcherInnerHtml = "";
    if (ui.botChatStartImage && typeof ui.botChatStartImage === "string" && ui.botChatStartImage.trim() !== "") {
      launcherInnerHtml = `<img src="${ui.botChatStartImage}" class="iso-start-img" alt="${ui.chatIconAltText || 'Chat with Us'}" title="${ui.chatIconTitleText || 'Chat with Us'}" />`;
    } else {
      launcherInnerHtml = `
        <svg class="iso-chat-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      `;
    }

    widgetContainer.innerHTML = `
      <!-- Help Notification Popup -->
      <div class="iso-help-callout" id="iso-help-callout" style="display: none;" role="alert">
        <button class="iso-callout-close" aria-label="Dismiss notification">&times;</button>
        <div class="iso-callout-content">${ui.helpNotificationRenderMsg || ""}</div>
      </div>

      <!-- Main Chat Window -->
      <div class="iso-window" aria-hidden="true" role="dialog">
        <!-- Header -->
        <div class="iso-header">
          <div class="iso-header-info">
            <div class="iso-avatar-wrapper">
              <div class="iso-header-logo">
                ${renderLogoHtml(headerLogo, headerTitle)}
              </div>
              <span class="iso-status-indicator"></span>
            </div>
            <div class="iso-header-text">
              <span class="iso-bot-name">${headerTitle}</span>
              <span class="iso-bot-status">${config.botActive !== false ? "Online" : "Offline"}</span>
            </div>
          </div>
          <div class="iso-header-actions">
            ${ui.showHelpButton && ui.helpButtonUrl ? `
              <a href="${ui.helpButtonUrl}" target="_blank" rel="noopener noreferrer" class="iso-header-btn iso-help-btn" title="Help Resources" aria-label="Help">
                ${helpIcon}
              </a>
            ` : ""}
            <button class="iso-header-btn iso-minimize-btn" title="Minimize chat" aria-label="Minimize">
              ${minimizeIcon}
            </button>
            <button class="iso-header-btn iso-close-btn" title="Close conversation" aria-label="Close">
              ${closeIcon}
            </button>
          </div>
        </div>

        <!-- Messages Body -->
        <div class="iso-body"></div>

        <!-- Quick Replies -->
        <div class="iso-quick-replies" style="display: none;"></div>

        <!-- Chat Input Area -->
        <div class="iso-input-area">
          <div class="iso-input-wrapper">
            <input type="text" placeholder="${inputPlaceholder}" aria-label="Type your message" ${config.botActive === false ? "disabled" : ""}>
          </div>
          <button class="iso-send-btn" disabled aria-label="Send message">
            ${sendIcon}
          </button>
        </div>

        <!-- Branding / Powered By -->
        <div class="iso-branding">
          ${ui.poweredBy || 'AI powered by <span>Isomorphic</span>'}
        </div>
      </div>

      <!-- Main Toggle Launcher -->
      <button class="iso-toggle" aria-label="${ui.chatIconAltText || 'Chat with Us'}" title="${ui.chatIconTitleText || 'Chat with Us'}">
        ${launcherInnerHtml}
        <div class="iso-close-icon">${closeIcon}</div>
      </button>
    `;

    document.body.appendChild(widgetContainer);

    chatToggle = widgetContainer.querySelector(".iso-toggle");
    chatWindow = widgetContainer.querySelector(".iso-window");
    chatBody = widgetContainer.querySelector(".iso-body");
    textInput = widgetContainer.querySelector(".iso-input-area input");
    sendButton = widgetContainer.querySelector(".iso-send-btn");
    helpNotificationEl = widgetContainer.querySelector("#iso-help-callout");

    setupEventListeners();
    initHelpNotification();
    startIdleMonitoring();

    if (ui.isChatOpened) {
      openChat();
    }
  }

  // --------------------------------------------------------
  // 7. EVENT HANDLERS & BINDING
  // --------------------------------------------------------
  function setupEventListeners() {
    chatToggle.addEventListener("click", handleToggleClick);

    widgetContainer.querySelector(".iso-minimize-btn").addEventListener("click", minimizeChat);
    widgetContainer.querySelector(".iso-close-btn").addEventListener("click", handleCloseButtonClick);

    const calloutCloseBtn = widgetContainer.querySelector(".iso-callout-close");
    if (calloutCloseBtn) {
      calloutCloseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dismissHelpNotification();
      });
    }

    if (helpNotificationEl) {
      helpNotificationEl.addEventListener("click", () => {
        dismissHelpNotification();
        openChat();
      });
    }

    textInput.addEventListener("input", () => {
      resetIdleTimer();
      const hasText = textInput.value.trim() !== "";
      sendButton.disabled = !hasText;
      if (config.botUIConfigs && config.botUIConfigs.botChatSubmitButton === false) {
        sendButton.style.display = hasText ? "flex" : "none";
      }
    });

    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        triggerMessageSend();
      }
    });

    sendButton.addEventListener("click", triggerMessageSend);
  }

  function handleToggleClick() {
    dismissHelpNotification();
    if (isChatOpen) {
      minimizeChat();
    } else {
      openChat();
    }
  }

  // Welcome message is pulled directly from MongoDB config as soon as the bot opens
  function openChat() {
    dismissHelpNotification();
    isChatOpen = true;
    isMinimized = false;
    isSessionEnded = false;
    widgetContainer.classList.add("iso-active");
    chatWindow.setAttribute("aria-hidden", "false");
    resetIdleTimer();

    // Render customizable welcome message from MongoDB config as soon as bot opens
    if (!chatHistory || chatHistory.length === 0) {
      renderWelcomeMessages();
    }

    setTimeout(scrollToBottom, 80);
    if (window.innerWidth > 480 && textInput) {
      textInput.disabled = false;
      textInput.focus();
    }
  }

  function minimizeChat() {
    isChatOpen = false;
    isMinimized = true;
    widgetContainer.classList.remove("iso-active");
    chatWindow.setAttribute("aria-hidden", "true");
  }


  // --------------------------------------------------------
  // END CHAT & SURVEY FLOW
  // --------------------------------------------------------
  function handleCloseButtonClick() {
    if (chatHistory.length > 0 && !isSessionEnded && !chatBody.querySelector(".iso-end-chat-form")) {
      appendMessage("bot", "Before you leave, please rate your experience with us today:");
      showEndChatForm("cross_icon");
    } else {
      finalizeCloseChat();
    }
  }

  function showEndChatForm(reason = "cross_icon") {
    if (chatBody && chatBody.querySelector(".iso-end-chat-form")) return;

    let surveyForm = (config.customForms || []).find(f => f.name === "survey" || (f.intent || []).includes("end_chat"));
    if (!surveyForm) {
      surveyForm = {
        type: "form",
        name: "survey",
        title: "Session Feedback & Rating",
        showDownloadButton: true,
        showCancelledButton: true,
        cancelledButtonTitle: "Skip & Close",
        payload: {
          fields: [
            { title: "Rating", name: "rating", type: "rating", validate: { required: true } },
            { title: "Comments / Feedback (Optional)", name: "feedback", type: "textarea", validate: { required: false } },
            { title: "Closed", name: "status", type: "hidden", validate: { required: false } }
          ],
          submitButtonTitle: "Submit & End Chat",
          downloadTranscriptButtonTitle: "Download Transcript"
        }
      };
    }

    if (textInput) {
      textInput.disabled = true;
      textInput.placeholder = "Chat session ending...";
    }
    if (sendButton) {
      sendButton.disabled = true;
    }

    renderCustomForm(surveyForm, true);
  }

  function finalizeCloseChat() {
    isChatOpen = false;
    isMinimized = false;
    isSessionEnded = true;

    // End conversation session and clear chat history from memory and localStorage
    chatHistory = [];
    try {
      localStorage.removeItem(getHistoryKey());
      localStorage.removeItem("iso_history_ISOBot");
      localStorage.removeItem("cbot_history_ISOBot");
      sessionStorage.removeItem("iso_chat_session_id");
    } catch (e) {
      console.warn("[ISO Chatbot] Error clearing localStorage on close:", e);
    }

    if (chatBody) {
      chatBody.innerHTML = "";
    }

    removeTypingIndicator();
    hideQuickReplies();

    if (textInput) {
      textInput.disabled = false;
      textInput.value = "";
      textInput.placeholder = (config.botUIConfigs && config.botUIConfigs.DefaultEmptyMessage) || config.placeholderText || "Message ISO Bot...";
    }
    if (sendButton) {
      sendButton.disabled = true;
    }

    resetIdleTimer();
    idleMessagesSentCount = 0;

    widgetContainer.classList.remove("iso-active");
    chatWindow.setAttribute("aria-hidden", "true");
  }

  function closeChat() {
    handleCloseButtonClick();
  }


  function triggerMessageSend() {
    if (isSessionEnded) return;
    const text = textInput.value.trim();
    if (!text || isTyping) return;

    resetIdleTimer();
    appendMessage("user", text);
    textInput.value = "";
    sendButton.disabled = true;
    if (config.botUIConfigs && config.botUIConfigs.botChatSubmitButton === false) {
      sendButton.style.display = "none";
    }

    getBotResponse(text);
  }

  // --------------------------------------------------------
  // 8. HELP NOTIFICATION SCHEDULER
  // --------------------------------------------------------
  function initHelpNotification() {
    const ui = config.botUIConfigs || {};
    const renderTime = parseMongoNumber(ui.helpNotificationRenderTime, 10000);
    const renderMsg = ui.helpNotificationRenderMsg;

    if (!renderMsg || renderTime <= 0) return;

    helpNotificationTimer = setTimeout(() => {
      if (!isChatOpen && !helpNotificationDismissed && helpNotificationEl) {
        helpNotificationEl.style.display = "block";
      }
    }, renderTime);
  }

  function dismissHelpNotification() {
    helpNotificationDismissed = true;
    if (helpNotificationTimer) clearTimeout(helpNotificationTimer);
    if (helpNotificationEl) helpNotificationEl.style.display = "none";
  }

  // --------------------------------------------------------
  // 9. IDLE STATE INACTIVITY MONITORING
  // --------------------------------------------------------
  function startIdleMonitoring() {
    if (idleCheckInterval) clearInterval(idleCheckInterval);
    idleCheckInterval = setInterval(() => {
      if (!isChatOpen || isSessionEnded) return;

      const idleConfigs = (config.botUIConfigs && config.botUIConfigs.idleStatMessages) || [];
      if (!idleConfigs || idleConfigs.length === 0) return;

      idleSeconds++;

      for (let i = idleMessagesSentCount; i < idleConfigs.length; i++) {
        const threshold = parseMongoNumber(idleConfigs[i].time, 0);
        if (threshold > 0 && idleSeconds >= threshold) {
          appendMessage("bot", idleConfigs[i].message);
          idleMessagesSentCount = i + 1;

          if (idleMessagesSentCount >= idleConfigs.length) {
            endChatSession();
          }
          break;
        }
      }
    }, 1000);
  }

  function resetIdleTimer() {
    idleSeconds = 0;
  }

  function endChatSession() {
    isSessionEnded = true;
    if (textInput) {
      textInput.disabled = true;
      textInput.placeholder = "Chat session ended due to inactivity.";
    }
    if (sendButton) sendButton.disabled = true;

    const banner = document.createElement("div");
    banner.className = "iso-session-ended";
    banner.innerHTML = `
      <div style="font-size:12px; color:#64748B;">This session has timed out.</div>
      <button class="iso-restart-btn">Restart Chat</button>
    `;
    banner.querySelector(".iso-restart-btn").addEventListener("click", () => {
      restartChatSession();
    });
    chatBody.appendChild(banner);
    scrollToBottom();
  }

  function restartChatSession() {
    isSessionEnded = false;
    idleSeconds = 0;
    idleMessagesSentCount = 0;
    if (textInput) {
      textInput.disabled = false;
      textInput.placeholder = (config.botUIConfigs && config.botUIConfigs.DefaultEmptyMessage) || "Message ISO Bot...";
    }
    clearChatHistory();
  }

  // --------------------------------------------------------
  // 10. MESSAGE RENDERING & FEEDBACK
  // --------------------------------------------------------
  function escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function parseMarkdown(text) {
    if (!text) return "";
    let str = String(text);

    // Normalize multi-line cells inside tables (join lines starting with bullet / dash / text)
    const lines = str.split("\n");
    const normalizedLines = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTableRow = /^\|.*\|$/.test(line.trim());
      const isTableSeparator = /^\|[\s\-:\|]+\|$/.test(line.trim());

      if (isTableRow || isTableSeparator) {
        inTable = true;
        normalizedLines.push(line);
      } else if (inTable && (line.trim().startsWith("•") || line.trim().startsWith("-") || line.trim().startsWith("*") || (line.trim() && !line.includes("|")))) {
        if (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].startsWith("|")) {
          // If previous row had pipes, append inside last cell before closing pipe
          const lastIdx = normalizedLines.length - 1;
          const lastLine = normalizedLines[lastIdx];
          if (lastLine.endsWith("|")) {
            normalizedLines[lastIdx] = lastLine.slice(0, -1) + "<br/>• " + line.replace(/^[•\-*]\s*/, "").trim() + " |";
          } else {
            normalizedLines[lastIdx] += "<br/>" + line.trim();
          }
        } else {
          normalizedLines.push(line);
          inTable = false;
        }
      } else {
        inTable = false;
        normalizedLines.push(line);
      }
    }
    str = normalizedLines.join("\n");

    // 1. Code blocks
    const codeBlocks = [];
    str = str.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre class="iso-md-pre"><code class="language-${lang}">${escapeHTML(code.trim())}</code></pre>`);
      return `%%CODEBLOCK_${idx}%%`;
    });

    // 2. Inline code
    const inlineCodes = [];
    str = str.replace(/`([^`]+)`/g, (match, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code class="iso-md-inline-code">${escapeHTML(code)}</code>`);
      return `%%INLINECODE_${idx}%%`;
    });

    function parseInline(txt) {
      let t = txt;
      t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      t = t.replace(/_([^_]+)_/g, "<em>$1</em>");
      t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="iso-md-link">$1</a>');
      return t;
    }

    // 3. Markdown Tables
    str = str.replace(/(?:(?:^|\n)\|[^\n]+\|\r?\n\|[\s\-:\|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, (tableBlock) => {
      const rows = tableBlock.trim().split("\n").map(l => l.trim()).filter(Boolean);
      if (rows.length < 2) return tableBlock;

      const headerLine = rows[0];
      const bodyLines = rows.slice(2);

      const parseRow = (line, isHeader = false) => {
        const cells = line.split("|").map(c => c.trim()).slice(1, -1);
        const tag = isHeader ? "th" : "td";
        return "<tr>" + cells.map(c => `<${tag}>${parseInline(c)}</${tag}>`).join("") + "</tr>";
      };

      const thead = "<thead>" + parseRow(headerLine, true) + "</thead>";
      const tbody = "<tbody>" + bodyLines.map(l => parseRow(l, false)).join("") + "</tbody>";

      return `\n<div class="iso-table-wrapper"><table class="iso-md-table">${thead}${tbody}</table></div>\n`;
    });

    // 4. Headings
    str = str.replace(/^### (.*$)/gim, '<h4 class="iso-md-h4">$1</h4>');
    str = str.replace(/^## (.*$)/gim, '<h3 class="iso-md-h3">$1</h3>');
    str = str.replace(/^# (.*$)/gim, '<h2 class="iso-md-h2">$1</h2>');

    // 5. Horizontal rules
    str = str.replace(/^(?:---|___|\*\*\*)\s*$/gim, '<hr class="iso-md-hr" />');

    // 6. Bullet lists
    str = str.replace(/(?:^|\n)(?:[*\-•]\s+[^\n]+(?:\n[*\-•]\s+[^\n]+)*)/g, (listBlock) => {
      const items = listBlock.trim().split("\n").map(l => l.replace(/^[*\-•]\s+/, "").trim());
      return "\n<ul class=\"iso-md-ul\">" + items.map(it => `<li>${parseInline(it)}</li>`).join("") + "</ul>\n";
    });

    // 7. Numbered lists
    str = str.replace(/(?:^|\n)(?:\d+\.\s+[^\n]+(?:\n\d+\.\s+[^\n]+)*)/g, (listBlock) => {
      const items = listBlock.trim().split("\n").map(l => l.replace(/^\d+\.\s+/, "").trim());
      return "\n<ol class=\"iso-md-ol\">" + items.map(it => `<li>${parseInline(it)}</li>`).join("") + "</ol>\n";
    });

    // 8. General inline formatting
    str = parseInline(str);

    // 9. Convert remaining line breaks into <br/>
    str = str.replace(/\n\n+/g, "<br/><br/>").replace(/\n/g, "<br/>");
    str = str.replace(/<br\/><br\/>(<div|<ul|<ol|<h2|<h3|<h4|<hr)/gi, "$1");
    str = str.replace(/(<\/div>|<\/ul>|<\/ol>|<\/h2>|<\/h3>|<\/h4>|<hr \/>)<br\/><br\/>/gi, "$1");
    str = str.replace(/<br\/>(<div|<ul|<ol|<h2|<h3|<h4|<hr)/gi, "$1");
    str = str.replace(/(<\/div>|<\/ul>|<\/ol>|<\/h2>|<\/h3>|<\/h4>|<hr \/>)<br\/>/gi, "$1");

    // 10. Restore code blocks & inline codes
    str = str.replace(/%%CODEBLOCK_(\d+)%%/g, (m, idx) => codeBlocks[parseInt(idx)] || "");
    str = str.replace(/%%INLINECODE_(\d+)%%/g, (m, idx) => inlineCodes[parseInt(idx)] || "");

    return str.trim();
  }

  function renderMessage(sender, text, isHtml = false, timestampStr = null, id = null) {
    const messageEl = document.createElement("div");
    messageEl.className = `iso-message iso-message-${sender}`;
    const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    messageEl.setAttribute("data-msg-id", msgId);

    const timestamp = timestampStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const ui = config.botUIConfigs || {};
    let avatarHtml = "";
    if (sender === "bot") {
      avatarHtml = `<div class="iso-msg-avatar">${renderLogoHtml(ui.logoUrl, config.botName)}</div>`;
    }

    let processedText = "";
    if (sender === "user") {
      processedText = escapeHTML(text);
    } else {
      processedText = isHtml ? text : parseMarkdown(text);
    }

    // Feedback Thumbs Up / Down row
    let feedbackHtml = "";
    if (sender === "bot" && ui.showThumbUpDownFeedbackform) {
      feedbackHtml = `
        <div class="iso-feedback-row">
          <button class="iso-feedback-btn iso-like-btn" title="Helpful" aria-label="Like response">
            ${renderFeedbackIcon(ui.likeIcon, "like")}
          </button>
          <button class="iso-feedback-btn iso-dislike-btn" title="Not helpful" aria-label="Dislike response">
            ${renderFeedbackIcon(ui.dislikeIcon, "dislike")}
          </button>
          <span class="iso-feedback-note"></span>
        </div>
      `;
    }

    messageEl.innerHTML = `
      ${avatarHtml}
      <div class="iso-bubble-wrapper">
        <div class="iso-msg-bubble">
          ${processedText}
        </div>
        ${feedbackHtml}
        <span class="iso-msg-time">${timestamp}</span>
      </div>
    `;

    // Bind feedback button events
    if (sender === "bot" && ui.showThumbUpDownFeedbackform) {
      const likeBtn = messageEl.querySelector(".iso-like-btn");
      const dislikeBtn = messageEl.querySelector(".iso-dislike-btn");
      const note = messageEl.querySelector(".iso-feedback-note");

      likeBtn.addEventListener("click", () => {
        likeBtn.classList.add("iso-voted");
        dislikeBtn.classList.remove("iso-voted");
        likeBtn.disabled = true;
        dislikeBtn.disabled = true;
        note.textContent = "Thank you!";
      });

      dislikeBtn.addEventListener("click", () => {
        dislikeBtn.classList.add("iso-voted");
        likeBtn.classList.remove("iso-voted");
        likeBtn.disabled = true;
        dislikeBtn.disabled = true;
        note.textContent = "Feedback received.";
      });
    }

    chatBody.appendChild(messageEl);
    scrollToBottom();
    return messageEl;
  }

    // Session Management Helper
  function getOrCreateSessionId() {
    let sId = sessionStorage.getItem("iso_chat_session_id");
    if (!sId) {
      sId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      sessionStorage.setItem("iso_chat_session_id", sId);
    }
    return sId;
  }

  function endChatSession(feedbackData = {}) {
    const activeSessionId = sessionStorage.getItem("iso_chat_session_id");
    if (activeSessionId) {
      const endpoint = config.chatApiUrl || config.apiEndpoint || DEFAULT_CHAT_API_URL;
      const endEndpoint = endpoint.replace(/\/chat$/, "/chat/session-end");
      const tenantIdValue = config.tenantId || config.teanantId || "onestop";
      try {
        fetch(endEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            tenantId: tenantIdValue,
            botId: config.botId,
            rating: feedbackData.rating || null,
            feedback: feedbackData.feedback || ""
          }),
          keepalive: true
        }).catch(() => {});
      } catch (e) {}
      sessionStorage.removeItem("iso_chat_session_id");
    }
  }

  function appendMessage(sender, text, isHtml = false) {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    renderMessage(sender, text, isHtml, timestamp, msgId);

    if (config.persistHistory) {
      chatHistory.push({ sender, text, timestamp, isHtml, id: msgId });
      saveChatHistory();
    }
  }

  function showTypingIndicator() {
    if (isTyping) return;
    isTyping = true;

    const indicator = document.createElement("div");
    indicator.className = "iso-message iso-message-bot iso-typing-container";
    const ui = config.botUIConfigs || {};

    indicator.innerHTML = `
      <div class="iso-msg-avatar">${renderLogoHtml(ui.logoUrl, config.botName)}</div>
      <div class="iso-typing-indicator">
        <div class="iso-typing-dot"></div>
        <div class="iso-typing-dot"></div>
        <div class="iso-typing-dot"></div>
      </div>
    `;

    chatBody.appendChild(indicator);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    if (!isTyping) return;
    const indicator = chatBody.querySelector(".iso-typing-container");
    if (indicator) indicator.remove();
    isTyping = false;
  }

  function scrollToBottom() {
    if (chatBody) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  }

  // --------------------------------------------------------
  // 11. CUSTOM FORMS (transferCall & survey)
  // --------------------------------------------------------
  function renderCustomForm(formConfig, isEndChatForm = false) {
    if (!formConfig || !formConfig.payload) return;
    const payload = formConfig.payload;

    const formWrapper = document.createElement("div");
    formWrapper.className = "iso-form-container" + (isEndChatForm || formConfig.name === "survey" ? " iso-end-chat-form" : "");

    let fieldsHtml = "";
    (payload.fields || []).forEach(f => {
      const isRequired = f.validate && f.validate.required;
      const reqLabel = isRequired ? ` <span style="color:#EF4444;">*</span>` : "";

      if (f.type === "hidden") {
        fieldsHtml += `<input type="hidden" name="${f.name}" value="${f.name === 'status' ? 'Escalated' : ''}">`;
      } else if (f.type === "rating") {
        fieldsHtml += `
          <div class="iso-form-group">
            <label class="iso-form-label">${f.title}${reqLabel}</label>
            <div class="iso-rating-group" data-name="${f.name}">
              <input type="hidden" name="${f.name}" value="5" ${isRequired ? "required" : ""}>
              ${[1, 2, 3, 4, 5].map(v => `<button type="button" class="iso-star-btn iso-star-active" data-val="${v}">&#9733;</button>`).join("")}
            </div>
          </div>
        `;
      } else if (f.type === "textarea") {
        fieldsHtml += `
          <div class="iso-form-group">
            <label class="iso-form-label">${f.title}${reqLabel}</label>
            <textarea name="${f.name}" class="iso-form-textarea" rows="2" placeholder="${f.title}" ${isRequired ? "required" : ""}></textarea>
          </div>
        `;
      } else {
        const inputType = (f.validate && f.validate.email) ? "email" : (f.name.toLowerCase().includes("phone") ? "tel" : "text");
        fieldsHtml += `
          <div class="iso-form-group">
            <label class="iso-form-label">${f.title}${reqLabel}</label>
            <input type="${inputType}" name="${f.name}" class="iso-form-input" placeholder="${f.title}" ${isRequired ? "required" : ""}>
          </div>
        `;
      }
    });

    const downloadTranscriptBtn = formConfig.showDownloadButton ? `
      <button type="button" class="iso-form-download">
        <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        ${payload.downloadTranscriptButtonTitle || "Download Transcript"}
      </button>
    ` : "";

    const cancelTitle = formConfig.cancelledButtonTitle || (isEndChatForm ? "Skip & Close" : "Cancel");
    const cancelBtn = (formConfig.showCancelledButton || isEndChatForm) ? `
      <button type="button" class="iso-form-cancel">${cancelTitle}</button>
    ` : "";

    formWrapper.innerHTML = `
      <div class="iso-form-title">${formConfig.title || "Form"}</div>
      <form class="iso-dynamic-form">
        ${fieldsHtml}
        <div class="iso-form-actions">
          <button type="submit" class="iso-form-submit">${payload.submitButtonTitle || "Submit"}</button>
          ${downloadTranscriptBtn}
          ${cancelBtn}
        </div>
      </form>
    `;

    // Star rating interaction
    const starBtns = formWrapper.querySelectorAll(".iso-star-btn");
    starBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.getAttribute("data-val"), 10);
        const parent = btn.closest(".iso-rating-group");
        parent.querySelector("input").value = val;
        parent.querySelectorAll(".iso-star-btn").forEach(b => {
          const bVal = parseInt(b.getAttribute("data-val"), 10);
          if (bVal <= val) {
            b.classList.add("iso-star-active");
          } else {
            b.classList.remove("iso-star-active");
          }
        });
      });
    });

    // Transcript download button
    const dlBtn = formWrapper.querySelector(".iso-form-download");
    if (dlBtn) {
      dlBtn.addEventListener("click", downloadTranscript);
    }

    // Cancel button
    const cancelAction = formWrapper.querySelector(".iso-form-cancel");
    if (cancelAction) {
      cancelAction.addEventListener("click", () => formWrapper.remove());
    }

    // Form submission
    const formEl = formWrapper.querySelector("form");
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(formEl);
      const data = Object.fromEntries(formData.entries());

      if (isEndChatForm || formConfig.name === "survey") {
        formWrapper.innerHTML = `
          <div style="font-size: 13px; color: #10B981; font-weight: 600; text-align: center; padding: 12px 0;">
            ✓ Thank you for your feedback! Ending chat session...
          </div>
        `;
        endChatSession(data);
        setTimeout(() => {
          finalizeCloseChat();
        }, 1500);
      } else {
        formWrapper.innerHTML = `
          <div style="font-size: 13px; color: #10B981; font-weight: 500; text-align: center; padding: 8px 0;">
            ✓ Information successfully submitted. Thank you!
          </div>
        `;
      }

      if (payload.postbackUrl) {
        try {
          await fetch(payload.postbackUrl, {
            method: payload.method || "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });
        } catch (err) {
          console.warn("[ISO Chatbot] Form postback request error:", err);
        }
      }
    });

    if (isEndChatForm || formConfig.name === "survey") {
      const cancelAction = formWrapper.querySelector(".iso-form-cancel");
      if (cancelAction) {
        cancelAction.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          formWrapper.innerHTML = `
            <div style="font-size: 12px; color: #64748B; text-align: center; padding: 10px 0;">
              Ending chat session...
            </div>
          `;
          endChatSession({});
          setTimeout(() => {
            finalizeCloseChat();
          }, 1000);
        };
      }
    }

    chatBody.appendChild(formWrapper);
    scrollToBottom();
  }

  function downloadTranscript() {
    let transcriptText = `==============================================\n`;
    transcriptText += `CHAT TRANSCRIPT: ${config.botUIConfigs.botHeaderText || config.botName}\n`;
    transcriptText += `Date: ${new Date().toLocaleString()}\n`;
    transcriptText += `==============================================\n\n`;

    chatHistory.forEach(item => {
      const senderName = item.sender === "bot" ? (config.botUIConfigs.botHeaderText || config.botName) : "You";
      transcriptText += `[${item.timestamp}] ${senderName}:\n${item.text}\n\n`;
    });

    transcriptText += `==============================================\n`;
    transcriptText += `End of conversation.\n`;

    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------------
  // 12. BOT INTELLIGENCE & RESPONSES
  // --------------------------------------------------------
  async function getBotResponse(userMsg) {
    showTypingIndicator();
    hideQuickReplies();

    const textLower = userMsg.toLowerCase().trim();

    const tenantIdValue = config.tenantId ||
                          config.teanantId ||
                          (config.botUIConfigs && (config.botUIConfigs.tenantId || config.botUIConfigs.teanantId)) ||
                          window.tenantId ||
                          window.teanantId ||
                          "onestop";

    // Request payload sending botId, tenantId (and teanantId), and query
    const requestPayload = {
      query: userMsg,
      message: userMsg,
      botId: config.botId,
      tenantId: tenantIdValue,
      teanantId: tenantIdValue,
      sessionId: getOrCreateSessionId(),
      history: chatHistory.slice(-10)
    };

    const endpoint = config.chatApiUrl || config.apiEndpoint || DEFAULT_CHAT_API_URL;

    // Check if user says bye, goodbye, end chat, etc.
    const isByeMessage = /^(bye|goodbye|bye bye|good bye|exit|end chat|end conversation|close chat)\b/i.test(textLower) ||
                         textLower === "bye" ||
                         textLower === "goodbye" ||
                         textLower === "end chat session";

    if (isByeMessage) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(requestPayload)
        });

        removeTypingIndicator();

        let botReply = "Thank you for chatting with us! Have a wonderful day. Goodbye! 👋";
        if (response.ok) {
          const data = await response.json();
          botReply = data.response || data.reply || data.message || data.answer || botReply;
        }

        appendMessage("bot", botReply);
      } catch (err) {
        removeTypingIndicator();
        appendMessage("bot", "Thank you for chatting with us! Have a wonderful day. Goodbye! 👋");
      }

      // Show the End Chat Survey Form right after the goodbye message
      setTimeout(() => {
        showEndChatForm("bye_message");
      }, 600);
      return;
    }

    // Check customForms intent matches (for other intents like transferCall)
    const matchedForm = (config.customForms || []).find(f => {
      if (f.status !== "enabled") return false;
      return (f.intent || []).some(intent => textLower.includes(intent.replace(/_/g, " ")) || textLower.includes(intent));
    });

    if (matchedForm) {
      const delaySec = parseMongoNumber(config.botUIConfigs.transferFormDelay, 5);
      setTimeout(() => {
        removeTypingIndicator();
        if (matchedForm.name === "transferCall") {
          appendMessage("bot", "I am connecting you with our support team. Please complete the details below so we can assist you promptly:");
        } else if (matchedForm.name === "survey") {
          appendMessage("bot", "Thank you for chatting with us. We value your feedback:");
        }
        renderCustomForm(matchedForm);
      }, delaySec * 1000);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(requestPayload)
      });

      removeTypingIndicator();

      if (response.ok) {
        let data;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const rawText = await response.text();
          try {
            data = JSON.parse(rawText);
          } catch (e) {
            data = rawText;
          }
        }

        let botReply = "";
        if (typeof data === "string") {
          botReply = data;
        } else if (data && typeof data === "object") {
          // Extract response from common API field keys
          botReply = data.response ||
                     data.reply ||
                     data.message ||
                     data.answer ||
                     data.text ||
                     data.output ||
                     (data.data && (data.data.response || data.data.reply || data.data.message)) ||
                     "";
        }

        if (!botReply) {
          botReply = "Response received from server.";
        }

        appendMessage("bot", botReply);

        // Check if API response triggered a form
        if (data && data.form && Array.isArray(config.customForms)) {
          const formToRender = config.customForms.find(f => f.name === data.form);
          if (formToRender) renderCustomForm(formToRender);
        }

        // Suggestions or quick replies from API if provided
        const suggestions = (data && (data.quickReplies || data.suggestions || data.options)) || config.quickReplies;
        if (suggestions && suggestions.length > 0) {
          showQuickReplies(suggestions);
        }
      } else {
        appendMessage("bot", `Error: Chat API responded with status ${response.status}.`);
      }
    } catch (err) {
      console.warn("[ISO Chatbot] Backend API call error, using simulated fallback.", err);
      removeTypingIndicator();
      fallbackSimulatedResponse(textLower);
    }
  }

  function fallbackSimulatedResponse(textLower) {
    let reply = "Thank you for your message. How can I assist you with your questions today?";

    if (textLower.includes("transfer") || textLower.includes("agent") || textLower.includes("live")) {
      const form = (config.customForms || []).find(f => f.name === "transferCall");
      appendMessage("bot", "I can help escalate this request. Please fill out the form below:");
      if (form) renderCustomForm(form);
      return;
    } else if (textLower.includes("end") || textLower.includes("bye") || textLower.includes("survey")) {
      const form = (config.customForms || []).find(f => f.name === "survey");
      appendMessage("bot", "Thank you for reaching out to ISO AI. Before you go, could you share your feedback?");
      if (form) renderCustomForm(form);
      return;
    } else if (textLower.includes("academic") || textLower.includes("course") || textLower.includes("student")) {
      reply = "I specialize in academic support! You can ask about course registrations, campus resources, academic deadlines, or tutoring services.";
    } else if (textLower.includes("tech") || textLower.includes("password") || textLower.includes("login")) {
      reply = "For technology support, I can guide you through student portal access, multi-factor authentication, Wi-Fi connectivity, or account resets.";
    }

    appendMessage("bot", reply);
    showQuickReplies(config.quickReplies);
  }

  function showQuickReplies(replies) {
    const container = widgetContainer.querySelector(".iso-quick-replies");
    if (!replies || replies.length === 0) {
      container.style.display = "none";
      return;
    }

    container.innerHTML = "";
    replies.forEach(replyText => {
      const btn = document.createElement("button");
      btn.className = "iso-quick-reply-btn";
      btn.textContent = replyText;
      btn.addEventListener("click", () => {
        appendMessage("user", replyText);
        hideQuickReplies();
        getBotResponse(replyText);
      });
      container.appendChild(btn);
    });

    container.style.display = "flex";
    scrollToBottom();
  }

  function hideQuickReplies() {
    const container = widgetContainer.querySelector(".iso-quick-replies");
    if (container) container.style.display = "none";
  }

  // --------------------------------------------------------
  // 13. WELCOME MESSAGES & HISTORY PERSISTENCE
  // --------------------------------------------------------
  function getHistoryKey() {
    return `iso_history_${config.botId}`;
  }

  function saveChatHistory() {
    if (!config.persistHistory) return;
    try {
      localStorage.setItem(getHistoryKey(), JSON.stringify(chatHistory));
    } catch (e) {
      console.warn("[ISO Chatbot] Error saving history to localStorage", e);
    }
  }

  function loadChatHistory() {
    // Purge any old cache from localStorage that contains obsolete messages or no user messages
    try {
      const oldHistory = localStorage.getItem(getHistoryKey());
      if (oldHistory && (oldHistory.includes("Atom") || !oldHistory.includes('"sender":"user"'))) {
        localStorage.removeItem(getHistoryKey());
      }
    } catch (e) {}

    if (config.persistHistory) {
      const historyString = localStorage.getItem(getHistoryKey());
      if (historyString) {
        try {
          const parsed = JSON.parse(historyString);
          if (Array.isArray(parsed) && parsed.some(m => m.sender === "user")) {
            chatHistory = parsed;
            chatHistory.forEach(msg => {
              renderMessage(msg.sender, msg.text, msg.isHtml, msg.timestamp, msg.id);
            });
            showQuickReplies(config.quickReplies);
            return;
          }
        } catch (e) {
          console.warn("[ISO Chatbot] Error parsing saved chat history", e);
        }
      }
    }

    // Only render immediately if isChatOpened is configured as true;
    // Otherwise, welcome message renders as soon as the user opens the bot!
    if (config.botUIConfigs && config.botUIConfigs.isChatOpened) {
      renderWelcomeMessages();
    }
  }

  function getWelcomeMessages() {
    const ui = config.botUIConfigs || {};
    // Priority:
    // 1. config.greetingMessage (from MongoDB document root)
    // 2. ui.greetingMessage
    // 3. ui.welcomeMessage
    // 4. config.welcomeMessage
    const candidate = config.greetingMessage ||
                      (ui.greetingMessage && ui.greetingMessage.length ? ui.greetingMessage : null) ||
                      ui.welcomeMessage ||
                      config.welcomeMessage;

    if (!candidate) {
      return ["Hi! How can I assist you today?"];
    }

    if (Array.isArray(candidate)) {
      const filtered = candidate.filter(msg => typeof msg === "string" && msg.trim() !== "");
      return filtered.length > 0 ? filtered : ["Hi! How can I assist you today?"];
    }

    if (typeof candidate === "string" && candidate.trim() !== "") {
      return [candidate.trim()];
    }

    return ["Hi! How can I assist you today?"];
  }

  function renderWelcomeMessages() {
    chatHistory = [];
    if (chatBody) chatBody.innerHTML = "";

    const messages = getWelcomeMessages();
    messages.forEach(msg => {
      appendMessage("bot", msg);
    });

    showQuickReplies(config.quickReplies);
  }

  function clearChatHistory() {
    localStorage.removeItem(getHistoryKey());
    renderWelcomeMessages();
  }

  function updateDOMWithNewConfig() {
    if (!widgetContainer) return;
    const ui = config.botUIConfigs || {};

    // 1. Header title
    const nameEl = widgetContainer.querySelector(".iso-bot-name");
    if (nameEl && (ui.botHeaderText || config.botName)) {
      nameEl.textContent = ui.botHeaderText || config.botName;
    }

    // 2. Header logo
    const logoEl = widgetContainer.querySelector(".iso-header-logo");
    if (logoEl && (ui.logoUrl || config.botLogo)) {
      logoEl.innerHTML = renderLogoHtml(ui.logoUrl || config.botLogo, ui.botHeaderText || config.botName);
    }

    // 3. Toggle button launcher image
    const startImg = widgetContainer.querySelector(".iso-start-img");
    if (startImg && ui.botChatStartImage) {
      startImg.src = ui.botChatStartImage;
    }

    // 4. Input placeholder
    if (textInput && (ui.DefaultEmptyMessage || config.placeholderText)) {
      textInput.placeholder = ui.DefaultEmptyMessage || config.placeholderText;
    }

    // 5. If chat has only initial greetings or is empty, refresh welcome message from botUIConfigs
    const hasUserMessages = chatHistory.some(m => m.sender === "user");
    if (!hasUserMessages && isChatOpen) {
      renderWelcomeMessages();
    }
  }

  // --------------------------------------------------------
  // 14. INITIALIZATION (Runs API call first, then mounts UI)
  // --------------------------------------------------------
  async function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
      return;
    }

    // 1. Call API inside chatbot.js first
    await fetchConfigFromAPI();

    // 2. Inject styles with unique "iso-" classes
    injectStyles();

    // 3. Build unique "iso-" DOM elements
    createChatbotDOM();

    // 4. Load history or await bot opening
    loadChatHistory();
  }

  init();

  // --------------------------------------------------------
  // 15. PUBLIC GLOBAL CONTROL INTERFACE
  // --------------------------------------------------------
  const publicApi = {
    open: () => openChat(),
    close: () => closeChat(),
    toggle: () => handleToggleClick(),
    clearHistory: () => clearChatHistory(),
    showForm: (formName) => {
      const form = (config.customForms || []).find(f => f.name === formName);
      if (form) renderCustomForm(form);
    },
    downloadTranscript: () => downloadTranscript(),
    loadFromApi: async (apiUrl) => {
      if (!apiUrl) return;
      try {
        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          applyLoadedConfig(data);
          normalizeConfigs(config);
          injectStyles();
          updateDOMWithNewConfig();
          return config;
        }
      } catch (err) {
        console.error("[ISO Chatbot] Failed to fetch config from API", err);
      }
    },
    updateUIConfigs: (newUIConfigs) => {
      config.botUIConfigs = deepMerge(config.botUIConfigs, newUIConfigs);
      normalizeConfigs(config);
      injectStyles();
      updateDOMWithNewConfig();
    },
    updateConfig: (newConfig) => {
      applyLoadedConfig(newConfig);
      normalizeConfigs(config);
      injectStyles();
      updateDOMWithNewConfig();
    },
    sendMessage: (text) => {
      if (!isChatOpen) openChat();
      appendMessage("user", text);
      getBotResponse(text);
    },
    getConfig: () => JSON.parse(JSON.stringify(config))
  };

  // Primary API namespace
  window.IsoChat = publicApi;
  // Backward compatibility alias
  window.AuraChat = publicApi;
})();
