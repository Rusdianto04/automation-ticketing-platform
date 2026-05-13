"use strict";

/**
 * src/modules/ticket/services/ticket.service.js
 * Business logic for ticket lifecycle management.
 * Controller calls this; service calls repositories + infrastructure.
 */

const config         = require("../../../config");
const TicketRepo     = require("../repositories/ticket.repository");
const ActivityRepo   = require("../../activity/repositories/activity.repository");
const DiscordService = require("../../../infrastructure/discord/discord.service");
const EmailService   = require("../../../infrastructure/email/email.service");
const { getPublicUrl }   = require("../../../common/utils/network");
const { getTicketMode }  = require("../../../common/utils/ticket");
const { CLOSING_STATUSES, VALID_TICKET_STATUSES, ACTIVITY_TYPE, TICKET_TYPE } = require("../../../common/constants");
const { generateKeywords } = require("../../../common/helpers/text");
const { fireAndForget }  = require("../../../common/helpers");
const { createLogger }   = require("../../../common/logger");

const logger = createLogger("TICKET_SERVICE");

// ─── Lazy-loaded services (prevent circular deps) ─────────────────────────────
let _recommendation = null;
let _incident       = null;

function getRecommendationService() {
  if (!_recommendation) _recommendation = require("./recommendation.service");
  return _recommendation;
}

function getIncidentService() {
  if (!_incident) _incident = require("../../report/services/incident.service");
  return _incident;
}

// ─── Service methods ──────────────────────────────────────────────────────────

async function createTicket({ type, formFields, formId, createdBy, keywords, autoCreateDiscord = true }) {
  const title = type === "INCIDENT"
    ? (formFields["Incident Title"] || formFields["Incident Information"] || formFields["Issue"] || "Incident")
    : (formFields["Issue"] || "Support Request");

  const searchKeywords = keywords?.length ? keywords : generateKeywords(title);

  const finalFormId = createdBy && String(createdBy).startsWith("admin")
    ? "admin_portal"
    : (formId || "static_portal");

  let ticket = await TicketRepo.create({
    type,
    formId:            finalFormId,
    formFields,
    statusPengusulan:  "OPEN",
    evidenceAttachment: [],
    searchKeywords,
  });

  await ActivityRepo.create({
    ticketId:    ticket.id,
    type:        ACTIVITY_TYPE.CREATED,
    description: `Tiket dibuat oleh ${createdBy || "User"} melalui Portal`,
  });

  logger.info(`Ticket #${ticket.id} created (${type})`);

  // Discord thread
  let discordThread = null;
  if (autoCreateDiscord) {
    try {
      const { thread, infoMessage, overflowIds, commandsMessage } =
        await DiscordService.createTicketThread(ticket, config.discord.channelId);

      ticket = await TicketRepo.update(ticket.id, {
        discord: {
          infoMessageId:      infoMessage.id,
          commandsMessageId:  commandsMessage?.id ?? null,
          threadId:           thread.id,
          threadUrl:          thread.url,
          channelId:          config.discord.channelId,
          overflowMessageIds: overflowIds ?? [],
        },
      });

      discordThread = { threadId: thread.id, threadUrl: thread.url };
      logger.info(`Discord thread created: ${thread.url}`);
    } catch (discordErr) {
      logger.warn(`Discord thread failed (non-fatal): ${discordErr.message}`);
      try {
        await ActivityRepo.create({
          ticketId:    ticket.id,
          type:        ACTIVITY_TYPE.DISCORD_ERROR,
          description: `Discord thread gagal: ${discordErr.message.substring(0, 200)}`,
        });
      } catch (_) {}
    }
  }

  // Post-creation background tasks (smart recommendation + incident detection)
  const threadId = ticket.discord?.threadId;
  if (threadId) {
    setTimeout(() => _runBackgroundTasks(ticket, formFields, type, threadId), 2000);
  }

  // Email confirmation
  const emailTo = (formFields["Email"] || "").trim();
  if (emailTo && emailTo.includes("@")) {
    fireAndForget("EMAIL", async () => {
      const html = EmailService.buildConfirmationEmail(ticket, type, getPublicUrl());
      await EmailService.sendEmail({
        to:      emailTo,
        subject: `Konfirmasi Penerimaan Ticket ${type === "INCIDENT" ? "Incident" : "Support"} #${ticket.id}`,
        html,
      });
      logger.info(`Email konfirmasi terkirim ke ${emailTo}`);
    });
  }

  return { ticket, discordThread, emailSent: !!(emailTo && emailTo.includes("@")) };
}

