// app/dashboard/page.tsx

import { Metadata } from "next";
import { getIncidentTickets, getAllTickets, getTicketTitle, formatDate } from "@/lib/tickets";

import DashboardClient from "./DashboardClient";


export const metadata: Metadata = {
  title: "Support & Incident Portal",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [incidents, allTickets] = await Promise.all([
    getIncidentTickets(10),
    getAllTickets({ limit: 50 }),
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
    assignee: Array.isArray(t.assignee)
      ? t.assignee.map((a: any) => a.username || a.name || "").filter(Boolean).join(", ")
      : "—",
    summary: (t.summary_ticket as string) || "",
  }));

  const allTicketData = allTickets.map((t) => ({
    id: t.id,
    type: t.type as "INCIDENT" | "TICKETING",
    title: getTicketTitle(t),
    status: t.status_pengusulan,
    priority: (t.form_fields["Priority Incident"] as string) || "—",
    severity: (t.form_fields["Severity Incident"] as string) || "—",
    suspect_area: (t.form_fields["Suspect Area"] as string) || "—",
    indicated_issue: (t.form_fields["Indicated Issue"] as string) || "—",
    created_at: formatDate(t.created_at, true),
    raw_created: t.created_at,
    assignee: Array.isArray(t.assignee)
      ? t.assignee.map((a: any) => a.username || a.name || "").filter(Boolean).join(", ")
      : "—",
    summary: (t.summary_ticket as string) || "",
  }));

  return (
    <DashboardClient
      incidents={incidentData}
      allTickets={allTicketData}
      orgName={process.env.ORG_NAME || "SEAMOLEC"}
      orgDepartment={process.env.ORG_DEPARTMENT || "IT Infrastructure"}
    />
  );
}
