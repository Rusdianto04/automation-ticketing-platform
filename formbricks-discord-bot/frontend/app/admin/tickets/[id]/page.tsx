// app/admin/tickets/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getAdminSessionAction } from "../../actions";
import { getTicketById, getTicketTitle, getRequesterName, formatDate } from "@/lib/tickets";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTicketDetailClient from "./AdminTicketDetailClient";

export const dynamic = "force-dynamic";

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
    discord:        (ticket.discord as { threadUrl?: string; threadId?: string }) || {},
    report_url:     ticket.report_url    || "",
    created_at:     formatDate(ticket.created_at, true),
    updated_at:     formatDate(ticket.updated_at, true),
    resolved_at:    ticket.resolved_at ? formatDate(ticket.resolved_at, true) : null,
    // FIX: Batasi 10 aktivitas terbaru saja
    activities: (ticket.activities || [])
      .slice(0, 10)
      .map((a) => ({
        id:          a.id,
        type:        a.type,
        description: a.description || "",
        created_at:  formatDate(a.created_at, true),
      })),
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