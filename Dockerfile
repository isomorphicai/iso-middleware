# ==============================================================================
# Multi-stage Dockerfile for ISO Chatbot Middleware
# Target: Node.js 22 Alpine (Latest Active LTS)
# ==============================================================================

# ----------------- Stage 1: Build & Dependencies -----------------
FROM node:22-alpine AS dependencies

WORKDIR /app

# Install build dependencies if native addons needed
RUN apk add --no-cache libc6-compat

# Copy package descriptors
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# ----------------- Stage 2: Production Image -----------------
FROM node:22-alpine AS runner

WORKDIR /app

# Environment variables
ENV NODE_ENV=production \
    PORT=5001 \
    HOST=0.0.0.0

# Security: Run as non-root user built into the node alpine image
# Create app directory with proper ownership
RUN chown -R node:node /app

# Copy dependencies from previous stage
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./

# Copy application source code
COPY --chown=node:node src ./src

# Switch to non-root user
USER node

# Expose service port
EXPOSE 5001

# Healthcheck to verify container is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/health || exit 1

# Start the application
CMD ["node", "src/server.js"]
