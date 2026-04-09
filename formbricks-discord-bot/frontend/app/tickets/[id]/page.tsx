// app/tickets/[id]/page.tsx
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getTicketById, getTicketTitle, getRequesterName, formatDate } from "@/lib/tickets";
import TicketDetailSupport  from "./TicketDetailSupport";
import TicketDetailIncident from "./TicketDetailIncident";

export const dynamic = "force-dynamic";

interface Props {
  // FIX: Next.js 14.2.x+ — params adalah Promise di async server components
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: rawId } = await params;
  const ticket = await getTicketById(Number(rawId));
  if (!ticket) return { title: "Ticket Not Found" };
  return { title: `#${ticket.id} (${getTicketTitle(ticket)})` };
}

export default async function TicketDetailPage({ params }: Props) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (isNaN(id)) notFound();

  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  const orgName       = process.env.ORG_NAME       || "IT Support Division";
  const orgDepartment = process.env.ORG_DEPARTMENT || "IT Infrastructure";

  const commonProps = {
    ticket,
    orgName,
    orgDepartment,
    title:     getTicketTitle(ticket),
    requester: getRequesterName(ticket),
    createdAt: formatDate(ticket.created_at, true),
    updatedAt: formatDate(ticket.updated_at, true),
  };

  if (ticket.type === "INCIDENT") return <TicketDetailIncident {...commonProps} />;
  return <TicketDetailSupport {...commonProps} />;
}