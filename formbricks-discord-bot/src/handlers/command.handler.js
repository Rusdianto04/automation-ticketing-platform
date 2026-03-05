/**
 * src/handlers/command.handler.js
 * Discord Command Handlers: !status !assign !evidence
 *
 * Semua command handler di-register ke Discord client.
 * Tidak ada Sequelize — semua DB ops via Prisma model layer.
 */

"use strict";

const config         = require("../config");
const TicketModel    = require("../models/ticket.model");
const ActivityModel  = require("../models/activity.model");
const DiscordService = require("../services/discord.service");
const N8NService     = require("../services/n8n.service");
const { normalizeTicketId } = require("../utils/ticket");

/**
 * Register semua command handlers ke Discord client.
 * @param {Client} client
 */
function register(client) {

  // ── !status ──────────────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!status")) return;

    const content      = message.content.substring(7).trim();
    const lines        = content.split("\n");
    const firstLine    = lines[0].trim();
    const args         = firstLine.split(" ");
    const rawTicketId  = args[0];
    const action       = args[1];
    const firstLineRemainder = args.slice(2).join(" ");
    const additionalLines    = lines.slice(1).join("\n");
    const note               = (firstLineRemainder + (additionalLines ? "\n" + additionalLines : "")).trim();

    const ticketId = normalizeTicketId(rawTicketId);
    if (!ticketId || !action) {
      return message.reply(
        "❌ Format: `!status #<id> <action> <keterangan>`\n\n" +
        "**Ticketing:** pending | approve | reject | done\n" +
        "**Incident:** investigasi | mitigasi | resolved"
      );
    }

    let ticket = await TicketModel.findById(ticketId);
    if (!ticket) return message.reply(`❌ Ticket #${ticketId} tidak ditemukan`);

    // Resolve status
    let statusPengusulan, statusLabel;
    if (ticket.type === "INCIDENT") {
      switch (action.toLowerCase()) {
        case "investigasi": statusPengusulan = "INVESTIGASI"; statusLabel = "Investigasi"; break;
        case "mitigasi":    statusPengusulan = "MITIGASI";    statusLabel = "Mitigasi";    break;
        case "resolved":    statusPengusulan = "RESOLVED";    statusLabel = "Resolved";    break;
        default:
          return message.reply("❌ Status tidak valid untuk Incident. Gunakan: investigasi, mitigasi, resolved");
      }
    } else {
      switch (action.toLowerCase()) {
        case "pending": statusPengusulan = "PENDING";  statusLabel = "Pending";      break;
        case "approve": statusPengusulan = "APPROVED"; statusLabel = "In Progress";  break;
        case "reject":  statusPengusulan = "REJECTED"; statusLabel = "Rejected";     break;
        case "done":    statusPengusulan = "DONE";     statusLabel = "Done";         break;
        default:
          return message.reply("❌ Status tidak valid untuk Ticketing. Gunakan: pending, approve, reject, done");
      }
    }

    // Build update — set resolvedAt jika closing status
    const isClosingStatus =
      (ticket.type === "INCIDENT" && statusPengusulan === "RESOLVED") ||
      (ticket.type !== "INCIDENT" && statusPengusulan === "DONE");

    const updateData = {
      status_pengusulan: statusPengusulan,
      status_note:       note || null,
    };
    if (isClosingStatus) updateData.resolved_at = new Date();

    ticket = await TicketModel.update(ticketId, updateData);

    // Update Discord
    await DiscordService.updateThreadTitle(ticket);
    await DiscordService.updateTicketMessage(ticket);

    await ActivityModel.create({
      ticketId: ticket.id,
      type:     "status_update",
      description: `Status: ${statusLabel}${note ? " | Note: " + note : ""}`,
    });

    // Closing flow — tunggu N8N generate summary/rootCause
    if (isClosingStatus) {
      await new Promise((r) => setTimeout(r, 3000));
      const freshTicket = await TicketModel.findById(ticketId);

      if (freshTicket.summaryTicket?.trim()) {
        const outOfSync = await DiscordService.isDiscordOutOfSync(freshTicket);
        if (outOfSync) await DiscordService.repairPinnedMessage(freshTicket);
      } else {
        await N8NService.triggerWorkflow({
          eventType:        "thread_activity",
          threadId:         freshTicket.discord?.threadId || message.channel.id,
          threadName:       message.channel.name || `Ticket #${freshTicket.id}`,
          ticketId:         freshTicket.id,
          ticketType:       freshTicket.type,
          statusPengusulan: statusPengusulan,
          mode:             "CLOSING",
          messageId:        message.id,
          messageContent:   `Status changed to ${statusLabel}`,
          authorId:         message.author.id,
          authorName:       message.author.tag,
          timestamp:        new Date().toISOString(),
        });
      }
    }
  });

  // ── !assign ───────────────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!assign")) return;

    const args        = message.content.split(" ");
    const rawTicketId = args[1];
    const mentions    = message.mentions.users;
    const ticketId    = normalizeTicketId(rawTicketId);

    if (!ticketId || mentions.size === 0) {
      return message.reply("❌ Format: `!assign #<id> @petugas1 @petugas2 ...`");
    }

    let ticket = await TicketModel.findById(ticketId);
    if (!ticket) return message.reply(`❌ Ticket #${ticketId} tidak ditemukan`);

    const assigneeArray = Array.from(mentions.values()).map((user) => ({
      discordId: user.id,
      username:  user.tag,
      mention:   `<@${user.id}>`,
    }));

    ticket = await TicketModel.update(ticketId, { assignee: assigneeArray });
    await DiscordService.updateTicketMessage(ticket);

    await ActivityModel.create({
      ticketId: ticket.id,
      type:     "assigned",
      description: `Assigned to ${assigneeArray.map((a) => a.username).join(", ")}`,
    });
  });

  // ── !evidence ─────────────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!evidence")) return;

    const args         = message.content.split(" ");
    const rawTicketId  = args[1];
    const messageLink  = args[2];
    const ticketId     = normalizeTicketId(rawTicketId);

    if (!ticketId || !messageLink) {
      return message.reply("❌ Format: `!evidence #<id> <message_link>`");
    }

    try {
      let ticket = await TicketModel.findById(ticketId);
      if (!ticket) return message.reply(`❌ Ticket #${ticketId} tidak ditemukan`);

      const evidenceArray = Array.isArray(ticket.evidenceAttachment) ? [...ticket.evidenceAttachment] : [];
      evidenceArray.push({
        id:      evidenceArray.length + 1,
        url:     messageLink,
        addedAt: new Date().toISOString(),
        addedBy: message.author.tag,
      });

      ticket = await TicketModel.update(ticketId, { evidence_attachment: evidenceArray });
      await DiscordService.updateTicketMessage(ticket);

      await ActivityModel.create({
        ticketId: ticket.id,
        type:     "evidence_added",
        description: `Evidence added: ${messageLink}`,
      });
    } catch (err) {
      console.error(`❌ [COMMAND] Evidence error:`, err);
      await message.reply(`❌ Error: ${err.message}`);
    }
  });

  console.log("✅ [COMMAND] All command handlers registered (!status, !assign, !evidence)");
}

module.exports = { register };
