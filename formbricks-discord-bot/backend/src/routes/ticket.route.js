"use strict";

const router  = require("express").Router();
const config  = require("../config");
const prisma  = require("../database/client");
const TicketModel    = require("../models/ticket.model");
const ActivityModel  = require("../models/activity.model");
const DiscordService = require("../services/discord.service");
const { validateApiKey } = require("../middleware/auth");
const { getTicketMode }  = require("../utils/ticket");
const { sendEmail, buildConfirmationEmail } = require("../services/email.service");
const { getPublicUrl } = require("../utils/network");
const RecommendationService = require("../services/recommendation.service");
const IncidentService       = require("../services/incident.service");

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
        title: t.type === "INCIDENT"
          ? (ff["Incident Title"] || ff["Incident Information"] || ff["Issue"] || "Incident Report")
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

    const isIncident = ticket.type === "INCIDENT";
    const updateData = {};

    if (summary?.trim() && summary !== "null") {
      updateData.summary_ticket = summary.trim();
    }

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
router.post("/timeline/append", validateApiKey, async (req, res) => {
  try {
    const { ticketId, ticketType, newTimeline } = req.body;
    if (!ticketId)    return res.status(400).json({ error: "ticketId required" });
    if (!newTimeline) return res.status(400).json({ error: "newTimeline required" });

    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return res.status(404).json({ error: `Ticket #${ticketId} not found` });

    const isIncident   = (ticketType || ticket.type) === "INCIDENT";
    const entries      = Array.isArray(newTimeline) ? newTimeline : [newTimeline];
    const validEntries = entries.filter((e) => e && e.datetime && e.action);

    if (validEntries.length === 0) {
      return res.status(400).json({ error: "newTimeline: entry tidak valid (butuh datetime + action)" });
    }

    const currentVal = isIncident
      ? (ticket.timelineActionTaken  || ticket.timeline_action_taken  || "")
      : (ticket.timelineTindakLanjut || ticket.timeline_tindak_lanjut || "");
    const currentCount = currentVal.split("\n").filter((l) => l.trim()).length;

    let idx = currentCount + 1;
    const appendText = validEntries.map((e) => {
      const line = `${idx}. (${e.datetime}) ${e.action}`;
      idx++;
      return line;
    }).join("\n");

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

    const updatedTicket = await TicketModel.findById(ticketId);

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
    let type = req.body.type;
    if (type === "SUPPORT") type = "TICKETING";

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

// POST /api/ticket/create — buat tiket dari Static Portal (User & Admin)
router.post("/create", validateApiKey, async (req, res) => {
  try {
    const { formFields, createdBy, autoCreateDiscord = true } = req.body;
    let type = req.body.type;
    if (type === "SUPPORT") type = "TICKETING";

    if (!type)       return res.status(400).json({ error: "type required" });
    if (!formFields) return res.status(400).json({ error: "formFields required" });
    if (!config.ticket.validTypes.includes(type)) {
      return res.status(400).json({ error: `type tidak valid. Gunakan: ${config.ticket.validTypes.join(", ")}` });
    }

    // ── Judul & keywords ──────────────────────────────────────────────────────
    const title = type === "INCIDENT"
      ? (formFields["Incident Title"] || formFields["Incident Information"] || formFields["Issue"] || "Incident")
      : (formFields["Issue"] || "Support Request");

    const STOPWORDS = new Set(["yang","untuk","dari","dengan","adalah","pada","ke","di","dan","atau","ini","itu","ada","tidak","bisa","cara","saya","kami"]);
    const keywords  = title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .slice(0, 12);

    // ── Tentukan form_id berdasarkan sumber ───────────────────────────────────
    const formId = createdBy && String(createdBy).startsWith("admin")
      ? "admin_portal"
      : "static_portal";

    // ── Buat tiket di DB ──────────────────────────────────────────────────────
    let ticket = await TicketModel.create({
      type,
      formId,
      formFields,
      statusPengusulan:   "OPEN",
      evidenceAttachment: [],
      searchKeywords:    keywords,
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "created",
      description: `Tiket dibuat oleh ${createdBy && String(createdBy).startsWith("admin") ? `Admin (${createdBy.replace(/^admin:/, "")})` : (createdBy || "User")} melalui Portal`,
    });

    console.log(`✅ [TICKET/CREATE] Ticket #${ticket.id} (${type}) dibuat oleh ${createdBy || "user"}`);

    // ── Discord thread (non-blocking, default ON untuk static portal) ─────────
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
        console.log(`✅ [TICKET/CREATE] Discord thread: ${thread.url}`);
      } catch (discordErr) {
        console.error("[TICKET/CREATE] Discord thread gagal (non-fatal):", discordErr.message);
        try {
          await ActivityModel.create({
            ticketId:    ticket.id,
            type:        "discord_error",
            description: `Discord thread gagal: ${discordErr.message.substring(0, 200)}`,
          });
        } catch (_) {}
      }
    }

    // Smart Recommendation + Incident Detection (non-blocking) ────────
    setImmediate(async () => {
      try {
        const issueText = type === "INCIDENT"
          ? (formFields["Incident Title"] || formFields["Incident Information"] || "")
          : (formFields["Issue"] || "");

        if (!issueText.trim()) return;

        const recResult = await RecommendationService.getRecommendation({
          issueText,
          keywords:  ticket.searchKeywords || keywords,
          type,
          excludeId: ticket.id,  
        });

        if (recResult.found && discordThread?.threadId) {
          try {
            const client = DiscordService.getClient();

            const thread = await client.channels.fetch(discordThread.threadId);
            if (thread?.isThread()) {
              const recMsg = RecommendationService.buildDiscordRecommendation(recResult, type);
              if (recMsg) {
                await thread.send(recMsg);
                console.log(`💡 [TICKET/CREATE] Smart Recommendation dikirim ke thread #${discordThread.threadId}`);
              }
            }

            const top = recResult.topSuggestion;
            if (top && config.discord.channelId) {
              const channel = await client.channels.fetch(config.discord.channelId);
              if (channel?.isTextBased()) {
                const icon  = type === "INCIDENT" ? "🚨" : "🎫";
                const refId = top.source === "ticket" ? `#${top.ticketId}` : top.title;
                const summary = top.summary
                  ? String(top.summary).substring(0, 120) + "..."
                  : (top.content ? String(top.content).substring(0, 120) + "..." : "");
                const notif = [
                  `💡 **SMART RECOMMENDATION** — ${icon} Ticket #${ticket.id}`,
                  `Ditemukan referensi dari kasus sebelumnya (${refId}).`,
                  summary ? `> ${summary}` : "",
                  discordThread.threadUrl ? `Lihat detail di thread: ${discordThread.threadUrl}` : "",
                ].filter(Boolean).join("\n");
                await channel.send(notif);
                console.log(`💡 [TICKET/CREATE] Notifikasi Smart Recommendation dikirim ke channel utama`);
              }
            }
          } catch (discordRecErr) {
            console.warn("[TICKET/CREATE] Gagal kirim recommendation ke Discord (non-fatal):", discordRecErr.message);
          }
        }

        const analysis = IncidentService.analyzeForIncident(ticket);
        if (analysis.isIncident) {
          console.log(`🚨 [TICKET/CREATE] Incident detected: #${ticket.id} | ${analysis.category}`);
          IncidentService.processIncident(ticket).catch((e) =>
            console.warn("[TICKET/CREATE] Incident process error (non-fatal):", e.message)
          );
        }
      } catch (bgErr) {
        console.warn("[TICKET/CREATE] Background task error (non-fatal):", bgErr.message);
      }
    });

    // ── Email konfirmasi ke pelapor ───────────────────────────────────────────
    const emailTo = (formFields["Email"] || "").trim();
    if (emailTo && emailTo.includes("@")) {
      try {
        const portalUrl    = getPublicUrl();
        const emailSubject = `Konfirmasi Penerimaan Ticket ${type === "INCIDENT" ? "Incident" : "Support"} #${ticket.id}`;
        const emailHtml    = buildConfirmationEmail(ticket, type, portalUrl);

        sendEmail({ to: emailTo, subject: emailSubject, html: emailHtml })
          .then((info) => {
            if (info) console.log(`✅ [TICKET/CREATE] Email konfirmasi terkirim ke ${emailTo}`);
          })
          .catch((err) => console.error(`❌ [TICKET/CREATE] Email gagal ke ${emailTo}:`, err.message));

        console.log(`📧 [TICKET/CREATE] Email sedang dikirim ke ${emailTo}...`);
      } catch (emailErr) {
        console.error("[TICKET/CREATE] Email error (non-fatal):", emailErr.message);
      }
    } else {
      console.warn(`⚠ [TICKET/CREATE] Email tidak dikirim — field Email kosong atau tidak valid`);
    }

    // ── Response ──────────────────────────────────────────────────────────────
    res.status(201).json({
      success:   true,
      ticketId:  ticket.id,
      discord:   discordThread,
      emailSent: !!(emailTo && emailTo.includes("@")),
    });
  } catch (err) {
    console.error("[TICKET] POST /create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DYNAMIC ROUTES — /:id 
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

// PUT /api/ticket/:id/status — update status dari Portal
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
      : ["OPEN", "PENDING", "APPROVED", "IN_PROGRESS", "REJECTED", "REJECT", "DONE"];

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

// POST /api/ticket/:id/sync-discord
router.post("/:id/sync-discord", validateApiKey, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const { action, status, assignees } = req.body;

    res.status(202).json({ accepted: true, ticketId: id, action });

    let ticket;
    try {
      ticket = await TicketModel.findById(id);
    } catch (dbErr) {
      console.error(`❌ [SYNC-DISCORD] DB findById failed #${id}:`, dbErr.message);
      return;
    }
    if (!ticket) {
      console.warn(`⚠️ [SYNC-DISCORD] Ticket #${id} not found in DB`);
      return;
    }

    const discord = ticket.discord || ticket.discordData || {};

    if (discord.threadId) {
      try {
        await Promise.all([
          DiscordService.updateThreadTitle(ticket),
          DiscordService.updateTicketMessage(ticket),
        ]);
        console.log(`✅ [SYNC-DISCORD] Ticket #${id} Discord updated (action: ${action})`);
      } catch (discordErr) {
        console.error(`❌ [SYNC-DISCORD] Discord update failed #${id}:`, discordErr.message);
      }
    } else {
      console.log(`⚠️ [SYNC-DISCORD] Ticket #${id} tidak punya Discord thread — skip Discord sync`);
    }

    const currentStatus = ticket.statusPengusulan || ticket.status_pengusulan;
    const isClosing     = currentStatus === "DONE" || currentStatus === "RESOLVED";

    if (isClosing && discord.threadId) {
      const hasSummary = !!(ticket.summaryTicket || ticket.summary_ticket);

      if (hasSummary) {
        console.log(`ℹ️ [SYNC-DISCORD] Ticket #${id} CLOSING — summary exists, checking Discord sync`);
        try {
          const outOfSync = await DiscordService.isDiscordOutOfSync(ticket);
          if (outOfSync) {
            await DiscordService.repairPinnedMessage(ticket);
            console.log(`🔧 [SYNC-DISCORD] Ticket #${id} Discord repaired (was out of sync)`);
          }
        } catch (repairErr) {
          console.error(`❌ [SYNC-DISCORD] Repair failed #${id}:`, repairErr.message);
        }
      } else {
        console.log(`🔔 [SYNC-DISCORD] Ticket #${id} CLOSING — triggering N8N for summary generation`);
        try {
          const N8NService = require("../services/n8n.service");
          await N8NService.triggerWorkflow({
            eventType:        "portal_status_closing",
            threadId:         discord.threadId,
            threadName:       discord.threadName || `#${id}`,
            ticketId:         ticket.id,
            ticketType:       ticket.type,
            statusPengusulan: currentStatus,
            mode:             "CLOSING",
            messageId:        null,
            messageContent:   `[Portal Admin] Status set to ${currentStatus}`,
            authorId:         "portal_admin",
            authorName:       "Portal Admin",
            timestamp:        new Date().toISOString(),
          });
          console.log(`✅ [SYNC-DISCORD] N8N CLOSING triggered for Ticket #${id}`);
        } catch (n8nErr) {
          console.error(`❌ [SYNC-DISCORD] N8N trigger failed #${id}:`, n8nErr.message);
        }
      }
    }

    try {
      const actionLabel = {
        status_update:      "Status diperbarui via Portal Admin",
        reassign:           "Assignee diperbarui via Portal Admin",
        form_fields_update: "Data formulir diperbarui via Portal Admin",
        ticket_data_update: "Data ticket diperbarui via Portal Admin",
      }[action] || `Update via Portal Admin (${action || "sync"})`;

      await ActivityModel.create({
        ticketId:    id,
        type:        action || "admin_update",
        description: actionLabel,
      });
    } catch (logErr) {
      console.warn(`⚠️ [SYNC-DISCORD] Activity log failed #${id}:`, logErr.message);
    }

  } catch (err) {
    if (!res.headersSent) {
      console.error("[TICKET] POST /:id/sync-discord error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;