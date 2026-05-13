"use strict";

/**
 * src/modules/ticket/mappers/ticket.mapper.js
 * Maps raw DB rows to domain objects and vice-versa.
 */

const { getTicketMode } = require("../../../common/utils/ticket");

/**
 * @param {object} raw - raw DB row (snake_case)
 * @returns {object}   - normalized domain ticket object (camelCase)
 */
function toDomain(raw) {
  if (!raw) return null;

  let formFields = raw.form_fields || raw.formFields || {};
  if (typeof formFields === "string") { try { formFields = JSON.parse(formFields); } catch { formFields = {}; } }

  let assignee = raw.assignee || [];
  if (typeof assignee === "string") { try { assignee = JSON.parse(assignee); } catch { assignee = []; } }

  let evidence = raw.evidence_attachment || raw.evidenceAttachment || [];
  if (typeof evidence === "string") { try { evidence = JSON.parse(evidence); } catch { evidence = []; } }

  let discord = raw.discord || {};
  if (typeof discord === "string") { try { discord = JSON.parse(discord); } catch { discord = {}; } }

  return {
    id:                   raw.id,
    type:                 raw.type,
    formId:               raw.form_id         ?? raw.formId,
    formFields,
    statusPengusulan:     raw.status_pengusulan ?? raw.statusPengusulan,
    statusNote:           raw.status_note      ?? raw.statusNote       ?? null,
    assignee:             Array.isArray(assignee) ? assignee : [],
    evidenceAttachment:   Array.isArray(evidence) ? evidence : [],
    timelineTindakLanjut: raw.timeline_tindak_lanjut ?? raw.timelineTindakLanjut ?? null,
    timelineActionTaken:  raw.timeline_action_taken  ?? raw.timelineActionTaken  ?? null,
    summaryTicket:        raw.summary_ticket   ?? raw.summaryTicket    ?? null,
    rootCause:            raw.root_cause       ?? raw.rootCause        ?? null,
    searchKeywords:       raw.search_keywords  ?? raw.searchKeywords   ?? [],
    discord,
    resolvedAt:           raw.resolved_at      ?? raw.resolvedAt       ?? null,
    createdAt:            raw.created_at       ?? raw.createdAt,
    updatedAt:            raw.updated_at       ?? raw.updatedAt,
  };
}

/**
 * @param {object} domain - domain ticket
 * @returns {object}      - public response shape
 */
function toResponse(domain) {
  if (!domain) return null;
  return {
    ...domain,
    mode: getTicketMode(domain),
  };
}

module.exports = { toDomain, toResponse };
