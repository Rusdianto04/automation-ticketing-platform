// app/admin/page.tsx
import { redirect } from "next/navigation";
import { getAdminSessionAction } from "./actions";
import { getTicketStats, getAllTickets, getTicketTitle } from "@/lib/tickets";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getAdminSessionAction();
  if (!session) redirect("/admin/login");

  const [stats, recentTickets] = await Promise.all([
    getTicketStats(),
    getAllTickets({ limit: 10 }),
  ]);

  const recent = recentTickets.map((t) => ({
    id: t.id,
    type: t.type,
    title: getTicketTitle(t),
    status: t.status_pengusulan,
    // FIX: kirim ISO string mentah — format dilakukan di client
    // agar timezone Asia/Jakarta diterapkan dengan benar
    created_at: t.created_at,
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