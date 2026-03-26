/**
 * src/routes/ticket.route.js
 * Ticket API Routes — Production v5 Final
 *
 * Router ini dipasang DUA kali di index.js:
 *   app.use("/api/ticket",  ticketRoute)   - singular prefix (core API & portal CRUD)
 *   app.use("/api/tickets", ticketRoute)   - plural prefix  (portal list & stats)
 *
 * FIX v5 (Prisma layer):
 *   - POST /summary: simpan summary + rootCause untuk SEMUA type (INCIDENT & TICKETING)
 *   - POST /timeline/append: atomic $executeRaw COALESCE+concat via chr(10) — no race condition
 *   - Semua route static sebelum /:id (route order kritis)
 *   - try-catch semua Discord calls (non-blocking)
 */

"use strict";

const router  = require("express").Router();
const config  = require("../config");
const prisma  = require("../database/client");
const TicketModel    = require("../models/ticket.model");
const ActivityModel  = require("../models/activity.model");
const DiscordService = require("../services/discord.service");
const { validateApiKey } = require("../middleware/auth");
const { getTicketMode }  = require("../utils/ticket");

// ---- Helpers ----------------------------------------------------------------

function serialize(data) {
  return JSON.parse(JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  ));
}

function discordAsync(fn) {
  try {
    Promise.resolve(fn()).catch((err) =>
      console.warn("[TICKET] Discord async error (non-fatal):", err.message)
    );
  } catch (err) {
    console.warn("[TICKET] Discord call error (non-fatal):", err.message);
  }
}

// ============================================================================
// STATIC ROUTES — harus PERTAMA sebelum /:id
// ============================================================================

