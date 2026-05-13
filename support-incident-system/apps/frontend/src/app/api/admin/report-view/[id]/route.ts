// app/api/admin/report-view/[id]/route.ts
// Resolves report URL via backend, then redirects browser.
// No direct Prisma — backend does the DB lookup.
import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionAction } from "@/app/admin/actions";
import { apiGetReportView } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionAction();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: rawId } = await params;
    const ticketId = parseInt(rawId, 10);
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    const data = await apiGetReportView(ticketId);
    // Redirect browser directly to backend report URL
    return NextResponse.redirect(data.reportUrl, { status: 302 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status  = message.includes("belum tersedia") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
