/**
 * src/services/discord.service.js
 * Discord Service — Production v5
 *
 * Equivalent 1:1 dengan semua fungsi Discord di index.js original (Sequelize v4).
 * Semua logic, format pesan, command text, dan alur identik dengan original.
 *
 * Fungsi yang di-port dari original:
 *   buildTicketInfoMessage()         → identik dengan original (~line 280)
 *   buildTicketCommandsMessage()     → identik dengan original (~line 320)
 *   buildIncidentInfoMessage()       → identik dengan original (~line 330)
 *   buildIncidentCommandsMessage()   → identik dengan original (~line 380)
 *   updateTicketMessage()            → identik dengan original updateTicketMessage()
 *   updateThreadTitle()              → identik dengan original updateThreadTitle()
 *   isDiscordOutOfSync()             → identik dengan original isDiscordOutOfSync()
 *   repairPinnedMessage()            → identik dengan original repairDiscordPinnedMessage()
 *   createTicketThread()             → gabungan 3 varian di original:
 *                                        formbricks webhook, chatbot auto-create, portal create
 *
 * FIX v2 (production):
 *   - pin() dibungkus pinSafe() — tidak crash jika bot kurang permission MANAGE_MESSAGES
 *   - Fallback react 📌 + notif jika pin gagal (error 50013)
 *   - source option di createTicketThread() untuk bedakan prefix channel message
 */

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

/** Set Discord client (dipanggil dari index.js bootstrap, sebelum client.login()) */
function setClient(client) {
  _client = client;
}

/**
 * Get Discord client — throws jika belum di-set.
 * Selalu gunakan ini daripada akses _client langsung.
 */
function getClient() {
  if (!_client) throw new Error("[DISCORD] Client not initialized. Call setClient() first.");
  return _client;
}

// ─── Message Builders ─────────────────────────────────────────────────────────
//
// Format pesan identik 100% dengan original index.js.
// Jangan ubah whitespace, separator dash, bullet, atau label —
// Peppermint Portal dan N8N mungkin melakukan string matching terhadap konten ini.

/**
 * Build info message untuk tiket SUPPORT (TICKETING).
 * Equivalent dengan buildTicketInfoMessage() di original index.js.
 *
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

  // Status mapping — identik dengan original
  let currentStatus = "Open";
  if (status === "PENDING")       currentStatus = "Pending";
  else if (status === "APPROVED") currentStatus = "In Progress";
  else if (status === "REJECTED") currentStatus = "Rejected";
  else if (status === "DONE")     currentStatus = "Done";

  const statusNoteStr = (statusNote && statusNote.trim() !== "") ? ` (${statusNote})` : "";
  const updatedStr    = updatedAt ? formatDateTime(updatedAt) : formatDateTime(new Date());

  // Summary section — hanya muncul jika ada konten
  // PENTING: rootCause TIDAK ditampilkan di pinned Discord message (identik dengan original index.js).
  // rootCause hanya tersimpan di DB dan ditampilkan via chatbot bot saat dipanggil user.
  // N8N discordHasSummary check: c.includes('**Summary:**') → tetap bekerja ✓
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
• Date / Time  : ${fields["Tanggal & Waktu Pemohon"] ? fields["Tanggal & Waktu Pemohon"].substring(0, 10) : "N/A"}
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
 * Build commands message untuk tiket SUPPORT.
 * Equivalent dengan buildTicketCommandsMessage() di original index.js.
 *
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
 * Build info message untuk tiket INCIDENT.
 * Equivalent dengan buildIncidentInfoMessage() di original index.js.
 *
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

  // Status mapping + durasi resolved — identik dengan original
  let statusText   = "Open";
  let statusDetail = "";
  if (status === "OPEN")             statusText = "Open";
  else if (status === "INVESTIGASI") statusText = "Investigasi";
  else if (status === "MITIGASI")    statusText = "Mitigasi";
  else if (status === "RESOLVED") {
    statusText   = "Resolved";
    statusDetail = formatResolvedStatus(createdAt, resolvedAt);
  }

  // Handling section — summary (summaryTicket) ditampilkan sebagai "Handling:" di pinned message
  // IDENTIK dengan original index.js: const handling = ticket.summaryTicket || "(Belum ada penanganan)"
  // PENTING: rootCause TIDAK ditampilkan di pinned Discord message —
  // hanya tersimpan di DB dan ditampilkan via chatbot bot saat user memanggilnya.
  // N8N discordHasSummary detection diupdate: c.includes('**Handling:**') — sesuai original.
  const handling = (summaryTicket && summaryTicket.trim() !== "")
    ? summaryTicket
    : "(Belum ada penanganan)";

  // ── Format identik dengan original index.js buildIncidentInfoMessage() ──
  // Ticket ID line ditambahkan agar N8N Workflow 1 dapat mem-parse ticketId
  // via regex: /#(\d+)_(Support|Incident)/
  return `-----------------------------------------------
🚨 **INCIDENT REPORT**
-----------------------------------------------
**Title**               : ${getTicketTitle(ticket)}
**Ticket ID**           : #${ticket.id}_Incident
**Date/Time**           : ${formatIncidentDateTime(fields["Date Incident"], fields["Time Incident"])}
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
 * Build commands message untuk tiket INCIDENT.
 * Equivalent dengan buildIncidentCommandsMessage() di original index.js.
 *
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
 * Pilih info message builder berdasarkan tipe tiket.
 * Dipakai oleh updateTicketMessage(), repairPinnedMessage(), createTicketThread().
 *
 * @param {object} ticket
 * @returns {string}
 */
