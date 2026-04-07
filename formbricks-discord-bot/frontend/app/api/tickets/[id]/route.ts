// app/api/tickets/[id]/route.ts
// Proxy ke backend untuk cek status tiket by ID — User Portal
// Privacy: hanya kembalikan field yang relevan untuk user (bukan admin data)

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_SELF_URL ||
  process.env.BACKEND_URL ||
  "http://backend:3000";

const API_KEY =
  process.env.N8N_API_KEY || "automation_ticketing01_incident02";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/ticket/${id}`, {
      headers: { "x-api-key": API_KEY },
      cache: "no-store",
    });

    if (res.status === 404) {
      return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Gagal mengambil data tiket" }, { status: res.status });
    }

    const data = await res.json();
    const t    = data.ticket;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ff: Record<string, any> = t.formFields || t.form_fields || {};

    // Privacy: kembalikan field minimal yang diperlukan user
    // TIDAK expose: discord, activities internal, summary AI, root_cause (admin only)
    const safe = {
      id:          t.id,
      type:        t.type,
      status:      t.status,
      status_note: t.statusNote || t.status_note || null,
      form_fields: sanitizeFormFields(ff, t.type),
      created_at:  t.createdAt || t.created_at,
      updated_at:  t.updatedAt || t.updated_at,
      resolved_at: t.resolvedAt || t.resolved_at || null,
    };

    return NextResponse.json({ ticket: safe });
  } catch (err) {
    console.error("[API/tickets/id] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Sanitize — kembalikan field yang relevan untuk user termasuk Email
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeFormFields(ff: Record<string, any>, type: string): Record<string, string> {
  if (type === "INCIDENT") {
    return {
      "Incident Title":       String(ff["Incident Title"]       || ff["Incident Information"] || ""),
      "Priority Incident":    String(ff["Priority Incident"]    || ""),
      "Severity Incident":    String(ff["Severity Incident"]    || ""),
      "Suspect Area":         String(ff["Suspect Area"]         || ""),
      "Indicated Issue":      String(ff["Indicated Issue"]      || ""),
      "Date & Time Incident": String(ff["Date & Time Incident"] || ""),
    };
  }
  // TICKETING — termasuk Email agar bisa tampil di search result
  return {
    "Reporter Information":      String(ff["Reporter Information"]      || ff["Name"] || ""),
    "Division":                  String(ff["Division"]                  || ""),
    "Email":                     String(ff["Email"]                     || ""),
    "Type of Support Requested": String(ff["Type of Support Requested"] || ""),
    "Issue":                     String(ff["Issue"]                     || ""),
    "Ruangan":                   String(ff["Ruangan"]                   || ""),
    "Lantai":                    String(ff["Lantai"]                    || ""),
  };
}