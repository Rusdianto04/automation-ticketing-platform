#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# docker-entrypoint.sh — support-incident-system Backend Startup
#
# Uses Node.js TCP + pg library checks (no psql/pg_isready needed on Alpine)
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "============================================================"
echo "  Support & Incident System — Backend Startup"
echo "============================================================"

# ── Step 0: Ensure upload directories exist and are writable ─────────────────
echo "[INFO] Ensuring upload directories exist and are writable..."
mkdir -p /app/public/uploads/tickets /app/public/reports /app/logs
# Coba chmod — mungkin gagal di named volume production (tidak masalah, sudah benar)
chmod -R 775 /app/public/uploads 2>/dev/null || true
echo "[OK] Upload directories ready!"

PG_HOST="${DB_HOST:-postgres}"
PG_PORT="${DB_PORT:-5432}"
PG_USER="${DB_USER:-formbricks_user}"
PG_PASS="${DB_PASSWORD:-${DB_PASS:-formbricks_pass}}"
PG_DB="${DB_NAME:-formbricks_tickets}"

echo "[INFO] Target DB: postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DB}"

# ── Step 1: TCP check ─────────────────────────────────────────────────────────
echo "[INFO] Waiting for PostgreSQL TCP..."
node -e "
const net = require('net');
const host = process.env.DB_HOST || 'postgres';
const port = parseInt(process.env.DB_PORT || '5432');
const maxRetries = 30;
const delayMs = 3000;
let attempt = 0;
function tryConnect() {
  attempt++;
  const socket = new net.Socket();
  socket.setTimeout(2000);
  socket.connect(port, host, () => {
    console.log('[OK] PostgreSQL TCP open at ' + host + ':' + port);
    socket.destroy();
    process.exit(0);
  });
  socket.on('error', () => {
    socket.destroy();
    if (attempt >= maxRetries) { console.error('[ERROR] PostgreSQL unreachable after ' + maxRetries + ' tries'); process.exit(1); }
    console.log('[WAIT] PostgreSQL not ready (' + attempt + '/' + maxRetries + '), retrying in 3s...');
    setTimeout(tryConnect, delayMs);
  });
  socket.on('timeout', () => {
    socket.destroy();
    if (attempt >= maxRetries) { console.error('[ERROR] Timeout'); process.exit(1); }
    setTimeout(tryConnect, delayMs);
  });
}
tryConnect();
"

echo "[OK] PostgreSQL TCP ready!"

# ── Step 2: DB query check ────────────────────────────────────────────────────
echo "[INFO] Verifying DB connection..."
node -e "
const { Client } = require('pg');
const maxRetries = 20;
const delayMs = 2000;
let attempt = 0;
async function tryQuery() {
  attempt++;
  const client = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'formbricks_user',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'formbricks_pass',
    database: process.env.DB_NAME || 'formbricks_tickets',
    connectionTimeoutMillis: 3000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    console.log('[OK] DB connection verified!');
    process.exit(0);
  } catch (err) {
    try { await client.end(); } catch(_) {}
    if (attempt >= maxRetries) { console.error('[ERROR] DB unreachable:', err.message); process.exit(1); }
    console.log('[WAIT] DB not ready (' + attempt + '/' + maxRetries + '): ' + err.message);
    setTimeout(tryQuery, delayMs);
  }
}
tryQuery();
"

echo "[OK] DB ready!"

# ── Step 3: Prisma baseline check ────────────────────────────────────────────
echo "[INFO] Checking Prisma migration state..."
node -e "
const { Client } = require('pg');
async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'formbricks_user',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'formbricks_pass',
    database: process.env.DB_NAME || 'formbricks_tickets',
  });
  await client.connect();
  try {
    const tableCheck = await client.query(\`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
      ) AS exists;
    \`);
    if (!tableCheck.rows[0].exists) {
      console.log('[INFO] Fresh install — no baseline needed');
      await client.end(); process.exit(0);
    }
    const initCheck = await client.query(\`
      SELECT COUNT(*) as count FROM _prisma_migrations WHERE migration_name = '0001_init';
    \`);
    if (parseInt(initCheck.rows[0].count) > 0) {
      console.log('[OK] Migration 0001_init already recorded');
      await client.end(); process.exit(0);
    }
    const { randomUUID } = require('crypto');
    const checksum = require('crypto').createHash('sha256').update('0001_init_baseline').digest('hex');
    await client.query(\`
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES ($1, $2, NOW(), '0001_init', NULL, NULL, NOW(), 1) ON CONFLICT (id) DO NOTHING;
    \`, [randomUUID(), checksum]);
    console.log('[OK] Baseline recorded for 0001_init');
  } catch (err) {
    console.error('[ERROR] Baseline check failed:', err.message);
    await client.end(); process.exit(1);
  }
  await client.end(); process.exit(0);
}
main().catch(err => { console.error('[ERROR]', err.message); process.exit(1); });
"

echo "[OK] Baseline check done!"

# ── Step 4: Prisma migrate deploy ────────────────────────────────────────────
echo "[INFO] Running prisma migrate deploy..."
if npx prisma migrate deploy; then
  echo "[OK] Prisma migrate deploy done!"
else
  echo "[WARN] prisma migrate deploy failed — trying db push as fallback..."
  npx prisma db push --accept-data-loss || true
fi

echo "============================================================"
echo "  Starting Support & Incident System Backend..."
echo "============================================================"

exec node src/server.js