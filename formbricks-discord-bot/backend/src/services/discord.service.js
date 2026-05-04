"use strict";

const { editMessageSafe, splitDiscordMessage } = require("../utils/discord");
const { formatDateTime, formatIncidentDateTime, formatResolvedStatus } = require("../utils/date");
const {
  getTicketTitle,
  formatAssigneeForDiscord,
  formatEvidenceForDisplay,
} = require("../utils/ticket");
const TicketModel   = require("../models/ticket.model");
const ActivityModel = require("../models/activity.model");

// ─── Client Singleton ────────────────────────────────────────────────────────
let _client = null;

function setClient(client) {
  _client = client;
}

function getClient() {
  if (!_client) throw new Error("[DISCORD] Client not initialized. Call setClient() first.");
  return _client;
}

// ─── Message Builders ─────────────────────────────────────────────────────────
/**
 * @param {object} ticket — normalized ticket
 * @returns {string}
 */
function buildTicketInfoMessage(ticket) {
  const fields        = ticket.formFields || ticket.form_fields || {};
  const status        = ticket.statusPengusulan || ticket.status_pengusulan || "OPEN";
  const statusNote    = ticket.statusNote    || ticket.status_note;
  const tindakLanjut  = ticket.timelineTindakLanjut || ticket.timeline_tindak_lanjut;
  const evidence      = ticket.evidenceAttachment   || ticket.evidence_attachment;
  const summaryTicket = ticket.summaryTicket        || ticket.summary_ticket;
  const updatedAt     = ticket.updatedAt            || ticket.updated_at;

  /// Status mapping
  let currentStatus = "Open";
  if (status === "PENDING")                              currentStatus = "Pending";
  else if (status === "APPROVED" || status === "IN_PROGRESS") currentStatus = "In Progress";
  else if (status === "REJECTED" || status === "REJECT") currentStatus = "Rejected";
  else if (status === "DONE")                            currentStatus = "Done";

  const statusNoteStr = (statusNote && statusNote.trim() !== "") ? ` (${statusNote})` : "";
  const updatedStr    = updatedAt ? formatDateTime(updatedAt) : formatDateTime(new Date());

  let summarySection = "";
  if (summaryTicket && summaryTicket.trim() !== "") {
    summarySection = `----------------------------------------------\n**Summary:**\n${summaryTicket}\n`;
  }

  // ── Format identik karakter-per-karakter dengan original index.js ──
  return `────────────────────────────────
🎫 TICKET SUPPORT INFORMATION
────────────────────────────────
**Title               :** ${getTicketTitle(ticket)}
**Ticket ID      :** #${ticket.id}_Support
-------------------------------------------
**Reporter Information:**
• Name         : ${fields["Reporter Information"] || "N/A"}
• Division     : ${fields["Division"] || "N/A"}
• Phone        : ${fields["No Telepon"] || "N/A"}
• Email         : ${fields["Email"] || "N/A"}
--------------------------------------------
**Device & Location:**
• Device ID  : ${fields["ID Device"] || "N/A"}
• Room        : ${fields["Ruangan"] || "N/A"}
• Floor         : ${fields["Lantai"] || "N/A"}
• Quantity   : ${fields["Jumlah Barang"] || "N/A"}
----------------------------------------------
**Ticket Detail:**
• Date / Time  : ${formatDateTime(ticket.createdAt || ticket.created_at)}
• Support Type : ${fields["Type of Support Requested"] || "N/A"}
• Issue       : ${fields["Issue"] || "N/A"}
• Assign Team: 
${formatAssigneeForDiscord(ticket.assignee)}
----------------------------------------------
**Ticket Status:**
• Status             : ${currentStatus}${statusNoteStr}
• Updated At   : ${updatedStr}
----------------------------------------------
**Tindak Lanjut:**
${tindakLanjut || "(Belum ada tindak lanjut)"}
${summarySection}
**Evidence / Attachment:**
${formatEvidenceForDisplay(evidence)}
----------------------------------------------`;
}

/**
 * @param {object} ticket
 * @returns {string}
 */
function buildTicketCommandsMessage(ticket) {
  return (
    `💡 **COMMAND UNTUK MANAGE TICKET #${ticket.id}:**\n` +
    "```\n" +
    `!assign #${ticket.id} @petugas1 @petugas2\n` +
    `!status #${ticket.id} pending|approve|reject|done <keterangan>\n` +
    `!evidence #${ticket.id} <message_link>\n` +
    "```\n" +
    "📝 **Tips:** Semua command mendukung multiline. Tekan Enter untuk membuat paragraf baru."
  );
}

/**
 * @param {object} ticket
 * @returns {string}
 */
