// app/admin/tickets/page.tsx
import { redirect } from "next/navigation";
import { getAdminSessionAction } from "../actions";
import { getAllTickets, getTicketTitle, getRequesterName, formatDate } from "@/features/ticket";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTicketsClient from "./AdminTicketsClient";

// Force dynamic — pakai cookies (session) + query DB saat runtime
export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const session = await getAdminSessionAction();
  if (!session) redirect("/admin/login");

  const tickets = await getAllTickets({ limit: 200 });

  const data = tickets.map((t) => ({
    id: t.id,
    type: t.type,
    title: getTicketTitle(t),
    status: t.status_pengusulan,
    requester: getRequesterName(t),
    assignee: Array.isArray(t.assignee)
      ? t.assignee
          .map((a) =>
            typeof a === "string" ? a : (a as {username?:string;displayName?:string}).username || (a as {username?:string;displayName?:string}).displayName || ""
          )
          .filter(Boolean)
          .join(", ")
      : "—",
    created_at: formatDate(t.created_at),
    updated_at: formatDate(t.updated_at),
  }));

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="admin-main">
        <AdminTicketsClient tickets={data} />
      </div>
    </div>
  );
}