/**
 * index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Formbricks Discord Bot — Production Entry Point v5
 *
 * Arsitektur: Event-Driven, Modular, Clean Code
 *   Discord Bot  → Handlers (chatbot, command, thread)
 *   Express API  → Routes   (ticket, chatbot, knowledge, report, webhook, web)
 *   Database     → Prisma ORM (PostgreSQL)
 *   Automation   → N8N Workflows (event-triggered via HTTP)
 *
 * File ini hanya bertugas sebagai "orchestrator":
 *   - Inisialisasi semua dependency
 *   - Register semua handler & route
 *   - Start Discord client + Express server
 *
 * Semua business logic ada di src/ — tidak ada logic di sini.
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
const config         = require("./src/config");
const prisma         = require("./src/database/client");
const { setupViews } = require("./src/database/views");
const { getPublicUrl } = require("./src/utils/network");
const DiscordService = require("./src/services/discord.service");

// Routes
const webhookRoute     = require("./src/routes/webhook.route");
const ticketRoute      = require("./src/routes/ticket.route");
const chatbotRoute     = require("./src/routes/chatbot.route");
const knowledgeRoute   = require("./src/routes/knowledge.route");
const reportRoute      = require("./src/routes/report.route");
const webRoute         = require("./src/routes/web.route");
const peppermintRoute  = require("./src/routes/peppermint.route");  // ← NEW: Peppermint Portal API

// CORS Middleware
const { corsMiddleware } = require("./src/middleware/cors");         // ← NEW: CORS for Peppermint

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

// Inject client ke DiscordService — centralized, tidak ada circular dep
DiscordService.setClient(client);

// Discord ready event
client.once("ready", () => {
  console.log(`\n✅ [DISCORD] Bot ready: ${client.user.tag}`);
});

// Register semua Discord event handlers
ChatbotHandler.register(client);   // mention / DM → chatbot, auto-create, incident report
CommandHandler.register(client);   // !status, !assign, !evidence
ThreadHandler.register(client);    // monitor thread messages → trigger N8N

// ─────────────────────────────────────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────────────────────────────────────

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(corsMiddleware);   // ← NEW: CORS — izinkan Peppermint portal akses API

// ── Template Engine ───────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));
app.use("/reports", express.static(config.portal.reportDir || path.join(__dirname, "public", "reports")));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/webhook",          webhookRoute);    // POST /webhook/formbricks
app.use("/api/ticket",       ticketRoute);     // GET|POST /api/ticket/*  (core API + portal CRUD)
app.use("/api/tickets",      ticketRoute);     // GET /api/tickets & /api/tickets/stats (Peppermint Portal)
app.use("/api/chatbot",      chatbotRoute);    // POST /api/chatbot/*
app.use("/api/knowledge",    knowledgeRoute);  // GET|POST /api/knowledge/*
app.use("/api/report",       reportRoute);     // POST|GET /api/report/*
app.use("/api/peppermint",   peppermintRoute); // ← NEW: Peppermint Portal Integration API
app.use("/",                 webRoute);        // GET / | /tickets/:id | /health

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
    console.log("\n🚀 Starting Formbricks Discord Bot v5...\n");

    // 1. Ensure reports directory exists
    const reportDir = config.portal.reportDir || path.join(__dirname, "public", "reports");
    [path.join(__dirname, "public"), reportDir, path.join(__dirname, "logs")].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });

    // 2. Connect to Database (Prisma)
    await prisma.$connect();
    console.log("✅ [DB] PostgreSQL connected via Prisma");

    // 3. Setup DB Views (idempotent — safe to run every startup)
    await setupViews();

    // 4. Cache & log public URL
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
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║       Formbricks Discord Bot v5 — Production Ready           ║
║       Prisma ORM | Event-Driven | Enterprise Clean Code      ║
╚══════════════════════════════════════════════════════════════╝

  🚀  Server     : http://0.0.0.0:${config.port}
  🌐  Portal     : ${publicUrl}
  📊  Dashboard  : ${publicUrl}/
  📄  Reports    : ${publicUrl}/reports/
  🩺  Health     : ${publicUrl}/health

  ── Peppermint Portal API ───────────────────────────────────────
  GET   /api/peppermint/tickets              ← List tiket (filter+pagination)
  GET   /api/peppermint/tickets/stats        ← Dashboard stats
  GET   /api/peppermint/tickets/:id          ← Detail tiket + activities
  PUT   /api/peppermint/tickets/:id/status   ← Admin: update status
  PUT   /api/peppermint/tickets/:id/assign   ← Admin: assign petugas
  POST  /api/peppermint/tickets/:id/comment  ← Admin: tambah komentar
  PUT   /api/peppermint/tickets/:id/note     ← Admin: catatan internal
  GET   /api/peppermint/knowledge            ← List runbook KB
  POST  /api/peppermint/knowledge            ← Admin: tambah runbook
  PUT   /api/peppermint/knowledge/:id        ← Admin: update runbook
  DELETE /api/peppermint/knowledge/:id       ← Admin: hapus runbook

  ── Webhook ────────────────────────────────────────────────
  POST  /webhook/formbricks              ← Formbricks submission

  ── Ticket API ─────────────────────────────────────────────
  GET   /api/ticket/:id
  POST  /api/ticket/summary
  POST  /api/ticket/timeline/append
  POST  /api/ticket/repair-discord
  POST  /api/ticket/auto-create
  POST  /api/ticket/find-similar

  ── Chatbot API (N8N → API, no direct postgres) ────────────
  POST  /api/chatbot/context
  POST  /api/chatbot/log-interaction
  GET   /api/chatbot/stats
  GET   /api/chatbot/history/:ticketId

  ── Knowledge Base ─────────────────────────────────────────
  GET   /api/knowledge/search-runbooks
  POST  /api/knowledge/search
  POST  /api/knowledge/runbook
  GET   /api/knowledge/runbooks

  ── Incident Report ────────────────────────────────────────
  POST  /api/report/generate
  GET   /api/report/regenerate-file/:ticketId
  GET   /api/report/:id

  ── Discord Bot ────────────────────────────────────────────
  ✅  @mention / DM  → AI Chatbot
  ✅  !status        → Update ticket status
  ✅  !assign        → Assign petugas
  ✅  !evidence      → Tambah evidence
  ✅  !clear-history → Reset chat history
  ✅  !chatbot-help  → Panduan chatbot
  ✅  !chatbot-stats → Usage statistics
  ✅  Thread monitor → Trigger N8N event-driven

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