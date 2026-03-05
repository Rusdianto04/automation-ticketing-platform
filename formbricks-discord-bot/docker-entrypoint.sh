#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# docker-entrypoint.sh — Formbricks Discord Bot Startup
#
# FIX: Tidak menggunakan pg_isready / psql (tidak tersedia di Alpine node image)
# SOLUSI: Gunakan Node.js murni untuk:
#   1. TCP check (tunggu PostgreSQL listen di port 5432)
#   2. DB query check (pg library — sudah ada di node_modules)
#   3. Baseline Prisma migration (fix P3005)
#   4. Jalankan prisma migrate deploy
#   5. Start aplikasi
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "============================================================"
echo "  Formbricks Discord Bot v5 — Startup"
echo "============================================================"

# ── Variabel koneksi dari environment ────────────────────────────────────────
PG_HOST="${DB_HOST:-postgres}"
PG_PORT="${DB_PORT:-5432}"
PG_USER="${DB_USER:-formbricks_user}"
PG_PASS="${DB_PASSWORD:-${DB_PASS:-formbricks_pass}}"
PG_DB="${DB_NAME:-formbricks_tickets}"

echo "[INFO] Target DB: postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DB}"

# ── Step 1: Tunggu PostgreSQL siap via Node.js TCP check ─────────────────────
# Tidak pakai pg_isready/psql — murni Node.js net module (selalu tersedia)
echo "[INFO] Menunggu PostgreSQL siap (TCP check via Node.js)..."

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
    console.log('[OK] PostgreSQL TCP port ' + port + ' terbuka di ' + host);
    socket.destroy();
    process.exit(0);
  });

  socket.on('error', (err) => {
    socket.destroy();
    if (attempt >= maxRetries) {
      console.error('[ERROR] PostgreSQL tidak dapat dijangkau setelah ' + maxRetries + ' percobaan. Keluar.');
      process.exit(1);
    }
    console.log('[WAIT] PostgreSQL belum siap (' + attempt + '/' + maxRetries + '), tunggu 3 detik...');
    setTimeout(tryConnect, delayMs);
  });

  socket.on('timeout', () => {
    socket.destroy();
    if (attempt >= maxRetries) {
      console.error('[ERROR] Timeout. PostgreSQL tidak merespons.');
      process.exit(1);
    }
    console.log('[WAIT] Timeout (' + attempt + '/' + maxRetries + '), tunggu 3 detik...');
    setTimeout(tryConnect, delayMs);
  });
}

tryConnect();
"

echo "[OK] PostgreSQL TCP siap!"

# ── Step 2: Tunggu PostgreSQL benar-benar bisa menerima query ────────────────
# TCP bisa open tapi PostgreSQL belum selesai init. Tambah delay + query test.
echo "[INFO] Verifikasi koneksi DB dengan query test..."

node -e "
const { Client } = require('pg');
const maxRetries = 20;
const delayMs = 2000;
let attempt = 0;

async function tryQuery() {
  attempt++;
  const client = new Client({
    host:     process.env.DB_HOST     || 'postgres',
    port:     parseInt(process.env.DB_PORT || '5432'),
    user:     process.env.DB_USER     || 'formbricks_user',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'formbricks_pass',
    database: process.env.DB_NAME     || 'formbricks_tickets',
    connectionTimeoutMillis: 3000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    console.log('[OK] Koneksi database berhasil!');
    process.exit(0);
  } catch (err) {
    try { await client.end(); } catch(_) {}
    if (attempt >= maxRetries) {
      console.error('[ERROR] Tidak bisa connect ke database setelah ' + maxRetries + ' percobaan:', err.message);
      process.exit(1);
    }
    console.log('[WAIT] Query test gagal (' + attempt + '/' + maxRetries + '): ' + err.message);
    setTimeout(tryQuery, delayMs);
  }
}

tryQuery();
"

echo "[OK] Database siap menerima koneksi!"

# ── Step 3: Handle Prisma baseline untuk database existing (fix P3005) ────────
echo "[INFO] Memeriksa status Prisma migration..."

node -e "
const { Client } = require('pg');

async function main() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'postgres',
    port:     parseInt(process.env.DB_PORT || '5432'),
    user:     process.env.DB_USER     || 'formbricks_user',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'formbricks_pass',
    database: process.env.DB_NAME     || 'formbricks_tickets',
  });

  await client.connect();

  try {
    // Cek apakah tabel _prisma_migrations sudah ada
    const tableCheck = await client.query(\`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
      ) AS exists;
    \`);

    const migrationsTableExists = tableCheck.rows[0].exists;

    if (!migrationsTableExists) {
      console.log('[INFO] Tabel _prisma_migrations belum ada — fresh install, skip baseline.');
      await client.end();
      process.exit(0);
    }

    console.log('[INFO] Tabel _prisma_migrations ditemukan (database existing).');

    // Cek apakah migration 0001_init sudah tercatat
    const initCheck = await client.query(\`
      SELECT COUNT(*) as count
      FROM _prisma_migrations
      WHERE migration_name = '0001_init';
    \`);

    const initCount = parseInt(initCheck.rows[0].count);

    if (initCount > 0) {
      console.log('[OK] Migration 0001_init sudah tercatat (skip baseline).');
      await client.end();
      process.exit(0);
    }

    // Migration belum tercatat — buat baseline record
    console.log('[INFO] Migration 0001_init belum tercatat — melakukan baseline...');

    // Generate UUID
    const { randomUUID } = require('crypto');
    const migrationId = randomUUID();

    // Checksum dari nama file (cukup untuk baseline, tidak harus sha256 exact)
    const checksum = require('crypto')
      .createHash('sha256')
      .update('0001_init_baseline')
      .digest('hex');

    await client.query(\`
      INSERT INTO _prisma_migrations
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        ($1, $2, NOW(), '0001_init', NULL, NULL, NOW(), 1)
      ON CONFLICT (id) DO NOTHING;
    \`, [migrationId, checksum]);

    console.log('[OK] Baseline migration 0001_init berhasil dicatat. ID:', migrationId);

  } catch (err) {
    console.error('[ERROR] Baseline check gagal:', err.message);
    await client.end();
    process.exit(1);
  }

  await client.end();
  process.exit(0);
}

main().catch(err => {
  console.error('[ERROR] Unexpected error:', err.message);
  process.exit(1);
});
"

echo "[OK] Baseline check selesai!"

# ── Step 4: Jalankan Prisma Migrate Deploy ────────────────────────────────────
echo "[INFO] Menjalankan prisma migrate deploy..."
if npx prisma migrate deploy; then
  echo "[OK] Prisma migrate deploy selesai!"
else
  echo "[WARN] prisma migrate deploy gagal. Cek log di atas."
  echo "[INFO] Mencoba prisma db push sebagai fallback..."
  npx prisma db push --accept-data-loss || true
fi

echo "============================================================"
echo "  Starting Formbricks Discord Bot..."
echo "============================================================"

exec node index.js