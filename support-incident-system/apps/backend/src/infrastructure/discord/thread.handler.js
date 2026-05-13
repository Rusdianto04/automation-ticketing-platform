"use strict";

const TicketModel    = require("../../modules/ticket/repositories/ticket.repository");
const N8NService     = require("../../infrastructure/n8n/n8n.service");
const DiscordService = require("./discord.service");
const { getTicketMode } = require("../../common/utils/ticket");

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

      if (mode === "CLOSING" && ticket.summaryTicket?.trim()) {
        const outOfSync = await DiscordService.isDiscordOutOfSync(ticket);
        if (outOfSync) await DiscordService.repairPinnedMessage(ticket);
        return;
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