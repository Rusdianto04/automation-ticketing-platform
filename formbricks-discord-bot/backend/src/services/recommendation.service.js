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
    else if ([...targetSet].some((tk) => tk.includes(kw) || kw.includes(tk))) hits += 0.5;
  }
  return hits / sourceKw.length;
}

// ---------------------------------------------------------------------------
// Core: findSimilarTickets
// FIX v11: Tambah discord column di SELECT untuk mendapatkan threadUrl referensi
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

  const anyConditions = allKw.slice(0, 8)
    .map((kw) => `'${kw.replace(/'/g, "''")}'  = ANY(search_keywords)`)
    .join(" OR ");

  const ilikeParts = allKw.slice(0, 5)
    .map((kw) => `(COALESCE(form_fields->>'Issue','') ILIKE '%${kw.replace(/'/g, "''")}%' OR COALESCE(form_fields->>'Incident Information','') ILIKE '%${kw.replace(/'/g, "''")}%' OR COALESCE(summary_ticket,'') ILIKE '%${kw.replace(/'/g, "''")}%')`)
    .join(" OR ");

  let rows = [];

  // ── Layer 1: ANY match pada search_keywords ───────────────────────────────
  // FIX v11: tambah discord column untuk ambil threadUrl referensi
  try {
    rows = await prisma.$queryRawUnsafe(`
      SELECT
        id, type, form_fields, summary_ticket, root_cause,
        timeline_tindak_lanjut, timeline_action_taken,
        search_keywords, status_pengusulan, resolved_at, updated_at,
        discord
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
          search_keywords, status_pengusulan, resolved_at, updated_at,
          discord
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

  // ── Layer 3: FTS fallback ─────────────────────────────────────────────────
  if (rows.length < 2 && issueText.trim().length > 3) {
    try {
      const searchText = allKw.slice(0, 5).join(" ");
      const ftsRows = await prisma.$queryRawUnsafe(`
        SELECT
          id, type, form_fields, summary_ticket, root_cause,
          timeline_tindak_lanjut, timeline_action_taken,
          search_keywords, status_pengusulan, resolved_at, updated_at,
          discord
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

  const MIN_SCORE = 0.1;

  const scored = rows.map((r) => {
    const dbKw  = Array.isArray(r.search_keywords) ? r.search_keywords : [];
    const kwSc  = overlapScore(allKw, dbKw);
    const ctxSc = contextScore(issueText, r);
    const score = Math.max(kwSc, ctxSc * 0.8);

    const ff    = (typeof r.form_fields === "string" ? JSON.parse(r.form_fields) : r.form_fields) || {};
    const title = r.type === "INCIDENT"
      ? (ff["Incident Title"] || ff["Incident Information"] || "Incident")
      : (ff["Issue"] || "Support Ticket");

    // FIX v11: ambil threadUrl dari discord JSONB
    const discordData = (typeof r.discord === "string" ? JSON.parse(r.discord) : r.discord) || {};
    const threadUrl   = discordData.threadUrl || null;

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
      threadUrl,   // ← URL Discord thread dari tiket referensi
      score,
    };
  });

  return scored
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);
}

// ---------------------------------------------------------------------------
// Core: findRunbooks
// ---------------------------------------------------------------------------

