/**
 * features/ticket/ticket.types.ts
 * Ticket-feature-specific types and derived types.
 */

import type { Ticket, TicketStatus, TicketType } from "@/types";

export type { Ticket, TicketStatus, TicketType };

export interface TicketListItem {
  id:         number;
  type:       TicketType;
  title:      string;
  status:     TicketStatus;
  statusNote: string | null;
  assignee:   unknown[];
  reporter:   string;
  division:   string;
  priority:   string;
  summary:    string | null;
  createdAt:  string;
}

export interface TicketFilters {
  status?: TicketStatus | "ALL";
  type?:   TicketType   | "ALL";
  search?: string;
  limit?:  number;
}

export interface CreateTicketPayload {
  type:               TicketType;
  formFields:         Record<string, string>;
  createdBy?:         string;
  autoCreateDiscord?: boolean;
}

export interface UpdateStatusPayload {
  status:     TicketStatus;
  note?:      string;
  updatedBy?: string;
}

export interface AssignPayload {
  assignees:   string[];
  assignedBy?: string;
}
