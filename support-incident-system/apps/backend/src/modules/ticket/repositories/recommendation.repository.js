"use strict";

/**
 * src/modules/ticket/repositories/recommendation.repository.js
 *
 * All DB queries used by recommendation.service.js.
 * Receives pre-built SQL clauses (typeFilter, excludeClause) from the service
 * since the service builds complex dynamic conditions from its scoring logic.
 */

const prisma  = require("../../../infrastructure/prisma/client");
const { serialize } = require("../../../common/helpers");

const SELECT_TICKET_COLS = `
  id, type, form_fields, summary_ticket, root_cause,
  timeline_tindak_lanjut, timeline_action_taken,
  search_keywords, status_pengusulan, resolved_at, updated_at, discord
`;

/**
 * Layer 1 + 2: keyword ANY match → ILIKE fallback.
 * @param {string[]} keywords
 * @param {string}   typeFilter    - raw SQL clause e.g. "AND type = 'TICKETING'"
 * @param {string}   excludeClause - raw SQL clause e.g. "AND id != 42"
 * @param {number}   limit
 */
async function findResolvedByKeywords({ keywords, typeFilter = "", excludeClause = "", limit = 9 }) {
  const kwClean = (keywords || []).slice(0, 10)
    .map((k) => String(k).trim().toLowerCase())
    .filter((k) => k.length > 2);

  if (kwClean.length === 0) return [];

  const anyConditions = kwClean
    .map((kw) => `'${kw.replace(/'/g, "''")}'::varchar = ANY(search_keywords)`)
    .join(" OR ");
  const ilikeParts = kwClean.slice(0, 4)
    .map((kw) => `form_fields::text ILIKE '%${kw.replace(/'/g, "''")}%'`)
    .join(" OR ");

  let rows = [];

  // Layer 1: ANY keyword match
  try {
    rows = serialize(await prisma.$queryRawUnsafe(`
      SELECT ${SELECT_TICKET_COLS}
      FROM tickets
      WHERE status_pengusulan IN ('DONE','RESOLVED')
        ${typeFilter}
        ${excludeClause}
        AND (${anyConditions})
      ORDER BY updated_at DESC
      LIMIT ${Number(limit)}
    `));
  } catch (err) {
    console.warn("[RECOMMEND_REPO] Layer-1 ANY error:", err.message);
  }

  // Layer 2: ILIKE fallback
  if (rows.length < 2 && ilikeParts) {
    try {
      const ikeRows = serialize(await prisma.$queryRawUnsafe(`
        SELECT ${SELECT_TICKET_COLS}
        FROM tickets
        WHERE status_pengusulan IN ('DONE','RESOLVED')
          ${typeFilter}
          ${excludeClause}
          AND (${ilikeParts})
        ORDER BY updated_at DESC
        LIMIT ${Math.ceil(Number(limit) * 2 / 3)}
      `));
      const seen = new Set(rows.map((r) => r.id));
      for (const r of ikeRows) if (!seen.has(r.id)) rows.push(r);
    } catch (err) {
      console.warn("[RECOMMEND_REPO] Layer-2 ILIKE error:", err.message);
    }
  }

  return rows;
}

/**
 * Layer 3: PostgreSQL full-text search fallback.
 * @param {string} searchText    - space-joined keywords
 * @param {string} typeFilter    - raw SQL clause
 * @param {string} excludeClause - raw SQL clause
 * @param {number} limit
 */
async function findResolvedByFullText({ searchText, typeFilter = "", excludeClause = "", limit = 6 }) {
  if (!searchText || searchText.trim().length < 3) return [];
  try {
    return serialize(await prisma.$queryRawUnsafe(`
      SELECT ${SELECT_TICKET_COLS}
      FROM tickets
      WHERE status_pengusulan IN ('DONE','RESOLVED')
        ${typeFilter}
        ${excludeClause}
        AND to_tsvector('simple',
          COALESCE(form_fields->>'Issue','') || ' ' ||
          COALESCE(form_fields->>'Incident Information','') || ' ' ||
          COALESCE(summary_ticket,'')
        ) @@ plainto_tsquery('simple', $1)
      ORDER BY updated_at DESC
      LIMIT ${Number(limit)}
    `, searchText));
  } catch (err) {
    console.warn("[RECOMMEND_REPO] Layer-3 FTS error:", err.message);
    return [];
  }
}

module.exports = { findResolvedByKeywords, findResolvedByFullText };
