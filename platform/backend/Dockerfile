# ================================
# CustomERP Backend - Production
# ================================
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies only
COPY package*.json ./
# Note: use npm install here (not npm ci) because in development we may bump dependencies
# without immediately regenerating/committing package-lock.json. This keeps production builds working.
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/
COPY migrations/ ./migrations/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]

