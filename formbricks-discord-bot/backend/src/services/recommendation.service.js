"use strict";

const prisma = require("../database/client");

const STOPWORDS = new Set([
  "yang","untuk","dari","dengan","adalah","pada","ke","di","dan","atau",
  "ini","itu","ada","tidak","bisa","cara","saya","kami","sudah","belum",
  "akan","the","is","in","on","at","to","of","a","an","and","or",
  "ini","kan","ya","nih","dong","aja","sih","juga","lagi","lah",
]);

function tokenize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function overlapScore(kw1 = [], kw2 = []) {
  if (!kw1.length || !kw2.length) return 0;
  const s1 = new Set(kw1);
  const s2 = new Set(kw2);
  let inter = 0;
  for (const k of s1) if (s2.has(k)) inter++;
  const union = s1.size + s2.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Hitung skor kontekstual antara issueText baru dengan tiket lama.
 * Lebih akurat dari pure keyword overlap — mempertimbangkan panjang teks.
 */
function contextScore(issueText, row) {
  const ff     = (typeof row.form_fields === "string" ? JSON.parse(row.form_fields) : row.form_fields) || {};
  const target = [
    ff["Issue"] || "",
    ff["Incident Information"] || "",
    row.summary_ticket || "",
  ].join(" ").toLowerCase();

  const sourceKw = tokenize(issueText);
  const targetKw = tokenize(target);

  if (sourceKw.length === 0 || targetKw.length === 0) return 0;

  const targetSet = new Set(targetKw);
  let hits = 0;
  for (const kw of sourceKw) {
    if (targetSet.has(kw)) hits++;
    // Partial match: jika kw adalah substring dari keyword target
    else if ([...targetSet].some((tk) => tk.includes(kw) || kw.includes(tk))) hits += 0.5;
  }
  return hits / sourceKw.length;
}

// ---------------------------------------------------------------------------
// Core: findSimilarTickets
// FIX v10: Gunakan ANY(ARRAY[...]) bukan && operator (type mismatch)
//          Tambah minimum threshold, excludeId, multi-layer fallback
// ---------------------------------------------------------------------------

async function findSimilarTickets({
  issueText = "",
  keywords  = [],
  type      = null,
  limit     = 5,
  excludeId = null,
}) {
  const safeLimit = Math.min(Number(limit) || 5, 10);

  const derivedKw = tokenize(issueText);
  const allKw     = [...new Set([...derivedKw, ...keywords.map((k) => k.toLowerCase())])];

  if (allKw.length === 0) return [];

  const excludeClause = excludeId ? `AND id != ${Number(excludeId)}` : "";
  const typeFilter    = type ? `AND type = '${type.replace(/'/g, "''")}'` : "";

  // Bangun kondisi ANY per keyword — type-safe untuk varchar[]
  const anyConditions = allKw.slice(0, 8)
    .map((kw) => `'${kw.replace(/'/g, "''")}'  = ANY(search_keywords)`)
    .join(" OR ");

  // Bangun kondisi ILIKE untuk fallback
  const ilikeParts = allKw.slice(0, 5)
    .map((kw) => `(COALESCE(form_fields->>'Issue','') ILIKE '%${kw.replace(/'/g, "''")}%' OR COALESCE(form_fields->>'Incident Information','') ILIKE '%${kw.replace(/'/g, "''")}%' OR COALESCE(summary_ticket,'') ILIKE '%${kw.replace(/'/g, "''")}%')`)
    .join(" OR ");

  let rows = [];

  // ── Layer 1: ANY match pada search_keywords (varchar-safe) ───────────────
  try {
    rows = await prisma.$queryRawUnsafe(`
      SELECT
        id, type, form_fields, summary_ticket, root_cause,
        timeline_tindak_lanjut, timeline_action_taken,
        search_keywords, status_pengusulan, resolved_at, updated_at
      FROM tickets
      WHERE status_pengusulan IN ('DONE','RESOLVED')
        ${excludeClause}
        ${typeFilter}
        AND (${anyConditions})
      ORDER BY updated_at DESC
      LIMIT ${safeLimit * 3}
    `);
  } catch (err) {
    console.warn("[RECOMMEND] Layer-1 ANY error:", err.message);
  }

  // ── Layer 2: ILIKE fallback ───────────────────────────────────────────────
  if (rows.length < 2 && ilikeParts) {
    try {
      const ikeRows = await prisma.$queryRawUnsafe(`
        SELECT
          id, type, form_fields, summary_ticket, root_cause,
          timeline_tindak_lanjut, timeline_action_taken,
          search_keywords, status_pengusulan, resolved_at, updated_at
        FROM tickets
        WHERE status_pengusulan IN ('DONE','RESOLVED')
          ${excludeClause}
          ${typeFilter}
          AND (${ilikeParts})
        ORDER BY updated_at DESC
        LIMIT ${safeLimit * 2}
      `);
      const seen = new Set(rows.map((r) => r.id));
      for (const r of ikeRows) if (!seen.has(r.id)) rows.push(r);
    } catch (err) {
      console.warn("[RECOMMEND] Layer-2 ILIKE error:", err.message);
    }
  }

  // ── Layer 3: FTS fallback bahasa Indonesia ────────────────────────────────
  if (rows.length < 2 && issueText.trim().length > 3) {
    try {
      const searchText = allKw.slice(0, 5).join(" ");
      const ftsRows = await prisma.$queryRawUnsafe(`
        SELECT
          id, type, form_fields, summary_ticket, root_cause,
          timeline_tindak_lanjut, timeline_action_taken,
          search_keywords, status_pengusulan, resolved_at, updated_at
        FROM tickets
        WHERE status_pengusulan IN ('DONE','RESOLVED')
          ${excludeClause}
          ${typeFilter}
          AND to_tsvector('simple',
            COALESCE(form_fields->>'Issue','') || ' ' ||
            COALESCE(form_fields->>'Incident Information','') || ' ' ||
            COALESCE(summary_ticket,'')
          ) @@ plainto_tsquery('simple', $1)
        ORDER BY updated_at DESC
        LIMIT ${safeLimit * 2}
      `, searchText);
      const seen = new Set(rows.map((r) => r.id));
      for (const r of ftsRows) if (!seen.has(r.id)) rows.push(r);
    } catch (err) {
      console.warn("[RECOMMEND] Layer-3 FTS error:", err.message);
    }
  }

  if (rows.length === 0) return [];

  // ── Scoring & ranking ─────────────────────────────────────────────────────
  const MIN_SCORE = 0.1; // threshold minimum — jangan tampilkan jika tidak relevan

  const scored = rows.map((r) => {
    const dbKw  = Array.isArray(r.search_keywords) ? r.search_keywords : [];
    const kwSc  = overlapScore(allKw, dbKw);
    const ctxSc = contextScore(issueText, r);
    const score = Math.max(kwSc, ctxSc * 0.8); // ambil yang terbaik

    const ff    = (typeof r.form_fields === "string" ? JSON.parse(r.form_fields) : r.form_fields) || {};
    const title = r.type === "INCIDENT"
      ? (ff["Incident Title"] || ff["Incident Information"] || "Incident")
      : (ff["Issue"] || "Support Ticket");

    return {
      ticketId:   Number(r.id),
      type:       r.type,
      title,
      summary:    r.summary_ticket              || null,
      rootCause:  r.root_cause                  || null,
      timeline:   r.type === "INCIDENT"
        ? r.timeline_action_taken
        : r.timeline_tindak_lanjut,
      resolvedAt: r.resolved_at,
      score,
    };
  });

  // Filter dengan minimum threshold, sort by score desc
  return scored
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);
}

