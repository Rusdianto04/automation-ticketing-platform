/**
 * src/database/client.js
 * Prisma Client — Singleton
 *
 * Pattern singleton memastikan satu connection pool
 * per proses Node.js, termasuk saat nodemon hot-reload.
 */

"use strict";

const { PrismaClient } = require("@prisma/client");
const config           = require("../config");

// ─── Singleton ───────────────────────────────────────────────────────────────

const globalRef = globalThis;

const prisma =
  globalRef.__prisma ??
  new PrismaClient({
    log: config.isDev
      ? ["query", "info", "warn", "error"]
      : ["error", "warn"],
  });

if (config.isDev) {
  globalRef.__prisma = prisma;
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function disconnect() {
  try {
    await prisma.$disconnect();
    console.log("✅ [DB] Prisma disconnected gracefully");
  } catch (err) {
    console.error("❌ [DB] Prisma disconnect error:", err.message);
    process.exit(1);
  }
}

process.on("SIGINT",     disconnect);
process.on("SIGTERM",    disconnect);
process.on("beforeExit", disconnect);

module.exports = prisma;
