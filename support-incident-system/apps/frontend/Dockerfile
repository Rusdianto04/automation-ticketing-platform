# =============================================================================
# Dockerfile — support-incident-system Frontend (Next.js Portal)
# Node 20 Alpine | Multi-stage standalone build | Non-root user
# No direct database access — all data via backend API
# =============================================================================

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Provide build-time defaults so next.config.js env block resolves correctly.
# These will be overridden at runtime by docker-compose environment section.
ENV BACKEND_URL=http://backend:3000
ENV BACKEND_SELF_URL=http://backend:3000
ENV N8N_API_KEY=automation_ticketing01_incident02
ENV ORG_NAME=SEAMOLEC
ENV ORG_DEPARTMENT="IT Department"

RUN mkdir -p /app/public
RUN npm run build

# ── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache wget && \
    addgroup -g 1001 -S nodejs && \
    adduser  -S nextjs -u 1001

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Runtime defaults — overridden by docker-compose environment section
ENV BACKEND_URL=http://backend:3000
ENV BACKEND_SELF_URL=http://backend:3000
ENV N8N_API_KEY=automation_ticketing01_incident02
ENV ORG_NAME=SEAMOLEC
ENV ORG_DEPARTMENT="IT Department"

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
