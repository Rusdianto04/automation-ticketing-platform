// app/api/tickets/create/route.ts
// API endpoint untuk menerima submission form static (User & Admin Portal)
// Menggantikan Formbricks webhook — data langsung ke backend

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_SELF_URL ||
  process.env.BACKEND_URL ||
  "http://backend:3000";

const API_KEY =
  process.env.N8N_API_KEY || "automation_ticketing01_incident02";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, formFields, createdBy, autoCreateDiscord = true } = body;

    if (!type || !formFields) {
      return NextResponse.json(
        { error: "type dan formFields wajib diisi" },
        { status: 400 }
      );
    }

    const validTypes = ["TICKETING", "INCIDENT"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type tidak valid. Gunakan: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/ticket/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        type,
        formFields,
        createdBy: createdBy || "static_portal",
        autoCreateDiscord,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Gagal membuat tiket" },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[API/tickets/create] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}