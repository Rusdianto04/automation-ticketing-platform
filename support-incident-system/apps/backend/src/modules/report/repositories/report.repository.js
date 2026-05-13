"use strict";

/**
 * src/modules/report/repositories/report.repository.js
 *
 * All Prisma calls for incident_reports, incident stats, admin dashboard data,
 * and grouped ticket queries live here.
 *
 * Eliminates direct Prisma usage from:
 *   - report/routes/report.route.js
 *   - report/routes/incident.route.js
 *   - report/routes/admin.route.js
 *   - report/services/report.service.js
 *   - report/services/incident.service.js
 */

const prisma  = require("../../../infrastructure/prisma/client");
const { serialize } = require("../../../common/helpers");

// ─── Incident Reports table ───────────────────────────────────────────────────

/**
 * Get the latest report record for a ticket.
 */
async function getReportByTicketId(ticketId) {
  const rows = serialize(await prisma.$queryRaw`
    SELECT * FROM incident_reports
    WHERE ticket_id = ${Number(ticketId)}
    ORDER BY generated_at DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

/**
 * Get a report by its primary key.
 */
async function getReportById(id) {
  const rows = serialize(await prisma.$queryRaw`
    SELECT * FROM incident_reports WHERE id = ${Number(id)} LIMIT 1
  `);
  return rows[0] || null;
}

/**
 * Insert a new incident report record.
 * Returns the newly inserted row.
 */
async function createReport({ ticketId, reportTitle, fileUrl, filePath, reportContent, generatedBy }) {
  const result = await prisma.$queryRaw`
    INSERT INTO incident_reports
      (ticket_id, report_title, file_url, file_path, report_content, generated_by, generated_at)
    VALUES
      (${Number(ticketId)},
       ${reportTitle},
       ${fileUrl || null},
       ${filePath || null},
       ${JSON.stringify(reportContent || {})}::jsonb,
       ${generatedBy || "API"},
       NOW())
    RETURNING *
  `;
  return serialize(result)[0];
}

/**
 * Update report file_url and file_path after file generation.
 */
async function updateReportFile({ id, fileUrl, filePath }) {
  const result = await prisma.$queryRaw`
    UPDATE incident_reports
    SET file_url = ${fileUrl}, file_path = ${filePath}
    WHERE id = ${Number(id)}
    RETURNING *
  `;
  return serialize(result)[0];
}

// ─── Incident tickets ─────────────────────────────────────────────────────────

/**
 * Get all active (non-resolved) incident tickets.
 */
async function getActiveIncidents(limit = 50) {
  return serialize(await prisma.$queryRaw`
    SELECT
      t.id, t.form_fields, t.status_pengusulan, t.status_note,
      t.discord, t.search_keywords, t.created_at, t.updated_at, t.resolved_at,
      t.summary_ticket, t.root_cause, t.assignee
    FROM tickets t
    WHERE t.type = 'INCIDENT'
      AND t.status_pengusulan NOT IN ('RESOLVED','DONE')
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `);
}

/**
 * Get incident summary statistics.
 */
async function getIncidentStats() {
  const result = serialize(await prisma.$queryRaw`
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
  return result[0] || {};
}

/**
 * Find multiple tickets by an array of IDs (for grouped incident display).
 */
async function findManyByIds(ids) {
  if (!ids || ids.length === 0) return [];
  return prisma.ticket.findMany({
    where:  { id: { in: ids.map(Number) } },
    select: { id: true, form_fields: true, status_pengusulan: true, created_at: true },
  });
}

// ─── Admin dashboard data ─────────────────────────────────────────────────────

/**
 * Ticket count statistics for admin dashboard.
 */
async function getDashboardStats(todayWIB) {
  const [
    total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount,
    recentAiActivity,
  ] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { created_at: { gte: todayWIB } } }),
    prisma.ticket.count({ where: { status_pengusulan: "OPEN" } }),
    prisma.ticket.count({ where: { status_pengusulan: "PENDING" } }),
    prisma.ticket.count({ where: { status_pengusulan: { in: ["DONE", "RESOLVED"] } } }),
    prisma.ticket.count({ where: { type: "INCIDENT" } }),
    prisma.ticket.count({ where: { status_pengusulan: { in: ["REJECT", "REJECTED"] } } }),
    prisma.activity.findFirst({
      where: {
        type:       { in: ["AI_CLASSIFIED", "CHATBOT_RESPONSE", "AI_ERROR"] },
        created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      orderBy: { created_at: "desc" },
    }),
  ]);

  return { total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount, recentAiActivity };
}

/**
 * DB latency check — runs a trivial count query and measures ms.
 */
async function pingDb() {
  const start = Date.now();
  await prisma.ticket.count();
  return Date.now() - start;
}

/**
 * Activity log for admin dashboard, with optional filters.
 */
async function getActivities({ where, limit }) {
  return prisma.activity.findMany({
    where,
    orderBy: { created_at: "desc" },
    take:    limit,
  });
}

/**
 * Count activities for stats summary.
 */
async function countActivities() {
  return prisma.activity.findMany({
    select:  { type: true },
    orderBy: { created_at: "desc" },
    take:    200,
  });
}

/**
 * Recent tickets for admin dashboard widget.
 */
async function getRecentTickets(limit = 10) {
  return prisma.ticket.findMany({
    orderBy: { created_at: "desc" },
    take:    limit,
    select: {
      id: true, type: true, form_fields: true,
      status_pengusulan: true, assignee: true, created_at: true,
    },
  });
}

/**
 * Export tickets by type and optional date range / status.
 */
async function exportTickets({ type, startDate, endDate, status, limit = 5000 }) {
  const where = { type };
  if (status)    where.status_pengusulan = status;
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate)   where.created_at.lte = new Date(endDate);
  }
  return prisma.ticket.findMany({
    where,
    orderBy: { created_at: "asc" },
    take:    limit,
  });
}

/**
 * Look up the report URL for a given ticket (from incident_reports table or ticket.discord JSONB).
 */
async function getReportViewForTicket(ticketId) {
  let rows = [];
  try {
    rows = serialize(await prisma.$queryRaw`
      SELECT file_url, file_path, report_title
      FROM incident_reports
      WHERE ticket_id = ${Number(ticketId)}
      ORDER BY generated_at DESC
      LIMIT 1
    `);
  } catch (_) {}

  if (rows[0]?.file_url) return { fileUrl: rows[0].file_url };

  // Fallback: ticket.discord JSONB
  const ticket = await prisma.ticket.findUnique({
    where:  { id: Number(ticketId) },
    select: { discord: true },
  });
  const d = (typeof ticket?.discord === "string" ? JSON.parse(ticket.discord || "{}") : ticket?.discord) || {};
  const fileUrl = d.reportUrl || d.report_url || d.file_url || null;
  return { fileUrl };
}

module.exports = {
  getReportByTicketId,
  getReportById,
  createReport,
  updateReportFile,
  getActiveIncidents,
  getIncidentStats,
  findManyByIds,
  getDashboardStats,
  pingDb,
  getActivities,
  countActivities,
  getRecentTickets,
  exportTickets,
  getReportViewForTicket,
};
