// app/api/admin/stats/route.ts
// Proxy ke backend /api/admin/stats untuk data system status
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_SELF_URL || process.env.BACKEND_URL || "http://backend:3000";
const API_KEY     = process.env.N8N_API_KEY || "automation_ticketing01_incident02";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/stats`, {
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const data = await res.json();

    // Backend returns: { stats: { total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount }, system: {...}, timestamp }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    // Return fallback system status agar UI tidak stuck di CHECKING
    return NextResponse.json({
      stats: { total: 0, todayTotal: 0, openCount: 0, pendingCount: 0, doneCount: 0, incidentCount: 0, rejectCount: 0 },
      system: {
        discord_bot:    "OFFLINE",
        discord_detail: `Backend tidak merespons: ${message}`,
        n8n_workflow:   "OFFLINE",
        n8n_detail:     "Tidak dapat terhubung ke backend",
        database:       "OFFLINE",
        db_detail:      "Tidak dapat terhubung ke database",
        ai_service:     "IDLE",
        ai_detail:      "Tidak ada data",
        db_response_ms: 0,
      },
      timestamp: new Date().toISOString(),
    }, { status: 200 }); // tetap 200 agar client bisa proses
  }
}