// app/tickets/[id]/page.tsx
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getTicketById, getTicketTitle, getRequesterName, formatDate } from "@/features/ticket";
import TicketDetailSupport  from "./TicketDetailSupport";
import TicketDetailIncident from "./TicketDetailIncident";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_SELF_URL || process.env.BACKEND_URL || "http://backend:3000";
const API_KEY     = process.env.N8N_API_KEY || "automation_ticketing01_incident02";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchUserRecommendation(ticketId: number, type: string) {
  // Hanya untuk TICKETING — user tidak perlu lihat recommendation incident
  if (type !== "TICKETING") return null;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/recommend/for-portal/${ticketId}?audience=user`,
      { headers: { "x-api-key": API_KEY }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? data.recommendation : null;
  } catch {
    return null;
  }
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

  const orgName       = process.env.ORG_NAME       || "SEAMOLEC";
  const orgDepartment = process.env.ORG_DEPARTMENT || "IT DEPARTMENT";

  // Fetch user recommendation (hanya TICKETING, non-blocking)
  const userRecommendation = await fetchUserRecommendation(id, ticket.type);

  const commonProps = {
    ticket,
    orgName,
    orgDepartment,
    title:     getTicketTitle(ticket),
    requester: getRequesterName(ticket),
    createdAt: formatDate(ticket.created_at, true),
    updatedAt: formatDate(ticket.updated_at, true),
    userRecommendation: userRecommendation || null,
  };

  if (ticket.type === "INCIDENT") return <TicketDetailIncident {...commonProps} />;
  return <TicketDetailSupport {...commonProps} />;
}