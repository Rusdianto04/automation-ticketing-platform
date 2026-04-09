# =============================================================================
# Dockerfile — SIS Backend (Discord Bot + Express API)
# Node 18 Alpine | Multi-stage | Production
# =============================================================================

FROM node:18-alpine AS base

WORKDIR /app

RUN apk add --no-cache openssl wget

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM base AS deps

COPY package.json ./

RUN npm install

COPY prisma ./prisma/

RUN npx prisma generate

# ── Stage 2: Production Runner ────────────────────────────────────────────────
FROM base AS runner

WORKDIR /app

# Copy semua node_modules sekaligus (termasuk .prisma di dalamnya)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY index.js             ./
COPY src/                 ./src/
COPY prisma/              ./prisma/
COPY docker-entrypoint.sh ./
COPY n8n-workflows/       ./n8n-workflows/

RUN chmod +x /app/docker-entrypoint.sh && \
    mkdir -p /app/public/reports /app/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["/app/docker-entrypoint.sh"]