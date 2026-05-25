// app/api/admin/tickets-page/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllTickets, getTicketTitle, getRequesterName, formatDate } from "@/features/ticket";
import { verifyAdminToken } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifyAdminToken(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url    = new URL(req.url);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    const limit  = parseInt(url.searchParams.get("limit")  || "10", 10);

    // Ambil semua tiket, sort descending by id, lalu slice sesuai offset & limit
    const all  = await getAllTickets({ limit: 1000 });
    const sorted = [...all].sort((a, b) => b.id - a.id);
    const page = sorted.slice(offset, offset + limit);

    const tickets = page.map((t) => ({
      id:         t.id,
      type:       t.type,
      title:      getTicketTitle(t),
      status:     t.status_pengusulan,
      requester:  getRequesterName(t),
      assignee: Array.isArray(t.assignee)
        ? t.assignee
            .map((a) =>
              typeof a === "string"
                ? a
                : (a as { username?: string; displayName?: string }).username ||
                  (a as { username?: string; displayName?: string }).displayName ||
                  ""
            )
            .filter(Boolean)
            .join(", ")
        : "—",
      created_at: formatDate(t.created_at),
      updated_at: formatDate(t.updated_at),
    }));

    return NextResponse.json({ tickets });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}