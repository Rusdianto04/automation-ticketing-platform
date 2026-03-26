/**
 * src/routes/knowledge.route.js
 * Knowledge Base API Routes
 *
 * Endpoint ini diakses oleh N8N untuk mencari runbook & solusi historis.
 * Semua query menggunakan PostgreSQL $queryRaw Prisma (parameterized — aman dari SQL injection).
 *
 * GET  /api/knowledge/search-runbooks  — search KB by keywords + category
 * POST /api/knowledge/search           — search similar resolved tickets
 * POST /api/knowledge/runbook          — tambah runbook baru
 * GET  /api/knowledge/runbooks         — list semua runbook
 */

"use strict";

const router = require("express").Router();
const prisma = require("../database/client");
const { validateApiKey } = require("../middleware/auth");
const TicketModel = require("../models/ticket.model");
const { getTicketTitle } = require("../utils/ticket");

// GET /api/knowledge/search-runbooks
router.get("/search-runbooks", validateApiKey, async (req, res) => {
  try {
    const { keywords, category, limit = 5 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 5, 20);

    let runbooks;

    if (keywords) {
      const kwArray    = keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
      const searchText = kwArray.join(" ");

      if (category) {
        runbooks = await prisma.$queryRaw`
          SELECT id, category, title, content, keywords, usage_count, success_rate
          FROM knowledge_base
          WHERE
            category = ${category}
            AND (
              keywords && ${kwArray}::text[]
              OR to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${searchText})
            )
          ORDER BY usage_count DESC, success_rate DESC
          LIMIT ${safeLimit}
        `;
      } else {
        runbooks = await prisma.$queryRaw`
          SELECT id, category, title, content, keywords, usage_count, success_rate
          FROM knowledge_base
          WHERE
            keywords && ${kwArray}::text[]
            OR to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${searchText})
          ORDER BY usage_count DESC, success_rate DESC
          LIMIT ${safeLimit}
        `;
      }
    } else if (category) {
      runbooks = await prisma.$queryRaw`
        SELECT id, category, title, content, keywords, usage_count, success_rate
        FROM knowledge_base
        WHERE category = ${category}
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ${safeLimit}
      `;
    } else {
      runbooks = await prisma.$queryRaw`
        SELECT id, category, title, content, keywords, usage_count, success_rate
        FROM knowledge_base
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ${safeLimit}
      `;
    }

    res.json({ success: true, count: runbooks.length, runbooks });
  } catch (err) {
    console.error("[KNOWLEDGE] Search-runbooks error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/knowledge/search
router.post("/search", validateApiKey, async (req, res) => {
  try {
    const { keywords, limit = 5 } = req.body;
    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: "keywords array required" });
    }

    const safeLimit = Math.min(parseInt(limit) || 5, 10);
    const tickets   = await TicketModel.findSimilar(keywords, safeLimit);

    const results = tickets.map((t) => ({
      ticketId:  t.id,
      type:      t.type,
      issue:     getTicketTitle(t),
      summary:   t.summaryTicket,
      rootCause: t.rootCause,
      timeline:  t.type === "INCIDENT" ? t.timelineActionTaken : t.timelineTindakLanjut,
      keywords:  t.searchKeywords,
      resolvedAt: t.resolvedAt,
    }));

    res.json({ success: true, count: results.length, tickets: results });
  } catch (err) {
    console.error("[KNOWLEDGE] Search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/knowledge/runbook
router.post("/runbook", validateApiKey, async (req, res) => {
  try {
    const { category, title, content, keywords, createdBy } = req.body;
    if (!category || !title || !content) {
      return res.status(400).json({ error: "category, title, content required" });
    }

    const kw = Array.isArray(keywords) ? keywords : [];
    const result = await prisma.$queryRaw`
      INSERT INTO knowledge_base (category, title, content, keywords, created_by)
      VALUES (${category}, ${title}, ${content}, ${kw}::text[], ${createdBy || "system"})
      RETURNING id
    `;

    res.json({ success: true, runbookId: result[0]?.id });
  } catch (err) {
    console.error("[KNOWLEDGE] Runbook create error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/knowledge/runbooks
router.get("/runbooks", validateApiKey, async (req, res) => {
  try {
    const { category, keyword, limit = 10 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 10, 50);

    let runbooks;

    if (category && keyword) {
      runbooks = await prisma.$queryRaw`
        SELECT * FROM knowledge_base
        WHERE category = ${category} AND ${keyword} = ANY(keywords)
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ${safeLimit}
      `;
    } else if (category) {
      runbooks = await prisma.$queryRaw`
        SELECT * FROM knowledge_base
        WHERE category = ${category}
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ${safeLimit}
      `;
    } else if (keyword) {
      runbooks = await prisma.$queryRaw`
        SELECT * FROM knowledge_base
        WHERE ${keyword} = ANY(keywords)
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ${safeLimit}
      `;
    } else {
      runbooks = await prisma.$queryRaw`
        SELECT * FROM knowledge_base
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ${safeLimit}
      `;
    }

    res.json({ success: true, count: runbooks.length, runbooks });
  } catch (err) {
    console.error("[KNOWLEDGE] Runbooks error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;