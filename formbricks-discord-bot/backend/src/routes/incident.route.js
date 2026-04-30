/**
 * src/routes/incident.route.js
 * Incident Management API Routes — NEW (v9)
 *
 * Mount in index.js:
 *   app.use("/api/incident", incidentRoute);
 *
 * Endpoints:
 *   GET  /api/incident/active           — all active (non-resolved) incidents
 *   GET  /api/incident/:id              — single incident detail
 *   POST /api/incident/:id/status       — update status + broadcast
 *   POST /api/incident/:id/broadcast    — manual broadcast to Discord
 *   GET  /api/incident/stats            — summary for admin panel widget
 *
 * ⚠ Does NOT modify ticket.route.js or webhook.route.js.
 */

"use strict";

const router         = require("express").Router();
const prisma         = require("../database/client");
const TicketModel    = require("../models/ticket.model");
const ActivityModel  = require("../models/activity.model");
const IncidentService = require("../services/incident.service");
const { validateApiKey } = require("../middleware/auth");

function serialize(v) {
  return JSON.parse(JSON.stringify(v, (_, val) =>
    typeof val === "bigint" ? Number(val) : val
  ));
}

// ---------------------------------------------------------------------------
// GET /api/incident/active
// ---------------------------------------------------------------------------
router.get("/active", validateApiKey, async (req, res) => {
  try {
    const rows = serialize(await prisma.$queryRaw`
      SELECT
        t.id, t.form_fields, t.status_pengusulan, t.status_note,
        t.discord, t.search_keywords, t.created_at, t.updated_at, t.resolved_at,
        t.summary_ticket, t.root_cause, t.assignee
      FROM tickets t
      WHERE t.type = 'INCIDENT'
        AND t.status_pengusulan NOT IN ('RESOLVED','DONE')
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

    const incidents = rows.map((r) => {
      const ff       = r.form_fields || {};
      const discData = r.discord     || {};
      const category = IncidentService.detectCategory(
        `${ff["Incident Information"]||""} ${ff["Indicated Issue"]||""}`,
        ff["Suspect Area"] || ""
      );
      return {
        id:          r.id,
        title:       ff["Incident Title"] || ff["Incident Information"] || `Incident #${r.id}`,
        status:      r.status_pengusulan,
        statusLabel: IncidentService.buildStatusEmoji(r.status_pengusulan),
        statusNote:  r.status_note,
        category,
        priority:    ff["Priority Incident"] || "Medium",
        severity:    ff["Severity Incident"] || "Medium",
        assignee:    r.assignee || [],
        groupedTicketIds: discData.groupedTicketIds || [],
        threadUrl:   discData.threadUrl || null,
        summary:     r.summary_ticket,
        rootCause:   r.root_cause,
        createdAt:   r.created_at,
        updatedAt:   r.updated_at,
      };
    });

    res.json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    console.error("[INCIDENT] GET /active error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/incident/stats
// ---------------------------------------------------------------------------
router.get("/stats", validateApiKey, async (req, res) => {
  try {
    const stats = serialize(await prisma.$queryRaw`
      SELECT
        COUNT(*)::int                                                               AS total,
        COUNT(CASE WHEN status_pengusulan = 'OPEN'        THEN 1 END)::int         AS open,
        COUNT(CASE WHEN status_pengusulan = 'INVESTIGASI' THEN 1 END)::int         AS investigating,
        COUNT(CASE WHEN status_pengusulan = 'MITIGASI'    THEN 1 END)::int         AS mitigating,
        COUNT(CASE WHEN status_pengusulan IN ('RESOLVED','DONE') THEN 1 END)::int  AS resolved,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int AS last24h
      FROM tickets
      WHERE type = 'INCIDENT'
    `);

    res.json({ success: true, stats: stats[0] });
  } catch (err) {
    console.error("[INCIDENT] GET /stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/incident/:id
// ---------------------------------------------------------------------------
router.get("/:id", validateApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const ticket = await TicketModel.findById(id);
    if (!ticket)               return res.status(404).json({ error: `Ticket #${id} not found` });
    if (ticket.type !== "INCIDENT") return res.status(400).json({ error: "Not an incident ticket" });

    const ff       = ticket.formFields || {};
    const discData = ticket.discord    || {};
    const category = IncidentService.detectCategory(
      `${ff["Incident Information"]||""} ${ff["Indicated Issue"]||""}`,
      ff["Suspect Area"] || ""
    );

    // Fetch grouped ticket summaries
    const grouped = discData.groupedTicketIds || [];
    let groupedSummaries = [];
    if (grouped.length > 0) {
      try {
        const rows = await prisma.ticket.findMany({
          where: { id: { in: grouped } },
          select: { id: true, form_fields: true, status_pengusulan: true, created_at: true },
        });
        groupedSummaries = rows.map((r) => {
          const gff = r.form_fields || {};
          return {
            id:     r.id,
            title:  gff["Incident Information"] || gff["Issue"] || `Ticket #${r.id}`,
            status: r.status_pengusulan,
          };
        });
      } catch (_) {}
    }

    res.json({
      success: true,
      incident: {
        id:          ticket.id,
        title:       ff["Incident Title"] || ff["Incident Information"] || `Incident #${ticket.id}`,
        status:      ticket.statusPengusulan,
        statusLabel: IncidentService.buildStatusEmoji(ticket.statusPengusulan),
        statusNote:  ticket.statusNote,
        category,
        priority:    ff["Priority Incident"] || "Medium",
        severity:    ff["Severity Incident"] || "Medium",
        formFields:  ff,
        assignee:    ticket.assignee || [],
        summary:     ticket.summaryTicket,
        rootCause:   ticket.rootCause,
        timeline:    ticket.timelineActionTaken,
        groupedTickets: groupedSummaries,
        threadUrl:   discData.threadUrl,
        createdAt:   ticket.createdAt,
        updatedAt:   ticket.updatedAt,
        resolvedAt:  ticket.resolvedAt,
      },
    });
  } catch (err) {
    console.error("[INCIDENT] GET /:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/incident/:id/status
// Update incident status + broadcast
// Body: { status: "INVESTIGASI"|"MITIGASI"|"RESOLVED", note: "..." }
// ---------------------------------------------------------------------------
router.post("/:id/status", validateApiKey, async (req, res) => {
  try {
    const id     = Number(req.params.id);
    const { status, note } = req.body;

    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });
    if (!status)             return res.status(400).json({ error: "status required" });

    const validStatuses = ["INVESTIGASI", "MITIGASI", "RESOLVED", "OPEN"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const result = await IncidentService.updateIncidentStatus(id, status.toUpperCase(), note || "");

    if (!result.ok) {
      return res.status(400).json({ error: result.reason });
    }

    const updated = await TicketModel.findById(id);
    res.json({
      success:   true,
      ticketId:  id,
      newStatus: status.toUpperCase(),
      broadcast: result.broadcast,
      ticket:    updated,
    });
  } catch (err) {
    console.error("[INCIDENT] POST /:id/status error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/incident/:id/broadcast
// Manual broadcast to Discord (e.g., admin wants to push a status update)
// Body: { note: "optional message" }
// ---------------------------------------------------------------------------
router.post("/:id/broadcast", validateApiKey, async (req, res) => {
  try {
    const id   = Number(req.params.id);
    const note = req.body?.note || "";

    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const ticket = await TicketModel.findById(id);
    if (!ticket)               return res.status(404).json({ error: `Ticket #${id} not found` });
    if (ticket.type !== "INCIDENT") return res.status(400).json({ error: "Not an incident ticket" });

    // Non-blocking broadcast
    IncidentService.processIncident(ticket, { updateNote: note, forceBroadcast: true })
      .catch((err) => console.warn("[INCIDENT] Broadcast error:", err.message));

    await ActivityModel.create({
      ticketId:    id,
      type:        "incident_manual_broadcast",
      description: `Manual broadcast triggered${note ? `: ${note.substring(0, 200)}` : ""}`,
    });

    res.json({ success: true, message: "Broadcast triggered (async)" });
  } catch (err) {
    console.error("[INCIDENT] POST /:id/broadcast error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;