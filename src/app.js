const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const env = require('./config/env');
const requestLogger = require('./middlewares/requestLogger');
const errorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');
const ApiResponse = require('./helpers/apiResponse');

const app = express();

// Security headers with embedding-friendly configuration for the chat widget
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration: enables cross-origin requests for chatbot embedding
const corsOptions = {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  credentials: true
};
app.use(cors(corsOptions));

// HTTP request logging
app.use(requestLogger);

// Gzip compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Liveness probe directly at /health for Docker & load balancers
app.get('/health', (req, res) => {
  const healthController = require('./controllers/healthController');
  return healthController.getHealth(req, res);
});

// Mount all API endpoints under /api
app.use('/api', apiRoutes);

// Serve embeddable chatbot.js widget script directly
app.get('/chatbot.js', (req, res) => {
  const chatbotPath = path.join(__dirname, '../../chat/chatbot.js');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(chatbotPath);
});

// Serve static assets from portal client build folder if present
const path = require('path');
const fs = require('fs');
const portalDistPath = path.join(__dirname, '../../iso-portal/client/dist');
const distPath = fs.existsSync(portalDistPath) ? portalDistPath : path.join(__dirname, '../../iso-admin/client/dist');
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// Fallback for SPA routing - serve index.html if not an /api route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      return ApiResponse.success(res, {
        service: 'ISO Chatbot Middleware & Admin Engine',
        version: '1.0.0',
        documentation: '/api/health',
        status: 'online'
      }, 'ISO Unified Middleware & Admin Engine is active');
    }
  });
});

// 404 handler
app.use((req, res) => {
  return ApiResponse.notFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;
