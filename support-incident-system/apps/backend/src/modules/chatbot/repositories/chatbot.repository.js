"use strict";

/**
 * src/modules/chatbot/repositories/chatbot.repository.js
 *
 * Single source of truth for all DB access in the chatbot module.
 * All Prisma calls from chatbot.route.js and knowledge.route.js live here.
 * Routes call this repo — never call Prisma directly.
 */

const prisma  = require("../../../infrastructure/prisma/client");
const { serialize } = require("../../../common/helpers");

// ─── Knowledge Base ───────────────────────────────────────────────────────────

/**
 * Search knowledge base using full-text search + keyword array match.
 * Falls back to ILIKE if FTS returns nothing.
 */
async function searchKnowledge({ keywords, category, limit = 5 }) {
  const safeLimit = Math.min(parseInt(limit) || 5, 20);
  const kwClean   = (keywords || []).slice(0, 8)
    .map((k) => String(k).toLowerCase().trim())
    .filter(Boolean);
  const searchText = kwClean.join(" ");

  let rows = [];

  if (kwClean.length > 0 && category) {
    rows = await prisma.$queryRaw`
      SELECT id, category, title, content, keywords, usage_count, success_rate
      FROM knowledge_base
      WHERE
        category = ${category}
        AND (
          keywords && ${kwClean}::varchar[]
          OR to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${searchText})
        )
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  } else if (kwClean.length > 0) {
    rows = await prisma.$queryRaw`
      SELECT id, category, title, content, keywords, usage_count, success_rate
      FROM knowledge_base
      WHERE
        keywords && ${kwClean}::varchar[]
        OR to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${searchText})
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  } else if (category) {
    rows = await prisma.$queryRaw`
      SELECT id, category, title, content, keywords, usage_count, success_rate
      FROM knowledge_base
      WHERE category = ${category}
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT id, category, title, content, keywords, usage_count, success_rate
      FROM knowledge_base
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  }

  return serialize(rows);
}

/**
 * Full-text + ILIKE knowledge search used by chatbot context endpoint.
 * Returns up to 4 results; falls back to ILIKE if FTS is empty.
 */
async function searchKnowledgeForChatbot({ keywords }) {
  const kwClean    = (keywords || []).slice(0, 8)
    .map((k) => String(k).toLowerCase().trim())
    .filter(Boolean);
  const searchText = kwClean.join(" ");
  const ilikeParts = kwClean
    .map((kw) => `(title ILIKE '%${kw.replace(/'/g, "''")}%' OR content ILIKE '%${kw.replace(/'/g, "''")}%')`)
    .join(" OR ");

  let rows = [];
  try {
    rows = serialize(await prisma.$queryRaw`
      SELECT id, category, title, content, keywords, usage_count, success_rate
      FROM knowledge_base
      WHERE to_tsvector('english', title || ' ' || content)
              @@ plainto_tsquery('english', ${searchText})
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT 4
    `);
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
    } catch (_) {}
  }

  return rows;
}

/**
 * List all runbooks with optional category + keyword filter.
 */
async function listRunbooks({ category, keyword, limit = 10 }) {
  const safeLimit = Math.min(parseInt(limit) || 10, 50);
  let rows;

  if (category && keyword) {
    rows = await prisma.$queryRaw`
      SELECT * FROM knowledge_base
      WHERE category = ${category} AND ${keyword} = ANY(keywords)
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  } else if (category) {
    rows = await prisma.$queryRaw`
      SELECT * FROM knowledge_base
      WHERE category = ${category}
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  } else if (keyword) {
    rows = await prisma.$queryRaw`
      SELECT * FROM knowledge_base
      WHERE ${keyword} = ANY(keywords)
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT * FROM knowledge_base
      ORDER BY usage_count DESC, success_rate DESC
      LIMIT ${safeLimit}
    `;
  }

  return serialize(rows);
}

/**
 * Create a new knowledge base runbook entry.
 */
async function createRunbook({ category, title, content, keywords, createdBy }) {
  const kw = Array.isArray(keywords) ? keywords : [];
  const result = await prisma.$queryRaw`
    INSERT INTO knowledge_base (category, title, content, keywords, created_by)
    VALUES (${category}, ${title}, ${content}, ${kw}::varchar[], ${createdBy || "system"})
    RETURNING id
  `;
  return serialize(result)[0];
}

// ─── Chatbot Interactions ─────────────────────────────────────────────────────

/**
 * Log a chatbot interaction (Q&A pair).
 */
async function logInteraction({
  ticketId, userId, userName, question, answer, intent, contextUsed, processingTimeMs,
}) {
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
  return serialize(result)[0];
}

/**
 * Get aggregated chatbot usage statistics.
 */
async function getStats() {
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
  return { statistics: serialize(statistics), recentInteractions: serialize(recentInteractions) };
}

/**
 * Get interaction history for a specific ticket.
 */
async function getHistoryByTicketId(ticketId, limit = 50) {
  const rows = await prisma.$queryRaw`
    SELECT * FROM chatbot_interactions
    WHERE ticket_id = ${ticketId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return serialize(rows);
}

// ─── Similar Tickets (used by chatbot context) ────────────────────────────────

/**
 * Find resolved tickets similar to given keywords.
 * Uses keyword array match (ANY) first, falls back to ILIKE.
 */
async function findSimilarForChatbot({ keywords, excludeId }) {
  const kwClean = (keywords || []).slice(0, 8)
    .map((k) => String(k).toLowerCase().trim())
    .filter((k) => k.length > 2);

  if (kwClean.length === 0) return [];

  const anyConditions = kwClean
    .map((kw) => `'${kw.replace(/'/g, "''")}'::varchar = ANY(search_keywords)`)
    .join(" OR ");

  const ilikeParts = kwClean
    .map((kw) => `(form_fields->>'Issue' ILIKE '%${kw.replace(/'/g, "''")}%' OR COALESCE(summary_ticket,'') ILIKE '%${kw.replace(/'/g, "''")}%')`)
    .join(" OR ");

  const excludeClause = excludeId ? `AND id != ${Number(excludeId)}` : "";

  let rows = [];
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
    } catch (_) {}
  }

  return rows.slice(0, 5);
}

module.exports = {
  searchKnowledge,
  searchKnowledgeForChatbot,
  listRunbooks,
  createRunbook,
  logInteraction,
  getStats,
  getHistoryByTicketId,
  findSimilarForChatbot,
};