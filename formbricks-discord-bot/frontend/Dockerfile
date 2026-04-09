# =============================================================================
# Dockerfile — SIS Frontend (Next.js Portal)
# Node 20 Alpine | Multi-stage standalone build
#
# FIX v3:
#   [1] DATABASE_URL dummy di build stage agar prisma generate tidak crash
#   [2] HEALTHCHECK start-period dinaikkan ke 120s
# =============================================================================

FROM node:20-alpine AS base
RUN apk add --no-cache wget openssl
WORKDIR /app

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM base AS deps
COPY package.json ./

# FIX: DATABASE_URL dummy agar prisma generate tidak crash saat build
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate

# ── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN mkdir -p /app/public
RUN npm run build

# ── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/public
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3001

# FIX: start-period=120s — Next.js standalone butuh waktu cold start
HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]