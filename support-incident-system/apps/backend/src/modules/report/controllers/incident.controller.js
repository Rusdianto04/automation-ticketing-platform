"use strict";

/**
 * src/modules/report/controllers/incident.controller.js
 * Thin controller for incident management endpoints.
 */

const ReportRepo     = require("../repositories/report.repository");
const TicketRepo     = require("../../ticket/repositories/ticket.repository");
const ActivityRepo   = require("../../activity/repositories/activity.repository");
const IncidentService = require("../services/incident.service");
const { ok, fail }   = require("../../../common/helpers");
const { createLogger } = require("../../../common/logger");

const logger = createLogger("INCIDENT_CTRL");

async function getActive(req, res) {
  try {
    const rows      = await ReportRepo.getActiveIncidents(50);
    const incidents = rows.map((r) => {
      const ff       = r.form_fields || {};
      const discData = r.discord     || {};
      const category = IncidentService.detectCategory(
        `${ff["Incident Information"] || ""} ${ff["Indicated Issue"] || ""}`,
        ff["Suspect Area"] || ""
      );
      return {
        id:          r.id,
        title:       ff["Incident Title"] || ff["Incident Information"] || `Incident #${r.id}`,
        status:      r.status_pengusulan,
        statusLabel: IncidentService.buildStatusEmoji(r.status_pengusulan),
        statusNote:  r.status_note,
        category,
        priority:    ff["Priority Incident"] || "Medium",
        severity:    ff["Severity Incident"] || "Medium",
        assignee:    r.assignee || [],
        groupedTicketIds: discData.groupedTicketIds || [],
        threadUrl:   discData.threadUrl  || null,
        summary:     r.summary_ticket,
        rootCause:   r.root_cause,
        createdAt:   r.created_at,
        updatedAt:   r.updated_at,
      };
    });
    return ok(res, { count: incidents.length, incidents });
  } catch (err) {
    logger.error(`getActive error: ${err.message}`);
    return fail(res, err);
  }
}

async function getStats(req, res) {
  try {
    const stats = await ReportRepo.getIncidentStats();
    return ok(res, { stats });
  } catch (err) {
    logger.error(`getStats error: ${err.message}`);
    return fail(res, err);
  }
}

async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const ticket = await TicketRepo.findById(id);
    if (!ticket)                    return res.status(404).json({ error: `Ticket #${id} not found` });
    if (ticket.type !== "INCIDENT") return res.status(400).json({ error: "Not an incident ticket" });

    const ff       = ticket.formFields || {};
    const discData = ticket.discord    || {};
    const category = IncidentService.detectCategory(
      `${ff["Incident Information"] || ""} ${ff["Indicated Issue"] || ""}`,
      ff["Suspect Area"] || ""
    );

    let groupedSummaries = [];
    const grouped = discData.groupedTicketIds || [];
    if (grouped.length > 0) {
      try {
        const rows = await ReportRepo.findManyByIds(grouped);
        groupedSummaries = rows.map((r) => {
          const gff = r.form_fields || {};
          return { id: r.id, title: gff["Incident Information"] || `Ticket #${r.id}`, status: r.status_pengusulan };
        });
      } catch (_) {}
    }

    return ok(res, {
      incident: {
        id: ticket.id, title: ff["Incident Title"] || ff["Incident Information"] || `Incident #${ticket.id}`,
        status: ticket.statusPengusulan, statusLabel: IncidentService.buildStatusEmoji(ticket.statusPengusulan),
        statusNote: ticket.statusNote, category,
        priority: ff["Priority Incident"] || "Medium", severity: ff["Severity Incident"] || "Medium",
        formFields: ff, assignee: ticket.assignee || [],
        summary: ticket.summaryTicket, rootCause: ticket.rootCause, timeline: ticket.timelineActionTaken,
        groupedTickets: groupedSummaries, threadUrl: discData.threadUrl,
        createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, resolvedAt: ticket.resolvedAt,
      },
    });
  } catch (err) {
    logger.error(`getById error: ${err.message}`);
    return fail(res, err);
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const { status, note } = req.body;
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });
    if (!status)              return res.status(400).json({ error: "status required" });

    const validStatuses = ["INVESTIGASI", "MITIGASI", "RESOLVED", "OPEN"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const result = await IncidentService.updateIncidentStatus(id, status.toUpperCase(), note || "");
    if (!result.ok) return res.status(400).json({ error: result.reason });

    const updated = await TicketRepo.findById(id);
    return ok(res, { ticketId: id, newStatus: status.toUpperCase(), broadcast: result.broadcast, ticket: updated });
  } catch (err) {
    logger.error(`updateStatus error: ${err.message}`);
    return fail(res, err);
  }
}

async function broadcast(req, res) {
  try {
    const id   = Number(req.params.id);
    const note = req.body?.note || "";
    if (isNaN(id) || id < 1) return res.status(400).json({ error: "id tidak valid" });

    const ticket = await TicketRepo.findById(id);
    if (!ticket)                    return res.status(404).json({ error: `Ticket #${id} not found` });
    if (ticket.type !== "INCIDENT") return res.status(400).json({ error: "Not an incident ticket" });

    IncidentService.processIncident(ticket, { updateNote: note, forceBroadcast: true })
      .catch((err) => logger.warn(`Broadcast error: ${err.message}`));

    await ActivityRepo.create({
      ticketId:    id,
      type:        "incident_manual_broadcast",
      description: `Manual broadcast triggered${note ? `: ${note.substring(0, 200)}` : ""}`,
    });

    return ok(res, { message: "Broadcast triggered (async)" });
  } catch (err) {
    logger.error(`broadcast error: ${err.message}`);
    return fail(res, err);
  }
}

module.exports = { getActive, getStats, getById, updateStatus, broadcast };
