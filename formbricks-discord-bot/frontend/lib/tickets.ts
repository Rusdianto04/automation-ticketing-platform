// lib/tickets.ts — Data Access Layer (Frontend Portal)
// Updated v6: Static Form Support, field mapping baru
import { prisma } from "./prisma";
import type { Ticket, TicketStatus, TicketType } from "@/types";

export async function getAllTickets(options?: {
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}): Promise<Ticket[]> {
  const { limit = 200, status, type } = options || {};

  const where: Record<string, unknown> = {};

  if (status === "RESOLVED") {
    where.status_pengusulan = "RESOLVED";
  } else if (status && status !== "ALL") {
    where.status_pengusulan = status;
  }

  if (type && type !== "ALL") {
    where.type = type;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = await (prisma as any).ticket.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit,
  });

  return tickets.map(normalizeTicket);
}

// Ambil hanya ticket INCIDENT (untuk tampilan publik)
export async function getIncidentTickets(limit = 50): Promise<Ticket[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = await (prisma as any).ticket.findMany({
    where: { type: "INCIDENT" },
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return tickets.map(normalizeTicket);
}

export async function getTicketById(id: number): Promise<Ticket | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  const ticket = await p.ticket.findUnique({
    where: { id },
    include: {
      activities: {
        orderBy: { created_at: "desc" },
        take: 20,
      },
    },
  });
  if (!ticket) return null;

  const normalized = normalizeTicket(ticket);

  // Cari report_url dari tabel incident_reports jika belum ada
  if (normalized.type === "INCIDENT" && !normalized.report_url) {
    try {
      const report = await p.incidentReport.findFirst({
        where: { ticket_id: id },
        orderBy: { generated_at: "desc" },
      });
      if (report?.file_url) {
        normalized.report_url = report.file_url;
      }
    } catch {
      // Non-fatal
    }
  }

  return normalized;
}

export async function getTicketStats() {
  const p = prisma as any;
  // Total semua ticket (support + incident)
  // Open  = semua ticket yang belum selesai (OPEN, PENDING, INVESTIGASI, MITIGASI, APPROVED, IN_PROGRESS)
  // Closed = semua ticket yang sudah selesai (DONE, RESOLVED, REJECT, REJECTED)
  const [total, openCount, closedCount] = await Promise.all([
    p.ticket.count(),
    p.ticket.count({
      where: {
        status_pengusulan: {
          in: ["OPEN", "PENDING", "INVESTIGASI", "MITIGASI", "APPROVED", "IN_PROGRESS"],
        },
      },
    }),
    p.ticket.count({
      where: {
        status_pengusulan: {
          in: ["DONE", "RESOLVED", "REJECT", "REJECTED"],
        },
      },
    }),
  ]);

  return { total, openCount, closedCount };
}
export async function updateTicketStatus(id: number, status: TicketStatus, note?: string) {
  const isResolved = status === "DONE" || status === "RESOLVED";
  const isReopened = status === "OPEN" || status === "INVESTIGASI" || status === "MITIGASI" || status === "PENDING";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any).ticket.update({
    where: { id },
    data: {
      status_pengusulan: status,
      status_note:       note,
      updated_at:        new Date(),
      ...(isResolved  ? { resolved_at: new Date() } : {}),
      ...(isReopened  ? { resolved_at: null }        : {}),
    },
  });
}

export async function reassignTicket(id: number, assignees: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any).ticket.update({
    where: { id },
    data: { assignee: assignees, updated_at: new Date() },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTicket(raw: any): Ticket {
  let formFields = raw.form_fields;
  if (typeof formFields === "string") {
    try { formFields = JSON.parse(formFields); } catch { formFields = {}; }
  }

  let assignee = raw.assignee;
  if (typeof assignee === "string") {
    try { assignee = JSON.parse(assignee); } catch { assignee = []; }
  }

  let evidence = raw.evidence_attachment;
  if (typeof evidence === "string") {
    try { evidence = JSON.parse(evidence); } catch { evidence = []; }
  }

  let discord = raw.discord;
  if (typeof discord === "string") {
    try { discord = JSON.parse(discord); } catch { discord = {}; }
  }

  const discordObj = discord || {};
  const summaryTicket = raw.summary_ticket ?? null;
  const rootCause     = raw.root_cause     ?? null;

  const reportUrl =
    raw.report_url           ||
    discordObj.reportUrl     ||
    discordObj.report_url    ||
    discordObj.file_url      ||
    discordObj.fileUrl       ||
    discordObj.reportFileUrl ||
    null;

  let status = raw.status_pengusulan || "OPEN";
  if (status === "APPROVED")  status = "IN_PROGRESS";
  if (status === "REJECTED")  status = "REJECT";

  return {
    ...raw,
    form_fields:            formFields || {},
    assignee:               Array.isArray(assignee) ? assignee : [],
    evidence_attachment:    Array.isArray(evidence) ? evidence : [],
    discord:                discordObj,
    status_pengusulan:      status as TicketStatus,
    type:                   (raw.type === "INCIDENT" ? "INCIDENT" : "TICKETING") as TicketType,
    summary_ticket:         summaryTicket,
    root_cause:             rootCause,
    report_url:             reportUrl,
    timeline_tindak_lanjut: raw.timeline_tindak_lanjut ?? null,
    timeline_action_taken:  raw.timeline_action_taken  ?? null,
    created_at:  raw.created_at?.toISOString?.()  ?? raw.created_at,
    updated_at:  raw.updated_at?.toISOString?.()  ?? raw.updated_at,
    resolved_at: raw.resolved_at?.toISOString?.() ?? raw.resolved_at,
    activities: raw.activities?.map((a: Record<string, unknown>) => ({
      ...a,
      created_at: (a.created_at as Date)?.toISOString?.() ?? a.created_at,
    })),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTicketTitle(ticket: Ticket): string {
  const f = ticket.form_fields;
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
  const f = ticket.form_fields;

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
      day:   "2-digit",
      month: "short",
      year:  "numeric",
      timeZone: "Asia/Jakarta",
    });

    if (!includeTime) return dateStr;

    const timeStr = d.toLocaleTimeString("en-US", {
      hour:   "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });

    const hour24 = parseInt(
      d.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }),
      10
    );
    const period = hour24 < 12 ? "AM" : "PM";

    return `${dateStr}, ${timeStr} ${period}`;
  } catch {
    return date;
  }
}