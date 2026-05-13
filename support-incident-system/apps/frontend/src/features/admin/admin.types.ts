/**
 * features/admin/admin.types.ts
 */

export interface DashboardStats {
  total:         number;
  todayTotal:    number;
  openCount:     number;
  pendingCount:  number;
  doneCount:     number;
  incidentCount: number;
  rejectCount:   number;
}

export interface SystemStatus {
  discord_bot:    "ONLINE" | "OFFLINE" | "STARTING";
  discord_detail: string;
  n8n_workflow:   "RUNNING" | "OFFLINE";
  n8n_detail:     string;
  database:       "HEALTHY" | "DEGRADED";
  db_detail:      string;
  ai_service:     "ACTIVE" | "IDLE";
  ai_detail:      string;
  db_response_ms: number;
}

export interface StatsResponse {
  stats:     DashboardStats;
  system:    SystemStatus;
  timestamp: string;
}

export interface ActivityLog {
  id:        string;
  timestamp: string;
  level:     "SUCCESS" | "ERROR" | "WARN" | "INFO";
  component: "DISCORD_BOT" | "N8N_WORKFLOW" | "AI_SERVICE" | "EMAIL" | "DATABASE";
  type:      string;
  message:   string;
  ticket_id: number | null;
}

export interface AdminTicketRow {
  id:        number;
  type:      string;
  title:     string;
  status:    string;
  assignee:  unknown[];
  createdAt: string;
}