function buildIncidentInfoMessage(ticket) {
  const fields        = ticket.formFields || ticket.form_fields || {};
  const status        = ticket.statusPengusulan || ticket.status_pengusulan || "OPEN";
  const actionTaken   = ticket.timelineActionTaken || ticket.timeline_action_taken;
  const summaryTicket = ticket.summaryTicket       || ticket.summary_ticket;
  const rootCause     = ticket.rootCause           || ticket.root_cause;
  const evidence      = ticket.evidenceAttachment  || ticket.evidence_attachment;
  const createdAt     = ticket.createdAt           || ticket.created_at;
  const resolvedAt    = ticket.resolvedAt          || ticket.resolved_at;

  // Status mapping + durasi resolved
  let statusText   = "Open";
  let statusDetail = "";
  if (status === "OPEN")                               { statusText = "Open"; }
  else if (status === "INVESTIGASI")                   { statusText = "Investigasi"; }
  else if (status === "MITIGASI")                      { statusText = "Mitigasi"; }
  else if (status === "RESOLVED" || status === "DONE") {
    statusText = "Resolved";
    if (ticket.resolvedAt || ticket.resolved_at) {
      const resolvedAt = new Date(ticket.resolvedAt || ticket.resolved_at);
      const createdAt  = new Date(ticket.createdAt  || ticket.created_at);
      const diffMs     = resolvedAt.getTime() - createdAt.getTime();
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      statusDetail = ` (${formatDateTime(resolvedAt)} - ${h > 0 ? `${h} Hour${h > 1 ? "s" : ""} ` : ""}${m} Menit)`;
    }
  }

  const handling = (summaryTicket && summaryTicket.trim() !== "")
    ? summaryTicket
    : "(Belum ada penanganan)";

  return `-----------------------------------------------
🚨 **INCIDENT REPORT**
-----------------------------------------------
**Title**               : ${getTicketTitle(ticket)}
**Ticket ID**           : #${ticket.id}_Incident
**Date/Time**           : ${formatDateTime(createdAt)}
**Priority**            : ${fields["Priority Incident"] || "N/A"}
**Severity**            : ${fields["Severity Incident"] || "N/A"}
**Suspect Area**        : ${fields["Suspect Area"] || "N/A"}
**Assign Team** : ${formatAssigneeForDiscord(ticket.assignee)}
-----------------------------------------------
**Action Taken:**
${actionTaken || "(Belum ada action yang diambil)"}

**Indicated Issue:**
${fields["Indicated Issue"] || "N/A"}

**Handling:**
${handling}

**Evidence Attachment:**
${formatEvidenceForDisplay(evidence)}

-----------------------------------------------
**Status** : ${statusText}${statusDetail}
-----------------------------------------------`;
}

/**
 * @param {object} ticket
 * @returns {string}
 */
function buildIncidentCommandsMessage(ticket) {
  return (
    `💡 **COMMAND UNTUK MANAGE INCIDENT #${ticket.id}:**\n` +
    "```\n" +
    `!assign #${ticket.id} @petugas1 @petugas2\n` +
    `!status #${ticket.id} investigasi|mitigasi|resolved <keterangan>\n` +
    `!evidence #${ticket.id} <message_link>\n` +
    "```\n" +
    "📝 **Tips:** Semua command mendukung multiline. Tekan Enter untuk membuat paragraf baru."
  );
}

/**
 * @param {object} ticket
 * @returns {string}
 */
function buildInfoMessage(ticket) {
  return ticket.type === "INCIDENT"
    ? buildIncidentInfoMessage(ticket)
    : buildTicketInfoMessage(ticket);
}

/**
 * @param {object} ticket
 * @returns {string}
 */
function buildCommandsMessage(ticket) {
  return ticket.type === "INCIDENT"
    ? buildIncidentCommandsMessage(ticket)
    : buildTicketCommandsMessage(ticket);
}

// ─── Pin Helper ───────────────────────────────────────────────────────────────

/**
 * @param {Message}       message  — pesan yang akan di-pin
 * @param {ThreadChannel} thread   — thread (untuk fallback notif)
 * @param {string}        label    — "info" | "commands" (untuk log & fallback selektif)
 */
async function pinSafe(message, thread, label = "message") {
  try {
    await message.pin();
  } catch (pinErr) {
    console.warn(`⚠ [DISCORD] Pin ${label} gagal (perlu MANAGE_MESSAGES): ${pinErr.message}`);
    // Fallback 1: react 📌 agar mudah ditemukan di thread
    try { await message.react("📌"); } catch (_) {}
    // Fallback 2: notif hanya untuk info message (satu kali per thread)
    if (label === "info") {
      try {
        await thread.send({
          content: "📌 **[Info Message di atas]** — Berikan permission **Manage Messages** ke bot agar pesan dapat di-pin otomatis."
        });
      } catch (_) {}
    }
  }
}

