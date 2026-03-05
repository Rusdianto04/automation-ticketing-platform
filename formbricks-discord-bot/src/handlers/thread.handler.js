/**
 * src/handlers/thread.handler.js
 * Discord Thread Activity Monitor
 *
 * Setiap pesan baru di thread tiket akan:
 *   1. Cari tiket berdasarkan threadId (JSONB query)
 *   2. Tentukan mode (MONITORING | CLOSING)
 *   3. Jika CLOSING & summary sudah ada → cek/repair Discord sync
 *   4. Trigger N8N workflow dengan context lengkap
 */

"use strict";

const TicketModel    = require("../models/ticket.model");
const N8NService     = require("../services/n8n.service");
const DiscordService = require("../services/discord.service");
const { getTicketMode } = require("../utils/ticket");

/**
 * Register thread activity monitor ke Discord client.
 * @param {Client} client
 */
function register(client) {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith("!")) return;
    if (!message.channel.isThread?.()) return;
    if (!message.content?.trim()) return;

    try {
      const ticket = await TicketModel.findByThreadId(message.channel.id);
      if (!ticket) return;

      console.log(`📨 [THREAD] Message in Ticket #${ticket.id} by ${message.author.tag}`);

      const mode = getTicketMode(ticket);

      // FIX: Jika CLOSING & summary SUDAH ada di DB → pastikan Discord sinkron, lalu stop
      // Jika CLOSING tapi summary BELUM ada → TETAP trigger N8N agar Workflow 1 bisa simpan summary
      // (Sebelumnya: return jika mode CLOSING tanpa cek apakah summary sudah ada → N8N tidak pernah dipanggil)
      if (mode === "CLOSING" && ticket.summaryTicket?.trim()) {
        const outOfSync = await DiscordService.isDiscordOutOfSync(ticket);
        if (outOfSync) await DiscordService.repairPinnedMessage(ticket);
        return; // tiket sudah selesai & sinkron — tidak perlu trigger N8N lagi
      }

      // Trigger N8N event-driven (MONITORING mode ATAU CLOSING tanpa summary)
      await N8NService.triggerWorkflow({
        eventType:        "thread_activity",
        threadId:         message.channel.id,
        threadName:       message.channel.name,
        ticketId:         ticket.id,
        ticketType:       ticket.type,
        statusPengusulan: ticket.statusPengusulan,
        mode,
        messageId:        message.id,
        messageContent:   message.content.substring(0, 200),
        authorId:         message.author.id,
        authorName:       message.author.tag,
        timestamp:        new Date().toISOString(),
      });
    } catch (err) {
      console.error(`❌ [THREAD] Error processing activity:`, err.message);
    }
  });

  console.log("✅ [THREAD] Thread activity monitor registered");
}

module.exports = { register };
