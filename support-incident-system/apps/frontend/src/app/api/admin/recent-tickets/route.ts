// app/api/admin/recent-tickets/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_SELF_URL || process.env.BACKEND_URL || "http://backend:3000";
const API_KEY     = process.env.N8N_API_KEY || "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveAssigneeName(raw: any): string {
  if (!raw) return "—";
  if (Array.isArray(raw)) {
    if (raw.length === 0) return "—";
    const names = raw.map((a) =>
      typeof a === "string" ? a : (a?.username || a?.name || "")
    ).filter(Boolean);
    return names.join(", ") || "—";
  }
  if (typeof raw === "string") {
    try { return resolveAssigneeName(JSON.parse(raw)); } catch { return raw || "—"; }
  }
  if (typeof raw === "object") return raw.username || raw.name || "—";
  return "—";
}

export async function GET(req: NextRequest) {
  try {
    const url   = new URL(req.url);
    const limit = url.searchParams.get("limit") || "10";

    const res = await fetch(
      `${BACKEND_URL}/api/admin/recent-tickets?limit=${limit}`,
      {
        headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const data = await res.json();

    const tickets = (data.tickets || []).map((t: any) => ({
      id:         t.id,
      type:       t.type,
      title:      t.title,
      status:     t.status,
      assignee:   resolveAssigneeName(t.assignee),
      created_at: t.createdAt ?? t.created_at ?? null,
    }));

    return NextResponse.json({ tickets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message, tickets: [] }, { status: 200 });
  }
}