// ─── Update Operations
/**
 * @param {ThreadChannel} thread    — Discord thread
 * @param {number|string} ticketId  — ID tiket
 * @returns {Promise<{ hasInfo: boolean, hasCommands: boolean }>}
 */
async function checkExistingPins(thread, ticketId) {
  try {
    const pinned   = await thread.messages.fetchPinned();
    const clientId = getClient().user?.id;

    const hasInfo = pinned.some((m) =>
      m.author?.id === clientId &&
      (m.content.includes(`#${ticketId}_Support`) || m.content.includes(`#${ticketId}_Incident`))
    );

    const hasCommands = pinned.some((m) =>
      m.author?.id === clientId &&
      m.content.includes("COMMAND UNTUK MANAGE")
    );

    console.log(`[DISCORD] checkExistingPins Ticket #${ticketId}: hasInfo=${hasInfo} hasCommands=${hasCommands}`);
    return { hasInfo, hasCommands };
  } catch (_) {
    return { hasInfo: false, hasCommands: false };
  }
}

/**
 * @param {object} ticket — normalized ticket (id wajib ada, discord.threadId & infoMessageId juga)
 */
async function updateTicketMessage(ticket) {
  const discord = ticket.discord || {};
  if (!discord.threadId || !discord.infoMessageId) {
    console.log(`⚠️ [DISCORD] No Discord thread/message info for Ticket #${ticket.id}`);
    return;
  }

  try {
    const fresh   = await TicketModel.findById(ticket.id);
    const thread  = await getClient().channels.fetch(fresh.discord.threadId);
    if (!thread) return;

    const message = await thread.messages.fetch(fresh.discord.infoMessageId);
    if (!message) return;

    const newContent = buildInfoMessage(fresh);

    await editMessageSafe(thread, message, newContent, fresh, async (t) => {
      await TicketModel.update(t.id, { discord: t.discord });
    });

    console.log(`✅ [DISCORD] Info message updated — Ticket #${fresh.id}`);
  } catch (err) {
    console.error(`❌ [DISCORD] Failed to update message for #${ticket.id}:`, err.message);
  }
}

/**
 * Update nama thread sesuai status tiket terbaru.
 * @param {object} ticket
 */
async function updateThreadTitle(ticket) {
  const discord = ticket.discord || {};
  if (!discord.threadId) return;

  try {
    const thread      = await getClient().channels.fetch(discord.threadId);
    if (!thread) return;

    const status      = ticket.statusPengusulan || ticket.status_pengusulan;
    const ticketTitle = getTicketTitle(ticket);

    let prefix = "[OPEN] ";
    if (ticket.type === "INCIDENT") {
      if (status === "INVESTIGASI")  prefix = "[INVESTIGASI] ";
      else if (status === "MITIGASI") prefix = "[MITIGASI] ";
      else if (status === "RESOLVED") prefix = "[CLOSED] ";
    } else {
      if (status === "PENDING")                              prefix = "[PENDING] ";
      else if (status === "APPROVED" || status === "IN_PROGRESS") prefix = "[IN PROGRESS] ";
      else if (status === "REJECTED" || status === "REJECT") prefix = "[REJECTED] ";
      else if (status === "DONE")                            prefix = "[CLOSED] ";
    }

    const typeLabel = ticket.type === "INCIDENT" ? "[Incident]" : "[Support]";
    const newName   = `${prefix}${typeLabel} ${ticketTitle}`;
    const finalName = newName.length > 100 ? newName.substring(0, 97) + "..." : newName;

    await thread.setName(finalName);
    console.log(`✅ [DISCORD] Thread title updated: ${finalName}`);
  } catch (err) {
    console.error(`❌ [DISCORD] Failed to update thread title for #${ticket.id}:`, err.message);
  }
}

/**
 * Cek apakah pinned message di Discord tidak sinkron dengan data di DB.aram {object} ticket
 * @returns {Promise<boolean>}
 */
