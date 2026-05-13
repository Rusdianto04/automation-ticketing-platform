"use strict";

/**
 * src/common/constants/index.js
 * Global domain constants for the support-incident-system.
 */

const TICKET_STATUS = Object.freeze({
  OPEN:        "OPEN",
  PENDING:     "PENDING",
  APPROVED:    "APPROVED",
  IN_PROGRESS: "IN_PROGRESS",
  REJECTED:    "REJECTED",
  REJECT:      "REJECT",
  DONE:        "DONE",
  // Incident-specific
  INVESTIGASI: "INVESTIGASI",
  MITIGASI:    "MITIGASI",
  RESOLVED:    "RESOLVED",
});

const TICKET_TYPE = Object.freeze({
  TICKETING: "TICKETING",
  INCIDENT:  "INCIDENT",
});

const VALID_TICKET_STATUSES = Object.freeze({
  TICKETING: ["OPEN", "PENDING", "APPROVED", "IN_PROGRESS", "REJECTED", "REJECT", "DONE"],
  INCIDENT:  ["OPEN", "INVESTIGASI", "MITIGASI", "RESOLVED"],
});

const CLOSING_STATUSES = new Set(["DONE", "RESOLVED"]);
const OPEN_STATUSES    = new Set(["OPEN", "PENDING", "INVESTIGASI", "MITIGASI", "APPROVED", "IN_PROGRESS"]);

const ACTIVITY_TYPE = Object.freeze({
  CREATED:                  "created",
  THREAD_CREATED:           "thread_created",
  STATUS_UPDATE:            "status_update",
  ASSIGNED:                 "assigned",
  COMMENT:                  "comment",
  EVIDENCE:                 "evidence",
  TIMELINE_UPDATED:         "timeline_updated",
  REPORT_GENERATED:         "report_generated",
  DISCORD_ERROR:            "discord_error",
  INCIDENT_DETECTED:        "incident_detected",
  INCIDENT_MANUAL_BROADCAST:"incident_manual_broadcast",
  CHATBOT_AUTO_CREATE:      "chatbot_auto_create",
  ADMIN_UPDATE:             "admin_update",
});

const FORM_ID = Object.freeze({
  TICKETING:     process.env.FORM_ID_TICKETING || "zcp7cbqqrtavbyd6wwkmk2vx",
  INCIDENT:      process.env.FORM_ID_INCIDENT  || "cmiobkjfm2piqad012scz1yxf",
  ADMIN_PORTAL:  "admin_portal",
  STATIC_PORTAL: "static_portal",
  CHATBOT:       "chatbot_auto_create",
});

module.exports = {
  TICKET_STATUS,
  TICKET_TYPE,
  VALID_TICKET_STATUSES,
  CLOSING_STATUSES,
  OPEN_STATUSES,
  ACTIVITY_TYPE,
  FORM_ID,
};
