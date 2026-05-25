// app/api/admin/export/incident/route.ts
import { NextRequest, NextResponse } from "next/server";
import { apiExportTickets } from "@/lib/api";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

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
  if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { return arr as string; } }
  if (!Array.isArray(arr)) return String(assignee);
  return (arr as unknown[])
    .map((a) => {
      if (typeof a === "string") return a;
      if (a && typeof a === "object") { const o = a as Record<string, string>; return o.displayName || o.username || o.name || ""; }
      return "";
    })
    .filter(Boolean).join(", ") || "—";
}

function getAttachmentUrl(ff: Record<string, unknown>, evidence: unknown): string | null {
  if (ff["Attachment"] && typeof ff["Attachment"] === "string" && ff["Attachment"].trim()) {
    return ff["Attachment"].trim();
  }
  if (!evidence) return null;
  let arr: unknown = evidence;
  if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { return null; } }
  if (!Array.isArray(arr) || (arr as unknown[]).length === 0) return null;
  const first = (arr as unknown[])[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const o = first as Record<string, string>;
    return o.url || o.link || null;
  }
  return null;
}

const borderAll: Partial<ExcelJS.Borders> = {
  top:    { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  left:   { style: "thin", color: { argb: "FF000000" } },
  right:  { style: "thin", color: { argb: "FF000000" } },
};

const MONTHS_ID = ["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export async function GET(req: NextRequest) {
  try {
    const url       = new URL(req.url);
    const rangeMode = url.searchParams.get("rangeMode");
    const now       = new Date();

    let startUTC: Date;
    let endUTC: Date;
    let periodLabel: string;

    if (rangeMode === "range") {
      const sd = parseInt(url.searchParams.get("startDay")   || "1", 10);
      const sm = parseInt(url.searchParams.get("startMonth") || "0", 10);
      const sy = parseInt(url.searchParams.get("startYear")  || "0", 10);
      const ed = parseInt(url.searchParams.get("endDay")     || "1", 10);
      const em = parseInt(url.searchParams.get("endMonth")   || "0", 10);
      const ey = parseInt(url.searchParams.get("endYear")    || "0", 10);

      const startDay   = sd > 0 ? sd : 1;
      const startMonth = sm > 0 ? sm : now.getMonth() + 1;
      const startYear  = sy > 0 ? sy : now.getFullYear();
      const endDay     = ed > 0 ? ed : now.getDate();
      const endMonth   = em > 0 ? em : now.getMonth() + 1;
      const endYear    = ey > 0 ? ey : now.getFullYear();

      startUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay,    0, 0, 0) - 7 * 3600 * 1000);
      endUTC   = new Date(Date.UTC(endYear,   endMonth - 1,   endDay + 1,  0, 0, 0) - 7 * 3600 * 1000);

      const slabel = MONTHS_ID[startMonth] || `Bulan${startMonth}`;
      const elabel = MONTHS_ID[endMonth]   || `Bulan${endMonth}`;

      if (startYear === endYear && startMonth === endMonth && startDay === endDay) {
        periodLabel = `${startDay} ${slabel} ${startYear}`;
      } else if (startYear === endYear && startMonth === endMonth) {
        periodLabel = `${startDay}–${endDay} ${slabel} ${startYear}`;
      } else if (startYear === endYear) {
        periodLabel = `${startDay} ${slabel} – ${endDay} ${elabel} ${startYear}`;
      } else {
        periodLabel = `${startDay} ${slabel} ${startYear} – ${endDay} ${elabel} ${endYear}`;
      }
    } else {
      const month = parseInt(url.searchParams.get("month") || "0", 10);
      const year  = parseInt(url.searchParams.get("year")  || "0", 10);
      const targetMonth = month > 0 ? month : now.getMonth() + 1;
      const targetYear  = year  > 0 ? year  : now.getFullYear();
      startUTC    = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0) - 7 * 3600 * 1000);
      endUTC      = new Date(Date.UTC(targetYear, targetMonth,     1, 0, 0, 0) - 7 * 3600 * 1000);
      periodLabel = `${MONTHS_ID[targetMonth] || `Bulan${targetMonth}`} ${targetYear}`;
    }

    const result  = await apiExportTickets("incident", {
      startDate: startUTC.toISOString(),
      endDate:   endUTC.toISOString(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tickets = result.tickets as any[];

    const workbook   = new ExcelJS.Workbook();
    workbook.creator = "SIS Portal";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Incident ${periodLabel}`);

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

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      cell.font      = { bold: true, color: { argb: "FF000000" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border    = borderAll;
    });
    headerRow.height = 32;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tickets.forEach((t: any, idx: number) => {
      let ff: Record<string, unknown> = {};
      if (typeof t.form_fields === "string") {
        try { ff = JSON.parse(t.form_fields); } catch { ff = {}; }
      } else if (t.form_fields && typeof t.form_fields === "object") {
        ff = t.form_fields as Record<string, unknown>;
      }

      const createdAt = new Date(t.created_at);

      const dateTimeField = getField(ff, "Date & Time Incident");
      const dateIncident  = getField(ff, "Date Incident", "Tanggal Incident", "Date");
      const timeIncident  = getField(ff, "Time Incident", "Waktu Incident", "Time");
      const dateTimeStr   = dateTimeField !== "—"
        ? dateTimeField
        : dateIncident !== "—" && timeIncident !== "—"
          ? `${dateIncident}/${timeIncident}`
          : createdAt.toLocaleString("id-ID", {
              day: "2-digit", month: "2-digit", year: "numeric",
              hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
            });

      const STATUS_MAP: Record<string, string> = {
        OPEN: "Open", INVESTIGASI: "Investigasi", MITIGASI: "Mitigasi",
        RESOLVED: "Resolved", DONE: "Resolved", REJECT: "Reject",
      };
      let statusStr = STATUS_MAP[t.status_pengusulan] || t.status_pengusulan;

      if (t.resolved_at && (t.status_pengusulan === "RESOLVED" || t.status_pengusulan === "DONE")) {
        const resolvedAt  = new Date(t.resolved_at);
        const diffMs      = resolvedAt.getTime() - createdAt.getTime();
        const diffHours   = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins    = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const resolvedStr = resolvedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
        statusStr = `Resolved (${resolvedStr} - ${diffHours > 0 ? `${diffHours} Hour${diffHours > 1 ? "s" : ""} ` : ""}${diffMins} Minutes)`;
      }

      const title = getField(ff, "Incident Title", "Incident Information", "Title") !== "—"
        ? getField(ff, "Incident Title", "Incident Information", "Title")
        : (t.summary_ticket as string | undefined)?.split(".")[0]?.trim() || "Incident Report";

      const attachmentUrl = getAttachmentUrl(ff, t.evidence_attachment);

      const row = sheet.addRow({
        title,
        datetime: dateTimeStr,
        priority: getField(ff, "Priority Incident", "Priority"),
        severity: getField(ff, "Severity Incident", "Severity"),
        area:     getField(ff, "Suspect Area", "Area", "Lokasi"),
        assignee: formatAssignee(t.assignee),
        action:   ((t.timeline_action_taken || t.timeline_tindak_lanjut || "—") as string).trim(),
        issue:    getField(ff, "Indicated Issue", "Issue", "Masalah"),
        handling: (t.summary_ticket as string | undefined) || "—",
        evidence: attachmentUrl ? "Lihat Attachment" : "—",
        status:   statusStr,
      });

      const bgColor = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
      row.eachCell((cell) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.alignment = { vertical: "top", wrapText: true };
        cell.font      = { size: 10 };
        cell.border    = borderAll;
      });
      row.height = 60;

      if (attachmentUrl) {
        const evidenceCell = row.getCell(10);
        evidenceCell.value = { text: "Lihat Attachment", hyperlink: attachmentUrl };
        evidenceCell.font  = { size: 10, color: { argb: "FF0563C1" }, underline: true };
      }
    });

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer   = await workbook.xlsx.writeBuffer();
    const fileName = `Laporan_Incident_${periodLabel.replace(/[\s/–]/g, "_")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EXPORT INCIDENT]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}