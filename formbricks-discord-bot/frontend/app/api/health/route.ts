// app/api/health/route.ts
// Docker HEALTHCHECK endpoint — WAJIB ADA
// Tanpa file ini: wget ke /api/health -> 404 -> container selalu (unhealthy)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status:    "ok",
      service:   "sis-frontend",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}