async function findRunbooks(keywords = [], limit = 3) {
  if (!keywords.length) return [];
  const safeLimit = Math.min(Number(limit) || 3, 10);

  const kwClean    = keywords.slice(0, 8).map((k) => String(k).toLowerCase().trim()).filter(Boolean);
  const searchText = kwClean.join(" ");

  const ilikeParts = kwClean.slice(0, 4)
    .map((kw) => `(title ILIKE '%${kw.replace(/'/g, "''")}%' OR content ILIKE '%${kw.replace(/'/g, "''")}%')`)
    .join(" OR ");

  let rows = [];

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
            threadUrl: similarTickets[0].threadUrl,
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
// Discord Builder — HANYA ke dalam thread, strict 1900 char limit
// FIX v11:
//   - Max 1900 char (Discord limit 2000, buffer 100)
//   - Hanya tampilkan topSuggestion + 1-2 referensi judul
//   - Format runbook langkah-langkah singkat jika ada timeline
//   - Tidak tampilkan semua similarTickets secara penuh (terlalu panjang)
// ---------------------------------------------------------------------------
const DISCORD_MAX = 1900;

function truncate(str, max) {
  if (!str) return "";
  const s = String(str);
  return s.length <= max ? s : s.substring(0, max - 3) + "...";
}

function buildDiscordRecommendation(result, ticketType = "TICKETING") {
  if (!result || !result.found) return null;

  const isIncident  = ticketType === "INCIDENT";
  const icon        = isIncident ? "🚨" : "💡";
  const headerLabel = isIncident ? "INCIDENT SMART RECOMMENDATION" : "SMART RECOMMENDATION";

  const lines = [];
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`${icon} **${headerLabel} — untuk Teknisi**`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Ditemukan referensi dari kasus serupa yang sudah diselesaikan:_`);

  // ── Hanya tampilkan judul kasus serupa (tidak detail) ───────────────────
  if (result.similarTickets && result.similarTickets.length > 0) {
    const simLabel = isIncident ? "Insiden Serupa" : "Kasus Serupa";
    lines.push(`\n📋 **${simLabel} (${result.similarTickets.length}):**`);
    result.similarTickets.slice(0, 3).forEach((t, i) => {
      const titleShort = truncate(t.title, 70);
      lines.push(`  ${i + 1}. ${titleShort}`);
      // Tampilkan link Discord thread jika ada (paling berguna untuk teknisi)
      if (t.threadUrl) lines.push(`     🔗 ${t.threadUrl}`);
    });
  }

  // ── topSuggestion: tampilkan sebagai runbook langkah-langkah singkat ────
  const top = result.topSuggestion;
  if (top?.source === "ticket") {
    lines.push(`\n🛠️ **Referensi Penanganan Terbaik:**`);
    if (top.summary)   lines.push(truncate(top.summary, 300));
    if (top.rootCause) lines.push(`🔍 ${truncate(top.rootCause, 150)}`);

    // Parse timeline sebagai numbered steps jika memungkinkan
    if (top.timeline) {
      const rawSteps = String(top.timeline).split("\n").filter((l) => l.trim()).slice(0, 4);
      if (rawSteps.length > 0) {
        lines.push(`\n📋 **Langkah Penanganan:**`);
        rawSteps.forEach((step) => lines.push(truncate(step, 120)));
      }
    }
    if (top.threadUrl) lines.push(`\n🔗 **Thread Referensi:** ${top.threadUrl}`);
  } else if (top?.source === "runbook") {
    lines.push(`\n📖 **${top.title}** [${top.category}]`);
    lines.push(truncate(top.content, 300));
  }

  lines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`_⚠ Verifikasi relevansi sebelum menerapkan_`);

  // Gabungkan dan potong jika melebihi limit
  const full = lines.filter(Boolean).join("\n");
  return full.length <= DISCORD_MAX ? full : full.substring(0, DISCORD_MAX - 50) + "\n...\n_[Pesan dipotong — lihat portal admin untuk detail lengkap]_";
}

// ---------------------------------------------------------------------------
// User Portal Recommendation
// FIX v11:
//   - Format numbered steps yang mudah dibaca (bukan hanya summary mentah)
//   - Pisahkan langkah-langkah dari summary jika ada pola numbered list
//   - Tambah disclaimer yang jelas
//   - Maksimal 2 kasus, tanpa ID tiket
// ---------------------------------------------------------------------------

function parseStepsFromText(text) {
  if (!text) return [];
  // Coba parse jika ada pola numbered: "1. xxx\n2. xxx"
  const numbered = text.match(/\d+\.\s+[^\n]+/g);
  if (numbered && numbered.length >= 2) {
    return numbered.slice(0, 5).map((s) => s.replace(/^\d+\.\s+/, "").trim());
  }
  // Coba parse bullet: "- xxx" atau "• xxx"
  const bullets = text.match(/[-•]\s+[^\n]+/g);
  if (bullets && bullets.length >= 2) {
    return bullets.slice(0, 5).map((s) => s.replace(/^[-•]\s+/, "").trim());
  }
  // Fallback: split by newline
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 10);
  return lines.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Helpers: parse & clean timeline steps (hapus tanggal/waktu)
// ---------------------------------------------------------------------------

/**
 * Ambil langkah-langkah dari teks timeline, hapus timestamp/tanggal.
 * Input:  "1. (12:46 WIB, 30/04/2026) Conducted a check related..."
 * Output: ["Conducted a check related to the printer device", ...]
 */
function cleanTimelineSteps(timelineText) {
  if (!timelineText) return [];
  return String(timelineText)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 5)
    .map((line) => {
      // Hapus prefix angka: "1. " "2. "
      let cleaned = line.replace(/^\d+\.\s*/, "");
      // Hapus timestamp dalam kurung: "(12:46 WIB, 30/04/2026)" atau "(12:46, 30/4/2026)"
      cleaned = cleaned.replace(/\(\d{1,2}[:.]\d{2}[^)]*\)/g, "");
      // Hapus format tanggal lain: "30/04/2026" "30-04-2026" "2026-04-30"
      cleaned = cleaned.replace(/\b\d{1,4}[-/]\d{1,2}[-/]\d{2,4}\b/g, "");
      // Hapus format WIB/WITA/WIT
      cleaned = cleaned.replace(/\b(WIB|WITA|WIT)\b/g, "");
      // Bersihkan whitespace berlebih
      cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
      // Kapitalisasi huruf pertama
      if (cleaned.length > 0) cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
      return cleaned;
    })
    .filter((line) => line.length > 5) // buang baris yang jadi kosong setelah dibersihkan
    .slice(0, 6); // max 6 langkah
}

/**
 * Gabungkan summary dari beberapa tiket serupa menjadi satu teks tunggal.
 * Deduplicate kalimat yang sangat mirip.
 */
function mergeSummaries(tickets) {
  const allSummaries = tickets
    .filter((t) => t.summary && t.summary.trim())
    .map((t) => String(t.summary).trim());

  if (allSummaries.length === 0) return "";
  if (allSummaries.length === 1) return allSummaries[0].substring(0, 400);

  // Ambil summary terpanjang sebagai basis, tambah info dari yang lain jika berbeda
  allSummaries.sort((a, b) => b.length - a.length);
  const base   = allSummaries[0].substring(0, 400);
  return base;
}

/**
 * Gabungkan langkah-langkah dari beberapa tiket serupa, deduplicate.
 * Hasilnya adalah 1 set langkah terbaik yang mewakili semua kasus.
 */
function mergeSteps(tickets) {
  // Kumpulkan semua langkah dari semua tiket
  const allSteps = [];
  const seen     = new Set();

  for (const t of tickets) {
    const steps = cleanTimelineSteps(t.timeline || "");
    for (const step of steps) {
      // Deduplicate: skip jika terlalu mirip dengan yang sudah ada
      const normalized = step.toLowerCase().replace(/\s+/g, " ");
      const isDuplicate = [...seen].some((s) => {
        const sim = s.split(" ").filter((w) => normalized.includes(w)).length;
        return sim / s.split(" ").length > 0.7; // 70% kata sama = duplikat
      });
      if (!isDuplicate && step.length > 5) {
        allSteps.push(step);
        seen.add(normalized);
      }
    }
    if (allSteps.length >= 6) break; // max 6 langkah total
  }

  return allSteps.slice(0, 6);
}

// ---------------------------------------------------------------------------
// User Portal Recommendation 
// ---------------------------------------------------------------------------

function buildUserRecommendation(result) {
  if (!result || !result.found) return null;

  // Kasus serupa yang punya summary
  const withSummary = (result.similarTickets || []).filter(
    (t) => t.summary && t.summary.trim()
  );

  // Kasus serupa yang punya timeline (untuk langkah-langkah)
  const withTimeline = (result.similarTickets || []).filter(
    (t) => t.timeline && t.timeline.trim()
  );

  const hasRunbook = (result.runbooks || []).length > 0;

  if (withSummary.length === 0 && !hasRunbook) return null;

  // ── Gabungkan semua menjadi 1 rangkuman terpadu ───────────────────────────
  const mergedSummary   = mergeSummaries(withSummary);
  const mergedSteps     = mergeSteps(withTimeline.length > 0 ? withTimeline : withSummary);

  // Jika tidak ada langkah dari timeline, coba dari runbook
  let runbookSteps = [];
  let runbookLabel = null;
  if (mergedSteps.length === 0 && hasRunbook) {
    const rb     = result.runbooks[0];
    runbookSteps = cleanTimelineSteps(rb.content || "");
    runbookLabel = rb.title;
  }

  const finalSteps = mergedSteps.length > 0 ? mergedSteps : runbookSteps;

  // Tentukan pesan intro berdasarkan jumlah kasus
  const count   = withSummary.length;
  let message;
  if (count === 0 && hasRunbook) {
    message = "Kami memiliki panduan yang mungkin dapat membantu Anda sementara menunggu teknisi:";
  } else if (count === 1) {
    message = "Kami menemukan kasus serupa yang pernah berhasil ditangani. Berikut panduan sementara yang dapat Anda coba:";
  } else {
    message = `Kami menemukan ${count} kasus serupa yang pernah berhasil ditangani. Berikut panduan terpadu berdasarkan pengalaman tersebut:`;
  }

  return {
    found:      true,
    count,
    message,
    // 1 rangkuman terpadu — bukan array steps lagi
    summary:     mergedSummary || (hasRunbook ? String(result.runbooks[0].content || "").substring(0, 400) : ""),
    actionSteps: finalSteps,
    stepSource:  mergedSteps.length > 0 ? "ticket" : (runbookLabel || "panduan"),
    disclaimer:  "Rekomendasi ini adalah panduan sementara berdasarkan kasus serupa. Teknisi kami tetap akan menangani permasalahan Anda secara resmi.",
  };
}
// ---------------------------------------------------------------------------
// Technician Portal Recommendation — compact dengan accordion concept
// FIX v11:
//   - topSuggestion sebagai highlight utama (langsung tampil)
//   - similarTickets dalam format compact (hanya judul + status)
//   - Detail per ticket via expandable (frontend handle dengan state)
//   - Max 3 tiket serupa, tapi data dikirim compact
// ---------------------------------------------------------------------------

function buildTechnicianRecommendation(result, ticketType = "TICKETING") {
  if (!result || !result.found) return null;

  const isIncident = ticketType === "INCIDENT";

  // Top suggestion — detail penuh untuk highlight utama
  const topSuggestion = result.topSuggestion
    ? {
        ...result.topSuggestion,
        summary:   result.topSuggestion.summary   ? truncate(result.topSuggestion.summary,   500) : null,
        rootCause: result.topSuggestion.rootCause ? truncate(result.topSuggestion.rootCause, 400) : null,
        timeline:  result.topSuggestion.timeline  ? truncate(result.topSuggestion.timeline,  400) : null,
      }
    : null;

  return {
    found:     true,
    isIncident,
    label: isIncident
      ? "Insiden serupa pernah terjadi — gunakan sebagai referensi mitigasi"
      : "Kasus serupa pernah ditangani — gunakan sebagai referensi solusi",
    // topSuggestion: highlight utama — langsung tampil tanpa accordion
    topSuggestion,
    // similarTickets: compact — hanya info penting, detail via expand
    similarTickets: (result.similarTickets || []).slice(0, 5).map((t) => ({
      ticketId:   t.ticketId,
      title:      truncate(t.title, 100),
      // Hanya 1 baris summary untuk preview
      summaryPreview: t.summary ? truncate(t.summary, 120) : null,
      // Data lengkap tetap ada untuk expand
      summary:    t.summary   ? truncate(t.summary,    500) : null,
      rootCause:  t.rootCause ? truncate(t.rootCause,  400) : null,
      timeline:   t.timeline  ? truncate(t.timeline,   400) : null,
      resolvedAt: t.resolvedAt || null,
      threadUrl:  t.threadUrl  || null,
    })),
    runbooks: (result.runbooks || []).slice(0, 2).map((r) => ({
      title:          truncate(r.title, 80),
      category:       r.category,
      contentPreview: truncate(r.content, 100),
      content:        truncate(r.content, 600),
      successRate:    r.successRate || 0,
    })),
    totalSimilar: (result.similarTickets || []).length,
    totalRunbooks: (result.runbooks || []).length,
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