// GET /api/tickets — list semua tiket + filter & pagination
router.get("/", validateApiKey, async (req, res) => {
  try {
    const { status, type, search, limit = 50, offset = 0 } = req.query;
    const safeLimit  = Math.min(Math.max(parseInt(limit)  || 50, 1), 200);
    const safeOffset = Math.max(parseInt(offset) || 0, 0);

    let rows;
    const where = {};
    if (status) where.status_pengusulan = status;
    if (type)   where.type              = type;

    if (search && search.trim()) {
      const searchLike = `%${search.trim()}%`;
      rows = serialize(await prisma.$queryRaw`
        SELECT t.*
        FROM tickets t
        WHERE
          (${status || null}::text IS NULL OR t.status_pengusulan = ${status || null}::text)
          AND (${type   || null}::text IS NULL OR t.type = ${type || null}::text)
          AND (
               t.form_fields->>'Issue'                ILIKE ${searchLike}
            OR t.form_fields->>'Incident Information' ILIKE ${searchLike}
            OR COALESCE(t.summary_ticket, '')          ILIKE ${searchLike}
          )
        ORDER BY t.created_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `);
    } else {
      rows = await prisma.ticket.findMany({
        where:   Object.keys(where).length > 0 ? where : undefined,
        orderBy: { created_at: "desc" },
        take:    safeLimit,
        skip:    safeOffset,
        include: { activities: { orderBy: { created_at: "desc" }, take: 5 } },
      });
    }

    let total = rows.length;
    try {
      const cw = [];
      if (status) cw.push(`status_pengusulan = '${status.replace(/'/g, "''")}'`);
      if (type)   cw.push(`type = '${type.replace(/'/g, "''")}'`);
      const clause = cw.length ? " WHERE " + cw.join(" AND ") : "";
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM tickets${clause}`);
      total = Number(result[0]?.cnt ?? rows.length);
    } catch (_) { /* non-fatal */ }

    const tickets = rows.map((t) => {
      const ff = t.form_fields || t.formFields || {};
      return {
        id:         t.id,
        type:       t.type,
        title:      t.type === "INCIDENT"
          ? (ff["Incident Information"] || ff["Issue"] || "Incident Report")
          : (ff["Issue"] || "Ticket Support"),
        status:     t.status_pengusulan  ?? t.statusPengusulan,
        statusNote: t.status_note        ?? t.statusNote,
        assignee:   t.assignee           ?? [],
        reporter:   ff["Reporter Information"] ?? "N/A",
        division:   ff["Division"]             ?? "N/A",
        priority:   ff["Priority Incident"]    ?? ff["Type of Support Requested"] ?? "Medium",
        summary:    t.summary_ticket ?? t.summaryTicket ?? null,
        rootCause:  t.root_cause    ?? t.rootCause     ?? null,
        createdAt:  t.created_at    ?? t.createdAt,
        updatedAt:  t.updated_at    ?? t.updatedAt,
        resolvedAt: t.resolved_at   ?? t.resolvedAt    ?? null,
        discord:    t.discord       ?? null,
        recentActivities: (t.activities || []).slice(0, 5).map((a) => ({
          type:        a.type,
          description: a.description,
          createdAt:   a.created_at ?? a.createdAt,
        })),
      };
    });

    res.json({ success: true, count: tickets.length, total, offset: safeOffset, limit: safeLimit, tickets });
  } catch (err) {
    console.error("[TICKET] GET / (list) error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets/stats — dashboard statistics
router.get("/stats", validateApiKey, async (req, res) => {
  try {
    const [byTypeStatus, totals] = await Promise.all([
      prisma.$queryRaw`
        SELECT type, status_pengusulan AS status, COUNT(*)::int AS count
        FROM tickets
        GROUP BY type, status_pengusulan
        ORDER BY type, status_pengusulan
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS total_tickets,
          COUNT(CASE WHEN status_pengusulan IN ('OPEN','PENDING','APPROVED','INVESTIGASI','MITIGASI') THEN 1 END)::int AS open_tickets,
          COUNT(CASE WHEN status_pengusulan IN ('DONE','RESOLVED') THEN 1 END)::int AS closed_tickets,
          COUNT(CASE WHEN type = 'INCIDENT'  THEN 1 END)::int AS incidents,
          COUNT(CASE WHEN type = 'TICKETING' THEN 1 END)::int AS support_tickets,
          ROUND(AVG(CASE WHEN resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 END)::numeric, 2) AS avg_resolution_hours
        FROM tickets
      `,
    ]);

    res.json({ success: true, byTypeStatus: serialize(byTypeStatus), totals: serialize(totals[0]) });
  } catch (err) {
    console.error("[TICKET] GET /stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CORE API STATIC ROUTES
// ============================================================================

// POST /api/ticket/summary — AI menyimpan summary & root cause setelah tiket selesai
router.post("/summary", validateApiKey, async (req, res) => {
  try {
    const { ticketId, summary, rootCause, keywords, force } = req.body;
    if (!ticketId) return res.status(400).json({ error: "ticketId required" });

    let ticket = await TicketModel.findById(ticketId);
    if (!ticket) return res.status(404).json({ error: `Ticket #${ticketId} not found` });

    const mode = getTicketMode(ticket);
    if (mode !== "CLOSING" && !force) {
      console.warn(`[TICKET] POST /summary: Ticket #${ticketId} mode=${mode} — saving anyway (N8N trusted source)`);
    }

    // Jika summary sudah ada di DB => cek Discord sync saja
    if (ticket.summaryTicket?.trim() && !force) {
      try {
        const outOfSync = await DiscordService.isDiscordOutOfSync(ticket);
        if (outOfSync) {
          const repaired = await DiscordService.repairPinnedMessage(ticket);
          return res.json({ success: true, ticketId: ticket.id, message: "Summary sudah ada. Discord di-repair.", data: { summaryAlreadyExisted: true, discordRepaired: repaired } });
        }
        return res.json({ success: true, ticketId: ticket.id, message: "Summary sudah ada dan Discord sudah sync.", data: { summaryAlreadyExisted: true, discordSynced: true } });
      } catch (discordErr) {
        return res.json({ success: true, ticketId: ticket.id, message: "Summary sudah ada. Discord check failed.", data: { summaryAlreadyExisted: true, discordError: discordErr.message } });
      }
    }

    // FIX: conditional per type — identik dengan original index.js
    // INCIDENT:  summary_ticket => tampil sebagai **Handling:** di Discord
    //            root_cause     => disimpan ke DB, TIDAK tampil di pinned Discord
    // TICKETING: summary_ticket => tampil sebagai **Summary:** di Discord
    //            root_cause disimpan ke DB, TIDAK tampil di pinned Discord
    const isIncident = ticket.type === "INCIDENT";
    const updateData = {};

    if (summary?.trim() && summary !== "null") {
      updateData.summary_ticket = summary.trim();
    }

    // FIX: rootCause disimpan untuk SEMUA jenis ticket (INCIDENT dan TICKETING)
    // WF1 CLOSING mode selalu generate rootCause untuk kedua jenis ticket.
    // Di Discord: root_cause TIDAK tampil di pinned message (hanya di DB + chatbot).
    if (rootCause?.trim() && rootCause !== "null") {
      updateData.root_cause = rootCause.trim();
    }

    if (keywords) {
      try {
        const kw = typeof keywords === "string" ? JSON.parse(keywords) : keywords;
        if (Array.isArray(kw) && kw.length > 0) {
          updateData.search_keywords = kw.slice(0, 20).map(String);
        }
      } catch (_) { /* invalid JSON keywords - skip */ }
    }

    if (!ticket.resolvedAt) updateData.resolved_at = new Date();

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Tidak ada data valid untuk disimpan (summary, rootCause, atau keywords required)" });
    }

    ticket = await TicketModel.update(ticketId, updateData);

    let discordSynced = false;
    try {
      await DiscordService.updateTicketMessage(ticket);
      discordSynced = true;
    } catch (_) {
      try {
        const fresh = await TicketModel.findById(ticketId);
        discordSynced = await DiscordService.repairPinnedMessage(fresh);
      } catch (_2) { /* Discord sync gagal - tidak crash server */ }
    }

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "ai_summary_created",
      description: `AI generated ${isIncident ? "handling + root cause (Incident)" : "summary (Support)"}${discordSynced ? "" : " (Discord sync pending)"}`,
    });

    res.json({
      success:  true,
      ticketId: ticket.id,
      message:  discordSynced ? "Summary disimpan & Discord diupdate" : "Summary disimpan. Discord akan sync saat activity berikutnya.",
      data: {
        summaryUpdated:   !!updateData.summary_ticket,
        rootCauseUpdated: !!updateData.root_cause,
        keywordsUpdated:  !!updateData.search_keywords,
        discordSynced,
      },
    });
  } catch (err) {
    console.error("[TICKET] POST /summary error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ticket/timeline/append — AI append timeline entries
//
// FIX (Prisma layer — atomic append):
//   Race condition: read-then-write (findById -> build -> update) rentan overwrite
//   jika N8N kirim 2 request hampir bersamaan.
//   Solusi: $executeRaw COALESCE+concat dalam 1 SQL statement (atomic di PostgreSQL).
//   Gunakan chr(10) sebagai newline — menghindari escape ambiguity di tagged template.
//
//   INCIDENT  -> timeline_action_taken   (tampil "Action Taken" di pinned Discord)
//   TICKETING -> timeline_tindak_lanjut  (tampil "Tindak Lanjut" di pinned Discord)
router.post("/timeline/append", validateApiKey, async (req, res) => {
  try {
    const { ticketId, ticketType, newTimeline } = req.body;
    if (!ticketId)    return res.status(400).json({ error: "ticketId required" });
    if (!newTimeline) return res.status(400).json({ error: "newTimeline required" });

    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return res.status(404).json({ error: `Ticket #${ticketId} not found` });

    // INCIDENT -> action_taken | TICKETING -> tindak_lanjut
    const isIncident   = (ticketType || ticket.type) === "INCIDENT";
    const entries      = Array.isArray(newTimeline) ? newTimeline : [newTimeline];
    const validEntries = entries.filter((e) => e && e.datetime && e.action);

    if (validEntries.length === 0) {
      return res.status(400).json({ error: "newTimeline: entry tidak valid (butuh datetime + action)" });
    }

    // Hitung entry existing untuk index lanjutan
    const currentVal = isIncident
      ? (ticket.timelineActionTaken  || ticket.timeline_action_taken  || "")
      : (ticket.timelineTindakLanjut || ticket.timeline_tindak_lanjut || "");
    const currentCount = currentVal.split("\n").filter((l) => l.trim()).length;

    // Build teks yang akan di-append
    let idx = currentCount + 1;
    const appendText = validEntries.map((e) => {
      const line = `${idx}. (${e.datetime}) ${e.action}`;
      idx++;
      return line;
    }).join("\n");

    // Atomic APPEND via $executeRaw — 1 SQL statement, no race condition window.
    // chr(10) = newline character — aman di Prisma tagged template (no escape needed).
    // INCIDENT  -> update timeline_action_taken
    // TICKETING -> update timeline_tindak_lanjut
    if (isIncident) {
      await prisma.$executeRaw`
        UPDATE tickets
        SET
          timeline_action_taken = CASE
            WHEN timeline_action_taken IS NULL OR timeline_action_taken = ''
            THEN ${appendText}::text
            ELSE timeline_action_taken || chr(10) || ${appendText}::text
          END,
          updated_at = NOW()
        WHERE id = ${Number(ticketId)}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE tickets
        SET
          timeline_tindak_lanjut = CASE
            WHEN timeline_tindak_lanjut IS NULL OR timeline_tindak_lanjut = ''
            THEN ${appendText}::text
            ELSE timeline_tindak_lanjut || chr(10) || ${appendText}::text
          END,
          updated_at = NOW()
        WHERE id = ${Number(ticketId)}
      `;
    }

    // Reload fresh dari DB setelah atomic update
    const updatedTicket = await TicketModel.findById(ticketId);

    // Sync Discord pinned message (non-blocking)
    discordAsync(() => DiscordService.updateTicketMessage(updatedTicket));

    await ActivityModel.create({
      ticketId:    updatedTicket.id,
      type:        "ai_timeline_append",
      description: `AI appended ${validEntries.length} entr${validEntries.length === 1 ? "y" : "ies"} -> ${isIncident ? "Action Taken (Incident)" : "Tindak Lanjut (Support)"}`,
    });

    console.log(`[TICKET] Timeline appended #${ticketId}: ${validEntries.length} entries -> ${isIncident ? "INCIDENT/action_taken" : "TICKETING/tindak_lanjut"}`);
    res.json({
      success:       true,
      ticketId:      updatedTicket.id,
      entriesAdded:  validEntries.length,
      isIncident,
      columnUpdated: isIncident ? "timeline_action_taken" : "timeline_tindak_lanjut",
    });
  } catch (err) {
    console.error("[TICKET] POST /timeline/append error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ticket/repair-discord — force repair pinned message di thread
router.post("/repair-discord", validateApiKey, async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ error: "ticketId required" });

    const ticket = await TicketModel.findById(ticketId);
    if (!ticket)  return res.status(404).json({ error: `Ticket #${ticketId} not found` });
    if (!ticket.discord?.threadId) return res.status(400).json({ error: "Ticket belum punya Discord thread" });

    const repaired = await DiscordService.repairPinnedMessage(ticket);
    res.json({
      success:  repaired,
      ticketId: ticket.id,
      message:  repaired ? "Discord pinned message berhasil di-repair" : "Repair gagal - cek log Discord",
    });
  } catch (err) {
    console.error("[TICKET] POST /repair-discord error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ticket/auto-create — chatbot auto-create ticket + Discord thread
router.post("/auto-create", validateApiKey, async (req, res) => {
  try {
    const { title, description, keywords, formFields, createdBy } = req.body;
    // FIX: normalize type — N8N lama (Sequelize era) mengirim type="SUPPORT"
    // Prisma version hanya mengenal "TICKETING" atau "INCIDENT".
    // Normalisasi di sini agar N8N workflow lama tidak perlu diubah.
    let type = req.body.type;
    if (type === "SUPPORT") type = "TICKETING";   // backward compat

    if (!type)  return res.status(400).json({ error: "type required (TICKETING atau INCIDENT)" });
    if (!title) return res.status(400).json({ error: "title required" });
    if (!config.ticket.validTypes.includes(type)) {
      return res.status(400).json({ error: `type tidak valid. Gunakan: ${config.ticket.validTypes.join(", ")}` });
    }

    console.log(`[TICKET] Auto-creating ${type}: "${title}"`);

    let ticket = await TicketModel.create({
      type,
      formId:  "chatbot_auto_create",
      formFields: formFields || {
        Issue:                  title,
        "Reporter Information": createdBy || "AI Chatbot",
        "Incident Information": title,
      },
      statusPengusulan:   "OPEN",
      evidenceAttachment: [],
      searchKeywords:     Array.isArray(keywords) ? keywords.slice(0, 15) : [],
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "chatbot_auto_create",
      description: `Ticket auto-created via Chatbot oleh ${createdBy || "AI"}: "${title}"`,
    });

    try {
      const { thread, infoMessage, overflowIds, commandsMessage } =
        await DiscordService.createTicketThread(ticket, config.discord.channelId);

      if (description?.trim()) {
        await thread.send({ content: `Deskripsi dari pengguna:\n${description.trim()}` });
      }

      ticket = await TicketModel.update(ticket.id, {
        discord: {
          infoMessageId:      infoMessage.id,
          commandsMessageId:  commandsMessage?.id ?? null,
          threadId:           thread.id,
          threadUrl:          thread.url,
          channelId:          config.discord.channelId,
          overflowMessageIds: overflowIds ?? [],
        },
      });

      console.log(`[TICKET] Auto-created ticket #${ticket.id} -> ${thread.url}`);
      res.json({ success: true, ticketId: ticket.id, threadUrl: thread.url, threadId: thread.id });
    } catch (discordErr) {
      console.error(`[TICKET] Discord thread gagal untuk ticket #${ticket.id}:`, discordErr.message);
      res.json({
        success:   true,
        ticketId:  ticket.id,
        threadUrl: null,
        message:   `Ticket dibuat tapi Discord thread gagal: ${discordErr.message}`,
      });
    }
  } catch (err) {
    console.error("[TICKET] POST /auto-create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ticket/find-similar — N8N chatbot mencari tiket serupa
router.post("/find-similar", validateApiKey, async (req, res) => {
  try {
    const { keywords, limit = 5 } = req.body;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: "keywords harus berupa array non-kosong" });
    }
    const tickets = await TicketModel.findSimilar(keywords, Math.min(Number(limit) || 5, 10));
    res.json({ success: true, count: tickets.length, tickets });
  } catch (err) {
    console.error("[TICKET] POST /find-similar error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ticket/create — buat tiket dari Peppermint Portal
router.post("/create", validateApiKey, async (req, res) => {
  try {
    const { formFields, createdBy, autoCreateDiscord = false } = req.body;
    // FIX: normalize SUPPORT → TICKETING (backward compat)
    let type = req.body.type;
    if (type === "SUPPORT") type = "TICKETING";

    if (!type)       return res.status(400).json({ error: "type required" });
    if (!formFields) return res.status(400).json({ error: "formFields required" });
    if (!config.ticket.validTypes.includes(type)) {
      return res.status(400).json({ error: `type tidak valid. Gunakan: ${config.ticket.validTypes.join(", ")}` });
    }

    const title = type === "INCIDENT"
      ? (formFields["Incident Information"] || formFields["Issue"] || "Incident")
      : (formFields["Issue"] || "Support Request");

    const STOPWORDS = new Set(["yang","untuk","dari","dengan","adalah","pada","ke","di","dan","atau","ini","itu","ada","tidak","bisa","cara","saya","kami"]);
    const keywords  = title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .slice(0, 12);

    let ticket = await TicketModel.create({
      type,
      formId:            "peppermint_portal",
      formFields,
      statusPengusulan:   "OPEN",
      evidenceAttachment: [],
      searchKeywords:    keywords,
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "created",
      description: `Tiket dibuat dari Peppermint Portal oleh ${createdBy || "user"}`,
    });

    let discordThread = null;
    if (autoCreateDiscord) {
      try {
        const { thread, infoMessage, overflowIds } =
          await DiscordService.createTicketThread(ticket, config.discord.channelId);
        ticket = await TicketModel.update(ticket.id, {
          discord: {
            infoMessageId:      infoMessage.id,
            threadId:           thread.id,
            threadUrl:          thread.url,
            channelId:          config.discord.channelId,
            overflowMessageIds: overflowIds ?? [],
          },
        });
        discordThread = { threadId: thread.id, threadUrl: thread.url };
      } catch (discordErr) {
        console.error("[TICKET] Portal create Discord failed:", discordErr.message);
      }
    }

    res.status(201).json({ success: true, ticketId: ticket.id, discord: discordThread });
  } catch (err) {
    console.error("[TICKET] POST /create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DYNAMIC ROUTES — /:id HARUS PALING BAWAH
// ============================================================================

// GET /api/ticket/:id — detail tiket
router.get("/:id", validateApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} not found` });

    res.json({
      success: true,
      ticket: {
        id:                   ticket.id,
        type:                 ticket.type,
        formId:               ticket.formId,
        formFields:           ticket.formFields,
        status:               ticket.statusPengusulan,
        statusNote:           ticket.statusNote,
        mode:                 getTicketMode(ticket),
        assignee:             ticket.assignee             ?? [],
        evidenceAttachment:   ticket.evidenceAttachment   ?? [],
        timelineActionTaken:  ticket.timelineActionTaken  ?? null,
        timelineTindakLanjut: ticket.timelineTindakLanjut ?? null,
        summaryTicket:        ticket.summaryTicket        ?? null,
        rootCause:            ticket.rootCause            ?? null,
        searchKeywords:       ticket.searchKeywords       ?? [],
        discord:              ticket.discord              ?? null,
        createdAt:            ticket.createdAt,
        updatedAt:            ticket.updatedAt,
        resolvedAt:           ticket.resolvedAt           ?? null,
      },
    });
  } catch (err) {
    console.error("[TICKET] GET /:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ticket/:id/status — update status dari Peppermint Portal
router.put("/:id/status", validateApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const { status, note, updatedBy } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });

    let ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} not found` });

    const validStatuses = ticket.type === "INCIDENT"
      ? ["OPEN", "INVESTIGASI", "MITIGASI", "RESOLVED"]
      : ["OPEN", "PENDING", "APPROVED", "REJECTED", "DONE"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status "${status}" tidak valid untuk ${ticket.type}`, validStatuses });
    }

    const oldStatus  = ticket.statusPengusulan;
    const updateData = { status_pengusulan: status, status_note: note?.trim() || null };
    if ((status === "RESOLVED" || status === "DONE") && !ticket.resolvedAt) {
      updateData.resolved_at = new Date();
    }

    ticket = await TicketModel.update(id, updateData);

    discordAsync(async () => {
      await DiscordService.updateThreadTitle(ticket);
      await DiscordService.updateTicketMessage(ticket);
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "status_update",
      description: `Status: ${oldStatus} -> ${status}${note ? ` | ${note}` : ""}${updatedBy ? ` (by ${updatedBy})` : ""}`,
    });

    res.json({ success: true, ticketId: ticket.id, oldStatus, newStatus: status });
  } catch (err) {
    console.error("[TICKET] PUT /:id/status error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ticket/:id/comment — tambah komentar dari portal
router.post("/:id/comment", validateApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const { comment, userId, userName } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: "comment required" });

    const ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} not found` });

    const author = userName || userId || "User";
    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "comment",
      description: `${author}: ${comment.trim()}`,
    });

    if (ticket.discord?.threadId) {
      discordAsync(async () => {
        const thread = await DiscordService.getClient().channels.fetch(ticket.discord.threadId);
        if (thread) {
          await thread.send({ content: `Portal Comment by ${author}:\n${comment.trim()}` });
        }
      });
    }

    res.json({ success: true, ticketId: ticket.id });
  } catch (err) {
    console.error("[TICKET] POST /:id/comment error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ticket/:id/assign — assign petugas dari portal
router.put("/:id/assign", validateApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const { assignees, assignedBy } = req.body;
    if (!Array.isArray(assignees)) {
      return res.status(400).json({ error: "assignees harus berupa array" });
    }

    let ticket = await TicketModel.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} not found` });

    ticket = await TicketModel.update(id, { assignee: assignees });
    discordAsync(() => DiscordService.updateTicketMessage(ticket));

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "assigned",
      description: `Assigned to: ${assignees.map((a) => a.username || a.name || "unknown").join(", ")}${assignedBy ? ` (by ${assignedBy})` : ""}`,
    });

    res.json({ success: true, ticketId: ticket.id, assignees });
  } catch (err) {
    console.error("[TICKET] PUT /:id/assign error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
