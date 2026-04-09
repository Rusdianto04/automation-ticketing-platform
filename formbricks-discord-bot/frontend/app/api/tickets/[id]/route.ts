// app/api/tickets/[id]/route.ts
// Proxy ke backend untuk cek status tiket by ID (User Portal)
// Privacy: hanya kembalikan field yang relevan untuk user

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_SELF_URL ||
  process.env.BACKEND_URL ||
  "http://backend:3000";

const API_KEY =
  process.env.N8N_API_KEY || "automation_ticketing01_incident02";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    const t = data.ticket;

    // Ambil form_fields
    const ff = (t.formFields || t.form_fields || {}) as Record<string, string>;

    // Privacy: hanya kembalikan field yang diperlukan user
    // TIDAK expose: discord, activities, summary, root_cause (admin only)
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

// Sanitize form fields — kembalikan field yang relevan untuk user
// WAJIB include "Email" agar tampil di search result
function sanitizeFormFields(
  ff: Record<string, string>,
  type: string
): Record<string, string> {
  if (type === "INCIDENT") {
    return {
      "Incident Title":       ff["Incident Title"]       || ff["Incident Information"] || "",
      "Priority Incident":    ff["Priority Incident"]    || "",
      "Severity Incident":    ff["Severity Incident"]    || "",
      "Suspect Area":         ff["Suspect Area"]         || "",
      "Indicated Issue":      ff["Indicated Issue"]      || "",
      "Date & Time Incident": ff["Date & Time Incident"] || "",
    };
  }
  // TICKETING — include Email untuk ditampilkan di search result
  return {
    "Reporter Information":      ff["Reporter Information"]      || ff["Name"] || "",
    "Email":                     ff["Email"]                     || "",
    "Division":                  ff["Division"]                  || "",
    "Type of Support Requested": ff["Type of Support Requested"] || "",
    "Issue":                     ff["Issue"]                     || "",
    "Ruangan":                   ff["Ruangan"]                   || "",
    "Lantai":                    ff["Lantai"]                    || "",
  };
}