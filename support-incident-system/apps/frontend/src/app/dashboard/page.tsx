import { Metadata } from "next";
import { getIncidentTickets, getAllTickets, getTicketTitle, formatDate } from "@/features/ticket";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Support & Incident Portal",
};

export const dynamic = "force-dynamic";

// Helper: normalize assignee — handle string[], object[], atau string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveAssignee(raw: any): string {
  if (!raw) return "—";

  // Array
  if (Array.isArray(raw)) {
    if (raw.length === 0) return "—";
    const names = raw.map((a) => {
      if (typeof a === "string") return a.trim();
      if (typeof a === "object" && a !== null) {
        return (a.username || a.name || a.displayName || "").trim();
      }
      return "";
    }).filter(Boolean);
    return names.length > 0 ? names.join(", ") : "—";
  }

  // String langsung
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return resolveAssignee(parsed);
    } catch {
      return raw.trim() || "—";
    }
  }

  // Object tunggal
  if (typeof raw === "object") {
    return (raw.username || raw.name || raw.displayName || "—").trim();
  }

  return "—";
}

export default async function DashboardPage() {
  const [incidents, allTickets] = await Promise.all([
    getIncidentTickets(10),
    getAllTickets({ limit: 50 }),
  ]);

  const incidentData = incidents.map((t) => ({
    id:              t.id,
    type:            t.type as "INCIDENT",
    title:           getTicketTitle(t),
    status:          t.status_pengusulan,
    priority:        (t.form_fields["Priority Incident"] as string) || "—",
    severity:        (t.form_fields["Severity Incident"] as string) || "—",
    suspect_area:    (t.form_fields["Suspect Area"]      as string) || "—",
    indicated_issue: (t.form_fields["Indicated Issue"]   as string) || "—",
    created_at:      formatDate(t.created_at, true),
    raw_created:     t.created_at,
    assignee:        resolveAssignee(t.assignee),
    summary:         (t.summary_ticket as string) || "",
  }));

  const allTicketData = allTickets.map((t) => ({
    id:              t.id,
    type:            t.type as "INCIDENT" | "TICKETING",
    title:           getTicketTitle(t),
    status:          t.status_pengusulan,
    priority:        (t.form_fields["Priority Incident"] as string) || "—",
    severity:        (t.form_fields["Severity Incident"] as string) || "—",
    suspect_area:    (t.form_fields["Suspect Area"]      as string) || "—",
    indicated_issue: (t.form_fields["Indicated Issue"]   as string) || "—",
    created_at:      formatDate(t.created_at, true),
    raw_created:     t.created_at,
    assignee:        resolveAssignee(t.assignee),
    summary:         (t.summary_ticket as string) || "",
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