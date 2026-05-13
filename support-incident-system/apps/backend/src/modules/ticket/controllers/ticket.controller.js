"use strict";

/**
 * src/modules/ticket/controllers/ticket.controller.js
 * Thin controller: parse request → call service → return response.
 * Zero business logic here.
 */

const TicketService  = require("../services/ticket.service");
const TicketRepo     = require("../repositories/ticket.repository");
const ActivityRepo   = require("../../activity/repositories/activity.repository");
const DiscordService = require("../../../infrastructure/discord/discord.service");
const N8NService     = require("../../../infrastructure/n8n/n8n.service");
const { ticketListItemDTO, ticketDetailDTO } = require("../dto/ticket.dto");
const { serialize, ok, fail, parsePagination, fireAndForget } = require("../../../common/helpers");
const { getTicketMode } = require("../../../common/utils/ticket");
const { createLogger }  = require("../../../common/logger");
const config = require("../../../config");

const logger = createLogger("TICKET_CTRL");

// GET /api/ticket
async function list(req, res) {
  try {
    const { status, type, search } = req.query;
    const { limit, offset } = parsePagination(req.query);

    let rows;

    if (search?.trim()) {
      rows = await TicketRepo.searchTickets({ search, status, type, limit, offset });
    } else {
      const where = {};
      if (status) where.status_pengusulan = status;
      if (type)   where.type              = type;
      rows = await TicketRepo.findAll({
        where:   Object.keys(where).length > 0 ? where : undefined,
        orderBy: { created_at: "desc" },
        take:    limit,
        skip:    offset,
      });
    }

    let total = rows.length;
    try { total = await TicketRepo.countTickets({ status, type }); } catch (_) {}

    return ok(res, { total, count: rows.length, tickets: rows.map(ticketListItemDTO) });
  } catch (err) {
    logger.error(`GET / error: ${err.message}`);
    return fail(res, err);
  }
}

// GET /api/ticket/:id
async function getById(req, res) {
  try {
    const ticket = await TicketRepo.findById(req.ticketId);
    if (!ticket) return res.status(404).json({ error: `Ticket #${req.ticketId} tidak ditemukan` });
    return ok(res, { ticket: ticketDetailDTO(ticket) });
  } catch (err) {
    logger.error(`GET /:id error: ${err.message}`);
    return fail(res, err);
  }
}

// POST /api/ticket/create
async function create(req, res) {
  try {
    const { type, formFields, createdBy, autoCreateDiscord } = req.body;
    const result = await TicketService.createTicket({ type, formFields, createdBy, autoCreateDiscord });
    return ok(res, {
      ticketId:  result.ticket.id,
      discord:   result.discordThread,
      emailSent: result.emailSent,
    }, 201);
  } catch (err) {
    logger.error(`POST /create error: ${err.message}`);
    return fail(res, err);
  }
}

// POST /api/ticket/auto-create
async function autoCreate(req, res) {
  try {
    const { type, title, description, keywords, formFields, createdBy } = req.body;
    const result = await TicketService.autoCreate({ type, title, description, keywords, formFields, createdBy });
    return ok(res, result);
  } catch (err) {
    logger.error(`POST /auto-create error: ${err.message}`);
    return fail(res, err);
  }
}

// POST /api/ticket/find-similar
async function findSimilar(req, res) {
  try {
    const { keywords, limit = 5 } = req.body;
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: "keywords harus berupa array non-kosong" });
    }
    const tickets = await TicketRepo.findSimilar(keywords, Math.min(Number(limit) || 5, 10));
    return ok(res, { count: tickets.length, tickets });
  } catch (err) {
    logger.error(`POST /find-similar error: ${err.message}`);
    return fail(res, err);
  }
}

// POST /api/ticket/summary
async function summary(req, res) {
  try {
    const { ticketId, summaryText, rootCause, keywords, generatedBy } = req.body;
    if (!ticketId) return res.status(400).json({ error: "ticketId required" });

    const updateData = {};
    if (summaryText)  updateData.summary_ticket  = summaryText;
    if (rootCause)    updateData.root_cause       = rootCause;
    if (keywords)     updateData.search_keywords  = keywords;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Minimal satu field (summaryText, rootCause, keywords) wajib diisi" });
    }

    const ticket = await TicketRepo.update(Number(ticketId), updateData);
    if (!ticket) return res.status(404).json({ error: `Ticket #${ticketId} tidak ditemukan` });

    fireAndForget("DISCORD_SYNC", async () => {
      await DiscordService.updateTicketMessage(ticket);
    });

    logger.info(`Summary updated for Ticket #${ticketId} by ${generatedBy || "N8N"}`);
    return ok(res, { ticketId: ticket.id });
  } catch (err) {
    logger.error(`POST /summary error: ${err.message}`);
    return fail(res, err);
  }
}

