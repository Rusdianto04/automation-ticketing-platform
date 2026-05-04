// app/admin/tickets/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getAdminSessionAction } from "../../actions";
import { getTicketById, getTicketTitle, getRequesterName, formatDate } from "@/lib/tickets";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTicketDetailClient from "./AdminTicketDetailClient";
import type { TimelineItem } from "@/types";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_SELF_URL || process.env.BACKEND_URL || "http://backend:3000";
const API_KEY     = process.env.N8N_API_KEY || "automation_ticketing01_incident02";

async function fetchTechnicianRecommendation(ticketId: number) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/recommend/for-portal/${ticketId}?audience=technician`,
      { headers: { "x-api-key": API_KEY }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? data.recommendation : null;
  } catch {
    return null;
  }
}

// ✅ FIX: Konversi timeline (string | TimelineItem[] | null | undefined) → string
function serializeTimeline(raw: string | TimelineItem[] | null | undefined): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return JSON.stringify(raw);
  return "";
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSessionAction();
  if (!session) redirect("/admin/login");

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (isNaN(id)) notFound();

  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  // Fetch recommendation untuk teknisi (parallel, non-blocking)
  const recommendation = await fetchTechnicianRecommendation(id);

  const serialized = {
    id:           ticket.id,
    type:         ticket.type,
    title:        getTicketTitle(ticket),
    status:       ticket.status_pengusulan,
    status_note:  ticket.status_note || "",
    requester:    getRequesterName(ticket),
    form_fields:  ticket.form_fields as Record<string, string>,
    assignee: Array.isArray(ticket.assignee)
      ? ticket.assignee
          .map((a) =>
            typeof a === "string"
              ? a
              : (a as { username?: string; displayName?: string }).username ||
                (a as { username?: string; displayName?: string }).displayName ||
                ""
          )
          .filter(Boolean)
      : [],
    summary_ticket: ticket.summary_ticket || "",
    root_cause:     ticket.root_cause    || "",
    // ✅ FIX: Konversi timeline ke string agar kompatibel dengan interface AdminTicketDetailClient
    timeline_tindak_lanjut: serializeTimeline(ticket.timeline_tindak_lanjut),
    timeline_action_taken:  serializeTimeline(ticket.timeline_action_taken),
    discord:        (ticket.discord as { threadUrl?: string; threadId?: string }) || {},
    report_url:     ticket.report_url    || "",
    created_at:     formatDate(ticket.created_at, true),
    updated_at:     formatDate(ticket.updated_at, true),
    resolved_at:    ticket.resolved_at ? formatDate(ticket.resolved_at, true) : null,
    activities: (ticket.activities || [])
      .slice(0, 10)
      .map((a) => ({
        id:          a.id,
        type:        a.type,
        description: a.description || "",
        created_at:  formatDate(a.created_at, true),
      })),
    recommendation: recommendation || null,
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="admin-main">
        <AdminTicketDetailClient ticket={serialized} />
      </div>
    </div>
  );
}