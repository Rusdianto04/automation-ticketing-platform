"use strict";

/**
 * src/modules/ticket/dto/ticket.dto.js
 * Data Transfer Objects for the ticket module.
 * Handles request validation shapes and response transformation.
 */

const { TICKET_TYPE, VALID_TICKET_STATUSES, TICKET_STATUS } = require("../../../common/constants");

// ─── Request DTOs ─────────────────────────────────────────────────────────────

class CreateTicketDTO {
  constructor(body) {
    let type = body.type;
    if (type === "SUPPORT") type = "TICKETING";
    this.type              = type;
    this.formFields        = body.formFields    || body.form_fields    || {};
    this.formId            = body.formId        || body.form_id        || "static_portal";
    this.createdBy         = body.createdBy     || body.created_by     || null;
    this.autoCreateDiscord = body.autoCreateDiscord !== false;
    this.keywords          = Array.isArray(body.keywords) ? body.keywords.slice(0, 15) : null;
  }

  validate() {
    if (!this.type) return "type wajib diisi (TICKETING atau INCIDENT)";
    if (!Object.values(TICKET_TYPE).includes(this.type))
      return `type tidak valid. Gunakan: ${Object.values(TICKET_TYPE).join(", ")}`;
    if (!this.formFields || Object.keys(this.formFields).length === 0)
      return "formFields wajib diisi";
    return null;
  }
}

class UpdateStatusDTO {
  constructor(body) {
    this.status    = body.status;
    this.note      = body.note?.trim() || null;
    this.updatedBy = body.updatedBy || null;
  }

  validate(ticketType) {
    if (!this.status) return "status wajib diisi";
    const validList = VALID_TICKET_STATUSES[ticketType] || Object.values(TICKET_STATUS);
    if (!validList.includes(this.status))
      return `Status "${this.status}" tidak valid untuk ${ticketType}. Valid: ${validList.join(", ")}`;
    return null;
  }
}

class AssignTicketDTO {
  constructor(body) {
    this.assignees  = body.assignees  || [];
    this.assignedBy = body.assignedBy || null;
  }

  validate() {
    if (!Array.isArray(this.assignees)) return "assignees harus berupa array";
    return null;
  }
}

class CommentTicketDTO {
  constructor(body) {
    this.comment  = body.comment?.trim() || "";
    this.userId   = body.userId   || null;
    this.userName = body.userName || null;
  }

  validate() {
    if (!this.comment) return "comment wajib diisi";
    return null;
  }
}

class AutoCreateTicketDTO {
  constructor(body) {
    let type = body.type;
    if (type === "SUPPORT") type = "TICKETING";
    this.type        = type;
    this.title       = body.title?.trim() || "";
    this.description = body.description?.trim() || "";
    this.keywords    = Array.isArray(body.keywords) ? body.keywords.slice(0, 15) : [];
    this.formFields  = body.formFields || null;
    this.createdBy   = body.createdBy  || "AI Chatbot";
  }

  validate() {
    if (!this.type)  return "type wajib diisi (TICKETING atau INCIDENT)";
    if (!this.title) return "title wajib diisi";
    if (!Object.values(TICKET_TYPE).includes(this.type))
      return `type tidak valid. Gunakan: ${Object.values(TICKET_TYPE).join(", ")}`;
    return null;
  }
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

function ticketListItemDTO(ticket) {
  const ff = ticket.formFields || ticket.form_fields || {};
  return {
    id:         ticket.id,
    type:       ticket.type,
    title:      ticket.type === "INCIDENT"
      ? (ff["Incident Title"] || ff["Incident Information"] || ff["Issue"] || "Incident Report")
      : (ff["Issue"] || "Ticket Support"),
    status:     ticket.statusPengusulan ?? ticket.status_pengusulan,
    statusNote: ticket.statusNote      ?? ticket.status_note,
    assignee:   ticket.assignee        ?? [],
    reporter:   ff["Reporter Information"] ?? "N/A",
    division:   ff["Division"]             ?? "N/A",
    priority:   ff["Priority Incident"]    ?? ff["Type of Support Requested"] ?? "Medium",
    summary:    ticket.summaryTicket ?? ticket.summary_ticket ?? null,
    rootCause:  ticket.rootCause    ?? ticket.root_cause     ?? null,
    createdAt:  ticket.createdAt    ?? ticket.created_at,
    updatedAt:  ticket.updatedAt    ?? ticket.updated_at,
  };
}

function ticketDetailDTO(ticket) {
  const { getTicketMode } = require("../../../common/utils/ticket");
  return {
    id:                   ticket.id,
    type:                 ticket.type,
    formId:               ticket.formId,
    formFields:           ticket.formFields,
    status:               ticket.statusPengusulan,
    statusNote:           ticket.statusNote,
    mode:                 getTicketMode(ticket),
    assignee:             ticket.assignee             ?? [],
    evidenceAttachment:   ticket.evidenceAttachment   ?? [],
    timelineActionTaken:  ticket.timelineActionTaken  ?? null,
    timelineTindakLanjut: ticket.timelineTindakLanjut ?? null,
    summaryTicket:        ticket.summaryTicket        ?? null,
    rootCause:            ticket.rootCause            ?? null,
    searchKeywords:       ticket.searchKeywords       ?? [],
    discord:              ticket.discord              ?? null,
    createdAt:            ticket.createdAt,
    updatedAt:            ticket.updatedAt,
    resolvedAt:           ticket.resolvedAt           ?? null,
  };
}

module.exports = {
  CreateTicketDTO,
  UpdateStatusDTO,
  AssignTicketDTO,
  CommentTicketDTO,
  AutoCreateTicketDTO,
  ticketListItemDTO,
  ticketDetailDTO,
};