// POST /api/ticket/timeline/append
async function appendTimeline(req, res) {
  try {
    const { ticketId, entry, type: ticketType } = req.body;
    if (!ticketId || !entry) return res.status(400).json({ error: "ticketId dan entry required" });

    const ticket = await TicketRepo.findById(Number(ticketId));
    if (!ticket) return res.status(404).json({ error: `Ticket #${ticketId} tidak ditemukan` });

    const fieldKey = (ticketType || ticket.type) === "INCIDENT"
      ? "timeline_action_taken"
      : "timeline_tindak_lanjut";

    let current = ticket[fieldKey === "timeline_action_taken" ? "timelineActionTaken" : "timelineTindakLanjut"] || [];
    if (typeof current === "string") { try { current = JSON.parse(current); } catch { current = []; } }
    if (!Array.isArray(current)) current = [];

    const newEntry = typeof entry === "string"
      ? { timestamp: new Date().toISOString(), action: entry }
      : { timestamp: new Date().toISOString(), ...entry };

    current.push(newEntry);
    const updated = await TicketRepo.update(Number(ticketId), { [fieldKey]: current });

    fireAndForget("DISCORD_SYNC", () => DiscordService.updateTicketMessage(updated));
    return ok(res, { ticketId: updated.id });
  } catch (err) {
    logger.error(`POST /timeline/append error: ${err.message}`);
    return fail(res, err);
  }
}

// PUT /api/ticket/:id/status
async function updateStatus(req, res) {
  try {
    const { status, note, updatedBy } = req.body;
    const ticket = await TicketRepo.findById(req.ticketId);
    if (!ticket) return res.status(404).json({ error: `Ticket #${req.ticketId} tidak ditemukan` });

    const result = await TicketService.updateStatus(req.ticketId, { status, note, updatedBy }, ticket.type);
    return ok(res, { ticketId: req.ticketId, oldStatus: result.oldStatus, newStatus: status });
  } catch (err) {
    logger.error(`PUT /:id/status error: ${err.message}`);
    return fail(res, err);
  }
}

// PUT /api/ticket/:id/assign
async function assign(req, res) {
  try {
    const { assignees, assignedBy } = req.body;
    const ticket = await TicketService.assignTicket(req.ticketId, { assignees, assignedBy });
    return ok(res, { ticketId: ticket.id, assignees });
  } catch (err) {
    logger.error(`PUT /:id/assign error: ${err.message}`);
    return fail(res, err);
  }
}

// POST /api/ticket/:id/comment
async function comment(req, res) {
  try {
    const { comment: commentText, userId, userName } = req.body;
    const result = await TicketService.addComment(req.ticketId, { comment: commentText, userId, userName });
    return ok(res, result);
  } catch (err) {
    logger.error(`POST /:id/comment error: ${err.message}`);
    return fail(res, err);
  }
}