async function isDiscordOutOfSync(ticket) {
  const discord       = ticket.discord || {};
  const summaryTicket = ticket.summaryTicket || ticket.summary_ticket;

  if (!discord.threadId || !discord.infoMessageId) return false;
  if (!summaryTicket) return false;

  try {
    const thread  = await getClient().channels.fetch(discord.threadId);
    if (!thread) return false;
    const message = await thread.messages.fetch(discord.infoMessageId);
    if (!message) return false;

    const discordContent = message.content || "";
    if (!discordContent.includes(summaryTicket.substring(0, 30))) return true;
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Perbaiki pinned message yang tidak sinkron dengan DB.
 * @param {object} ticket
 * @returns {Promise<boolean>} — true jika berhasil repair
 */
async function repairPinnedMessage(ticket) {
  const discord = ticket.discord || {};
  if (!discord.threadId || !discord.infoMessageId) return false;

  try {
    const thread  = await getClient().channels.fetch(discord.threadId);
    if (!thread) return false;
    const message = await thread.messages.fetch(discord.infoMessageId);
    if (!message) return false;

    const newContent = buildInfoMessage(ticket);

    await editMessageSafe(thread, message, newContent, ticket, async (t) => {
      await TicketModel.update(t.id, { discord: t.discord });
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "discord_repair",
      description: "Discord pinned message repaired — summary/rootCause synced from DB",
    });

    return true;
  } catch (err) {
    console.error(`❌ [DISCORD] Repair failed for Ticket #${ticket.id}:`, err.message);
    return false;
  }
}

/**
 * Buat Discord thread baru untuk tiket + pin info & commands messages.
 * @param {object}  ticket             — normalized ticket
 * @param {string}  channelId          — Discord channel ID
 * @param {object}  [options]
 * @param {string}  [options.source]   — "formbricks" | "chatbot" | "portal"
 * @param {string}  [options.description] — pesan tambahan (chatbot: deskripsi user)
 * @returns {Promise<{ thread, infoMessage, overflowIds, commandsMessage }>}
 */
async function createTicketThread(ticket, channelId, options = {}) {
  const { source = "formbricks", description = null } = options;

  const channel     = await getClient().channels.fetch(channelId);
  const ticketTitle = getTicketTitle(ticket);
  const typeEmoji   = ticket.type === "INCIDENT" ? "🚨" : "🎫";
  const typeLabel   = ticket.type === "INCIDENT" ? "[Incident]" : "[Support]";

  // ── Channel message — prefix berbeda per source ────────────────────────────
  let channelMsgContent;
  if (source === "chatbot") {
    // Original: `${autoLabel} ${emoji} ${title}` dimana autoLabel = "🤖 **[AUTO-CREATED via Chatbot]**"
    channelMsgContent = `🤖 **[AUTO-CREATED via Chatbot]** ${typeEmoji} ${ticketTitle}`;
  } else if (source === "portal") {
    // Original: `🌐 **[PORTAL]** ${emoji} ${title}`
    channelMsgContent = `🌐 **[PORTAL]** ${typeEmoji} ${ticketTitle}`;
  } else {
    // Original formbricks webhook: `${emoji} ${title}`
    channelMsgContent = `${typeEmoji} ${ticketTitle}`;
  }

  // ── Channel message + thread creation ────────────────────────────────────
  const msg = await channel.send({ content: channelMsgContent });

  const rawName   = `[OPEN] ${typeLabel} ${ticketTitle}`;
  const finalName = rawName.length > 100 ? rawName.substring(0, 97) + "..." : rawName;
  const thread    = await msg.startThread({ name: finalName, autoArchiveDuration: 1440 });

  // ── Cek existing pinned SEBELUM pin baru (FIX double pin — Prisma layer) ──
  const existingPins = await checkExistingPins(thread, ticket.id);

  // ── Info message (chunk 1) + pin (jika belum ter-pin) ────────────────────
  const infoContent = buildInfoMessage(ticket);
  const infoChunks  = splitDiscordMessage(infoContent);
  const infoMessage = await thread.send({ content: infoChunks[0] });
  if (!existingPins.hasInfo) {
    await pinSafe(infoMessage, thread, "info");
  } else {
    console.log(`[DISCORD] Ticket #${ticket.id}: info message sudah ter-pin — skip re-pin`);
  }

  // ── Overflow chunks (info > 1900 chars) — TIDAK di-pin ───────────────────
  const overflowIds = [];
  for (let i = 1; i < infoChunks.length; i++) {
    const ov = await thread.send({ content: infoChunks[i] });
    overflowIds.push(ov.id);
    // Overflow chunks sengaja tidak di-pin (hanya info + commands yang ter-pin)
  }

  // ── Commands message + pin (jika belum ter-pin) ───────────────────────────
  const commandsMessage = await thread.send({ content: buildCommandsMessage(ticket) });
  if (!existingPins.hasCommands) {
    await pinSafe(commandsMessage, thread, "commands");
  } else {
    console.log(`[DISCORD] Ticket #${ticket.id}: commands message sudah ter-pin — skip re-pin`);
  }

  // ── Deskripsi tambahan — hanya untuk chatbot auto-create ─────────────────
  if (description && description.trim()) {
    await thread.send({ content: `📝 **Deskripsi dari pengguna:**\n${description.trim()}` });
  }

  return { thread, infoMessage, overflowIds, commandsMessage };
}

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  setClient,
  getClient,
  buildInfoMessage,
  buildCommandsMessage,
  buildTicketInfoMessage,
  buildIncidentInfoMessage,
  buildTicketCommandsMessage,
  buildIncidentCommandsMessage,
  updateTicketMessage,
  updateThreadTitle,
  isDiscordOutOfSync,
  repairPinnedMessage,
  createTicketThread,
};