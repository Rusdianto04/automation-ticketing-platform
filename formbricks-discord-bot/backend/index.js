/**
 * index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Support & Incident System — Backend Entry Point v5 (Monorepo)
 *
 * Arsitektur: Event-Driven, Modular, Clean Code
 *   Discord Bot  → Handlers (chatbot, command, thread)
 *   Express API  → Routes   (ticket, chatbot, knowledge, report, webhook, web)
 *   Database     → Prisma ORM (PostgreSQL)
 *   Automation   → N8N Workflows (event-triggered via HTTP)
 *
 * MONOREPO NOTE:
 *   EJS views dihapus — portal digantikan Next.js frontend (port 3001).
 *   web.route.js hanya berisi health check + redirect ke frontend.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

// ── Load .env sebelum apapun ──────────────────────────────────────────────────
require("dotenv").config();

// ── Core Dependencies ─────────────────────────────────────────────────────────
const path       = require("path");
const fs         = require("fs");
const express    = require("express");
const bodyParser = require("body-parser");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

// ── Internal Modules ──────────────────────────────────────────────────────────
const config           = require("./src/config");
const prisma           = require("./src/database/client");
const { setupViews }   = require("./src/database/views");
const { getPublicUrl } = require("./src/utils/network");
const DiscordService   = require("./src/services/discord.service");

// Routes
const webhookRoute   = require("./src/routes/webhook.route");
const ticketRoute    = require("./src/routes/ticket.route");
const chatbotRoute   = require("./src/routes/chatbot.route");
const knowledgeRoute = require("./src/routes/knowledge.route");
const reportRoute    = require("./src/routes/report.route");
const webRoute       = require("./src/routes/web.route");

// Discord Handlers
const ChatbotHandler = require("./src/handlers/chatbot.handler");
const CommandHandler = require("./src/handlers/command.handler");
const ThreadHandler  = require("./src/handlers/thread.handler");

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
// EXPRESS APP
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ── Static Files (Reports tetap diserve dari backend) ─────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use("/reports", express.static(config.portal.reportDir || path.join(__dirname, "public", "reports")));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/webhook",       webhookRoute);
app.use("/api/ticket",    ticketRoute);
app.use("/api/tickets",   ticketRoute);
app.use("/api/chatbot",   chatbotRoute);
app.use("/api/knowledge", knowledgeRoute);
app.use("/api/report",    reportRoute);
app.use("/",              webRoute);    // health + redirect ke frontend

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ [SERVER] Unhandled error:", err.message);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────────────────────────────────────

async function start() {
  try {
    console.log("\n🚀 Starting Support & Incident System — Backend v5...\n");

    // 1. Ensure directories exist
    const reportDir = config.portal.reportDir || path.join(__dirname, "public", "reports");
    [path.join(__dirname, "public"), reportDir, path.join(__dirname, "logs")].forEach((dir) => {
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
║   Support & Incident System — Backend         ║
║   Prisma ORM | Event-Driven | Production Ready               ║
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