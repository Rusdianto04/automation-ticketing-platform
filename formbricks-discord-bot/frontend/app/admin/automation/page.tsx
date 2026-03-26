// app/admin/automation/page.tsx
import { redirect } from "next/navigation";
import { getAdminSessionAction } from "../actions";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AutomationLogClient from "./AutomationLogClient";

// Force dynamic — pakai cookies (session) + query DB saat runtime
export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const session = await getAdminSessionAction();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="admin-main">
        <AutomationLogClient />
      </div>
    </div>
  );
}