function buildInfoMessage(ticket) {
  return ticket.type === "INCIDENT"
    ? buildIncidentInfoMessage(ticket)
    : buildTicketInfoMessage(ticket);
}

/**
 * Pilih commands message builder berdasarkan tipe tiket.
 *
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
 * Pin pesan Discord dengan graceful fallback.
 *
 * Bot memerlukan permission MANAGE_MESSAGES untuk melakukan pin.
 * Tanpa permission → DiscordAPIError[50013]: Missing Permissions.
 *
 * Fallback jika gagal:
 *   1. React 📌 ke pesan (visual marker mudah ditemukan)
 *   2. Kirim satu notif di thread (hanya untuk info message, bukan commands)
 *
 * Bot dan thread tetap berjalan normal meski pin gagal.
 *
 * FIX: Solusi permanen → berikan permission Manage Messages ke bot role:
 *   Discord → Channel Settings → Permissions → [Bot Role] → ✅ Manage Messages
 *
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
 * Guard: cek existing pinned di thread sebelum pin baru.
 * Identik dengan behavior original index.js — tidak pernah double pin.
 *
 * FIX (Prisma layer — saran ChatGPT):
 *   createTicketThread() dipanggil ulang karena retry / webhook duplicate
 *   menyebabkan double pin. Guard ini cek apakah bot sudah punya pinned
 *   message dengan ticketId sebelum pin ulang.
 *
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
 * Refresh pinned info message di thread Discord setelah perubahan data tiket.
 * Equivalent dengan updateTicketMessage() di original index.js.
 *
 * Perbedaan v5 vs original:
 *   Original: ticket.reload() (Sequelize instance method)
 *   v5:       TicketModel.findById(ticket.id) (Prisma, equivalent result)
 *
 * @param {object} ticket — normalized ticket (id wajib ada, discord.threadId & infoMessageId juga)
 */
