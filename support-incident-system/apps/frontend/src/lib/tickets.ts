// Architecture: Frontend → lib/tickets.ts → lib/api.ts → Backend API → Prisma
import {
  apiGetAllTickets,
  apiGetTicketById,
  apiUpdateTicketStatus,
  apiAssignTicket,
} from "./api";
import type { Ticket, TicketStatus, TicketType } from "@/types";

export async function getAllTickets(options?: {
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}): Promise<Ticket[]> {
  try {
    const data = await apiGetAllTickets({
      limit:  options?.limit ?? 200,
      status: options?.status && options.status !== "ALL" ? options.status : undefined,
      type:   options?.type   && options.type   !== "ALL" ? options.type   : undefined,
      search: options?.search,
    });
    // Backend list returns ticketListItemDTO (camelCase, has title)
    return (data.tickets as unknown[]).map(normalizeListTicket);
  } catch (err) {
    console.error("[tickets] getAllTickets error:", err);
    return [];
  }
}

export async function getIncidentTickets(limit = 50): Promise<Ticket[]> {
  return getAllTickets({ type: "INCIDENT", limit });
}

export async function getTicketById(id: number): Promise<Ticket | null> {
  try {
    const data = await apiGetTicketById(id);
    if (!data?.ticket) return null;
    // Backend getById returns ticketDetailDTO (camelCase, has formFields)
    return normalizeDetailTicket(data.ticket);
  } catch (err) {
    console.error(`[tickets] getTicketById(${id}) error:`, err);
    return null;
  }
}

export async function getTicketStats() {
  try {
    const tickets = await getAllTickets({ limit: 2000 });
    const openStatuses  = ["OPEN", "PENDING", "INVESTIGASI", "MITIGASI", "IN_PROGRESS"];
    const closeStatuses = ["DONE", "RESOLVED", "REJECT", "REJECTED"];
    return {
      total:       tickets.length,
      openCount:   tickets.filter(t => openStatuses.includes(t.status_pengusulan)).length,
      closedCount: tickets.filter(t => closeStatuses.includes(t.status_pengusulan)).length,
    };
  } catch (err) {
    console.error("[tickets] getTicketStats error:", err);
    return { total: 0, openCount: 0, closedCount: 0 };
  }
}

export async function updateTicketStatus(id: number, status: TicketStatus, note?: string) {
  return apiUpdateTicketStatus(id, status, note);
}

export async function reassignTicket(id: number, assignees: string[]) {
  return apiAssignTicket(id, assignees);
}

// ─── normalizeListTicket ───────────────────────────────────────────────────────
function normalizeListTicket(raw: any): Ticket {
  let assignee = raw.assignee ?? [];
    if (typeof assignee === "string") {
      try { assignee = JSON.parse(assignee); } catch { assignee = []; }
    }
    // Normalize: jika array of strings, jadikan array of objects agar konsisten
    if (Array.isArray(assignee)) {
      assignee = assignee.map((a: unknown) =>
        typeof a === "string" ? { username: a, name: a } : a
      );
    }

  let status: TicketStatus = (raw.status ?? raw.statusPengusulan ?? raw.status_pengusulan ?? "OPEN") as TicketStatus;
  if ((status as string) === "APPROVED")  status = "IN_PROGRESS";
  if ((status as string) === "REJECTED")  status = "REJECT";

  // Rebuild minimal form_fields dari DTO fields agar getTicketTitle() bisa dipakai
  // Backend sudah kirim title — kita simpan di form_fields sesuai type
  const syntheticFormFields: Record<string, string> = {};
  if (raw.type === "INCIDENT") {
    if (raw.title && raw.title !== "Incident Report") {
      syntheticFormFields["Incident Title"] = raw.title;
    }
  } else {
    if (raw.title && raw.title !== "Ticket Support" && raw.title !== "Tiket Support") {
      syntheticFormFields["Issue"] = raw.title;
    }
  }
  if (raw.reporter) syntheticFormFields["Reporter Information"] = raw.reporter;
  if (raw.division) syntheticFormFields["Division"] = raw.division;

  return {
    id:                  raw.id,
    type:                (raw.type === "INCIDENT" ? "INCIDENT" : "TICKETING") as TicketType,
    form_id:             raw.formId ?? raw.form_id ?? "",
    form_fields:         syntheticFormFields,
    status_pengusulan:   status,
    status_note:         raw.statusNote ?? raw.status_note ?? undefined,
    assignee:            Array.isArray(assignee) ? assignee : [],
    evidence_attachment: [],
    discord:             {},
    summary_ticket:      raw.summary ?? raw.summaryTicket ?? raw.summary_ticket ?? null,
    root_cause:          raw.rootCause ?? raw.root_cause ?? null,
    search_keywords:     raw.searchKeywords ?? raw.search_keywords ?? [],
    report_url:          raw.reportUrl ?? raw.report_url ?? null,
    timeline_tindak_lanjut: undefined,
    timeline_action_taken:  undefined,
    resolved_at:         raw.resolvedAt ?? raw.resolved_at ?? null,
    created_at:          raw.createdAt ?? raw.created_at ?? "",
    updated_at:          raw.updatedAt ?? raw.updated_at ?? "",
  };
}

