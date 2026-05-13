/**
 * src/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Support & Incident System — Backend Entry Point
 *
 * Arsitektur: Feature-Based, Layered, Clean Monorepo
 *   Discord Bot  → infrastructure/discord (handlers)
 *   Express API  → modules/* (routes → controllers → services → repositories)
 *   Database     → infrastructure/prisma (Prisma ORM, PostgreSQL)
 *   Automation   → infrastructure/n8n (N8N Workflows, event-triggered via HTTP)
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

// ── Load .env sebelum apapun ──────────────────────────────────────────────────
require("dotenv").config();

// ── Core Dependencies ─────────────────────────────────────────────────────────
const path = require("path");
const fs   = require("fs");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

// ── Internal Modules ──────────────────────────────────────────────────────────
const config         = require("./config");
const prisma         = require("./infrastructure/prisma/client");
const { setupViews } = require("./infrastructure/prisma/views");
const { getPublicUrl } = require("./common/utils/network");
const DiscordService = require("./infrastructure/discord/discord.service");

// Discord Handlers
const ChatbotHandler = require("./infrastructure/discord/chatbot.handler");
const CommandHandler = require("./infrastructure/discord/command.handler");
const ThreadHandler  = require("./infrastructure/discord/thread.handler");

// Express App
const app = require("./app");

// ─────────────────────────────────────────────────────────────────────────────
// DISCORD CLIENT
// ─────────────────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

DiscordService.setClient(client);

client.once("ready", () => {
  console.log(`\n✅ [DISCORD] Bot ready: ${client.user.tag}`);
});

ChatbotHandler.register(client);
CommandHandler.register(client);
ThreadHandler.register(client);

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────

async function start() {
  try {
    console.log("\n🚀 Starting Support & Incident System — Backend...\n");

    // 1. Ensure directories exist
    const reportDir = config.portal.reportDir || path.join(__dirname, "..", "public", "reports");
    [path.join(__dirname, "..", "public"), reportDir, path.join(__dirname, "..", "logs")].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });

    // 2. Connect to Database
    await prisma.$connect();
    console.log("✅ [DB] PostgreSQL connected via Prisma");

    // 3. Setup DB Views
    await setupViews();

    // 4. Cache public URL
    const publicUrl = getPublicUrl();
    console.log(`🌐 [NETWORK] Report access URL: ${publicUrl}/reports/`);

    // 5. Login Discord Bot
    await client.login(config.discord.token);

    // 6. Start Express Server
    await new Promise((resolve) => {
      app.listen(config.port, "0.0.0.0", () => {
        resolve();
        printStartupBanner(publicUrl);
      });
    });

  } catch (err) {
    console.error("\n❌ [STARTUP] Fatal error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP BANNER
// ─────────────────────────────────────────────────────────────────────────────

function printStartupBanner(publicUrl) {
  const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || 3001}`;
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   Support & Incident System — Backend                        ║
║   Prisma ORM | Feature-Based | Production Ready              ║
╚══════════════════════════════════════════════════════════════╝

  🔧  Backend API  : http://0.0.0.0:${config.port}
  🌐  Frontend     : ${frontendUrl}
  📊  User Portal  : ${publicUrl}/dashboard
  🔐  Admin Portal : ${publicUrl}/admin
  📄  Reports      : ${publicUrl}/reports/
  🩺  Health Check : ${publicUrl}/health

  ── Webhook ────────────────────────────────────────────────
  POST  /webhook/formbricks

  ── Ticket API ─────────────────────────────────────────────
  GET   /api/ticket/:id
  POST  /api/ticket/summary
  POST  /api/ticket/timeline/append
  POST  /api/ticket/repair-discord
  POST  /api/ticket/auto-create
  POST  /api/ticket/find-similar

  ── Chatbot API ────────────────────────────────────────────
  POST  /api/chatbot/context
  POST  /api/chatbot/log-interaction
  GET   /api/chatbot/stats
  GET   /api/chatbot/history/:ticketId

  ── Knowledge Base ─────────────────────────────────────────
  GET   /api/knowledge/search-runbooks
  POST  /api/knowledge/search
  POST  /api/knowledge/runbook

  ── Incident Report ────────────────────────────────────────
  POST  /api/report/generate
  GET   /api/report/regenerate-file/:ticketId
  GET   /api/report/:id

  ── Discord Bot ────────────────────────────────────────────
  ✅  @mention / DM   → AI Chatbot
  ✅  !status         → Update ticket status
  ✅  !assign         → Assign petugas
  ✅  !evidence       → Tambah evidence
  ✅  !clear-history  → Reset chat history
  ✅  !chatbot-help   → Panduan chatbot
  ✅  !chatbot-stats  → Usage statistics
  ✅  Thread monitor  → Trigger N8N event-driven

  ── Integrations ───────────────────────────────────────────
  🔔  N8N          : ${config.n8n.webhookUrl}
  🤖  Chatbot N8N  : ${config.n8n.chatbotWebhook}
  📧  SMTP         : ${config.smtp.host}:${config.smtp.port}

╔══════════════════════════════════════════════════════════════╗
║  ✅ All systems operational                                   ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────

start();