// ---------------------------------------------------------------------------
// Core: findRunbooks
// FIX v10: Gunakan ILIKE murni — tidak ada operator && yang bermasalah
// ---------------------------------------------------------------------------

async function findRunbooks(keywords = [], limit = 3) {
  if (!keywords.length) return [];
  const safeLimit = Math.min(Number(limit) || 3, 10);

  const kwClean    = keywords.slice(0, 8).map((k) => String(k).toLowerCase().trim()).filter(Boolean);
  const searchText = kwClean.join(" ");

  // ILIKE conditions — menghindari operator && yang type-mismatch
  const ilikeParts = kwClean.slice(0, 4)
    .map((kw) => `(title ILIKE '%${kw.replace(/'/g, "''")}%' OR content ILIKE '%${kw.replace(/'/g, "''")}%')`)
    .join(" OR ");

  let rows = [];

  // Layer 1: FTS (lebih akurat)
  try {
    rows = await prisma.$queryRawUnsafe(`
      SELECT id, category, title, content, keywords, usage_count, success_rate
      FROM knowledge_base
      WHERE to_tsvector('simple', title || ' ' || content)
            @@ plainto_tsquery('simple', $1)
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT $2
    `, searchText, safeLimit);
  } catch (err) {
    console.warn("[RECOMMEND] findRunbooks FTS error:", err.message);
  }

  // Layer 2: ILIKE fallback
  if (rows.length === 0 && ilikeParts) {
    try {
      rows = await prisma.$queryRawUnsafe(`
        SELECT id, category, title, content, keywords, usage_count, success_rate
        FROM knowledge_base
        WHERE ${ilikeParts}
        ORDER BY success_rate DESC, usage_count DESC
        LIMIT $1
      `, safeLimit);
    } catch (err) {
      console.warn("[RECOMMEND] findRunbooks ILIKE error:", err.message);
    }
  }

  return rows.map((r) => ({
    id:          Number(r.id),
    category:    r.category,
    title:       r.title,
    content:     r.content,
    successRate: Number(r.success_rate),
    usageCount:  Number(r.usage_count),
  }));
}

