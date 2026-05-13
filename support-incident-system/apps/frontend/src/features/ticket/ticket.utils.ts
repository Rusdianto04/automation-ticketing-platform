/**
 * features/ticket/ticket.utils.ts
 * Re-export helpers dari lib/tickets — single source of truth.
 */
import type { Ticket, TicketStatus } from "@/types";

export { getTicketTitle, getRequesterName, formatDate } from "@/lib/tickets";

export const STATUS_LABEL: Record<string, string> = {
  OPEN:        "Open",
  PENDING:     "Pending",
  APPROVED:    "Approved",
  IN_PROGRESS: "In Progress",
  INVESTIGASI: "Investigasi",
  MITIGASI:    "Mitigasi",
  REJECT:      "Ditolak",
  REJECTED:    "Ditolak",
  DONE:        "Selesai",
  RESOLVED:    "Resolved",
};

export const STATUS_COLOR: Record<string, string> = {
  OPEN:        "bg-emerald-100 text-emerald-700 border border-emerald-200",
  PENDING:     "bg-amber-100   text-amber-700   border border-amber-200",
  APPROVED:    "bg-blue-100    text-blue-700    border border-blue-200",
  IN_PROGRESS: "bg-blue-100    text-blue-700    border border-blue-200",
  INVESTIGASI: "bg-orange-100  text-orange-700  border border-orange-200",
  MITIGASI:    "bg-purple-100  text-purple-700  border border-purple-200",
  REJECT:      "bg-red-100     text-red-700     border border-red-200",
  REJECTED:    "bg-red-100     text-red-700     border border-red-200",
  DONE:        "bg-slate-100   text-slate-600   border border-slate-200",
  RESOLVED:    "bg-teal-100    text-teal-700    border border-teal-200",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function getStatusColor(status: string): string {
  return STATUS_COLOR[status] ?? "bg-gray-100 text-gray-700";
}

export const VALID_STATUSES_TICKETING: TicketStatus[] = [
  "OPEN", "PENDING", "APPROVED", "IN_PROGRESS", "REJECT", "DONE",
];

export const VALID_STATUSES_INCIDENT: TicketStatus[] = [
  "OPEN", "INVESTIGASI", "MITIGASI", "RESOLVED",
];

export function getValidStatuses(type: string): TicketStatus[] {
  return type === "INCIDENT" ? VALID_STATUSES_INCIDENT : VALID_STATUSES_TICKETING;
}

export function getTicketMode(ticket: Ticket): "INCIDENT" | "SUPPORT" {
  return ticket.type === "INCIDENT" ? "INCIDENT" : "SUPPORT";
}