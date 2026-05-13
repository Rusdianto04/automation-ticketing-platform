// app/admin/reports/page.tsx
import { redirect } from "next/navigation";
import { getAdminSessionAction } from "../actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getAdminSessionAction();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="admin-main">
        <ReportsClient />
      </div>
    </div>
  );
}