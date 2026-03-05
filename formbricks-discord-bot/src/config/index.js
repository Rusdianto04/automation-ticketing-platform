/**
 * src/config/index.js
 * Centralized Application Configuration
 *
 * Semua environment variable dibaca di satu tempat.
 * Validasi wajib dilakukan di sini — fail-fast jika ada yang kurang.
 *
 * FIX v2:
 *   portal.reportDir: null → path.join(process.cwd(), "public", "reports")
 *   Sebelumnya null, modul lain menggunakan fallback sendiri-sendiri
 *   (index.js pakai path.join(__dirname, ...) vs report.service.js pakai process.cwd())
 *   yang bisa menghasilkan path berbeda di environment tertentu.
 *   Dengan default konsisten di config, semua modul menggunakan path yang sama.
 */

"use strict";

const path = require("path");
require("dotenv").config();

// ─── Validation ──────────────────────────────────────────────────────────────

const REQUIRED_VARS = ["DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID", "DATABASE_URL"];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ [CONFIG] Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// ─── Config Object ───────────────────────────────────────────────────────────

const config = {
  // App
  env:  process.env.NODE_ENV || "production",
  port: parseInt(process.env.PORT, 10) || 3000,
  isDev: (process.env.NODE_ENV || "production") === "development",

  // Organization
  org: {
    name:       process.env.ORG_NAME       || "SEAMOLEC",
    department: process.env.ORG_DEPARTMENT || "IT Department",
  },

  // Database
  database: {
    url: process.env.DATABASE_URL,
  },

  // Discord
  discord: {
    token:     process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
  },

  // N8N Integration
  n8n: {
    webhookUrl:     process.env.N8N_WEBHOOK_URL     || "http://n8n:5678/webhook/discord-activity",
    chatbotWebhook: process.env.N8N_CHATBOT_WEBHOOK || "http://n8n:5678/webhook/chatbot-qa",
    apiKey:         process.env.N8N_API_KEY         || "automation_ticketing01_incident02",
  },

  // SMTP
  smtp: {
    host:   process.env.SMTP_HOST || "smtp.gmail.com",
    port:   parseInt(process.env.SMTP_PORT, 10) || 587,
    user:   process.env.SMTP_USER,
    pass:   process.env.SMTP_PASS,
    from:   process.env.EMAIL_FROM || process.env.SMTP_USER,
    secure: false,
  },

  // AI (Groq)
  groq: {
    apiKey:       process.env.GROQ_API_KEY,
    modelLarge:   "llama-3.3-70b-versatile",
    modelSmall:   "llama3-8b-8192",
    modelInstant: "llama-3.1-8b-instant",
  },

  // Portal / Reports
  // FIX: reportDir default ke path nyata (bukan null).
  //   - Sebelumnya null → modul lain menggunakan fallback sendiri yang bisa berbeda
  //   - index.js: path.join(__dirname, "public", "reports")  ← __dirname = /app
  //   - report.service.js: path.join(process.cwd(), "public", "reports")  ← juga /app
  //   - Tapi inconsistency tetap bisa masalah di env non-Docker
  //   - Dengan default di sini, satu sumber kebenaran untuk semua modul
  portal: {
    url:       process.env.PORTAL_URL  || null,                                                     // override manual — paling reliable
    hostIp:    process.env.HOST_IP     || null,                                                     // IP saja, auto-append port (opsional)
    reportDir: process.env.PDF_OUTPUT_DIR || path.join(process.cwd(), "public", "reports"),         // FIX: bukan null
  },

  // Formbricks Form IDs
  formbricks: {
    formIdTicketing: "zcp7cbqqrtavbyd6wwkmk2vx",
    formIdIncident:  "cmiobkjfm2piqad012scz1yxf",
  },

  // Rate Limiting
  rateLimit: {
    windowMs:    3000,    // 3s between requests per user
    cleanupMs:   60_000,
    purgeAfterMs: 60_000,
  },

  // Discord
  discordMaxChars: 1900,

  // Ticket
  ticket: {
    validTypes:  ["TICKETING", "INCIDENT"],
    validStatus: ["OPEN", "PENDING", "APPROVED", "REJECTED", "DONE", "INVESTIGASI", "MITIGASI", "RESOLVED"],
  },

  // Chatbot
  chatbot: {
    maxHistoryPerUser: 10,
    cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
    historyTtlMs:      60 * 60 * 1000, // 1 hour
  },
};

module.exports = config;
