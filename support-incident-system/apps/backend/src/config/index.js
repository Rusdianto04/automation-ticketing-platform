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

// ── Helper: parse "id:Label, id2:Label2" → { id: "Label", id2: "Label2" } ───
function parseFieldMap(envValue = "") {
  if (!envValue || !envValue.trim()) return {};
  const result = {};
  envValue.split(",").forEach((pair) => {
    const colonIdx = pair.indexOf(":");
    if (colonIdx === -1) return;
    const questionId = pair.slice(0, colonIdx).trim();
    const label      = pair.slice(colonIdx + 1).trim();
    if (questionId && label) result[questionId] = label;
  });
  return result;
}

// ─── Config Object ───────────────────────────────────────────────────────────
const config = {
  // App
  env:   process.env.NODE_ENV || "production",
  port:  parseInt(process.env.PORT, 10) || 3000,
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
    guildId:   process.env.DISCORD_GUILD_ID || null,
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
  portal: {
    url:            process.env.PORTAL_URL   || null,
    hostIp:         process.env.HOST_IP      || null,
    reportDir:      process.env.PDF_OUTPUT_DIR || path.join(process.cwd(), "public", "reports"),
    frontendUrl:    process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 3001}`,
    backendSelfUrl: process.env.BACKEND_SELF_URL || null,
  },

  // Formbricks Form IDs + Question ID → Label mapping
  formbricks: {
    formIdTicketing: process.env.FORM_ID_TICKETING || "zcp7cbqqrtavbyd6wwkmk2vx",
    formIdIncident:  process.env.FORM_ID_INCIDENT  || "cmiobkjfm2piqad012scz1yxf",
    // Mapping: { "questionUUID": "Field Label" }
    // Diisi via env FORMBRICKS_INCIDENT_FIELD_MAP dan FORMBRICKS_TICKETING_FIELD_MAP
    // Format env: "questionId:Label Name,questionId2:Label Name2"
    incidentFieldMap:  parseFieldMap(process.env.FORMBRICKS_INCIDENT_FIELD_MAP),
    ticketingFieldMap: parseFieldMap(process.env.FORMBRICKS_TICKETING_FIELD_MAP),
  },

  // Rate Limiting
  rateLimit: {
    windowMs:     3000,
    cleanupMs:    60_000,
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
    cleanupIntervalMs: 60 * 60 * 1000,
    historyTtlMs:      60 * 60 * 1000,
  },
};

module.exports = config;