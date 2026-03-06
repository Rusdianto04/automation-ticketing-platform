/**
 * src/routes/peppermint.route.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Peppermint Portal Integration API
 *
 * Endpoint khusus yang diakses oleh Peppermint (portal-website) untuk:
 *   1. READ   — Ambil data ticket, stats, activity log dari DB backend
 *   2. WRITE  — Admin Peppermint update status, assign, comment → simpan ke DB backend
 *
 * Konsep: SATU DATABASE (PostgreSQL backend) — Peppermint baca/tulis via API ini.
 *         Peppermint TIDAK punya DB sendiri untuk data tiket — semua dari backend.
 *
 * Auth: X-API-Key header (sama dengan endpoint lain)
 *       Tambahkan PEPPERMINT_API_KEY di .env untuk key terpisah (opsional)
 *
 * Base path: /api/peppermint  (dipasang di index.js)
 *
 * Routes:
 *   GET  /api/peppermint/tickets              — List tiket (filter, pagination, search)
 *   GET  /api/peppermint/tickets/stats        — Statistik dashboard (total, open, dll)
 *   GET  /api/peppermint/tickets/:id          — Detail 1 tiket + activity log
 *   PUT  /api/peppermint/tickets/:id/status   — Update status tiket
 *   PUT  /api/peppermint/tickets/:id/assign   — Assign petugas ke tiket
 *   POST /api/peppermint/tickets/:id/comment  — Tambah komentar/catatan
 *   GET  /api/peppermint/tickets/:id/activities — Activity log tiket
 *   GET  /api/peppermint/knowledge            — List runbook KB
 *   POST /api/peppermint/knowledge            — Tambah runbook baru (admin)
 *   PUT  /api/peppermint/knowledge/:id        — Update runbook
 *   DELETE /api/peppermint/knowledge/:id      — Hapus runbook
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const router        = require("express").Router();
const prisma        = require("../database/client");
const TicketModel   = require("../models/ticket.model");
const ActivityModel = require("../models/activity.model");
const DiscordService = require("../services/discord.service");
const config        = require("../config");

// ─── Helper: BigInt safe JSON serializer ─────────────────────────────────────
function serialize(data) {
  return JSON.parse(JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  ));
}

// ─── Helper: Non-blocking Discord sync ───────────────────────────────────────
function discordAsync(fn) {
  try {
    Promise.resolve(fn()).catch((err) =>
      console.warn("[PEPPERMINT] Discord async error (non-fatal):", err.message)
    );
  } catch (err) {
    console.warn("[PEPPERMINT] Discord call error (non-fatal):", err.message);
  }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// Mendukung dua key: N8N_API_KEY (default) atau PEPPERMINT_API_KEY (opsional terpisah)
function validatePeppermintKey(req, res, next) {
  const apiKey        = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  const validKey      = process.env.PEPPERMINT_API_KEY || config.n8n.apiKey;
  const validKeyAlt   = config.n8n.apiKey; // selalu accept key utama

  if (!apiKey || (apiKey !== validKey && apiKey !== validKeyAlt)) {
    return res.status(401).json({
      error:   "Unauthorized",
      message: "Invalid or missing API key. Gunakan X-API-Key header.",
    });
  }
  next();
}

// ─── Helper: Format ticket untuk Peppermint ──────────────────────────────────
function formatTicket(t) {
  const ff = t.form_fields || t.formFields || {};
  return {
    id:           t.id,
    type:         t.type,
    title:        t.type === "INCIDENT"
      ? (ff["Incident Information"] || ff["Issue"] || "Incident Report")
      : (ff["Issue"] || ff["Judul"] || "Ticket Support"),
    status:       t.status_pengusulan  ?? t.statusPengusulan  ?? "OPEN",
    statusNote:   t.status_note        ?? t.statusNote        ?? null,
    mode:         getMode(t),
    assignee:     t.assignee           ?? t.assignees         ?? [],
    reporter:     ff["Reporter Information"] ?? ff["Nama"] ?? "N/A",
    division:     ff["Division"]             ?? ff["Divisi"]  ?? "N/A",
    location:     ff["Location"]             ?? ff["Lokasi"]  ?? "N/A",
    priority:     ff["Priority Incident"]    ?? ff["Type of Support Requested"] ?? "Medium",
    formFields:   ff,
    summary:      t.summary_ticket ?? t.summaryTicket ?? null,
    rootCause:    t.root_cause     ?? t.rootCause     ?? null,
    timeline:     t.type === "INCIDENT"
      ? (t.timeline_action_taken  ?? t.timelineActionTaken  ?? null)
      : (t.timeline_tindak_lanjut ?? t.timelineTindakLanjut ?? null),
    timelineActionTaken:  t.timeline_action_taken  ?? t.timelineActionTaken  ?? null,
    timelineTindakLanjut: t.timeline_tindak_lanjut ?? t.timelineTindakLanjut ?? null,
    evidence:     t.evidence_attachment ?? t.evidenceAttachment ?? [],
    discord:      t.discord ?? null,
    searchKeywords: t.search_keywords ?? t.searchKeywords ?? [],
    createdAt:    t.created_at  ?? t.createdAt,
    updatedAt:    t.updated_at  ?? t.updatedAt,
    resolvedAt:   t.resolved_at ?? t.resolvedAt ?? null,
  };
}

function getMode(t) {
  const status = t.status_pengusulan ?? t.statusPengusulan ?? "OPEN";
  const type   = t.type ?? "TICKETING";

  if (type === "INCIDENT") {
    if (["RESOLVED"].includes(status))       return "CLOSING";
    if (["MITIGASI"].includes(status))       return "MITIGASI";
    if (["INVESTIGASI"].includes(status))    return "INVESTIGASI";
    return "MONITORING";
  }
  if (["DONE", "REJECTED"].includes(status)) return "CLOSING";
  if (["APPROVED"].includes(status))         return "IN_PROGRESS";
  if (["PENDING"].includes(status))          return "PENDING";
  return "MONITORING";
}

// ═══════════════════════════════════════════════════════════════════════════════
// READ ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/peppermint/tickets
 * List semua tiket dengan filter, search, dan pagination
 *
 * Query params:
 *   status   — filter by status (OPEN|PENDING|APPROVED|DONE|RESOLVED|INVESTIGASI|MITIGASI)
 *   type     — filter by type (TICKETING|INCIDENT)
 *   search   — full-text search (judul, issue, summary)
 *   limit    — jumlah hasil per halaman (default: 50, max: 200)
 *   offset   — offset untuk pagination (default: 0)
 *   sortBy   — kolom untuk sort (createdAt|updatedAt|status) default: createdAt
 *   sortDir  — asc|desc (default: desc)
 */
