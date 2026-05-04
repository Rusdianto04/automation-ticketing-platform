"use strict";

const router      = require("express").Router();
const prisma      = require("../database/client");
const TicketModel = require("../models/ticket.model");
const { validateApiKey } = require("../middleware/auth");
const { getTicketMode }  = require("../utils/ticket");

function serialize(data) {
  return JSON.parse(JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  ));
}

// ---------------------------------------------------------------------------
// POST /api/chatbot/context
// ---------------------------------------------------------------------------
router.post("/context", validateApiKey, async (req, res) => {
  try {
    const { ticketId, keywords, needsTicket, needsKB, needsSimilar } = req.body;

    const results = { ticket: null, runbooks: [], similarTickets: [] };
    const tasks   = [];

    // ── Task 1: Ticket ───────────────────────────────────────────────────────
    if (needsTicket && ticketId) {
      tasks.push((async () => {
        try {
          const t = await TicketModel.findById(ticketId);
          if (!t) { console.warn(`[CHATBOT] Ticket #${ticketId} not found`); return; }

          const ff = t.formFields || t.form_fields || {};
          const title = t.type === "INCIDENT"
            ? (ff["Incident Information"] || ff["Issue"] || "Incident Report")
            : (ff["Issue"] || "Ticket Support");

          results.ticket = {
            id:                   t.id,
            type:                 t.type,
            title,
            status:               t.statusPengusulan,
            mode:                 getTicketMode(t),
            timelineActionTaken:  t.timelineActionTaken  || null,
            timelineTindakLanjut: t.timelineTindakLanjut || null,
            summaryTicket:        t.summaryTicket        || null,
            rootCause:            t.rootCause            || null,
            formFields:           t.formFields,
            assignee:             t.assignee             || [],
            evidenceAttachment:   t.evidenceAttachment   || [],
            discord:              t.discord              || {},
            createdAt:            t.createdAt,
            resolvedAt:           t.resolvedAt           || null,
          };
        } catch (err) {
          console.error(`[CHATBOT] Ticket context error:`, err.message);
        }
      })());
    }

    // ── Task 2: Knowledge Base ───────────────────────────────────────────────
    if (needsKB && Array.isArray(keywords) && keywords.length > 0) {
      tasks.push((async () => {
        try {
          const kwClean    = keywords.slice(0, 8).map((k) => String(k).toLowerCase().trim()).filter(Boolean);
          const searchText = kwClean.join(" ");
          const ilikeParts = kwClean.map((kw) => `(title ILIKE '%${kw.replace(/'/g, "''")}%' OR content ILIKE '%${kw.replace(/'/g, "''")}%')`).join(" OR ");

          let rows = [];
          try {
            rows = serialize(await prisma.$queryRawUnsafe(`
              SELECT id, category, title, content, keywords, usage_count, success_rate
              FROM knowledge_base
              WHERE
                to_tsvector('english', title || ' ' || content)
                  @@ plainto_tsquery('english', $1)
              ORDER BY usage_count DESC, success_rate DESC
              LIMIT 4
            `, searchText));
          } catch (_) {}
          if (rows.length === 0 && ilikeParts) {
            try {
              rows = serialize(await prisma.$queryRawUnsafe(`
                SELECT id, category, title, content, keywords, usage_count, success_rate
                FROM knowledge_base
                WHERE ${ilikeParts}
                ORDER BY usage_count DESC, success_rate DESC
                LIMIT 4
              `));
            } catch (e2) {
              console.error("[CHATBOT] KB ILIKE fallback error:", e2.message);
            }
          }

          results.runbooks = rows;
        } catch (err) {
          console.error("[CHATBOT] KB context error:", err.message);
          results.runbooks = [];
        }
      })());
    }

    // ── Task 3: Similar Tickets ──────────────────────────────────────────────
    if (needsSimilar && Array.isArray(keywords) && keywords.length > 0) {
      tasks.push((async () => {
        try {
          const kwClean = keywords.slice(0, 8)
            .map((k) => String(k).toLowerCase().trim())
            .filter((k) => k.length > 2);

          if (kwClean.length === 0) return;
          const anyConditions = kwClean
            .map((kw) => `$${1}::varchar = ANY(search_keywords)`.replace("$1", `'${kw.replace(/'/g, "''")}'`))
            .join(" OR ");

          const ilikeParts = kwClean
            .map((kw) => `(form_fields->>'Issue' ILIKE '%${kw.replace(/'/g, "''")}%' OR COALESCE(summary_ticket,'') ILIKE '%${kw.replace(/'/g, "''")}%')`)
            .join(" OR ");

          const excludeClause = ticketId ? `AND id != ${Number(ticketId)}` : "";
          let rows = [];

          // Layer 1: ANY match pada search_keywords
          try {
            rows = serialize(await prisma.$queryRawUnsafe(`
              SELECT id, type, status_pengusulan, form_fields, summary_ticket, root_cause,
                     search_keywords, resolved_at, created_at
              FROM tickets
              WHERE status_pengusulan IN ('DONE','RESOLVED')
                ${excludeClause}
                AND (${anyConditions})
              ORDER BY updated_at DESC
              LIMIT 5
            `));
          } catch (_) {}

          // Layer 2: ILIKE fallback
          if (rows.length < 2 && ilikeParts) {
            try {
              const ikeRows = serialize(await prisma.$queryRawUnsafe(`
                SELECT id, type, status_pengusulan, form_fields, summary_ticket, root_cause,
                       search_keywords, resolved_at, created_at
                FROM tickets
                WHERE status_pengusulan IN ('DONE','RESOLVED')
                  ${excludeClause}
                  AND (${ilikeParts})
                ORDER BY updated_at DESC
                LIMIT 5
              `));
              const seen = new Set(rows.map((r) => r.id));
              for (const r of ikeRows) if (!seen.has(r.id)) rows.push(r);
            } catch (e2) {
              console.error("[CHATBOT] Similar ILIKE fallback error:", e2.message);
            }
          }

          results.similarTickets = rows.slice(0, 5).map((t) => ({
            ticketId:  t.id,
            type:      t.type,
            issue:     t.type === "INCIDENT"
              ? (t.form_fields?.["Incident Information"] || t.form_fields?.["Issue"] || "N/A")
              : (t.form_fields?.["Issue"] || "N/A"),
            summary:    t.summary_ticket,
            rootCause:  t.root_cause,
            keywords:   t.search_keywords,
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
    console.error("[CHATBOT] Context error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/chatbot/log-interaction
// ---------------------------------------------------------------------------
router.post("/log-interaction", validateApiKey, async (req, res) => {
  try {
    const { ticketId, userId, userName, question, answer, intent, contextUsed, processingTimeMs } = req.body;
    if (!userId || !userName || !question || !answer) {
      return res.status(400).json({ error: "userId, userName, question, answer required" });
    }

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

// ---------------------------------------------------------------------------
// GET /api/chatbot/stats
// ---------------------------------------------------------------------------
router.get("/stats", validateApiKey, async (req, res) => {
  try {
    const [statistics, recentInteractions] = await Promise.all([
      prisma.$queryRaw`
        SELECT intent,
               COUNT(*)::int               AS intent_count,
               AVG(processing_time_ms)::float AS avg_processing_time
        FROM chatbot_interactions
        GROUP BY intent
        ORDER BY intent_count DESC
      `,
      prisma.$queryRaw`
        SELECT user_name, intent, created_at
        FROM chatbot_interactions
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ]);

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

// ---------------------------------------------------------------------------
// GET /api/chatbot/history/:ticketId
// ---------------------------------------------------------------------------
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