// POST /api/ticket/:id/sync-discord
async function syncDiscord(req, res) {
  try {
    const { action, status } = req.body;
    const id = req.ticketId;

    // Respond immediately (async operation)
    res.status(202).json({ accepted: true, ticketId: id, action });

    const ticket = await TicketRepo.findById(id);
    if (!ticket) { logger.warn(`syncDiscord: Ticket #${id} not found`); return; }

    const discord      = ticket.discord || {};
    const currentStatus = ticket.statusPengusulan;
    const isClosing    = currentStatus === "DONE" || currentStatus === "RESOLVED";

    if (discord.threadId) {
      try {
        await Promise.all([
          DiscordService.updateThreadTitle(ticket),
          DiscordService.updateTicketMessage(ticket),
        ]);
        logger.info(`Discord synced for Ticket #${id} (action: ${action})`);
      } catch (err) {
        logger.error(`Discord sync failed #${id}: ${err.message}`);
      }

      if (isClosing) {
        const hasSummary = !!(ticket.summaryTicket);
        if (hasSummary) {
          try {
            const outOfSync = await DiscordService.isDiscordOutOfSync(ticket);
            if (outOfSync) await DiscordService.repairPinnedMessage(ticket);
          } catch (_) {}
        } else {
          try {
            await N8NService.triggerWorkflow({
              eventType:        "portal_status_closing",
              threadId:         discord.threadId,
              threadName:       discord.threadName || `#${id}`,
              ticketId:         id,
              ticketType:       ticket.type,
              statusPengusulan: currentStatus,
              mode:             "CLOSING",
              messageId:        null,
              messageContent:   `[Portal Admin] Status set to ${currentStatus}`,
              authorId:         "portal_admin",
              authorName:       "Portal Admin",
              timestamp:        new Date().toISOString(),
            });
          } catch (n8nErr) {
            logger.error(`N8N trigger failed #${id}: ${n8nErr.message}`);
          }
        }
      }
    }

    // Activity log
    try {
      const actionLabel = {
        status_update:      "Status diperbarui via Portal Admin",
        reassign:           "Assignee diperbarui via Portal Admin",
        form_fields_update: "Data formulir diperbarui via Portal Admin",
      }[action] || `Update via Portal Admin (${action || "sync"})`;

      await ActivityRepo.create({ ticketId: id, type: action || "admin_update", description: actionLabel });
    } catch (_) {}
  } catch (err) {
    if (!res.headersSent) return fail(res, err);
    logger.error(`POST /:id/sync-discord error: ${err.message}`);
  }
}

// POST /api/ticket/repair-discord
async function repairDiscord(req, res) {
  try {
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ error: "ticketId required" });

    const ticket = await TicketRepo.findById(Number(ticketId));
    if (!ticket) return res.status(404).json({ error: `Ticket #${ticketId} tidak ditemukan` });

    if (!ticket.discord?.threadId) {
      return res.status(400).json({ error: "Ticket tidak memiliki Discord thread" });
    }

    const outOfSync = await DiscordService.isDiscordOutOfSync(ticket);
    if (outOfSync) {
      await DiscordService.repairPinnedMessage(ticket);
      return ok(res, { ticketId: ticket.id, repaired: true });
    }

    return ok(res, { ticketId: ticket.id, repaired: false, message: "Discord sudah sinkron" });
  } catch (err) {
    logger.error(`POST /repair-discord error: ${err.message}`);
    return fail(res, err);
  }
}

// PATCH /api/ticket/:id/data
async function updateData(req, res) {
  try {
    const id = req.ticketId;
    const { requester, resolved_at } = req.body;

    const ticket = await TicketRepo.findById(id);
    if (!ticket) return res.status(404).json({ error: `Ticket #${id} tidak ditemukan` });

    const updatePayload = {};

    if (requester !== undefined) {
      const ff = { ...(ticket.formFields || {}) };
      ff["Reporter Information"] = requester;
      ff["Name"]                 = requester;
      updatePayload.form_fields  = ff;
    }

    if (resolved_at !== undefined) {
      updatePayload.resolved_at = resolved_at ? new Date(resolved_at) : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: "Tidak ada field yang diupdate" });
    }

    const updated = await TicketRepo.update(id, updatePayload);
    fireAndForget("DISCORD_SYNC", () => DiscordService.updateTicketMessage(updated));
    return ok(res, { ticketId: id });
  } catch (err) {
    logger.error(`PATCH /:id/data error: ${err.message}`);
    return fail(res, err);
  }
}

// PATCH /api/ticket/:id/form-fields
async function updateFormFields(req, res) {
  try {
    const id         = req.ticketId;
    const formFields = req.body.formFields || req.body.form_fields;

    if (!formFields || typeof formFields !== "object") {
      return res.status(400).json({ error: "formFields object required" });
    }

    const updated = await TicketRepo.update(id, { form_fields: formFields });
    if (!updated) return res.status(404).json({ error: `Ticket #${id} tidak ditemukan` });

    fireAndForget("DISCORD_SYNC", () => DiscordService.updateTicketMessage(updated));
    return ok(res, { ticketId: id });
  } catch (err) {
    logger.error(`PATCH /:id/form-fields error: ${err.message}`);
    return fail(res, err);
  }
}


module.exports = {
  list, getById, create, autoCreate, findSimilar,
  summary, appendTimeline,
  updateStatus, assign, comment, syncDiscord, repairDiscord,
  updateData, updateFormFields,
};
