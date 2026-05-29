/**
 * src/app.js
 * Express Application Setup — Support & Incident System
 */

"use strict";

const path       = require("path");
const express    = require("express");
const bodyParser = require("body-parser");

// ── Module Public APIs ────────────────────────────────────────────────────────
const { healthRouter }                              = require("./modules/health");
const { webhookRouter, webRouter }                  = require("./modules/webhook");
const { router: ticketRouter, recommendRouter }     = require("./modules/ticket");
const { chatbotRouter, knowledgeRouter }            = require("./modules/chatbot");
const { reportRouter, incidentRouter, adminRouter } = require("./modules/report");

const config = require("./config");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(
  "/reports",
  express.static(
    config.portal.reportDir || path.join(__dirname, "..", "public", "reports")
  )
);

// Serve uploaded ticket attachments dari backend/public/uploads/tickets
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "public", "uploads"))
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(healthRouter);
app.use("/api/admin",    adminRouter);
app.use("/webhook",      webhookRouter);
app.use("/api/ticket",   ticketRouter);
app.use("/api/tickets",  ticketRouter);
app.use("/api/chatbot",  chatbotRouter);
app.use("/api/knowledge",knowledgeRouter);
app.use("/api/report",   reportRouter);
app.use("/api/recommend",recommendRouter);
app.use("/api/incident", incidentRouter);
app.use("/",             webRouter);

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ [SERVER] Unhandled error:", err.message);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

module.exports = app;