// ---------------------------------------------------------------------------
// Public: getRecommendation
// ---------------------------------------------------------------------------

async function getRecommendation({
  issueText = "",
  keywords  = [],
  type      = null,
  excludeId = null,
}) {
  try {
    const derivedKw = keywords.length > 0 ? keywords : tokenize(issueText);

    const [similarTickets, runbooks] = await Promise.all([
      findSimilarTickets({ issueText, keywords, type, limit: 3, excludeId }),
      findRunbooks(derivedKw, 3),
    ]);

    const hasSimilar  = similarTickets.length > 0;
    const hasRunbooks = runbooks.length > 0;

    return {
      found: hasSimilar || hasRunbooks,
      similarTickets,
      runbooks,
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
    console.error("[RECOMMEND] getRecommendation error:", err.message);
    return { found: false, similarTickets: [], runbooks: [], topSuggestion: null };
  }
}

// ---------------------------------------------------------------------------
// Discord Builder — untuk Teknisi (dikirim ke thread setelah pinned message)
// ---------------------------------------------------------------------------

function buildDiscordRecommendation(result, ticketType = "TICKETING") {
  if (!result || !result.found) return null;

  const isIncident  = ticketType === "INCIDENT";
  const icon        = isIncident ? "🚨" : "💡";
  const headerLabel = isIncident ? "INCIDENT SMART RECOMMENDATION" : "SMART RECOMMENDATION";
  const simLabel    = isIncident ? "Insiden Serupa" : "Kasus Serupa yang Pernah Diselesaikan";

  const lines = [];
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`${icon} **${headerLabel} — untuk Teknisi**`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Ticket baru masuk. Ditemukan referensi dari kasus serupa:_`);

  if (result.similarTickets && result.similarTickets.length > 0) {
    lines.push(`\n📋 **${simLabel} (${result.similarTickets.length}):**`);
    result.similarTickets.slice(0, 3).forEach((t, i) => {
      lines.push(`\n**${i + 1}.** ${String(t.title || "").substring(0, 80)}`);
      if (t.summary)   lines.push(`   ↳ ✅ *Solusi:* ${String(t.summary).substring(0, 200)}`);
      if (t.rootCause) lines.push(`   ↳ 🔍 *Root Cause:* ${String(t.rootCause).substring(0, 150)}`);
      if (t.timeline)  lines.push(`   ↳ 📅 *Steps:* ${String(t.timeline).substring(0, 150)}`);
    });
  }

  const top = result.topSuggestion;
  if (top?.source === "ticket" && top.summary) {
    lines.push(`\n🛠️ **Langkah Penanganan yang Disarankan:**`);
    lines.push(String(top.summary).substring(0, 400));
    if (top.rootCause) lines.push(`\n🔍 **Root Cause:** ${String(top.rootCause).substring(0, 250)}`);
    if (top.timeline)  lines.push(`\n📅 **Action Steps:**\n${String(top.timeline).substring(0, 350)}`);
  } else if (top?.source === "runbook") {
    lines.push(`\n📖 **Runbook: ${top.title}** [${top.category}]`);
    lines.push(String(top.content || "").substring(0, 400));
  }

  if (result.runbooks && result.runbooks.length > 0) {
    lines.push(`\n📚 **Knowledge Base Terkait:**`);
    result.runbooks.slice(0, 2).forEach((r) => {
      lines.push(`  • [${r.category}] ${r.title}`);
    });
  }

  lines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_⚠ Mohon verifikasi relevansi sebelum menerapkan solusi_`);
  return lines.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// User Portal Recommendation
// FIX v10:
//   - Tidak tampilkan ticket ID (privacy — user lain tidak perlu tahu)
//   - Maksimal 2 kasus serupa
//   - Gunakan rangkuman generik jika ada beberapa kasus serupa
//   - Threshold relevance: hanya tampil jika similarity cukup tinggi
// ---------------------------------------------------------------------------

function buildUserRecommendation(result) {
  if (!result || !result.found) return null;

  // Filter hanya yang punya summary (ada solusinya)
  const withSummary = (result.similarTickets || []).filter((t) => t.summary && t.summary.trim());

  // Jika tidak ada yang punya summary, periksa runbook
  const hasRunbook  = (result.runbooks || []).length > 0;

  if (withSummary.length === 0 && !hasRunbook) return null;

  const steps = [];

  // Ambil maksimal 2 kasus serupa, TANPA tampilkan ticket ID
  withSummary.slice(0, 2).forEach((t, i) => {
    steps.push({
      type:  "similar",
      label: i === 0 ? "Solusi yang pernah berhasil" : "Solusi alternatif",
      hint:  String(t.summary).substring(0, 400),
    });
  });

  // Runbook sebagai pelengkap
  if (hasRunbook && steps.length < 2) {
    const r = result.runbooks[0];
    steps.push({
      type:     "runbook",
      label:    `Panduan: ${r.title}`,
      category: r.category,
      hint:     String(r.content || "").substring(0, 400),
    });
  }

  if (steps.length === 0) return null;

  return {
    found:   true,
    count:   withSummary.length,
    steps,
    message: withSummary.length > 1
      ? `Kami menemukan ${withSummary.length} kasus serupa yang pernah berhasil ditangani. Berikut ringkasan solusinya:`
      : "Kami menemukan kasus serupa yang pernah berhasil ditangani. Berikut saran awal yang mungkin membantu:",
  };
}

// ---------------------------------------------------------------------------
// Technician Portal Recommendation — detail teknis penuh
// ---------------------------------------------------------------------------

function buildTechnicianRecommendation(result, ticketType = "TICKETING") {
  if (!result || !result.found) return null;

  const isIncident = ticketType === "INCIDENT";

  return {
    found:     true,
    isIncident,
    label: isIncident
      ? "Insiden serupa pernah terjadi — gunakan sebagai referensi mitigasi"
      : "Kasus serupa pernah ditangani — gunakan sebagai referensi solusi",
    similarTickets: (result.similarTickets || []).slice(0, 3).map((t) => ({
      ticketId:   t.ticketId,
      title:      String(t.title || "").substring(0, 100),
      summary:    t.summary   ? String(t.summary).substring(0, 500)   : null,
      rootCause:  t.rootCause ? String(t.rootCause).substring(0, 400) : null,
      timeline:   t.timeline  ? String(t.timeline).substring(0, 400)  : null,
      resolvedAt: t.resolvedAt || null,
    })),
    runbooks: (result.runbooks || []).slice(0, 3).map((r) => ({
      title:       String(r.title || ""),
      category:    String(r.category || ""),
      content:     String(r.content || "").substring(0, 600),
      successRate: r.successRate || 0,
    })),
    topSuggestion: result.topSuggestion || null,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getRecommendation,
  findSimilarTickets,
  findRunbooks,
  tokenize,
  buildDiscordRecommendation,
  buildUserRecommendation,
  buildTechnicianRecommendation,
};