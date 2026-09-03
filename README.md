# ISO Middleware Module

Enterprise-grade API Middleware service built with Node.js and Express for the ISO Chatbot ecosystem. It handles chatbot configuration resolution, conversational AI routing, MongoDB fetch APIs, session persistence, dynamic form postbacks, thumbs up/down feedback, and telemetry tracking.

---

## 🏗️ Architecture & Directory Structure

Designed with a clean, decoupled MVC/Service Layer pattern:

```text
iso-middleware/
├── Dockerfile                  # Multi-stage container build (Node.js 22 Alpine)
├── .dockerignore               # Optimized build context exclusion
├── docker-compose.yml          # Local container orchestration with MongoDB
├── .env.example                # Environment variables template
├── .env                        # Local development settings
├── package.json                # Modern dependencies & scripts
├── README.md                   # Comprehensive documentation
└── src/
    ├── app.js                  # Express setup, security middleware, CORS & routes mounting
    ├── server.js               # Entrypoint, DB lifecycle & graceful shutdown handlers
    ├── config/
    │   ├── database.js         # Mongoose connection pooling, events & health status
    │   └── env.js              # Centralized and validated environment variables
    ├── constants/
    │   └── botDefaults.js      # Default botUIConfigs & customForms matching chatbot widget
    ├── controllers/
    │   ├── botController.js    # Bot config fetch & CRUD operations
    │   ├── chatController.js   # Chat completions & SSE streaming
    │   ├── conversationController.js # History & plain-text transcript downloads
    │   ├── feedbackController.js     # Thumbs up/down & star rating handlers
    │   ├── formController.js   # Dynamic custom forms submission postbacks
    │   ├── healthController.js # Docker/Kubernetes healthcheck & system stats
    │   └── mongoController.js  # Generalized MongoDB fetch & query utility APIs
    ├── helpers/
    │   ├── apiResponse.js      # Standardized JSON response envelope
    │   ├── logger.js           # Structured console logger with timestamps
    │   └── promptBuilder.js    # Prompt engineering, knowledge context & history windowing
    ├── middlewares/
    │   ├── errorHandler.js     # Centralized error handler (Mongoose errors, CastErrors)
    │   ├── rateLimiter.js      # Endpoint-specific IP rate limiters
    │   └── requestLogger.js    # HTTP request logging
    ├── models/
    │   ├── Analytics.js        # Bot metrics, token usage, daily activity & queries
    │   ├── Bot.js              # Bot model with botUIConfigs & toWidgetConfig()
    │   ├── Conversation.js     # Chat turns, message history & client metadata
    │   ├── Feedback.js         # Thumbs up/down feedback tracking
    │   ├── FormSubmission.js   # Dynamic form submissions (transfers, surveys)
    │   ├── Tenant.js           # Tenant definition & settings
    │   └── index.js            # Unified model exports
    ├── routes/
    │   ├── botRoutes.js        # /api/bot-config, /api/bots
    │   ├── chatRoutes.js       # /api/chat, /api/chat/stream
    │   ├── conversationRoutes.js # /api/conversations/:sessionId
    │   ├── feedbackRoutes.js   # /api/chat/feedback
    │   ├── formRoutes.js       # /api/chat/form-submit, /api/forms
    │   ├── healthRoutes.js     # /health
    │   ├── mongoRoutes.js      # /api/mongo/fetch, /api/mongo/collections
    │   └── index.js            # Aggregated /api router
    └── services/
        ├── aiService.js        # OpenAI + local intelligent fallback engine
        ├── analyticsService.js # Asynchronous telemetry & token logging
        ├── botService.js       # Bot resolution, fallback merging & DB lookups
        └── conversationService.js # Exchange recording & transcript formatting
```

---

## ⚡ Quick Start

### 1. Local Development

```bash
cd iso-middleware

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run development server (with hot reload via nodemon)
npm run dev
```

The server will start on `http://localhost:5001`.

---

## 🐳 Docker Deployment

The middleware is container-ready using **Node.js 22 Alpine** (latest Active LTS):
- **Multi-stage builds** for minimal image size (~150MB)
- **Non-root user (`node`)** for container security
- Built-in **`HEALTHCHECK`** polling `/health`
- **Graceful shutdown** on `SIGTERM` / `SIGINT`

### Build and Run with Docker

```bash
# Build the Docker image
docker build -t iso-middleware:latest .

# Run container standalone
docker run -d \
  --name iso-middleware \
  -p 5001:5001 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/isochat" \
  iso-middleware:latest
```

### Run with Docker Compose

To spin up the middleware together with a local MongoDB container:

```bash
docker compose up -d
```

Check status and logs:
```bash
docker compose ps
docker compose logs -f iso-middleware
```

---

