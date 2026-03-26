// lib/tickets.ts — Data Access Layer (Frontend Portal)
import { prisma } from "./prisma";
import type { Ticket, TicketStatus, TicketType } from "@/types";

export async function getAllTickets(options?: {
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}): Promise<Ticket[]> {
  const { limit = 100, status, type } = options || {};

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
  const now = new Date();
  const todayWIB = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCHours() >= 17 ? now.getUTCDate() : now.getUTCDate() - 1,
      17, 0, 0, 0
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;

  const [total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount] =
    await Promise.all([
      p.ticket.count(),
      p.ticket.count({ where: { created_at: { gte: todayWIB } } }),
      p.ticket.count({ where: { status_pengusulan: "OPEN" } }),
      p.ticket.count({ where: { status_pengusulan: "PENDING" } }),
      // FIX: Hitung DONE dan RESOLVED sebagai "selesai" secara terpisah
      p.ticket.count({ where: { status_pengusulan: { in: ["DONE", "RESOLVED"] } } }),
      p.ticket.count({ where: { type: "INCIDENT" } }),
      p.ticket.count({ where: { status_pengusulan: { in: ["REJECT", "REJECTED"] } } }),
    ]);

  return { total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount };
}

export async function updateTicketStatus(id: number, status: TicketStatus, note?: string) {
  // FIX: Set resolved_at untuk semua status "selesai"
  // Support:  DONE       → set resolved_at
  // Incident: RESOLVED   → set resolved_at
  // Incident: INVESTIGASI, MITIGASI → hapus resolved_at (belum selesai)
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
    raw.report_url          ||
    discordObj.reportUrl    ||
    discordObj.report_url   ||
    discordObj.file_url     ||
    discordObj.fileUrl      ||
    discordObj.reportFileUrl ||
    null;

  // FIX: Jangan mapping status RESOLVED → DONE
  // RESOLVED adalah status valid untuk Incident (berbeda dari DONE untuk Support)
  // Hanya mapping status legacy lama yang tidak dipakai lagi
  let status = raw.status_pengusulan || "OPEN";
  if (status === "APPROVED")              status = "DONE";      // legacy Support
  if (status === "REJECTED")              status = "REJECT";    // legacy Support
  // CATATAN: RESOLVED tidak diubah — biarkan apa adanya dari DB

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
      (f["Incident Information"] as string) ||
      (f["Incident Title"]       as string) ||
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