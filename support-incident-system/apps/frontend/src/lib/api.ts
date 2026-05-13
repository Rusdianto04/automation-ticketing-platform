/**
 * src/lib/api.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized HTTP client for all backend API calls.
 * Frontend NEVER touches the database directly — always goes through here.
 *
 * Architecture decision:
 *   Frontend (Next.js) → lib/api.ts → Backend (Express) → Prisma → PostgreSQL
 *
 * This file replaces all direct Prisma usage in the frontend.
 */

const BACKEND_URL =
  process.env.BACKEND_SELF_URL ||
  process.env.BACKEND_URL ||
  "http://backend:3000";

const API_KEY =
  process.env.N8N_API_KEY || "automation_ticketing01_incident02";

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    API_KEY,
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errMsg = `Backend returned ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error || body.message || errMsg;
    } catch { /* non-json */ }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

async function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body:   JSON.stringify(body),
  });
}

async function apiPut<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PUT",
    body:   JSON.stringify(body),
  });
}

// ── Ticket API ────────────────────────────────────────────────────────────────

export async function apiGetAllTickets(options?: {
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (options?.limit)  params.set("limit",  String(options.limit));
  if (options?.status) params.set("status", options.status);
  if (options?.type)   params.set("type",   options.type);
  if (options?.search) params.set("search", options.search);

  const qs = params.toString();
  return apiGet<{ success: boolean; tickets: unknown[]; total: number }>(
    `/api/ticket${qs ? `?${qs}` : ""}`
  );
}

export async function apiGetTicketById(id: number) {
  return apiGet<{ success: boolean; ticket: unknown }>(`/api/ticket/${id}`);
}

export async function apiCreateTicket(data: {
  type: string;
  formFields: Record<string, string>;
  createdBy?: string;
  autoCreateDiscord?: boolean;
}) {
  return apiPost<{ success: boolean; ticketId: number; discord?: unknown; emailSent?: boolean }>(
    "/api/ticket/create",
    data
  );
}

export async function apiUpdateTicketStatus(
  id: number,
  status: string,
  note?: string,
  updatedBy?: string
) {
  return apiPut<{ success: boolean; ticketId: number; oldStatus: string; newStatus: string }>(
    `/api/ticket/${id}/status`,
    { status, note, updatedBy }
  );
}

export async function apiAssignTicket(id: number, assignees: unknown[], assignedBy?: string) {
  return apiPut<{ success: boolean }>(`/api/ticket/${id}/assign`, { assignees, assignedBy });
}

export async function apiSyncDiscord(id: number, action: string) {
  return apiPost<{ accepted: boolean }>(`/api/ticket/${id}/sync-discord`, { action });
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export async function apiGetAdminStats() {
  return apiGet<{
    stats:     Record<string, number>;
    system:    Record<string, string | number>;
    timestamp: string;
  }>("/api/admin/stats");
}

export async function apiGetActivities(options?: {
  limit?:     number;
  level?:     string;
  component?: string;
  since?:     string;
}) {
  const params = new URLSearchParams();
  if (options?.limit)     params.set("limit",     String(options.limit));
  if (options?.level)     params.set("level",     options.level);
  if (options?.component) params.set("component", options.component);
  if (options?.since)     params.set("since",     options.since);
  const qs = params.toString();
  return apiGet<{ logs: unknown[]; stats: Record<string, number> }>(
    `/api/admin/activities${qs ? `?${qs}` : ""}`
  );
}

export async function apiGetRecentTickets(limit = 10) {
  return apiGet<{ success: boolean; tickets: unknown[]; count: number }>(
    `/api/admin/recent-tickets?limit=${limit}`
  );
}

export async function apiExportTickets(type: "support" | "incident", options?: {
  startDate?: string;
  endDate?:   string;
  status?:    string;
}) {
  const params = new URLSearchParams();
  if (options?.startDate) params.set("startDate", options.startDate);
  if (options?.endDate)   params.set("endDate",   options.endDate);
  if (options?.status)    params.set("status",    options.status);
  const qs = params.toString();
  return apiGet<{ success: boolean; tickets: unknown[]; count: number }>(
    `/api/admin/export/${type}${qs ? `?${qs}` : ""}`
  );
}

export async function apiGetReportView(ticketId: number) {
  return apiGet<{ success: boolean; reportUrl: string; fileName: string }>(
    `/api/admin/report-view/${ticketId}`
  );
}

// ── Incident API ──────────────────────────────────────────────────────────────

export async function apiGetActiveIncidents() {
  return apiGet<{ success: boolean; incidents: unknown[]; count: number }>("/api/incident/active");
}

export async function apiGetIncidentStats() {
  return apiGet<{ success: boolean; stats: Record<string, number> }>("/api/incident/stats");
}

export async function apiGetIncidentById(id: number) {
  return apiGet<{ success: boolean; incident: unknown }>(`/api/incident/${id}`);
}

export async function apiUpdateIncidentStatus(id: number, status: string, note?: string) {
  return apiPost<{ success: boolean }>(`/api/incident/${id}/status`, { status, note });
}


// ── Admin ticket mutations (replaces direct Prisma in actions.ts) ─────────────

export async function apiUpdateTicketData(
  id: number,
  data: { requester?: string; resolved_at?: string | null }
) {
  return apiFetch<{ success: boolean }>(
    `/api/ticket/${id}/data`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function apiUpdateFormFields(
  id: number,
  formFields: Record<string, string>
) {
  return apiFetch<{ success: boolean }>(
    `/api/ticket/${id}/form-fields`,
    { method: "PATCH", body: JSON.stringify({ formFields }) }
  );
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function apiHealthCheck() {
  return apiGet<{ status: string; uptime: number }>("/health");
}
