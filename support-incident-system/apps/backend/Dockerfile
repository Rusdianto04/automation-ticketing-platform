# =============================================================================
# Dockerfile — support-incident-system Backend
# Node 18 Alpine | Multi-stage | Production | Non-root user
# =============================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:18-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

# ── Stage 2: Production Runner ────────────────────────────────────────────────
FROM node:18-alpine AS runner

WORKDIR /app

# Security: non-root user
RUN apk add --no-cache openssl wget && \
    addgroup -g 1001 -S nodejs && \
    adduser  -S appuser -u 1001

# Copy production deps + generated Prisma client
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/           ./src/
COPY prisma/        ./prisma/
COPY n8n-workflows/ ./n8n-workflows/
COPY infra/docker/docker-entrypoint.sh ./docker-entrypoint.sh

# Buat semua direktori yang diperlukan dan set ownership SEBELUM switch user
RUN chmod +x /app/docker-entrypoint.sh && \
    mkdir -p /app/public/reports \
             /app/public/uploads/tickets \
             /app/logs && \
    chown -R appuser:nodejs /app && \
    chmod -R 775 /app/public/uploads

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["/app/docker-entrypoint.sh"]