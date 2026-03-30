// app/dashboard/page.tsx
import { Metadata } from "next";
import { getAllTickets, getTicketStats, getTicketTitle, getRequesterName, formatDate } from "@/lib/tickets";
import DashboardClient from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard Support & Incident Portal",
};

// Force dynamic rendering — page ini query DB saat runtime, bukan build time
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [tickets, stats] = await Promise.all([
    getAllTickets({ limit: 200 }),
    getTicketStats(),
  ]);

  const ticketData = tickets.map((t) => ({
    id: t.id,
    type: t.type,
    title: getTicketTitle(t),
    status: t.status_pengusulan,
    requester: getRequesterName(t),
    assignee: Array.isArray(t.assignee)
      ? t.assignee
          .map((a) =>
            typeof a === "string" ? a : (a as {username?:string;displayName?:string;name?:string}).username || (a as {username?:string;displayName?:string;name?:string}).displayName || (a as {username?:string;displayName?:string;name?:string}).name || ""
          )
          .filter(Boolean)
          .join(", ")
      : "—",
    created_at: formatDate(t.created_at),
    updated_at: formatDate(t.updated_at),
    raw_created: t.created_at,
  }));

  return (
    <DashboardClient
      tickets={ticketData}
      stats={stats}
      orgName={process.env.ORG_NAME || "IT Support Division"}
      orgDepartment={process.env.ORG_DEPARTMENT || "IT Infrastructure"}
    />
  );
}