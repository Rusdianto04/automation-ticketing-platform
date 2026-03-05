/**
 * src/routes/chatbot.route.js
 * Chatbot API Routes
 *
 * Semua endpoint ini diakses oleh N8N — BUKAN langsung ke PostgreSQL.
 * N8N memanggil API ini, API yang query ke DB via Prisma.
 *
 * FIX: BigInt serialization — Prisma $queryRaw mengembalikan COUNT() sebagai
 * BigInt yang tidak bisa di-JSON.stringify. Gunakan serializeBigInt() helper.
 *
 * POST /api/chatbot/context          — single-call: ticket + KB + similar (parallel)
 * POST /api/chatbot/log-interaction  — simpan log interaksi chatbot
 * GET  /api/chatbot/stats            — statistik usage chatbot
 * GET  /api/chatbot/history/:ticketId — history interaksi per tiket
 */

"use strict";

const router      = require("express").Router();
const prisma      = require("../database/client");
const TicketModel = require("../models/ticket.model");
const { validateApiKey }          = require("../middleware/auth");
const { getTicketMode }           = require("../utils/ticket");
// serializeBigInt: gunakan serialize() lokal di bawah — lebih efisien

// ─── Helper: serialize Prisma $queryRaw result (handle BigInt) ────────────────
function serialize(data) {
  return JSON.parse(JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  ));
}

