// app/api/admin/activities/route.ts
// Proxies to backend /api/admin/activities — no direct Prisma.
import { NextRequest, NextResponse } from "next/server";
import { apiGetActivities } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url       = new URL(req.url);
    const limit     = parseInt(url.searchParams.get("limit")     || "30");
    const level     = url.searchParams.get("level")     || undefined;
    const component = url.searchParams.get("component") || undefined;
    const since     = url.searchParams.get("since")     || undefined;

    const data = await apiGetActivities({ limit, level, component, since });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
