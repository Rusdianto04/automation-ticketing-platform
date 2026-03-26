/**
 * src/utils/ticket.js
 * Ticket Helper Utilities
 *
 * Normalisasi field, formatting, dan helper yang digunakan
 * di berbagai modul (handlers, services, routes).
 */

"use strict";

/**
 * Normalisasi ticket dari Prisma (snake_case) ke camelCase aliases.
 * Prisma mengembalikan nama kolom persis seperti di DB (snake_case).
 * Alias camelCase memastikan kompatibilitas dengan kode Discord handler.
 *
 * @param {object|null} t  — raw Prisma record
 * @returns {object|null}
 */
function normalizeTicket(t) {
  if (!t) return null;
  return {
    ...t,
    // camelCase aliases — backward compat
    formId:               t.form_id,
    formFields:           t.form_fields,
    statusPengusulan:     t.status_pengusulan,
    statusNote:           t.status_note,
    timelineTindakLanjut: t.timeline_tindak_lanjut,
    timelineActionTaken:  t.timeline_action_taken,
    evidenceAttachment:   t.evidence_attachment,
    summaryTicket:        t.summary_ticket,
    rootCause:            t.root_cause,
    searchKeywords:       t.search_keywords,
    resolvedAt:           t.resolved_at,
    createdAt:            t.created_at,
    updatedAt:            t.updated_at,
  };
}

/**
 * Parse ticket ID dari string — support "#123" atau "123".
 * @param {string|number|null} rawId
 * @returns {number|null}
 */
function normalizeTicketId(rawId) {
  if (!rawId) return null;
  const parsed = parseInt(String(rawId).replace(/^#/, "").trim(), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Ambil judul tiket dari form_fields.
 * @param {object} ticket — normalized ticket
 * @returns {string}
 */
function getTicketTitle(ticket) {
  const fields = ticket.formFields || ticket.form_fields || {};
  if (ticket.type === "INCIDENT") return fields["Incident Information"] || "Incident Report";
  return fields["Issue"] || "Ticket Support";
}

/**
 * Format array assignee untuk tampilan Discord (mention).
 */
function formatAssigneeForDiscord(assigneeArray) {
  if (!Array.isArray(assigneeArray) || assigneeArray.length === 0) {
    return "(Belum ada petugas yang ditugaskan)";
  }
  return assigneeArray.map((a) => a.mention).join(" ");
}

/**
 * Format array assignee untuk tampilan web (username).
 */
function formatAssigneeForWeb(assigneeArray) {
  if (!Array.isArray(assigneeArray) || assigneeArray.length === 0) {
    return "(Belum ada petugas yang ditugaskan)";
  }
  return assigneeArray.map((a) => a.username).join(", ");
}

/**
 * Format array evidence untuk tampilan (URL per baris).
 */
function formatEvidenceForDisplay(evidenceArray) {
  if (!Array.isArray(evidenceArray) || evidenceArray.length === 0) {
    return "(Belum ada lampiran)";
  }
  return evidenceArray.map((item) => item.url).join("\n");
}

/**
 * Tentukan mode tiket berdasarkan status.
 * @returns {"CLOSING"|"MONITORING"}
 */
function getTicketMode(ticket) {
  const status = ticket.statusPengusulan || ticket.status_pengusulan;
  if (ticket.type === "INCIDENT" && status === "RESOLVED") return "CLOSING";
  if (ticket.type !== "INCIDENT" && status === "DONE")     return "CLOSING";
  return "MONITORING";
}

/**
 * Bersihkan nilai form dari Formbricks payload.
 */
function cleanValue(v) {
  if (Array.isArray(v)) {
    const filtered = v.filter(
      (x) => x && String(x).trim() !== "" && !String(x).match(/^[a-z0-9_-]{10,}$/i)
    );
    return filtered.length ? filtered.join("\n") : null;
  }
  if (!v) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

module.exports = {
  normalizeTicket,
  normalizeTicketId,
  getTicketTitle,
  formatAssigneeForDiscord,
  formatAssigneeForWeb,
  formatEvidenceForDisplay,
  getTicketMode,
  cleanValue,
};
