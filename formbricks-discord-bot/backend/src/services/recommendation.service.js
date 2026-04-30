/**
 * src/services/recommendation.service.js
 * Recommendation Engine — NEW (v9)
 *
 * Provides similarity search and solution recommendations for:
 *   - Support tickets (TICKETING)
 *   - Incident tickets (INCIDENT)
 *
 * Strategy (layered — no external AI required):
 *   1. Keyword overlap against tickets.search_keywords (existing DB column)
 *   2. Full-text search against form_fields->>'Issue' / form_fields->>'Incident Information'
 *   3. Knowledge base runbook lookup
 *
 * Returns a structured RecommendationResult that callers attach to ticket
 * responses / Discord messages WITHOUT modifying the existing ticket creation flow.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  IMPORTANT: This service is READ-ONLY on the tickets table.     │
 * │  It never writes to tickets. Callers decide what to attach.     │
 * └─────────────────────────────────────────────────────────────────┘
 */

"use strict";

const prisma = require("../database/client");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Tokenise a raw text string into lowercased, de-stopworded keywords.
 * Reuses the same stopword list as ticket.route.js POST /create.
 */
const STOPWORDS = new Set([
  "yang","untuk","dari","dengan","adalah","pada","ke","di","dan","atau",
  "ini","itu","ada","tidak","bisa","cara","saya","kami","sudah","belum",
  "akan","ini","the","is","in","on","at","to","of","a","an","and","or",
]);

function tokenize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Simple keyword-overlap score: |intersection| / |union|  (Jaccard-like)
 */
