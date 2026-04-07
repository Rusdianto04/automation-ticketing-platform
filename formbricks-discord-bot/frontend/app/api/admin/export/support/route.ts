// app/api/admin/export/support/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

// Ambil URL attachment dari form_fields["Attachment"] atau evidence_attachment
function getAttachmentUrl(ff: Record<string, unknown>, evidence: unknown): string | null {
  // Prioritas 1: form_fields["Attachment"] (dari static form)
  if (ff["Attachment"] && typeof ff["Attachment"] === "string" && ff["Attachment"].trim()) {
    return ff["Attachment"].trim();
  }
  // Prioritas 2: evidence_attachment array (dari Discord bot)
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

    const MONTHS_ID = ["","Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const monthLabel = MONTHS_ID[targetMonth] || `Bulan${targetMonth}`;

    const p = prisma as any;
    const tickets = await p.ticket.findMany({
      where: { type: "TICKETING", created_at: { gte: startUTC, lt: endUTC } },
      orderBy: { created_at: "asc" },
    });

    const workbook   = new ExcelJS.Workbook();
    workbook.creator = "SIS Portal";
    workbook.created = new Date();

    const sheetName = `Support ${monthLabel} ${targetYear}`;
    const sheet     = workbook.addWorksheet(sheetName);

    // Kolom SAMA seperti sebelumnya — "Attachment" tetap ada, sekarang jadi hyperlink
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
      { header: "Tindak Lanjut",             key: "timeline",    width: 55 },
      { header: "Attachment",                key: "attachment",  width: 45 },
      { header: "Status Pengusulan",         key: "status",      width: 22 },
    ];

    // Header style — SAMA seperti sebelumnya (kuning FFFFF2CC, bold hitam)
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      cell.font      = { bold: true, color: { argb: "FF000000" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border    = borderAll;
    });
    headerRow.height = 32;

    const STATUS_MAP: Record<string, string> = {
      OPEN:     "Open",
      PENDING:  "Pending",
      DONE:     "Done (Sudah Selesai)",
      REJECT:   "Reject",
      RESOLVED: "Resolved",
    };

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
        timeline:    (t.timeline_tindak_lanjut || "—").trim(),
        attachment:  attachmentUrl ? "Lihat Attachment" : "—",
        status:      STATUS_MAP[t.status_pengusulan] || t.status_pengusulan,
      });

      // Zebra + border SAMA seperti sebelumnya
      const bgColor = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
      row.eachCell((cell) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.alignment = { vertical: "top", wrapText: true };
        cell.font      = { size: 10 };
        cell.border    = borderAll;
      });
      row.height = 60;

      // Set hyperlink pada kolom Attachment (kolom ke-14, index 14)
      if (attachmentUrl) {
        const attachCol = 14; // kolom N (1-based)
        const attachCell = row.getCell(attachCol);
        attachCell.value = { text: "Lihat Attachment", hyperlink: attachmentUrl };
        attachCell.font  = { size: 10, color: { argb: "FF0563C1" }, underline: true };
      }
    });

    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer     = await workbook.xlsx.writeBuffer();
    const fileName   = `Laporan_Support_${monthLabel}_${targetYear}.xlsx`;
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
    console.error("[EXPORT SUPPORT]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}