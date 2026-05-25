// app/api/admin/export/support/route.ts
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
  if (!Array.isArray(arr) || arr.length === 0) return null;
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

      // WIB = UTC+7, jadi geser -7 jam untuk konversi ke UTC
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

    const result  = await apiExportTickets("support", {
      startDate: startUTC.toISOString(),
      endDate:   endUTC.toISOString(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tickets = result.tickets as any[];

    const workbook   = new ExcelJS.Workbook();
    workbook.creator = "SIS Portal";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Support ${periodLabel}`);

    sheet.columns = [
      { header: "Reporter Information",      key: "reporter",    width: 28 },
      { header: "Divisi / Unit Kerja",       key: "divisi",      width: 22 },
      { header: "No Telepon",                key: "telepon",     width: 18 },
      { header: "Email",                     key: "email",       width: 28 },
      { header: "ID Device",                 key: "iddevice",    width: 18 },
      { header: "Ruangan",                   key: "ruangan",     width: 16 },
      { header: "Lantai",                    key: "lantai",      width: 10 },
      { header: "Tanggal & Waktu Pemohon",   key: "tanggal",     width: 24 },
      { header: "Type of Support Requested", key: "typesupport", width: 28 },
      { header: "Jumlah Barang",             key: "jumlah",      width: 14 },
      { header: "Keluhan Kerusakan",         key: "keluhan",     width: 38 },
      { header: "Assign Team",               key: "assignee",    width: 32 },
      { header: "Summary",                   key: "summary",     width: 55 },
      { header: "Attachment",               key: "attachment",  width: 45 },
      { header: "Status Pengusulan",         key: "status",      width: 22 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      cell.font      = { bold: true, color: { argb: "FF000000" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border    = borderAll;
    });
    headerRow.height = 32;

    const STATUS_MAP: Record<string, string> = {
      OPEN: "Open", PENDING: "Pending", DONE: "Done (Sudah Selesai)",
      REJECT: "Reject", RESOLVED: "Resolved",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tickets.forEach((t: any, idx: number) => {
      let ff: Record<string, unknown> = {};
      if (typeof t.form_fields === "string") {
        try { ff = JSON.parse(t.form_fields); } catch { ff = {}; }
      } else if (t.form_fields && typeof t.form_fields === "object") {
        ff = t.form_fields as Record<string, unknown>;
      }

      const createdAtStr = new Date(t.created_at).toLocaleString("id-ID", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
      });

      const attachmentUrl = getAttachmentUrl(ff, t.evidence_attachment);
      const summaryValue  = (t.summary_ticket || "").trim() || "—";

      const row = sheet.addRow({
        reporter:    getField(ff, "Reporter Information", "Name", "Nama"),
        divisi:      getField(ff, "Division", "Divisi", "Departemen", "Department", "Unit Kerja"),
        telepon:     getField(ff, "No Telepon", "Phone", "Nomor Telepon"),
        email:       getField(ff, "Email", "email"),
        iddevice:    getField(ff, "ID Device", "Device ID", "No Device"),
        ruangan:     getField(ff, "Ruangan", "Room", "Location", "Lokasi"),
        lantai:      getField(ff, "Lantai", "Floor"),
        tanggal:     getField(ff, "Tanggal & Waktu Pemohon", "Tanggal", "Date") || createdAtStr,
        typesupport: getField(ff, "Type of Support Requested", "Type of Support", "Kategori"),
        jumlah:      getField(ff, "Jumlah Barang", "Quantity"),
        keluhan:     getField(ff, "Issue", "Keluhan", "Masalah", "Problem"),
        assignee:    formatAssignee(t.assignee),
        summary:     summaryValue,
        attachment:  attachmentUrl ? "Lihat Attachment" : "—",
        status:      STATUS_MAP[t.status_pengusulan] || t.status_pengusulan,
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
        const attachCell = row.getCell(14);
        attachCell.value = { text: "Lihat Attachment", hyperlink: attachmentUrl };
        attachCell.font  = { size: 10, color: { argb: "FF0563C1" }, underline: true };
      }
    });

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer   = await workbook.xlsx.writeBuffer();
    const fileName = `Laporan_Support_${periodLabel.replace(/[\s/–]/g, "_")}.xlsx`;

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
    console.error("[EXPORT SUPPORT]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}