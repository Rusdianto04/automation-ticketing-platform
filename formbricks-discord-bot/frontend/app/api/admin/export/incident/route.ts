// app/api/admin/export/incident/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getField(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = fields[key];
    if (val !== undefined && val !== null && val !== "") {
      if (Array.isArray(val)) return val.join(", ");
      return String(val);
    }
  }
  return "—";
}

function formatAssignee(assignee: unknown): string {
  if (!assignee) return "—";
  let arr: unknown = assignee;
  if (typeof arr === "string") {
    try { arr = JSON.parse(arr); } catch { return arr as string; }
  }
  if (!Array.isArray(arr)) return String(assignee);
  return (arr as unknown[])
    .map((a) => {
      if (typeof a === "string") return a;
      if (a && typeof a === "object") {
        const o = a as Record<string, string>;
        return o.displayName || o.username || o.name || "";
      }
      return "";
    })
    .filter(Boolean)
    .join(", ") || "—";
}

function formatEvidence(evidence: unknown): string {
  if (!evidence) return "—";
  let arr: unknown = evidence;
  if (typeof arr === "string") {
    try { arr = JSON.parse(arr); } catch { return arr as string; }
  }
  if (!Array.isArray(arr)) return String(evidence);
  return (arr as unknown[])
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        const o = e as Record<string, string>;
        return o.url || o.link || "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n") || "—";
}

// Helper border — semua sisi thin
const borderAll: Partial<ExcelJS.Borders> = {
  top:    { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  left:   { style: "thin", color: { argb: "FF000000" } },
  right:  { style: "thin", color: { argb: "FF000000" } },
};

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const url   = new URL(req.url);
    const month = parseInt(url.searchParams.get("month") || "0", 10);
    const year  = parseInt(url.searchParams.get("year")  || "0", 10);

    const now         = new Date();
    const targetMonth = month > 0 ? month : now.getMonth() + 1;
    const targetYear  = year  > 0 ? year  : now.getFullYear();

    const startUTC = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0) - 7 * 3600 * 1000);
    const endUTC   = new Date(Date.UTC(targetYear, targetMonth,     1, 0, 0, 0) - 7 * 3600 * 1000);

    const MONTHS_ID = [
      "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    const monthLabel = MONTHS_ID[targetMonth] || `Bulan${targetMonth}`;

    const p = prisma as any;
    const tickets = await p.ticket.findMany({
      where: {
        type: "INCIDENT",
        created_at: { gte: startUTC, lt: endUTC },
      },
      orderBy: { created_at: "asc" },
    });

    // ── Build Excel ─────────────────────────────────────────────────────────
    const workbook   = new ExcelJS.Workbook();
    workbook.creator = "SIS Portal";
    workbook.created = new Date();

    const sheetName = `Incident ${monthLabel} ${targetYear}`;
    const sheet     = workbook.addWorksheet(sheetName);

    sheet.columns = [
      { header: "Title",               key: "title",    width: 38 },
      { header: "Date/Time",           key: "datetime", width: 24 },
      { header: "Priority",            key: "priority", width: 14 },
      { header: "Severity",            key: "severity", width: 18 },
      { header: "Suspect Area",        key: "area",     width: 22 },
      { header: "Assign Team",         key: "assignee", width: 32 },
      { header: "Action Taken",        key: "action",   width: 60 },
      { header: "Indicated Issue",     key: "issue",    width: 38 },
      { header: "Handling",            key: "handling", width: 55 },
      { header: "Evidence Attachment", key: "evidence", width: 45 },
      { header: "Status",              key: "status",   width: 32 },
    ];

    // ── Style header row ────────────────────────────────────────────────────
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type:    "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF2CC" },
      };
      cell.font      = { bold: true, color: { argb: "FF000000" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      // FIX: border semua sisi pada header
      cell.border = borderAll;
    });
    headerRow.height = 32;

    // ── Data rows ───────────────────────────────────────────────────────────
    tickets.forEach((t: any, idx: number) => {
      let ff: Record<string, unknown> = {};
      if (typeof t.form_fields === "string") {
        try { ff = JSON.parse(t.form_fields); } catch { ff = {}; }
      } else if (t.form_fields && typeof t.form_fields === "object") {
        ff = t.form_fields as Record<string, unknown>;
      }

      const createdAt = new Date(t.created_at);

      const dateIncident = getField(ff, "Date Incident", "Tanggal Incident", "Date");
      const timeIncident = getField(ff, "Time Incident", "Waktu Incident", "Time");
      const dateTimeStr  =
        dateIncident !== "—" && timeIncident !== "—"
          ? `${dateIncident}/${timeIncident}`
          : createdAt.toLocaleString("id-ID", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit",
              timeZone: "Asia/Jakarta",
            });

      const STATUS_MAP: Record<string, string> = {
        OPEN:        "Open",
        INVESTIGASI: "Investigasi",
        MITIGASI:    "Mitigasi",
        RESOLVED:    "Resolved",
        DONE:        "Resolved",
        REJECT:      "Reject",
      };
      let statusStr = STATUS_MAP[t.status_pengusulan] || t.status_pengusulan;

      if (
        t.resolved_at &&
        (t.status_pengusulan === "RESOLVED" || t.status_pengusulan === "DONE")
      ) {
        const resolvedAt  = new Date(t.resolved_at);
        const diffMs      = resolvedAt.getTime() - createdAt.getTime();
        const diffHours   = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins    = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const resolvedStr = resolvedAt.toLocaleTimeString("id-ID", {
          hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
        });
        statusStr = `Resolved (${resolvedStr} - ${
          diffHours > 0 ? `${diffHours} Hour${diffHours > 1 ? "s" : ""} ` : ""
        }${diffMins} Minutes)`;
      }

      const title =
        getField(ff, "Incident Information", "Incident Title", "Title") !== "—"
          ? getField(ff, "Incident Information", "Incident Title", "Title")
          : t.summary_ticket?.split(".")[0]?.trim() || "Incident Report";

      const row = sheet.addRow({
        title,
        datetime: dateTimeStr,
        priority: getField(ff, "Priority Incident", "Priority"),
        severity: getField(ff, "Severity Incident", "Severity"),
        area:     getField(ff, "Suspect Area", "Area", "Lokasi"),
        assignee: formatAssignee(t.assignee),
        action:   (t.timeline_action_taken || t.timeline_tindak_lanjut || "—").trim(),
        issue:    getField(ff, "Indicated Issue", "Issue", "Masalah"),
        handling: t.summary_ticket || "—",
        evidence: formatEvidence(t.evidence_attachment),
        status:   statusStr,
      });

      // Zebra striping + FIX: border semua sisi pada data rows
      const bgColor = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
      row.eachCell((cell) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.alignment = { vertical: "top", wrapText: true };
        cell.font      = { size: 10 };
        cell.border    = borderAll;
      });
      row.height = 60;
    });

    // Auto filter & freeze pane
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: sheet.columns.length },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    // Generate buffer
    const buffer     = await workbook.xlsx.writeBuffer();
    const fileName   = `Laporan_Incident_${monthLabel}_${targetYear}.xlsx`;
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err: any) {
    console.error("[EXPORT INCIDENT]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}