// POST /api/chatbot/context
// Equivalent dengan Sequelize findByPk + sequelize.query untuk KB + similar
router.post("/context", validateApiKey, async (req, res) => {
  try {
    const { ticketId, keywords, needsTicket, needsKB, needsSimilar } = req.body;

    const results = { ticket: null, runbooks: [], similarTickets: [] };
    const tasks   = [];

    // ── Parallel Task 1: Ticket ──────────────────────────────────────────────
    if (needsTicket && ticketId) {
      tasks.push((async () => {
        try {
          const t = await TicketModel.findById(ticketId);
          if (!t) { console.warn(`[CHATBOT] Ticket #${ticketId} not found`); return; }

          // FIX: sertakan title dari formFields agar N8N bisa tampilkan judul tiket
          const ff = t.formFields || t.form_fields || {};
          const title = t.type === "INCIDENT"
            ? (ff["Incident Information"] || ff["Issue"] || "Incident Report")
            : (ff["Issue"] || "Ticket Support");

          results.ticket = {
            id:                   t.id,
            type:                 t.type,
            title,                                        // FIX: tambah title
            status:               t.statusPengusulan,
            mode:                 getTicketMode(t),
            timelineActionTaken:  t.timelineActionTaken  || null,
            timelineTindakLanjut: t.timelineTindakLanjut || null,
            summaryTicket:        t.summaryTicket        || null,  // null-safe
            rootCause:            t.rootCause            || null,  // FIX: null-safe
            formFields:           t.formFields,
            assignee:             t.assignee             || [],
            evidenceAttachment:   t.evidenceAttachment   || [],
            discord:              t.discord              || {},
            createdAt:            t.createdAt,
            resolvedAt:           t.resolvedAt           || null,
          };
          console.log(`[CHATBOT] Ticket #${ticketId} loaded: type=${t.type}, status=${t.statusPengusulan}, hasSummary=${!!t.summaryTicket}, hasRootCause=${!!t.rootCause}`);
        } catch (err) {
          console.error(`[CHATBOT] Ticket context error:`, err.message);
        }
      })());
    }

    // ── Parallel Task 2: Knowledge Base ──────────────────────────────────────
    // Equivalent dengan Sequelize query: array overlap + full-text fallback
    if (needsKB && Array.isArray(keywords) && keywords.length > 0) {
      tasks.push((async () => {
        try {
          const kwClean    = keywords.slice(0, 8).map((k) => String(k).toLowerCase().trim()).filter(Boolean);
          const searchText = kwClean.join(" ");

          const rows = await prisma.$queryRaw`
            SELECT id, category, title, content, keywords, usage_count, success_rate
            FROM knowledge_base
            WHERE (
              keywords && ${kwClean}::text[]
              OR to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${searchText})
            )
            ORDER BY
              CASE WHEN keywords && ${kwClean}::text[] THEN 0 ELSE 1 END,
              usage_count DESC, success_rate DESC
            LIMIT 4
          `;
          results.runbooks = serialize(rows);
        } catch (err) {
          console.error("[CHATBOT] KB context error:", err.message);
          results.runbooks = [];
        }
      })());
    }

    // ── Parallel Task 3: Similar Tickets ─────────────────────────────────────
    // Equivalent dengan Sequelize query: array overlap + ILIKE fallback
    if (needsSimilar && Array.isArray(keywords) && keywords.length > 0) {
      tasks.push((async () => {
        try {
          const kwClean  = keywords.slice(0, 8).map((k) => String(k).toLowerCase().trim()).filter(Boolean);
          const likeText = `%${kwClean[0]}%`;

          const rows = await prisma.$queryRaw`
            SELECT id, type, status_pengusulan, form_fields, summary_ticket, root_cause,
                   search_keywords, resolved_at, created_at
            FROM tickets
            WHERE
              status_pengusulan IN ('DONE', 'RESOLVED')
              AND (
                search_keywords  && ${kwClean}::text[]
                OR form_fields::text            ILIKE ${likeText}
                OR COALESCE(summary_ticket, '') ILIKE ${likeText}
                OR COALESCE(root_cause, '')     ILIKE ${likeText}
              )
            ORDER BY
              CASE WHEN search_keywords && ${kwClean}::text[] THEN 0 ELSE 1 END,
              updated_at DESC
            LIMIT 5
          `;

          results.similarTickets = serialize(rows).map((t) => ({
            ticketId:  t.id,
            type:      t.type,
            issue:     t.type === "INCIDENT"
              ? (t.form_fields?.["Incident Information"] || t.form_fields?.["Issue"] || "N/A")
              : (t.form_fields?.["Issue"] || "N/A"),
            summary:   t.summary_ticket,
            rootCause: t.root_cause,
            keywords:  t.search_keywords,
            resolvedAt: t.resolved_at,
          }));
        } catch (err) {
          console.error("[CHATBOT] Similar tickets error:", err.message);
          results.similarTickets = [];
        }
      })());
    }

    await Promise.all(tasks);
    res.json({ success: true, ...results });
  } catch (err) {
    console.error("[CHATBOT] Context error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chatbot/log-interaction
// Equivalent dengan Sequelize query INSERT INTO chatbot_interactions
router.post("/log-interaction", validateApiKey, async (req, res) => {
  try {
    const { ticketId, userId, userName, question, answer, intent, contextUsed, processingTimeMs } = req.body;
    if (!userId || !userName || !question || !answer) {
      return res.status(400).json({ error: "userId, userName, question, answer required" });
    }

    // Gunakan parameterized query — aman dari SQL injection
    const result = await prisma.$queryRaw`
      INSERT INTO chatbot_interactions
        (ticket_id, user_id, user_name, question, answer, intent, context_used, groq_model, processing_time_ms, created_at)
      VALUES
        (${ticketId || null}::integer,
         ${String(userId)},
         ${String(userName)},
         ${String(question)},
         ${String(answer)},
         ${intent || "general"},
         ${JSON.stringify(contextUsed || {})}::jsonb,
         ${"llama-3.3-70b-versatile"},
         ${processingTimeMs || 0},
         NOW())
      RETURNING id
    `;

    res.json({ success: true, interactionId: serialize(result[0])?.id });
  } catch (err) {
    console.error("[CHATBOT] Log-interaction error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chatbot/stats
// Equivalent dengan Sequelize.query GROUP BY intent
router.get("/stats", validateApiKey, async (req, res) => {
  try {
    const statistics = await prisma.$queryRaw`
      SELECT intent,
             COUNT(*)               AS intent_count,
             AVG(processing_time_ms) AS avg_processing_time
      FROM chatbot_interactions
      GROUP BY intent
      ORDER BY intent_count DESC
    `;

    const recentInteractions = await prisma.$queryRaw`
      SELECT user_name, intent, created_at
      FROM chatbot_interactions
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // FIX: serialize BigInt sebelum JSON response
    res.json({
      success:            true,
      statistics:         serialize(statistics),
      recentInteractions: serialize(recentInteractions),
    });
  } catch (err) {
    console.error("[CHATBOT] Stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chatbot/history/:ticketId
router.get("/history/:ticketId", validateApiKey, async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const interactions = await prisma.$queryRaw`
      SELECT * FROM chatbot_interactions
      WHERE ticket_id = ${ticketId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const data = serialize(interactions);
    res.json({ success: true, count: data.length, interactions: data });
  } catch (err) {
    console.error("[CHATBOT] History error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;