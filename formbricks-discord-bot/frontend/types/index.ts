// types/index.ts

export type TicketStatus = "OPEN" | "PENDING" | "DONE" | "REJECT" | "INVESTIGASI" | "MITIGASI" | "RESOLVED";
export type TicketType   = "TICKETING" | "INCIDENT";

export interface AssigneeInfo {
  username?: string;
  displayName?: string;
  name?: string;
  id?: string;
}

export interface TimelineItem {
  timestamp?: string;
  date?: string;
  action?: string;
  status?: string;
  note?: string;
  actionBy?: string;
  by?: string;
}

export interface DiscordInfo {
  threadId?: string;
  channelId?: string;
  threadUrl?: string;
  messageId?: string;
}

export interface Ticket {
  id: number;
  type: TicketType;
  form_id: string;
  form_fields: Record<string, string | string[]>;
  status_pengusulan: TicketStatus;
  status_note?: string;
  assignee?: AssigneeInfo[] | string[];
  timeline_tindak_lanjut?: string | TimelineItem[];
  timeline_action_taken?: string | TimelineItem[];
  evidence_attachment?: string[];
  discord?: DiscordInfo;
  summary_ticket?: string;
  root_cause?: string;
  search_keywords?: string[];
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  activities?: Activity[];
  report_url?: string;
}

export interface Activity {
  id: number;
  ticket_id: number;
  type: string;
  description?: string;
  created_at: string;
}

// Admin types
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: "ADMIN";
  created_at: string;
}

export interface AutomationLog {
  id: number;
  timestamp: string;
  level: "INFO" | "SUCCESS" | "ERROR" | "WARN";
  component: "DISCORD_BOT" | "N8N_WORKFLOW" | "AI_SERVICE" | "DATABASE" | "EMAIL";
  message: string;
  ticket_id?: number;
  metadata?: Record<string, unknown>;
}

export interface SystemStatus {
  discord_bot: "ONLINE" | "OFFLINE" | "DEGRADED";
  n8n_workflow: "RUNNING" | "STOPPED" | "ERROR";
  database: "HEALTHY" | "DEGRADED" | "DOWN";
  ai_service: "ACTIVE" | "INACTIVE" | "ERROR";
}

export interface DashboardStats {
  total_today: number;
  open_tickets: number;
  resolved_tickets: number;
  pending_tickets: number;
  incident_count: number;
  automation_success_rate: number;
  automation_failed: number;
  avg_resolution_hours: number;
}