// ─── normalizeDetailTicket ─────────────────────────────────────────────────────
function normalizeDetailTicket(raw: any): Ticket {
  let formFields = raw.formFields ?? raw.form_fields ?? {};
  if (typeof formFields === "string") {
    try { formFields = JSON.parse(formFields); } catch { formFields = {}; }
  }

  let assignee = raw.assignee ?? [];
  if (typeof assignee === "string") {
    try { assignee = JSON.parse(assignee); } catch { assignee = []; }
  }
  // Normalize: jika array of strings, jadikan array of objects agar konsisten
  if (Array.isArray(assignee)) {
    assignee = assignee.map((a: unknown) =>
      typeof a === "string" ? { username: a, name: a } : a
    );
  }

  let evidence = raw.evidenceAttachment ?? raw.evidence_attachment ?? [];
  if (typeof evidence === "string") {
    try { evidence = JSON.parse(evidence); } catch { evidence = []; }
  }

  let discord = raw.discord ?? {};
  if (typeof discord === "string") {
    try { discord = JSON.parse(discord); } catch { discord = {}; }
  }
  const discordObj = discord || {};

  const reportUrl =
    raw.reportUrl        ||
    raw.report_url       ||
    discordObj.reportUrl ||
    discordObj.report_url||
    discordObj.file_url  ||
    null;

  // ticketDetailDTO uses "status" not "statusPengusulan"
  let status: TicketStatus = (
    raw.status ?? raw.statusPengusulan ?? raw.status_pengusulan ?? "OPEN"
  ) as TicketStatus;
  if ((status as string) === "APPROVED")  status = "IN_PROGRESS";
  if ((status as string) === "REJECTED")  status = "REJECT";

  return {
    id:                  raw.id,
    type:                (raw.type === "INCIDENT" ? "INCIDENT" : "TICKETING") as TicketType,
    form_id:             raw.formId ?? raw.form_id ?? "",
    form_fields:         formFields || {},
    status_pengusulan:   status,
    status_note:         raw.statusNote ?? raw.status_note ?? undefined,
    assignee:            Array.isArray(assignee) ? assignee : [],
    evidence_attachment: Array.isArray(evidence) ? evidence : [],
    discord:             discordObj,
    summary_ticket:      raw.summaryTicket ?? raw.summary_ticket ?? null,
    root_cause:          raw.rootCause     ?? raw.root_cause     ?? null,
    search_keywords:     raw.searchKeywords ?? raw.search_keywords ?? [],
    report_url:          reportUrl,
    timeline_tindak_lanjut: raw.timelineTindakLanjut ?? raw.timeline_tindak_lanjut ?? undefined,
    timeline_action_taken:  raw.timelineActionTaken  ?? raw.timeline_action_taken  ?? undefined,
    resolved_at:         raw.resolvedAt ?? raw.resolved_at ?? null,
    created_at:          raw.createdAt  ?? raw.created_at  ?? "",
    updated_at:          raw.updatedAt  ?? raw.updated_at  ?? "",
    activities:          (raw.activities ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      created_at: (a.created_at ?? a.createdAt) as string,
    })),
  };
}

// ── Display helpers ────────────────────────────────────────────────────────────
export function getTicketTitle(ticket: Ticket): string {
  const f = ticket.form_fields ?? {};
  if (ticket.type === "INCIDENT") {
    return (
      (f["Incident Title"]       as string) ||
      (f["Incident Information"] as string) ||
      "Incident Report"
    );
  }
  return (
    (f["Issue"]  as string) ||
    (f["Judul"]  as string) ||
    (f["Title"]  as string) ||
    "Tiket Support"
  );
}

export function getRequesterName(ticket: Ticket): string {
  const f = ticket.form_fields ?? {};
  const name =
    (f["Reporter Information"] as string) ||
    (f["Name"]                 as string) ||
    (f["Nama"]                 as string) ||
    (f["Reporter Name"]        as string) ||
    (f["Nama Pemohon"]         as string) ||
    (f["Full Name"]            as string) ||
    "";
  if (name && name.includes("@")) return "—";
  return name.trim() || "—";
}

export function formatDate(date: string | null | undefined, includeTime = false): string {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const dateStr = d.toLocaleDateString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    if (!includeTime) return dateStr;
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Asia/Jakarta",
    });
    return `${dateStr}, ${timeStr} WIB`;
  } catch {
    return date;
  }
}