async function updateTicketMessage(ticket) {
  const discord = ticket.discord || {};
  if (!discord.threadId || !discord.infoMessageId) {
    console.log(`⚠️ [DISCORD] No Discord thread/message info for Ticket #${ticket.id}`);
    return;
  }

  try {
    // Reload fresh dari DB — identik dengan ticket.reload() di Sequelize original
    const fresh   = await TicketModel.findById(ticket.id);
    const thread  = await getClient().channels.fetch(fresh.discord.threadId);
    if (!thread) return;

    const message = await thread.messages.fetch(fresh.discord.infoMessageId);
    if (!message) return;

    const newContent = buildInfoMessage(fresh);

    // editMessageSafe: handle pesan > 1900 char (overflow ke pesan berikutnya)
    // saveTicketFn diperlukan untuk persist overflowMessageIds baru ke DB
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
 * Equivalent dengan updateThreadTitle() di original index.js.
 *
 * Prefix thread name identik dengan original:
 *   TICKETING: [OPEN] → [PENDING] → [IN PROGRESS] → [REJECTED] → [CLOSED]
 *   INCIDENT:  [OPEN] → [INVESTIGASI] → [MITIGASI] → [CLOSED]
 *
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

    // Prefix identik karakter-per-karakter dengan original
    let prefix = "[OPEN] ";
    if (ticket.type === "INCIDENT") {
      if (status === "INVESTIGASI")  prefix = "[INVESTIGASI] ";
      else if (status === "MITIGASI") prefix = "[MITIGASI] ";
      else if (status === "RESOLVED") prefix = "[CLOSED] ";
    } else {
      if (status === "PENDING")        prefix = "[PENDING] ";
      else if (status === "APPROVED")  prefix = "[IN PROGRESS] ";
      else if (status === "REJECTED")  prefix = "[REJECTED] ";
      else if (status === "DONE")      prefix = "[CLOSED] ";
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
 * Cek apakah pinned message di Discord tidak sinkron dengan data di DB.
 * Equivalent dengan isDiscordOutOfSync() di original index.js.
 *
 * Out-of-sync terjadi ketika:
 *   AI summary sudah tersimpan di DB TAPI belum ter-render di Discord.
 *   Umumnya terjadi setelah status diubah ke DONE/RESOLVED dan N8N
 *   belum sempat memanggil /api/ticket/summary.
 *
 * @param {object} ticket
 * @returns {Promise<boolean>}
 */
async function isDiscordOutOfSync(ticket) {
  const discord       = ticket.discord || {};
  const summaryTicket = ticket.summaryTicket || ticket.summary_ticket;

  if (!discord.threadId || !discord.infoMessageId) return false;
  // Hanya cek summaryTicket — rootCause tidak ditampilkan di pinned message (identik original)
  if (!summaryTicket) return false;

  try {
    const thread  = await getClient().channels.fetch(discord.threadId);
    if (!thread) return false;
    const message = await thread.messages.fetch(discord.infoMessageId);
    if (!message) return false;

    const discordContent = message.content || "";
    // Support: content ada di bawah **Summary:** | Incident: ada di bawah **Handling:**
    // Identik dengan original: !discordContent.includes(ticket.summaryTicket.substring(0, 30))
    if (!discordContent.includes(summaryTicket.substring(0, 30))) return true;
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Perbaiki pinned message yang tidak sinkron dengan DB.
 * Equivalent dengan repairDiscordPinnedMessage() di original index.js.
 *
 * Dipanggil dalam 2 kondisi (sama dengan original):
 *   1. Thread activity monitor mendeteksi mode CLOSING + out-of-sync
 *   2. !status command selesai (DONE/RESOLVED) + summary sudah ada di DB
 *
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
 *
 * Menggabungkan 3 varian createThread dari original index.js dalam satu fungsi:
 *
 *   source: "formbricks" (default) — dari Formbricks webhook
 *     Channel msg: "🎫 Judul" atau "🚨 Judul"
 *     Dipakai oleh: webhook.route.js
 *
 *   source: "chatbot" — dari Discord chatbot auto-create
 *     Channel msg: "🤖 **[AUTO-CREATED via Chatbot]** 🎫 Judul"
 *     Dipakai oleh: chatbot.handler.js, ticket.route.js /auto-create
 *
 *   source: "portal" — dari Peppermint Portal
 *     Channel msg: "🌐 **[PORTAL]** 🎫 Judul"
 *     Dipakai oleh: ticket.route.js /create (autoCreateDiscord: true)
 *
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
  // Format identik dengan masing-masing varian di original index.js
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
  // Identik dengan guard di original index.js: tidak pernah pin jika sudah ada.
  // Penting: dipanggil SETELAH thread dibuat agar fetchPinned berjalan normal.
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
  // Identik dengan original: thread.send(`📝 **Deskripsi dari pengguna:**\n${description}`)
  if (description && description.trim()) {
    await thread.send({ content: `📝 **Deskripsi dari pengguna:**\n${description.trim()}` });
  }

  return { thread, infoMessage, overflowIds, commandsMessage };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Client management
  setClient,
  getClient,

  // Message builders
  // (diexport untuk dipakai langsung di chatbot.handler.js dan tests)
  buildInfoMessage,
  buildCommandsMessage,
  buildTicketInfoMessage,
  buildIncidentInfoMessage,
  buildTicketCommandsMessage,
  buildIncidentCommandsMessage,

  // Discord operations
  updateTicketMessage,
  updateThreadTitle,
  isDiscordOutOfSync,
  repairPinnedMessage,
  createTicketThread,
};