async function _runBackgroundTasks(ticket, formFields, type, threadId) {
  // Smart Recommendation
  try {
    const RecommendationService = getRecommendationService();
    const issueText = type === "INCIDENT"
      ? (formFields["Incident Title"] || formFields["Incident Information"] || "")
      : (formFields["Issue"] || "");

    if (issueText.trim()) {
      const recResult = await RecommendationService.getRecommendation({
        issueText,
        keywords:  ticket.searchKeywords || [],
        type,
        excludeId: ticket.id,
      });
      if (recResult.found) {
        const recMsg = RecommendationService.buildDiscordRecommendation(
          recResult, type, config.discord?.guildId, config.discord?.channelId
        );
        if (recMsg) {
          const thread = await DiscordService.getClient().channels.fetch(threadId);
          if (thread?.isThread()) {
            await thread.send(recMsg);
            logger.info(`Smart Recommendation sent to thread #${threadId}`);
          }
        }
      }
    }
  } catch (err) {
    logger.warn(`Smart Recommendation error (non-fatal): ${err.message}`);
  }

  // Incident detection
  try {
    const IncidentService = getIncidentService();
    const analysis = IncidentService.analyzeForIncident(ticket);
    if (analysis.isIncident) {
      IncidentService.processIncident(ticket).catch(() => {});
    }
  } catch (_) {}
}

async function updateStatus(id, { status, note, updatedBy }, ticketType) {
  const validList = VALID_TICKET_STATUSES[ticketType] || ["OPEN", "DONE", "RESOLVED"];
  if (!validList.includes(status)) {
    throw Object.assign(new Error(`Status "${status}" tidak valid untuk ${ticketType}`), { statusCode: 400 });
  }

  const ticket = await TicketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error(`Ticket #${id} tidak ditemukan`), { statusCode: 404 });

  const oldStatus  = ticket.statusPengusulan;
  const updateData = { status_pengusulan: status, status_note: note || null };

  if (CLOSING_STATUSES.has(status) && !ticket.resolvedAt) {
    updateData.resolved_at = new Date();
  }

  const updated = await TicketRepo.update(id, updateData);

  fireAndForget("DISCORD_SYNC", async () => {
    await DiscordService.updateThreadTitle(updated);
    await DiscordService.updateTicketMessage(updated);
  });

  await ActivityRepo.create({
    ticketId:    id,
    type:        ACTIVITY_TYPE.STATUS_UPDATE,
    description: `Status: ${oldStatus} -> ${status}${note ? ` | ${note}` : ""}${updatedBy ? ` (by ${updatedBy})` : ""}`,
  });

  return { ticket: updated, oldStatus };
}

async function assignTicket(id, { assignees, assignedBy }) {
  const ticket = await TicketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error(`Ticket #${id} tidak ditemukan`), { statusCode: 404 });

  const updated = await TicketRepo.update(id, { assignee: assignees });
  fireAndForget("DISCORD_SYNC", () => DiscordService.updateTicketMessage(updated));

  await ActivityRepo.create({
    ticketId:    id,
    type:        ACTIVITY_TYPE.ASSIGNED,
    description: `Assigned to: ${assignees.map((a) => a.username || a.name || "unknown").join(", ")}${assignedBy ? ` (by ${assignedBy})` : ""}`,
  });

  return updated;
}

async function addComment(id, { comment, userId, userName }) {
  const ticket = await TicketRepo.findById(id);
  if (!ticket) throw Object.assign(new Error(`Ticket #${id} tidak ditemukan`), { statusCode: 404 });

  const author = userName || userId || "User";
  await ActivityRepo.create({
    ticketId:    id,
    type:        ACTIVITY_TYPE.COMMENT,
    description: `${author}: ${comment}`,
  });

  if (ticket.discord?.threadId) {
    fireAndForget("DISCORD_COMMENT", async () => {
      const thread = await DiscordService.getClient().channels.fetch(ticket.discord.threadId);
      if (thread) await thread.send({ content: `Portal Comment by ${author}:\n${comment}` });
    });
  }

  return { ticketId: id };
}

async function autoCreate({ type, title, description, keywords, formFields, createdBy }) {
  let ticket = await TicketRepo.create({
    type,
    formId: "chatbot_auto_create",
    formFields: formFields || {
      Issue:                  title,
      "Reporter Information": createdBy || "AI Chatbot",
      "Incident Information": title,
    },
    statusPengusulan:   "OPEN",
    evidenceAttachment: [],
    searchKeywords:     keywords || [],
  });

  await ActivityRepo.create({
    ticketId:    ticket.id,
    type:        ACTIVITY_TYPE.CHATBOT_AUTO_CREATE,
    description: `Ticket auto-created via Chatbot oleh ${createdBy || "AI"}: "${title}"`,
  });

  try {
    const { thread, infoMessage, overflowIds, commandsMessage } =
      await DiscordService.createTicketThread(ticket, config.discord.channelId);

    if (description?.trim()) {
      await thread.send({ content: `Deskripsi dari pengguna:\n${description.trim()}` });
    }

    ticket = await TicketRepo.update(ticket.id, {
      discord: {
        infoMessageId:      infoMessage.id,
        commandsMessageId:  commandsMessage?.id ?? null,
        threadId:           thread.id,
        threadUrl:          thread.url,
        channelId:          config.discord.channelId,
        overflowMessageIds: overflowIds ?? [],
      },
    });

    return { success: true, ticketId: ticket.id, threadUrl: thread.url, threadId: thread.id };
  } catch (discordErr) {
    logger.error(`Discord thread gagal untuk ticket #${ticket.id}: ${discordErr.message}`);
    return { success: true, ticketId: ticket.id, threadUrl: null, message: discordErr.message };
  }
}

module.exports = {
  createTicket,
  updateStatus,
  assignTicket,
  addComment,
  autoCreate,
};
