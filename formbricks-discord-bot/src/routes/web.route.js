/**
 * src/routes/web.route.js
 * Web Portal Routes — Dashboard & Ticket Detail
 *
 * GET /           — Ticket dashboard (EJS view)
 * GET /tickets/:id — Ticket detail page (EJS view)
 * GET /health     — Health check (no auth)
 *
 * FIX v2:
 *   - Tambah orgName & orgDepartment ke semua res.render()
 *     → Views butuh kedua variabel ini untuk header & title
 *   - Sertakan activities (10 terakhir) di ticket_detail
 *     → Views dashboard.ejs sudah menggunakan ticket.activities di beberapa template
 *   - Equivalent 1:1 dengan Sequelize original index.js
 */

"use strict";

const router       = require("express").Router();
const config       = require("../config");
const TicketModel  = require("../models/ticket.model");
const ActivityModel = require("../models/activity.model");

// ─── GET /health ─────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    uptime:    Math.round(process.uptime()),
    service:   "formbricks-discord-bot",
    version:   "5.0.0",
  });
});

// ─── GET / — Dashboard ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const tickets = await TicketModel.findAll({
      orderBy: { created_at: "desc" },
      take:    50,
    });

    // FIX: wajib kirim orgName & orgDepartment — dipakai di views/dashboard.ejs
    // Equivalent Sequelize original: res.render("dashboard", { tickets, orgName, orgDepartment })
    res.render("dashboard", {
      tickets,
      orgName:       config.org.name,
      orgDepartment: config.org.department,
    });
  } catch (err) {
    console.error("[WEB] Dashboard error:", err.message);
    res.status(500).send(`<h1>Error loading dashboard</h1><p>${err.message}</p>`);
  }
});

// ─── GET /tickets/:id — Ticket Detail ────────────────────────────────────────
router.get("/tickets/:id", async (req, res) => {
  try {
    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) return res.status(404).send("<h1>Ticket not found</h1>");

    // Ambil activity log — sertakan untuk render timeline di detail view
    let activities = [];
    try {
      activities = await ActivityModel.findByTicketId(ticket.id, 20);
    } catch (_) { /* non-fatal */ }

    // FIX: wajib kirim orgName & orgDepartment — dipakai di views/ticket_detail.ejs
    // Equivalent Sequelize original: res.render("ticket_detail", { ticket, orgName, orgDepartment })
    res.render("ticket_detail", {
      ticket,
      activities,
      orgName:       config.org.name,
      orgDepartment: config.org.department,
    });
  } catch (err) {
    console.error("[WEB] Ticket detail error:", err.message);
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

module.exports = router;