function overlapScore(kw1 = [], kw2 = []) {
  if (!kw1.length || !kw2.length) return 0;
  const s1 = new Set(kw1);
  const s2 = new Set(kw2);
  let inter = 0;
  for (const k of s1) if (s2.has(k)) inter++;
  const union = s1.size + s2.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ---------------------------------------------------------------------------
// Core: findSimilarTickets
// ---------------------------------------------------------------------------

/**
 * Find resolved tickets similar to the incoming issue.
 *
 * @param {object} opts
 * @param {string}   opts.issueText   — free-text description of the problem
 * @param {string[]} [opts.keywords]  — optional pre-tokenized keywords
 * @param {string}   [opts.type]      — "TICKETING" | "INCIDENT" | null (both)
 * @param {number}   [opts.limit=5]
 * @returns {Promise<SimilarTicket[]>}
 */
async function findSimilarTickets({ issueText = "", keywords = [], type = null, limit = 5 }) {
  const safeLimit = Math.min(Number(limit) || 5, 10);

  // Build keyword set from both sources
  const derivedKw  = tokenize(issueText);
  const allKw      = [...new Set([...derivedKw, ...keywords.map((k) => k.toLowerCase())])];

  if (allKw.length === 0) return [];

  // ── Layer 1: keyword array overlap (fast, indexed) ───────────────────────
  let rows = [];
  try {
    const typeFilter = type ? `AND type = '${type}'` : "";
    rows = await prisma.$queryRawUnsafe(`
      SELECT
        id, type, form_fields, summary_ticket, root_cause,
        timeline_tindak_lanjut, timeline_action_taken,
        search_keywords, status_pengusulan, resolved_at, updated_at
      FROM tickets
      WHERE search_keywords && $1::text[]
        AND status_pengusulan IN ('DONE','RESOLVED')
        ${typeFilter}
      ORDER BY updated_at DESC
      LIMIT $2
    `, allKw, safeLimit * 3);  // over-fetch then re-rank
  } catch (err) {
    console.warn("[RECOMMEND] Layer-1 query error:", err.message);
  }

  // ── Layer 2: FTS fallback if layer 1 yields < 2 results ─────────────────
  if (rows.length < 2 && issueText.trim().length > 3) {
    try {
      const searchText = allKw.join(" ");
      const typeFilter = type ? `AND type = '${type}'` : "";
      const ftsRows = await prisma.$queryRawUnsafe(`
        SELECT
          id, type, form_fields, summary_ticket, root_cause,
          timeline_tindak_lanjut, timeline_action_taken,
          search_keywords, status_pengusulan, resolved_at, updated_at
        FROM tickets
        WHERE status_pengusulan IN ('DONE','RESOLVED')
          ${typeFilter}
          AND (
            to_tsvector('english', COALESCE(form_fields->>'Issue','') || ' ' ||
                                   COALESCE(form_fields->>'Incident Information','') || ' ' ||
                                   COALESCE(summary_ticket,''))
            @@ plainto_tsquery('english', $1)
          )
        ORDER BY updated_at DESC
        LIMIT $2
      `, searchText, safeLimit * 2);

      // Merge, deduplicate
      const seen = new Set(rows.map((r) => r.id));
      for (const r of ftsRows) if (!seen.has(r.id)) rows.push(r);
    } catch (err) {
      console.warn("[RECOMMEND] Layer-2 FTS error:", err.message);
    }
  }

  if (rows.length === 0) return [];

  // ── Re-rank by keyword overlap score ────────────────────────────────────
  const scored = rows.map((r) => {
    const dbKw = Array.isArray(r.search_keywords) ? r.search_keywords : [];
    const score = overlapScore(allKw, dbKw);
    const ff    = (typeof r.form_fields === "string" ? JSON.parse(r.form_fields) : r.form_fields) || {};
    const title = r.type === "INCIDENT"
      ? (ff["Incident Title"] || ff["Incident Information"] || "Incident")
      : (ff["Issue"] || "Support Ticket");

    return {
      ticketId:   Number(r.id),
      type:       r.type,
      title,
      summary:    r.summary_ticket   || null,
      rootCause:  r.root_cause       || null,
      timeline:   r.type === "INCIDENT" ? r.timeline_action_taken : r.timeline_tindak_lanjut,
      resolvedAt: r.resolved_at,
      score,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);
}

// ---------------------------------------------------------------------------
// Core: findRunbooks
// ---------------------------------------------------------------------------

/**
 * Search knowledge_base for relevant runbooks/articles.
 *
 * @param {string[]} keywords
 * @param {number}   [limit=3]
 * @returns {Promise<Runbook[]>}
 */
async function findRunbooks(keywords = [], limit = 3) {
  if (!keywords.length) return [];
  const safeLimit = Math.min(Number(limit) || 3, 10);

  try {
    const searchText = keywords.join(" ");
    const runbooks = await prisma.$queryRaw`
      SELECT id, category, title, content, keywords, usage_count, success_rate
      FROM knowledge_base
      WHERE
        keywords && ${keywords}::text[]
        OR to_tsvector('english', title || ' ' || content)
           @@ plainto_tsquery('english', ${searchText})
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT ${safeLimit}
    `;
    return runbooks.map((r) => ({
      id:          Number(r.id),
      category:    r.category,
      title:       r.title,
      content:     r.content,
      successRate: Number(r.success_rate),
      usageCount:  Number(r.usage_count),
    }));
  } catch (err) {
    console.warn("[RECOMMEND] findRunbooks error:", err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public: getRecommendation
// ---------------------------------------------------------------------------

/**
 * Main entry point. Call this AFTER a ticket is created but BEFORE responding.
 * This function is safe — all DB errors are caught, returning empty result.
 *
 * @param {object} opts
 * @param {string}   opts.issueText
 * @param {string[]} [opts.keywords]
 * @param {string}   [opts.type]      "TICKETING" | "INCIDENT"
 * @returns {Promise<RecommendationResult>}
 */
async function getRecommendation({ issueText = "", keywords = [], type = null }) {
  try {
    const [similarTickets, runbooks] = await Promise.all([
      findSimilarTickets({ issueText, keywords, type, limit: 3 }),
      findRunbooks(
        keywords.length > 0 ? keywords : tokenize(issueText),
        3
      ),
    ]);

    const hasSimilar  = similarTickets.length > 0;
    const hasRunbooks = runbooks.length > 0;
    const hasAny      = hasSimilar || hasRunbooks;

    return {
      found:          hasAny,
      similarTickets,
      runbooks,
      // Convenience: best single recommendation
      topSuggestion: hasSimilar
        ? {
            source:    "ticket",
            ticketId:  similarTickets[0].ticketId,
            title:     similarTickets[0].title,
            summary:   similarTickets[0].summary,
            rootCause: similarTickets[0].rootCause,
            timeline:  similarTickets[0].timeline,
          }
        : hasRunbooks
        ? {
            source:   "runbook",
            title:    runbooks[0].title,
            category: runbooks[0].category,
            content:  runbooks[0].content,
          }
        : null,
    };
  } catch (err) {
    console.error("[RECOMMEND] getRecommendation fatal error:", err.message);
    // Always return a safe empty result — NEVER break the caller
    return { found: false, similarTickets: [], runbooks: [], topSuggestion: null };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { getRecommendation, findSimilarTickets, findRunbooks, tokenize };