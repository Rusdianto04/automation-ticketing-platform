/**
 * src/common/utils/ticket.js
 * Ticket Helper Utilities
 *
 * Normalisasi field, formatting, dan helper yang digunakan
 * di berbagai modul (handlers, services, routes).
 *
 * NOTE: normalizeTicket() telah dipindahkan ke
 *       modules/ticket/mappers/ticket.mapper.js (toDomain).
 *       File ini hanya mengekspos utilities murni (non-DB).
 */

"use strict";

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
 * Support dua sumber:
 *   - Static Form (baru)  : "Incident Title"
 *   - Legacy / Discord    : "Incident Information"
 *   - Support             : "Issue"
 *
 * @param {object} ticket — normalized ticket
 * @returns {string}
 */
function getTicketTitle(ticket) {
  const fields = ticket.formFields || ticket.form_fields || {};
  if (ticket.type === "INCIDENT") {
    return (
      fields["Incident Title"]       ||
      fields["Incident Information"] ||
      "Incident Report"
    );
  }
  return fields["Issue"] || "Ticket Support";
}

/**
 * Format array assignee untuk tampilan Discord.
 * Handle dua format:
 *   1. Array of objects: [{mention, username, displayName, name}, ...]  (dari Discord bot)
 *   2. Array of strings: ["Budi", "Siti", "Tim Jaringan"]               (dari Portal Admin)
 */
function formatAssigneeForDiscord(assigneeArray) {
  if (!Array.isArray(assigneeArray) || assigneeArray.length === 0) {
    return "(Belum ada petugas yang ditugaskan)";
  }
  return (
    assigneeArray
      .map((a) => {
        if (typeof a === "string") return a.trim() || null;
        if (typeof a === "object" && a !== null) {
          return a.mention || a.displayName || a.username || a.name || null;
        }
        return null;
      })
      .filter(Boolean)
      .join(", ") || "(Belum ada petugas yang ditugaskan)"
  );
}

/**
 * Format array assignee untuk tampilan web (username).
 */
function formatAssigneeForWeb(assigneeArray) {
  if (!Array.isArray(assigneeArray) || assigneeArray.length === 0) {
    return "(Belum ada petugas yang ditugaskan)";
  }
  return assigneeArray
    .map((a) => {
      if (typeof a === "string") return a.trim();
      if (typeof a === "object" && a !== null) {
        return a.username || a.displayName || a.name || "";
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Format array evidence untuk tampilan (URL per baris).
 */
function formatEvidenceForDisplay(evidenceArray) {
  if (!Array.isArray(evidenceArray) || evidenceArray.length === 0) {
    return "(Belum ada lampiran)";
  }
  return evidenceArray.map((item) => (item.url || item)).join("\n");
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
 * Bersihkan nilai form dari webhook payload.
 * Tetap ada untuk kompatibilitas webhook legacy (Formbricks / lainnya).
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
  normalizeTicketId,
  getTicketTitle,
  formatAssigneeForDiscord,
  formatAssigneeForWeb,
  formatEvidenceForDisplay,
  getTicketMode,
  cleanValue,
};
