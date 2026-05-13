"use strict";

/**
 * src/modules/report/routes/admin.route.js
 *
 * Admin-facing API endpoints consumed by the Next.js frontend portal.
 * All DB access goes through ReportRepository — zero direct Prisma here.
 *
 * Mount: app.use("/api/admin", adminRoute)
 */

const router     = require("express").Router();
const ReportRepo = require("../repositories/report.repository");
const { validateApiKey } = require("../../../common/middleware/auth");
const { serialize }      = require("../../../common/helpers");
const { createLogger }   = require("../../../common/logger");
const { getPublicUrl }   = require("../../../common/utils/network");
const config             = require("../../../config");

const logger = createLogger("ADMIN_API");

// ── Health ping helper ────────────────────────────────────────────────────────
async function httpPing(url, timeoutMs = 4000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    let body = null;
    try { body = await res.json(); } catch (_) {}
    return { ok: res.ok, statusCode: res.status, body, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

// ── Activity type → level / component maps ────────────────────────────────────
const TYPE_TO_LEVEL = {
  created: "SUCCESS", thread_created: "SUCCESS", status_update: "SUCCESS",
  assigned: "SUCCESS", discord_error: "ERROR", report_generated: "SUCCESS",
  incident_detected: "INFO", chatbot_auto_create: "INFO", admin_update: "INFO",
  comment: "INFO", timeline_updated: "INFO", evidence: "INFO",
  TICKET_CREATED: "SUCCESS", STATUS_UPDATED: "SUCCESS", DISCORD_THREAD_CREATED: "SUCCESS",
  EMAIL_SENT: "SUCCESS", REPORT_GENERATED: "SUCCESS", AI_CLASSIFIED: "SUCCESS",
  N8N_COMPLETED: "SUCCESS", COMMENT_ADDED: "SUCCESS", RESOLVED: "SUCCESS",
  VIEWED: "INFO", N8N_TRIGGERED: "INFO", CHATBOT_RESPONSE: "INFO",
  HEARTBEAT: "INFO", WEBHOOK_FAILED: "ERROR", AI_ERROR: "ERROR",
  EMAIL_FAILED: "ERROR", DISCORD_ERROR: "ERROR", N8N_ERROR: "ERROR",
  ESCALATED: "WARN", OVERDUE: "WARN", RETRY: "WARN",
};
const TYPE_TO_COMPONENT = {
  created: "DATABASE", thread_created: "DISCORD_BOT", discord_error: "DISCORD_BOT",
  TICKET_CREATED: "DISCORD_BOT", DISCORD_THREAD_CREATED: "DISCORD_BOT", DISCORD_ERROR: "DISCORD_BOT",
  HEARTBEAT: "DISCORD_BOT", EMAIL_SENT: "EMAIL", EMAIL_FAILED: "EMAIL",
  AI_CLASSIFIED: "AI_SERVICE", AI_ERROR: "AI_SERVICE", CHATBOT_RESPONSE: "AI_SERVICE",
  chatbot_auto_create: "AI_SERVICE", N8N_TRIGGERED: "N8N_WORKFLOW", N8N_COMPLETED: "N8N_WORKFLOW",
  N8N_ERROR: "N8N_WORKFLOW", WEBHOOK_FAILED: "N8N_WORKFLOW", REPORT_GENERATED: "N8N_WORKFLOW",
  report_generated: "N8N_WORKFLOW", STATUS_UPDATED: "N8N_WORKFLOW", ASSIGNED: "N8N_WORKFLOW",
};

// GET /api/admin/stats
router.get("/stats", validateApiKey, async (req, res) => {
  try {
    const BACKEND_SELF = config.portal.backendSelfUrl || "http://localhost:3000";
    const N8N_URL      = process.env.N8N_INTERNAL_URL || "http://n8n:5678";

    const now      = new Date();
    const todayWIB = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(),
      now.getUTCHours() >= 17 ? now.getUTCDate() : now.getUTCDate() - 1,
      17, 0, 0, 0
    ));

    const [statsData, backendPing, n8nPing, dbMs] = await Promise.all([
      ReportRepo.getDashboardStats(todayWIB),
      httpPing(`${BACKEND_SELF}/health`, 4000),
      httpPing(`${N8N_URL}/healthz`, 4000),
      ReportRepo.pingDb(),
    ]);

    const { total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount, recentAiActivity } = statsData;

    const uptime = backendPing.ok && backendPing.body?.uptime ? Number(backendPing.body.uptime) : 0;
    const discordStatus = !backendPing.ok ? "OFFLINE" : uptime > 0 && uptime < 30 ? "STARTING" : "ONLINE";
    const discordDetail = !backendPing.ok
      ? `Backend tidak merespons (${backendPing.ms}ms)`
      : uptime > 0 && uptime < 30
        ? `Bot baru restart — uptime: ${uptime}s`
        : `Connected — ${uptime > 0 ? `uptime ${Math.round(uptime / 60)}m ${uptime % 60}s` : `${backendPing.ms}ms`}`;

    const n8nStatus = n8nPing.ok ? "RUNNING" : "OFFLINE";
    const n8nDetail = n8nPing.ok ? `Workflow engine aktif — ${n8nPing.ms}ms` : `N8N tidak merespons (${n8nPing.ms}ms)`;
    const dbStatus  = dbMs < 200 ? "HEALTHY" : "DEGRADED";

    let aiStatus, aiDetail;
    if (recentAiActivity) {
      const minsAgo = Math.round((Date.now() - new Date(recentAiActivity.created_at).getTime()) / 60000);
      aiStatus = "ACTIVE";
      aiDetail = `Aktif — klasifikasi terakhir ${minsAgo} menit yang lalu`;
    } else {
      aiStatus = "IDLE";
      aiDetail = "Tidak ada aktivitas AI dalam 1 jam terakhir";
    }

    return res.json({
      stats:  { total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount },
      system: {
        discord_bot:    discordStatus,
        discord_detail: discordDetail,
        n8n_workflow:   n8nStatus,
        n8n_detail:     n8nDetail,
        database:       dbStatus,
        db_detail:      `PostgreSQL — ${dbMs}ms`,
        ai_service:     aiStatus,
        ai_detail:      aiDetail,
        db_response_ms: dbMs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`GET /stats error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/activities
router.get("/activities", validateApiKey, async (req, res) => {
  try {
    const { limit: limitQ, level, component, since } = req.query;
    const limit = Math.min(parseInt(limitQ || "30"), 200);

    const where = {};
    if (since) where.created_at = { gt: new Date(since) };

    if (component) {
      const types = Object.entries(TYPE_TO_COMPONENT).filter(([, c]) => c === component).map(([t]) => t);
      if (types.length) where.type = { in: types };
    }
    if (level) {
      const types = Object.entries(TYPE_TO_LEVEL).filter(([, l]) => l === level).map(([t]) => t);
      if (types.length) {
        where.type = where.type?.in
          ? { in: where.type.in.filter((t) => types.includes(t)) }
          : { in: types };
      }
    }

    const activities  = await ReportRepo.getActivities({ where, limit });
    const allActs     = await ReportRepo.countActivities();

    const logs = activities.map((a) => ({
      id:        String(a.id),
      timestamp: a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at,
      level:     TYPE_TO_LEVEL[a.type]     || "INFO",
      component: TYPE_TO_COMPONENT[a.type] || "DATABASE",
      type:      a.type,
      message:   a.description || `${a.type} — Ticket #${a.ticket_id}`,
      ticket_id: a.ticket_id || null,
    }));

    const statsMap = { total: allActs.length, success: 0, errors: 0, warns: 0 };
    allActs.forEach((a) => {
      const lvl = TYPE_TO_LEVEL[a.type] || "INFO";
      if (lvl === "SUCCESS") statsMap.success++;
      else if (lvl === "ERROR") statsMap.errors++;
      else if (lvl === "WARN")  statsMap.warns++;
    });

    return res.json({ logs, stats: statsMap });
  } catch (err) {
    logger.error(`GET /activities error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/recent-tickets
router.get("/recent-tickets", validateApiKey, async (req, res) => {
  try {
    const limit   = Math.min(parseInt(req.query.limit || "10"), 50);
    const tickets = await ReportRepo.getRecentTickets(limit);
    const result  = tickets.map((t) => {
      const ff = t.form_fields || {};
      return {
        id:     t.id,
        type:   t.type,
        title:  t.type === "INCIDENT"
          ? (ff["Incident Title"] || ff["Incident Information"] || "Incident Report")
          : (ff["Issue"] || "Ticket Support"),
        status:    t.status_pengusulan,
        assignee:  t.assignee || [],
        createdAt: t.created_at,
      };
    });
    return res.json({ success: true, count: result.length, tickets: result });
  } catch (err) {
    logger.error(`GET /recent-tickets error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/export/support
router.get("/export/support", validateApiKey, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const tickets = await ReportRepo.exportTickets({ type: "TICKETING", startDate, endDate, status });
    return res.json({ success: true, count: tickets.length, tickets: serialize(tickets) });
  } catch (err) {
    logger.error(`GET /export/support error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/export/incident
router.get("/export/incident", validateApiKey, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const tickets = await ReportRepo.exportTickets({ type: "INCIDENT", startDate, endDate, status });
    return res.json({ success: true, count: tickets.length, tickets: serialize(tickets) });
  } catch (err) {
    logger.error(`GET /export/incident error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/report-view/:ticketId
router.get("/report-view/:ticketId", validateApiKey, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    if (isNaN(ticketId)) return res.status(400).json({ error: "Invalid ticket ID" });

    const { fileUrl } = await ReportRepo.getReportViewForTicket(ticketId);

    if (!fileUrl) {
      return res.status(404).json({ error: "Laporan belum tersedia. Generate via Discord Bot terlebih dahulu." });
    }

    let fileName = fileUrl;
    if (fileUrl.startsWith("http")) {
      const match = fileUrl.match(/\/reports\/(.+\.html)$/);
      fileName = match ? match[1] : fileUrl.split("/").pop() || "";
    }

    if (!fileName || !fileName.endsWith(".html")) {
      return res.status(400).json({ error: "Nama file laporan tidak valid" });
    }

    return res.json({ success: true, ticketId, fileName, reportUrl: `${getPublicUrl()}/reports/${fileName}` });
  } catch (err) {
    logger.error(`GET /report-view error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
