/**
 * src/utils/discord.js
 * Discord Message Utilities
 *
 * Chunking pesan agar tidak melebihi batas 2000 karakter Discord,
 * dan helper untuk edit pesan dengan overflow support.
 */

"use strict";

const config = require("../config");

/**
 * Split pesan panjang menjadi array chunk ≤ DISCORD_MAX_CHARS.
 * Split preferensi pada newline agar tidak memotong di tengah kata.
 *
 * @param {string} content
 * @returns {string[]}
 */
function splitDiscordMessage(content) {
  const MAX = config.discordMaxChars;
  // FIX: guard undefined/null — jangan return [undefined] karena akan crash saat chunks[0]
  const safeContent = (content != null && String(content).trim()) ? String(content) : "(Tidak ada konten)";
  if (safeContent.length <= MAX) return [safeContent];

  const chunks    = [];
  let remaining   = safeContent;

  while (remaining.length > MAX) {
    let splitAt = remaining.lastIndexOf("\n", MAX);
    if (splitAt <= 0) splitAt = MAX;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).replace(/^\n/, "");
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Edit pinned message dengan dukungan overflow:
 * - Jika konten melebihi 1 chunk, kirim pesan tambahan (overflow)
 * - Sync overflow lama jika sudah ada
 * - Hapus overflow lama yang tidak dibutuhkan lagi
 *
 * @param {ThreadChannel}  thread
 * @param {Message}        message       — pinned message utama
 * @param {string}         content       — konten baru
 * @param {object}         ticket        — normalized ticket (untuk update discord meta)
 * @param {Function}       saveTicketFn  — async fn(ticket) => updatedTicket
 */
async function editMessageSafe(thread, message, content, ticket, saveTicketFn) {
  const chunks         = splitDiscordMessage(content);
  const discordMeta    = ticket.discord || {};
  const existingOverflow = Array.isArray(discordMeta.overflowMessageIds)
    ? discordMeta.overflowMessageIds
    : [];
  const newOverflowIds = [];

  console.log(`📏 [DISCORD] Ticket #${ticket.id}: ${chunks.length} chunk(s)`);

  // Edit chunk pertama (pinned message utama)
  await message.edit({ content: chunks[0] });

  // Sync/buat overflow chunks
  for (let i = 1; i < chunks.length; i++) {
    const existingId = existingOverflow[i - 1];
    if (existingId) {
      try {
        const overflowMsg = await thread.messages.fetch(existingId);
        await overflowMsg.edit({ content: chunks[i] });
        newOverflowIds.push(existingId);
      } catch (_) {
        const newMsg = await thread.send({ content: chunks[i] });
        newOverflowIds.push(newMsg.id);
      }
    } else {
      const newMsg = await thread.send({ content: chunks[i] });
      newOverflowIds.push(newMsg.id);
    }
  }

  // Hapus overflow lama yang tidak terpakai
  if (existingOverflow.length > chunks.length - 1) {
    for (const staleId of existingOverflow.slice(chunks.length - 1)) {
      try {
        const staleMsg = await thread.messages.fetch(staleId);
        await staleMsg.delete();
      } catch (_) { /* message already deleted */ }
    }
  }

  // Update discord meta jika ada perubahan overflow
  if (newOverflowIds.length > 0 || existingOverflow.length > 0) {
    ticket.discord = { ...discordMeta, overflowMessageIds: newOverflowIds };
    if (typeof saveTicketFn === "function") {
      await saveTicketFn(ticket);
    }
  }
}

module.exports = { splitDiscordMessage, editMessageSafe };