## 📡 API Reference

### 1. Chatbot Widget Config Fetch

Used directly by `chat/chatbot.js` upon initialization:

```http
GET /api/bot-config?botId={botId}&tenantId={tenantId}
```

**Response Example:**
```json
{
  "_id": "6a97bb88eabe0901e52bb290",
  "botId": "ISOBot",
  "botName": "ISO Bot",
  "botActive": true,
  "greetingMessage": [
    "Hi! I’m your AI assistant. How can I assist you today?"
  ],
  "botUIConfigs": {
    "botThemeColor": "#00306D",
    "botHeaderText": "ISO AI Assistant",
    "botChatStartImage": "https://...",
    "showThumbUpDownFeedbackform": true,
    "botChatSubmitButton": true
  }
}
```

---

### 2. Chat Query API

Handles user messages sent from the widget:

```http
POST /api/chat
Content-Type: application/json

{
  "query": "How do I reset my password?",
  "botId": "ISOBot",
  "tenantId": "default",
  "sessionId": "sess_123456",
  "history": [
    { "sender": "user", "text": "Hi" },
    { "sender": "bot", "text": "Hello! How can I help?" }
  ]
}
```

**Response Example:**
```json
{
  "response": "To reset your credentials, visit the account settings portal and select 'Forgot Password'.",
  "reply": "To reset your credentials, visit the account settings portal and select 'Forgot Password'.",
  "botName": "ISO AI Assistant",
  "form": null,
  "quickReplies": ["Didn’t receive email", "Contact admin"],
  "sessionId": "sess_123456",
  "latencyMs": 45,
  "timestamp": "2026-09-02T08:00:00.000Z"
}
```

*(Note: Response provides both `response` and `reply` keys to match all property lookups in `chatbot.js`.)*

---

### 3. Streaming Chat (SSE)

Real-time token-by-token streaming:

```http
POST /api/chat/stream
Content-Type: application/json

{
  "query": "Explain what you can do",
  "botId": "ISOBot"
}
```

Returns Server-Sent Events stream:
```text
data: {"chunk":"Hello!","done":false}

data: {"chunk":" I can help","done":false}

data: {"done":true,"fullText":"Hello! I can help with ..."}
```

---

### 4. MongoDB Fetch APIs

Query any collection in the database with filtering, projection, and pagination:

```http
# List collections and estimated document counts
GET /api/mongo/collections

# Fetch documents from a collection with query params
GET /api/mongo/fetch/bots?page=1&limit=10&sort=-createdAt&fields=name,code,status

# Check MongoDB connectivity and ping latency
GET /api/mongo/status
```

---

### 5. Thumbs Up / Down Feedback

```http
POST /api/chat/feedback
Content-Type: application/json

{
  "botId": "ISOBot",
  "sessionId": "sess_123456",
  "type": "like",
  "rating": 5,
  "query": "How do I reset password?",
  "response": "To reset your credentials...",
  "comment": "Quick and helpful"
}
```

---

### 6. Dynamic Form Postback

Submits data from in-chat custom forms (such as `transferCall` or `survey`):

```http
POST /api/chat/form-submit
Content-Type: application/json

{
  "formName": "transferCall",
  "botId": "ISOBot",
  "sessionId": "sess_123456",
  "data": {
    "fullName": "Jane Doe",
    "phone": "+1-555-0199",
    "notes": "Need urgent billing help"
  }
}
```

---

### 7. Chat Transcript Export

Download or view complete conversation logs:

```http
# Download as text file
GET /api/conversations/{sessionId}/transcript?download=true

# View JSON history
GET /api/conversations/{sessionId}
```

---

### 8. Health Check

```http
GET /health
```

**Response Example:**
```json
{
  "status": "UP",
  "timestamp": "2026-09-02T08:00:00.000Z",
  "uptimeSeconds": 1420,
  "environment": "production",
  "nodeVersion": "v22.0.0",
  "database": {
    "state": "connected",
    "readyState": 1,
    "host": "mongo",
    "name": "isochat"
  },
  "processMemory": {
    "rssMB": 48,
    "heapUsedMB": 24,
    "heapTotalMB": 32
  }
}
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5001` | Server port |
| `HOST` | `0.0.0.0` | Host binding interface |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/isochat` | MongoDB connection URI |
| `MONGODB_POOL_SIZE` | `10` | Maximum connection pool size |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (comma-separated or `*`) |
| `OPENAI_API_KEY` | `""` | Optional OpenAI key (uses local engine if omitted) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Default LLM model for OpenAI calls |
| `RATE_LIMIT_MAX` | `120` | Max requests per minute per IP |
| `DEFAULT_BOT_ID` | `ISOBot` | Fallback bot identifier |
# iso-middleware
