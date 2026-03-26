// app/api/admin/recent-tickets/route.ts
// Endpoint realtime untuk tabel "Ticket Terbaru" di admin dashboard

import { NextResponse } from "next/server";
import { prisma }        from "@/lib/prisma";
import { getTicketTitle } from "@/lib/tickets"; // FIX: hapus normalizeTicketType (tidak ada di lib/tickets.ts)

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const p = prisma as any;

    const tickets = await p.ticket.findMany({
      orderBy: { created_at: "desc" },
      take:    10,
      select:  {
        id:                true,
        type:              true,
        form_fields:       true,
        status_pengusulan: true,
        created_at:        true,
      },
    });

    const result = tickets.map((t: any) => {
      // Pastikan form_fields selalu object, bukan string JSON
      let formFields = t.form_fields;
      if (typeof formFields === "string") {
        try   { formFields = JSON.parse(formFields); }
        catch { formFields = {}; }
      }
      if (!formFields || typeof formFields !== "object" || Array.isArray(formFields)) {
        formFields = {};
      }

      const type = t.type === "INCIDENT" ? "INCIDENT" : "TICKETING";

      // Ambil judul dari form_fields sesuai tipe tiket
      let title = "Tiket Support";
      if (type === "INCIDENT") {
        title =
          formFields["Incident Information"] ||
          formFields["Incident Title"]        ||
          "Incident Report";
      } else {
        title =
          formFields["Issue"]  ||
          formFields["Judul"]  ||
          formFields["Title"]  ||
          "Tiket Support";
      }

      // Normalisasi status
      let status = t.status_pengusulan || "OPEN";
      if (status === "RESOLVED" || status === "APPROVED") status = "DONE";
      if (status === "REJECTED")                          status = "REJECT";

      return {
        id:         t.id,
        type,
        title,
        status,
        created_at: t.created_at instanceof Date
          ? t.created_at.toISOString()
          : t.created_at,
      };
    });

    return NextResponse.json({ tickets: result });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}