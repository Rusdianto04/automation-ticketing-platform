/**
 * features/ticket/index.ts
 * Public API untuk ticket feature module.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type { Ticket, TicketStatus, TicketType } from "@/types";
export * from "./ticket.types";

// ── Display utilities ─────────────────────────────────────────────────────────
// getTicketTitle, getRequesterName, formatDate berasal dari lib/tickets (via ticket.utils)
export {
  getTicketTitle,
  getRequesterName,
  formatDate,
  getStatusLabel,
  getStatusColor,
  getValidStatuses,
  getTicketMode,
  VALID_STATUSES_TICKETING,
  VALID_STATUSES_INCIDENT,
  STATUS_LABEL,
  STATUS_COLOR,
} from "./ticket.utils";

// ── Data access ───────────────────────────────────────────────────────────────
export {
  getAllTickets,
  getIncidentTickets,
  getTicketById,
  getTicketStats,
  updateTicketStatus,
  reassignTicket,
} from "@/lib/tickets";