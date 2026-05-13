"use strict";
const { PrismaClient } = require("@prisma/client");
const config           = require("../../config");

// ─── Singleton ───────────────────────────────────────────────────────────────
const globalRef = globalThis;

// Dev: only log warn+error to keep logs clean. Query-level logging creates
// extreme noise in docker logs and is only useful for ad-hoc debugging.
// To enable query logging temporarily: set LOG_PRISMA_QUERY=true in .env
const prismaLogLevels = config.isDev && process.env.LOG_PRISMA_QUERY === "true"
  ? ["query", "info", "warn", "error"]
  : ["warn", "error"];

const prisma =
  globalRef.__prisma ??
  new PrismaClient({
    log: prismaLogLevels,
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
