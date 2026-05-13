// app/admin/page.tsx
import { redirect } from "next/navigation";
import { getAdminSessionAction } from "./actions";
import { getAllTickets, getTicketTitle } from "@/features/ticket";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getAdminSessionAction();
  if (!session) redirect("/admin/login");

  // Ambil semua tiket untuk hitung stats & recent
  const allTickets = await getAllTickets({ limit: 500 });

  // Hitung stats dari data lokal agar konsisten
  const now = new Date();
  const todayWIBStart = new Date(
    Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(),
      now.getUTCHours() >= 17 ? now.getUTCDate() : now.getUTCDate() - 1,
      17, 0, 0, 0
    )
  );

  const total        = allTickets.length;
  const todayTotal   = allTickets.filter(t => new Date(t.created_at) >= todayWIBStart).length;
  const openCount    = allTickets.filter(t => ["OPEN", "IN_PROGRESS", "INVESTIGASI", "MITIGASI"].includes(t.status_pengusulan)).length;
  const pendingCount = allTickets.filter(t => t.status_pengusulan === "PENDING").length;
  const doneCount    = allTickets.filter(t => ["DONE", "RESOLVED"].includes(t.status_pengusulan)).length;
  const incidentCount = allTickets.filter(t => t.type === "INCIDENT" && !["DONE","RESOLVED","REJECT"].includes(t.status_pengusulan)).length;
  const rejectCount  = allTickets.filter(t => ["REJECT", "REJECTED"].includes(t.status_pengusulan)).length;

  const stats = { total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount };

  // Recent tickets — 10 terbaru
  const recent = allTickets.slice(0, 10).map((t) => ({
    id:         t.id,
    type:       t.type,
    title:      getTicketTitle(t),
    status:     t.status_pengusulan,
    created_at: t.created_at,  // ISO string — diformat di client
  }));

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="admin-main">
        <AdminDashboardClient stats={stats} recentTickets={recent} />
      </div>
    </div>
  );
}