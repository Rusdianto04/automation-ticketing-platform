// app/dashboard/page.tsx
import { Metadata } from "next";
import {
  getIncidentTickets,
  getTicketStats,
  getTicketTitle,
  getRequesterName,
  formatDate,
} from "@/lib/tickets";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Support & Incident Portal",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // User portal: HANYA tampilkan incident secara publik
  // Ticket support: user harus cari berdasarkan ID
  const [incidents, stats] = await Promise.all([
    getIncidentTickets(50),
    getTicketStats(),
  ]);

  const incidentData = incidents.map((t) => ({
    id: t.id,
    type: t.type as "INCIDENT",
    title: getTicketTitle(t),
    status: t.status_pengusulan,
    priority: (t.form_fields["Priority Incident"] as string) || "—",
    severity: (t.form_fields["Severity Incident"] as string) || "—",
    suspect_area: (t.form_fields["Suspect Area"] as string) || "—",
    indicated_issue: (t.form_fields["Indicated Issue"] as string) || "—",
    created_at: formatDate(t.created_at, true),
    raw_created: t.created_at,
  }));

  return (
    <DashboardClient
      incidents={incidentData}
      stats={stats}
      orgName={process.env.ORG_NAME || "IT Support Division"}
      orgDepartment={process.env.ORG_DEPARTMENT || "IT Infrastructure"}
    />
  );
}