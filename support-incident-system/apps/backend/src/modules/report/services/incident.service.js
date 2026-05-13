"use strict";

const prisma       = require("../../../infrastructure/prisma/client");
const TicketModel  = require("../../ticket/repositories/ticket.repository");
const ActivityModel = require("../../activity/repositories/activity.repository");
const config        = require("../../../config");

let _discord = null;
function discord() {
  if (!_discord) _discord = require("../../../infrastructure/discord/discord.service");
  return _discord;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INCIDENT_KEYWORDS = [
  "down", "outage", "mati", "tidak bisa", "gangguan total", "semua user",
  "seluruh", "parah", "kritis", "critical", "server", "network", "jaringan",
  "database", "internet mati", "tidak ada koneksi",
];

const INCIDENT_CATEGORIES = {
  network:     ["network", "internet", "jaringan", "koneksi", "wifi", "lan", "vpn"],
  system:      ["server", "database", "db", "storage", "backup", "os", "windows", "linux"],
  application: ["aplikasi", "app", "web", "portal", "login", "error", "crash", "bug"],
  hardware:    ["hardware", "printer", "komputer", "pc", "laptop", "monitor", "ups"],
  security:    ["security", "hack", "virus", "ransomware", "breach", "akses tidak sah"],
};

const STATUS_LABELS = {
  OPEN:        "🔴 Investigating",
  INVESTIGASI: "🟡 Investigating",
  MITIGASI:    "🟠 Mitigating",
  RESOLVED:    "🟢 Resolved",
  DONE:        "🟢 Resolved",
};

function detectCategory(text = "", suspectArea = "") {
  const combined = `${text} ${suspectArea}`.toLowerCase();
  for (const [cat, kws] of Object.entries(INCIDENT_CATEGORIES)) {
    if (kws.some((kw) => combined.includes(kw))) return cat;
  }
  return "general";
}

function isIncidentKeyword(text = "") {
  const lower = text.toLowerCase();
  return INCIDENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildStatusEmoji(status = "OPEN") {
  return STATUS_LABELS[status.toUpperCase()] || "🔴 Open";
}

// ---------------------------------------------------------------------------
// Auto-detection
// ---------------------------------------------------------------------------

/**
 * @param {object} ticket — normalized ticket from TicketModel
 * @returns {{ isIncident: boolean, category: string, reason: string }}
 */
function analyzeForIncident(ticket) {
  try {
    const ff       = ticket.formFields || ticket.form_fields || {};
    const text     = `${ff["Incident Information"] || ""} ${ff["Indicated Issue"] || ""} ${ff["Issue"] || ""}`;
    const area     = ff["Suspect Area"] || "";
    const priority = (ff["Priority Incident"] || "").toLowerCase();
    const severity = (ff["Severity Incident"] || "").toLowerCase();

    if (ticket.type === "INCIDENT") {
      const category = detectCategory(text, area);
      const isCritical = ["critical","high","tinggi","kritis"].some(
        (k) => priority.includes(k) || severity.includes(k)
      );
      return {
        isIncident: true,
        category,
        reason: isCritical ? "High-priority incident" : "Incident ticket submitted",
        isCritical,
      };
    }

    if (ticket.type === "TICKETING" && isIncidentKeyword(text)) {
      return {
        isIncident:  true,
        category:    detectCategory(text, area),
        reason:      "Keyword pattern suggests system-wide impact",
        isCritical:  false,
        autoDetected: true,
      };
    }

    return { isIncident: false, category: "general", reason: "Normal ticket" };
  } catch (err) {
    console.warn("[INCIDENT] analyzeForIncident error:", err.message);
    return { isIncident: false, category: "general", reason: "Analysis error" };
  }
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * @param {string} category
 * @param {string[]} keywords
 * @returns {Promise<object|null>}
 */
async function findOpenIncidentGroup(category, keywords = []) {
  try {
    const windowMs = 4 * 60 * 60 * 1000;
    const since    = new Date(Date.now() - windowMs);
    const rows = await prisma.$queryRaw`
      SELECT id, form_fields, discord, status_pengusulan, created_at, search_keywords
      FROM tickets
      WHERE type = 'INCIDENT'
        AND status_pengusulan NOT IN ('RESOLVED', 'DONE')
        AND created_at >= ${since}
      ORDER BY created_at ASC
      LIMIT 20
    `;

    for (const row of rows) {
      const ff   = (typeof row.form_fields === "string" ? JSON.parse(row.form_fields) : row.form_fields) || {};
      const text = `${ff["Incident Information"] || ""} ${ff["Suspect Area"] || ""}`;
      const cat  = detectCategory(text, ff["Suspect Area"] || "");

      if (cat === category) return row;

      const dbKw  = Array.isArray(row.search_keywords) ? row.search_keywords : [];
      const overlap = keywords.filter((k) => dbKw.includes(k)).length;
      if (overlap >= 2) return row;
    }
    return null;
  } catch (err) {
    console.warn("[INCIDENT] findOpenIncidentGroup error:", err.message);
    return null;
  }
}

/**
 * @param {number} parentId
 * @param {number} childId
 */
async function attachToGroup(parentId, childId) {
  try {
    const parent = await TicketModel.findById(parentId);
    if (!parent) return;

    const discordData = parent.discord || {};
    const grouped     = discordData.groupedTicketIds || [];
    if (!grouped.includes(childId)) grouped.push(childId);

    await TicketModel.update(parentId, {
      discord: { ...discordData, groupedTicketIds: grouped },
    });

    await ActivityModel.create({
      ticketId:    parentId,
      type:        "incident_grouped",
      description: `Ticket #${childId} grouped into this incident`,
    });

    console.log(`[INCIDENT] Ticket #${childId} grouped under incident #${parentId}`);
  } catch (err) {
    console.warn("[INCIDENT] attachToGroup error:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Discord broadcast helpers
// ---------------------------------------------------------------------------

/**
 * @param {object} ticket   — normalized ticket
 * @param {object} opts
 * @param {string}   opts.category
 * @param {string}   opts.updateNote  — optional technician update note
 * @param {number[]} opts.grouped     — grouped ticket IDs
 * @returns {string}
 */
function buildIncidentBroadcastMessage(ticket, { category = "general", updateNote = "", grouped = [] } = {}) {
  const ff        = ticket.formFields || ticket.form_fields || {};
  const title     = ff["Incident Title"] || ff["Incident Information"] || `Incident #${ticket.id}`;
  const status    = buildStatusEmoji(ticket.statusPengusulan || ticket.status_pengusulan);
  const priority  = ff["Priority Incident"] || "Medium";
  const severity  = ff["Severity Incident"] || "Medium";
  const groupedStr = grouped.length > 0
    ? `\n📎 **Grouped Tickets:** ${grouped.map((id) => `#${id}`).join(", ")}`
    : "";
  const noteStr = updateNote ? `\n📝 **Update:** ${updateNote}` : "";

  return (
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🚨 **INCIDENT BROADCAST** — #${ticket.id}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `**Title    :** ${title}\n` +
    `**Status   :** ${status}\n` +
    `**Category :** ${category.toUpperCase()}\n` +
    `**Priority :** ${priority}\n` +
    `**Severity :** ${severity}\n` +
    `**Ticket ID:** #${ticket.id}_Incident` +
    groupedStr +
    noteStr +
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );
}

// ---------------------------------------------------------------------------
// Public: processIncident
// ---------------------------------------------------------------------------

/**
 * @param {object} ticket   — normalized ticket (just created)
 * @param {object} [opts]
 * @param {string}   [opts.updateNote]   — manual update note
 * @param {boolean}  [opts.forceBroadcast] — bypass checks, always broadcast
 */
async function processIncident(ticket, opts = {}) {
  try {
    const analysis = analyzeForIncident(ticket);
    if (!analysis.isIncident && !opts.forceBroadcast) return;

    console.log(`[INCIDENT] Processing ticket #${ticket.id}: ${analysis.reason}`);

    // ── Grouping ─────────────────────────────────────────────────────────────
    const kw        = ticket.searchKeywords || ticket.search_keywords || [];
    const groupParent = await findOpenIncidentGroup(analysis.category, kw);

    if (groupParent && Number(groupParent.id) !== Number(ticket.id)) {
      await attachToGroup(Number(groupParent.id), Number(ticket.id));
    }

    // ── Discord broadcast ──────────────────────────────────────────────────
    const discordData = ticket.discord || {};
    const grouped     = groupParent
      ? [(groupParent.discord?.groupedTicketIds || []), Number(ticket.id)].flat()
      : [];

    const broadcastMsg = buildIncidentBroadcastMessage(ticket, {
      category:   analysis.category,
      updateNote: opts.updateNote || "",
      grouped,
    });

    try {
      const disc = discord();
      const cl   = disc.getClientSafe ? disc.getClientSafe() : null;

      if (cl) {
        // Try to post to the incident's own thread first
        const threadId = discordData.threadId || discordData.thread_id;
        if (threadId) {
          const thread = await cl.channels.fetch(threadId).catch(() => null);
          if (thread?.isThread()) {
            await thread.send(broadcastMsg);
            console.log(`[INCIDENT] Broadcast posted to thread #${threadId}`);
          }
        }

        // Also try the configured incident broadcast channel (if separate)
        const broadcastChannelId = config.discord?.incidentChannelId || config.discord?.channelId;
        if (broadcastChannelId && broadcastChannelId !== discordData.channelId) {
          const ch = await cl.channels.fetch(broadcastChannelId).catch(() => null);
          if (ch?.isTextBased()) {
            await ch.send(broadcastMsg);
          }
        }
      }
    } catch (discordErr) {
      console.warn("[INCIDENT] Discord broadcast error (non-fatal):", discordErr.message);
    }

    // ── Log activity ────────────────────────────────────────────────────────
    await ActivityModel.create({
      ticketId:    Number(ticket.id),
      type:        "incident_detected",
      description: `${analysis.reason} | Category: ${analysis.category}${groupParent ? ` | Grouped under #${groupParent.id}` : ""}`,
    }).catch(() => {});

  } catch (err) {
    // processIncident must NEVER throw — it's called from webhook non-blocking
    console.error("[INCIDENT] processIncident error (suppressed):", err.message);
  }
}

// ---------------------------------------------------------------------------
// Public: updateIncidentStatus
// ---------------------------------------------------------------------------

/**
 * @param {number} ticketId
 * @param {string} newStatus   — INVESTIGASI | MITIGASI | RESOLVED
 * @param {string} [note]
 * @returns {Promise<{ ok: boolean, broadcast: boolean }>}
 */
async function updateIncidentStatus(ticketId, newStatus, note = "") {
  try {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket || ticket.type !== "INCIDENT") {
      return { ok: false, reason: "Not an incident ticket" };
    }

    const validTransitions = {
      OPEN:        ["INVESTIGASI", "MITIGASI", "RESOLVED"],
      INVESTIGASI: ["MITIGASI", "RESOLVED"],
      MITIGASI:    ["RESOLVED"],
    };
    const current = (ticket.statusPengusulan || "OPEN").toUpperCase();
    const allowed = validTransitions[current] || [];

    if (!allowed.includes(newStatus.toUpperCase())) {
      return { ok: false, reason: `Cannot transition from ${current} to ${newStatus}` };
    }

    const updated = await TicketModel.update(ticketId, {
      statusPengusulan: newStatus.toUpperCase(),
      statusNote:       note || null,
      resolvedAt:       newStatus === "RESOLVED" ? new Date() : undefined,
    });

    await ActivityModel.create({
      ticketId: Number(ticketId),
      type:     "incident_status_update",
      description: `Status: ${current} → ${newStatus.toUpperCase()}${note ? ` | Note: ${note}` : ""}`,
    });

    // Non-blocking broadcast
    processIncident(updated, { updateNote: note, forceBroadcast: true }).catch(() => {});

    return { ok: true, broadcast: true };
  } catch (err) {
    console.error("[INCIDENT] updateIncidentStatus error:", err.message);
    return { ok: false, reason: err.message };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  analyzeForIncident,
  processIncident,
  updateIncidentStatus,
  findOpenIncidentGroup,
  buildIncidentBroadcastMessage,
  buildStatusEmoji,
  detectCategory,
};