router.get("/tickets", validatePeppermintKey, async (req, res) => {
  try {
    const { status, type, search, limit = 50, offset = 0, sortBy = "created_at", sortDir = "desc" } = req.query;

    const safeLimit   = Math.min(Math.max(parseInt(limit)  || 50, 1), 200);
    const safeOffset  = Math.max(parseInt(offset) || 0, 0);
    const validSortBy = ["created_at", "updated_at", "status_pengusulan", "id"].includes(sortBy) ? sortBy : "created_at";
    const validDir    = sortDir === "asc" ? "ASC" : "DESC";

    let rows;

    if (search && search.trim()) {
      const searchLike = `%${search.trim()}%`;
      rows = serialize(await prisma.$queryRaw`
        SELECT t.*
        FROM tickets t
        WHERE
          (${status || null}::text IS NULL OR t.status_pengusulan = ${status || null}::text)
          AND (${type   || null}::text IS NULL OR t.type           = ${type   || null}::text)
          AND (
               t.form_fields->>'Issue'                ILIKE ${searchLike}
            OR t.form_fields->>'Incident Information' ILIKE ${searchLike}
            OR COALESCE(t.summary_ticket, '')         ILIKE ${searchLike}
            OR COALESCE(t.root_cause, '')             ILIKE ${searchLike}
            OR t.form_fields->>'Reporter Information' ILIKE ${searchLike}
          )
        ORDER BY t.created_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `);
    } else {
      const where = {};
      if (status) where.status_pengusulan = status;
      if (type)   where.type              = type;

      rows = await prisma.ticket.findMany({
        where:   Object.keys(where).length > 0 ? where : undefined,
        orderBy: { [validSortBy === "created_at" ? "created_at" : validSortBy]: validDir.toLowerCase() },
        take:    safeLimit,
        skip:    safeOffset,
        include: {
          activities: {
            orderBy: { created_at: "desc" },
            take:    3,
          },
        },
      });
    }

    // Total count
    let total = 0;
    try {
      const cw = [];
      if (status) cw.push(`status_pengusulan = '${status.replace(/'/g, "''")}'`);
      if (type)   cw.push(`type = '${type.replace(/'/g, "''")}'`);
      const clause = cw.length ? " WHERE " + cw.join(" AND ") : "";
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM tickets${clause}`);
      total = Number(result[0]?.cnt ?? rows.length);
    } catch (_) {
      total = rows.length;
    }

    const tickets = rows.map(formatTicket);

    res.json({
      success: true,
      count:   tickets.length,
      total,
      offset:  safeOffset,
      limit:   safeLimit,
      tickets,
    });
  } catch (err) {
    console.error("[PEPPERMINT] GET /tickets error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/peppermint/tickets/stats
 * Statistik untuk dashboard Peppermint
 */
router.get("/tickets/stats", validatePeppermintKey, async (req, res) => {
  try {
    const [byTypeStatus, totals, recentActivity] = await Promise.all([
      prisma.$queryRaw`
        SELECT type, status_pengusulan AS status, COUNT(*)::int AS count
        FROM tickets
        GROUP BY type, status_pengusulan
        ORDER BY type, status_pengusulan
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int                                                        AS total_tickets,
          COUNT(CASE WHEN status_pengusulan IN ('OPEN','PENDING','APPROVED','INVESTIGASI','MITIGASI') THEN 1 END)::int AS open_tickets,
          COUNT(CASE WHEN status_pengusulan IN ('DONE','RESOLVED')            THEN 1 END)::int AS closed_tickets,
          COUNT(CASE WHEN status_pengusulan IN ('RESOLVED','DONE')
                      AND resolved_at >= NOW() - INTERVAL '24 hours'          THEN 1 END)::int AS resolved_today,
          COUNT(CASE WHEN type = 'INCIDENT'                                   THEN 1 END)::int AS incidents,
          COUNT(CASE WHEN type = 'TICKETING'                                  THEN 1 END)::int AS support_tickets,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours'           THEN 1 END)::int AS new_today,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days'             THEN 1 END)::int AS new_this_week,
          ROUND(
            AVG(
              CASE WHEN resolved_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
              END
            )::numeric, 2
          ) AS avg_resolution_hours
        FROM tickets
      `,
      prisma.$queryRaw`
        SELECT a.id, a.ticket_id, a.type, a.description, a.created_at,
               t.type AS ticket_type,
               t.form_fields->>'Issue' AS ticket_issue
        FROM activities a
        JOIN tickets t ON t.id = a.ticket_id
        ORDER BY a.created_at DESC
        LIMIT 10
      `,
    ]);

    res.json({
      success:        true,
      byTypeStatus:   serialize(byTypeStatus),
      totals:         serialize(totals[0]),
      recentActivity: serialize(recentActivity),
    });
  } catch (err) {
    console.error("[PEPPERMINT] GET /tickets/stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/peppermint/tickets/:id
 * Detail lengkap 1 tiket + activity log
 */
router.get("/tickets/:id", validatePeppermintKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "ID tidak valid" });

    const ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} tidak ditemukan` });

    let activities = [];
    try {
      activities = await ActivityModel.findByTicketId(id, 50);
    } catch (_) { /* non-fatal */ }

    res.json({
      success:    true,
      ticket:     formatTicket(ticket),
      activities: activities.map((a) => ({
        id:          a.id,
        type:        a.type,
        description: a.description,
        createdAt:   a.created_at ?? a.createdAt,
      })),
    });
  } catch (err) {
    console.error("[PEPPERMINT] GET /tickets/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/peppermint/tickets/:id/activities
 * Activity log tiket (terpisah untuk lazy load)
 */
router.get("/tickets/:id/activities", validatePeppermintKey, async (req, res) => {
  try {
    const id    = Number(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    const activities = await ActivityModel.findByTicketId(id, limit);
    res.json({
      success:    true,
      ticketId:   id,
      count:      activities.length,
      activities: activities.map((a) => ({
        id:          a.id,
        type:        a.type,
        description: a.description,
        createdAt:   a.created_at ?? a.createdAt,
      })),
    });
  } catch (err) {
    console.error("[PEPPERMINT] GET /tickets/:id/activities error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WRITE ENDPOINTS — Admin Peppermint mengupdate data ke DB backend
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PUT /api/peppermint/tickets/:id/status
 * Admin Peppermint update status tiket
 *
 * Body: { status, note, updatedBy }
 * INCIDENT  valid status: OPEN | INVESTIGASI | MITIGASI | RESOLVED
 * TICKETING valid status: OPEN | PENDING | APPROVED | REJECTED | DONE
 */
router.put("/tickets/:id/status", validatePeppermintKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "ID tidak valid" });

    const { status, note, updatedBy } = req.body;
    if (!status) return res.status(400).json({ error: "status wajib diisi" });

    let ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} tidak ditemukan` });

    const validStatuses = ticket.type === "INCIDENT"
      ? ["OPEN", "INVESTIGASI", "MITIGASI", "RESOLVED"]
      : ["OPEN", "PENDING", "APPROVED", "REJECTED", "DONE"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error:          `Status "${status}" tidak valid untuk tipe ${ticket.type}`,
        validStatuses,
      });
    }

    const oldStatus  = ticket.statusPengusulan ?? ticket.status_pengusulan;
    const updateData = {
      status_pengusulan: status,
      status_note:       note?.trim() || null,
    };

    // Set resolved_at jika status terminal
    if ((status === "RESOLVED" || status === "DONE") && !ticket.resolvedAt) {
      updateData.resolved_at = new Date();
    }

    ticket = await TicketModel.update(id, updateData);

    // Sync Discord (non-blocking) — update thread title + pinned message
    discordAsync(async () => {
      await DiscordService.updateThreadTitle(ticket);
      await DiscordService.updateTicketMessage(ticket);
    });

    // Log activity
    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "status_update",
      description: `[Peppermint] Status: ${oldStatus} → ${status}${note ? ` | Note: ${note}` : ""}${updatedBy ? ` (by ${updatedBy})` : ""}`,
    });

    console.log(`[PEPPERMINT] Status update #${id}: ${oldStatus} → ${status} by ${updatedBy || "admin"}`);

    res.json({
      success:    true,
      ticketId:   ticket.id,
      oldStatus,
      newStatus:  status,
      updatedBy:  updatedBy || "admin",
    });
  } catch (err) {
    console.error("[PEPPERMINT] PUT /tickets/:id/status error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/peppermint/tickets/:id/assign
 * Admin Peppermint assign petugas ke tiket
 *
 * Body: { assignees: [{ username, name, discordId }], assignedBy }
 */
router.put("/tickets/:id/assign", validatePeppermintKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "ID tidak valid" });

    const { assignees, assignedBy } = req.body;
    if (!Array.isArray(assignees)) {
      return res.status(400).json({ error: "assignees harus berupa array" });
    }

    let ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} tidak ditemukan` });

    ticket = await TicketModel.update(id, { assignee: assignees });

    // Sync Discord
    discordAsync(() => DiscordService.updateTicketMessage(ticket));

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "assigned",
      description: `[Peppermint] Assigned to: ${assignees.map((a) => a.username || a.name || "unknown").join(", ")}${assignedBy ? ` (by ${assignedBy})` : ""}`,
    });

    res.json({
      success:   true,
      ticketId:  ticket.id,
      assignees,
      assignedBy: assignedBy || "admin",
    });
  } catch (err) {
    console.error("[PEPPERMINT] PUT /tickets/:id/assign error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/peppermint/tickets/:id/comment
 * Admin Peppermint tambah komentar/catatan ke tiket
 *
 * Body: { comment, userId, userName, internal (bool) }
 * internal=true  → hanya log di DB, tidak dikirim ke Discord
 * internal=false → log di DB + kirim ke Discord thread
 */
router.post("/tickets/:id/comment", validatePeppermintKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "ID tidak valid" });

    const { comment, userId, userName, internal = false } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: "comment tidak boleh kosong" });

    const ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} tidak ditemukan` });

    const author = userName || userId || "Admin Peppermint";

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "comment",
      description: `[Peppermint${internal ? " Internal" : ""}] ${author}: ${comment.trim()}`,
    });

    // Kirim ke Discord thread jika bukan internal comment
    if (!internal && ticket.discord?.threadId) {
      discordAsync(async () => {
        try {
          const thread = await DiscordService.getClient().channels.fetch(ticket.discord.threadId);
          if (thread) {
            await thread.send({
              content: `📋 **Portal Comment** by **${author}**:\n${comment.trim()}`,
            });
          }
        } catch (discordErr) {
          console.warn("[PEPPERMINT] Discord comment send failed:", discordErr.message);
        }
      });
    }

    res.json({
      success:   true,
      ticketId:  ticket.id,
      author,
      internal:  !!internal,
      sentToDiscord: !internal && !!ticket.discord?.threadId,
    });
  } catch (err) {
    console.error("[PEPPERMINT] POST /tickets/:id/comment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/peppermint/tickets/:id/note
 * Admin update status_note (catatan internal singkat) tanpa ubah status
 *
 * Body: { note, updatedBy }
 */
router.put("/tickets/:id/note", validatePeppermintKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "ID tidak valid" });

    const { note, updatedBy } = req.body;
    if (note === undefined) return res.status(400).json({ error: "note wajib diisi (bisa string kosong untuk hapus)" });

    const ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} tidak ditemukan` });

    const updated = await TicketModel.update(id, { status_note: note?.trim() || null });

    await ActivityModel.create({
      ticketId:    updated.id,
      type:        "note_updated",
      description: `[Peppermint] Note updated${updatedBy ? ` by ${updatedBy}` : ""}: ${note?.trim() || "(cleared)"}`,
    });

    res.json({ success: true, ticketId: updated.id, note: note?.trim() || null });
  } catch (err) {
    console.error("[PEPPERMINT] PUT /tickets/:id/note error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/peppermint/knowledge
 * List semua runbook KB
 */
router.get("/knowledge", validatePeppermintKey, async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    const safeLimit  = Math.min(parseInt(limit) || 20, 100);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    let rows;
    if (search) {
      const like = `%${search.trim()}%`;
      rows = await prisma.$queryRaw`
        SELECT * FROM knowledge_base
        WHERE
          (${category || null}::text IS NULL OR category = ${category || null}::text)
          AND (
               title   ILIKE ${like}
            OR content ILIKE ${like}
          )
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;
    } else if (category) {
      rows = await prisma.knowledgeBase.findMany({
        where:   { category },
        orderBy: [{ usage_count: "desc" }, { success_rate: "desc" }],
        take:    safeLimit,
        skip:    safeOffset,
      });
    } else {
      rows = await prisma.knowledgeBase.findMany({
        orderBy: [{ usage_count: "desc" }, { success_rate: "desc" }],
        take:    safeLimit,
        skip:    safeOffset,
      });
    }

    const total = await prisma.knowledgeBase.count(
      category ? { where: { category } } : undefined
    );

    res.json({
      success: true,
      count:   rows.length,
      total,
      runbooks: rows,
    });
  } catch (err) {
    console.error("[PEPPERMINT] GET /knowledge error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/peppermint/knowledge
 * Admin tambah runbook baru
 *
 * Body: { category, title, content, keywords[], createdBy }
 */
router.post("/knowledge", validatePeppermintKey, async (req, res) => {
  try {
    const { category, title, content, keywords, createdBy } = req.body;
    if (!category || !title || !content) {
      return res.status(400).json({ error: "category, title, dan content wajib diisi" });
    }

    const kw = Array.isArray(keywords) ? keywords.map(String) : [];

    const result = await prisma.$queryRaw`
      INSERT INTO knowledge_base (category, title, content, keywords, created_by)
      VALUES (${category}, ${title}, ${content}, ${kw}::text[], ${createdBy || "admin_peppermint"})
      RETURNING id, category, title, created_at
    `;

    res.status(201).json({
      success:   true,
      runbookId: serialize(result[0])?.id,
      data:      serialize(result[0]),
    });
  } catch (err) {
    console.error("[PEPPERMINT] POST /knowledge error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/peppermint/knowledge/:id
 * Admin update runbook
 *
 * Body: { category?, title?, content?, keywords?, successRate? }
 */
router.put("/knowledge/:id", validatePeppermintKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    const { category, title, content, keywords, successRate } = req.body;

    const existing = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `Runbook #${id} tidak ditemukan` });

    const updateData = {};
    if (category    !== undefined) updateData.category     = category;
    if (title       !== undefined) updateData.title        = title;
    if (content     !== undefined) updateData.content      = content;
    if (keywords    !== undefined) updateData.keywords     = Array.isArray(keywords) ? keywords : [];
    if (successRate !== undefined) updateData.success_rate = parseFloat(successRate) || 0;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Tidak ada field yang diupdate" });
    }

    const updated = await prisma.knowledgeBase.update({
      where: { id },
      data:  updateData,
    });

    res.json({ success: true, runbookId: id, data: updated });
  } catch (err) {
    console.error("[PEPPERMINT] PUT /knowledge/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/peppermint/knowledge/:id
 * Admin hapus runbook
 */
router.delete("/knowledge/:id", validatePeppermintKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    const existing = await prisma.knowledgeBase.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `Runbook #${id} tidak ditemukan` });

    await prisma.knowledgeBase.delete({ where: { id } });

    res.json({ success: true, runbookId: id, message: `Runbook "${existing.title}" berhasil dihapus` });
  } catch (err) {
    console.error("[PEPPERMINT] DELETE /knowledge/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;