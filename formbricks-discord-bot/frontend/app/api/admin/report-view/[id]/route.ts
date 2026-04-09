// app/api/admin/report-view/[id]/route.ts
// Proxy dinamis untuk laporan incident HTML
// Ambil nama file dari DB → redirect ke backend dengan IP terkini
// GET /api/admin/report-view/9

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verifikasi session admin
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

    const p = prisma as any;

    // Ambil nama file laporan dari tabel incident_reports
    // file_url bisa berisi full URL lama ATAU hanya nama file (format baru)
    let rows: any[] = [];
    try {
      rows = await p.$queryRaw`
        SELECT file_url, file_path, report_title
        FROM incident_reports
        WHERE ticket_id = ${ticketId}
        ORDER BY generated_at DESC
        LIMIT 1
      `;
    } catch {
      // Tabel belum ada
    }

    // Fallback: cari dari ticket.discord JSONB
    let fileNameOrUrl = rows[0]?.file_url || "";

    if (!fileNameOrUrl) {
      const ticket = await p.ticket.findUnique({
        where: { id: ticketId },
        select: { discord: true },
      });
      const discordObj: Record<string, string> =
        typeof ticket?.discord === "string"
          ? JSON.parse(ticket.discord || "{}")
          : (ticket?.discord as Record<string, string>) || {};
      fileNameOrUrl =
        discordObj.reportUrl  ||
        discordObj.report_url ||
        discordObj.file_url   ||
        "";
    }

    if (!fileNameOrUrl) {
      return NextResponse.json(
        { error: "Laporan belum tersedia. Generate via Discord Bot terlebih dahulu." },
        { status: 404 }
      );
    }

    // Ekstrak nama file dari URL lama atau gunakan langsung jika sudah nama file
    // Format lama: "http://192.168.43.220:3000/reports/report_9_1773729913517.html"
    // Format baru: "report_9_1773729913517.html"
    let fileName = fileNameOrUrl;
    if (fileNameOrUrl.startsWith("http")) {
      // Ekstrak bagian setelah /reports/
      const match = fileNameOrUrl.match(/\/reports\/(.+\.html)$/);
      fileName = match ? match[1] : fileNameOrUrl.split("/").pop() || "";
    }

    if (!fileName || !fileName.endsWith(".html")) {
      return NextResponse.json({ error: "Nama file laporan tidak valid" }, { status: 400 });
    }

    // Deteksi IP backend terkini dari environment variable
    // BACKEND_SELF_URL sudah di-set di docker-compose via HOST_IP dari start.sh
    const backendUrl =
      process.env.BACKEND_SELF_URL ||
      process.env.BACKEND_URL       ||
      "http://backend:3000";

    // Untuk URL yang akan dibuka browser user (dari LAN),
    // kita perlu IP yang accessible dari browser — bukan Docker internal
    // Ambil HOST_IP yang diinjek start.sh, gunakan port 3000 (Express backend)
    const hostIp   = process.env.HOST_IP || "";
    const backendPort = "3000";

    let publicBackendUrl: string;
    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      publicBackendUrl = `http://${hostIp}:${backendPort}`;
    } else {
      // Fallback: parse dari BACKEND_SELF_URL atau pakai request host
      // Ganti port backend Docker internal dengan port yang accessible
      publicBackendUrl = backendUrl
        .replace("http://backend:", `http://${req.headers.get("host")?.split(":")[0] || "localhost"}:`)
        .replace(/:3000$/, `:${backendPort}`);
    }

    const reportPublicUrl = `${publicBackendUrl}/reports/${fileName}`;

    // Redirect ke URL yang sudah pakai IP terkini
    return NextResponse.redirect(reportPublicUrl, { status: 302 });
  } catch (err: any) {
    console.error("[REPORT VIEW]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}