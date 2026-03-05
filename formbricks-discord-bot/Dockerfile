# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — Formbricks Discord Bot v5 (Prisma ORM, Production)
#
# CATATAN:
#   Tidak menggunakan postgresql-client / pg_isready.
#   Koneksi DB dicek via Node.js (net module + pg library) di entrypoint.
#   Ini lebih reliable di multi-stage Alpine build.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:18-alpine AS base

WORKDIR /app

# openssl: diperlukan Prisma untuk TLS ke PostgreSQL
# wget: diperlukan healthcheck bot container
RUN apk add --no-cache openssl wget

# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM base AS deps

COPY package*.json ./

# Install production deps + prisma untuk generate
RUN npm ci --only=production && \
    npm install --save-dev prisma

COPY prisma ./prisma/

RUN npx prisma generate

# ── Stage 2: Runner (Production Image) ───────────────────────────────────────
FROM base AS runner

WORKDIR /app

COPY --from=deps /app/node_modules        ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

COPY . .

RUN chmod +x /app/docker-entrypoint.sh && \
    mkdir -p /app/public/reports /app/logs

EXPOSE 3000

CMD ["/app/docker-entrypoint.sh"]