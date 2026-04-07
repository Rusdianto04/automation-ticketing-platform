// app/api/admin/export/support/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate   = searchParams.get("endDate");
    const status    = searchParams.get("status");
    const month     = searchParams.get("month");
    const year      = searchParams.get("year");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prisma as any;
    const where: Record<string, unknown> = { type: "TICKETING" };
    if (status && status !== "ALL") where.status_pengusulan = status;

    // Filter bulan/tahun (dari ReportsClient)
    if (month && year) {
      const m = parseInt(month); const y = parseInt(year);
      const start = new Date(y, m - 1, 1);
      const end   = new Date(y, m, 0, 23, 59, 59, 999);
      where.created_at = { gte: start, lte: end };
    } else if (startDate || endDate) {
      where.created_at = {};
      if (startDate) (where.created_at as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); (where.created_at as Record<string, unknown>).lte = e; }
    }

    const tickets = await p.ticket.findMany({ where, orderBy: { created_at: "desc" }, take: 5000 });

    const wb = new ExcelJS.Workbook();
    wb.creator = "IT Support Portal";
    wb.created = new Date();

    const ws = wb.addWorksheet("Tiket Support", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    // Header style — warna konsisten (navy gelap)
    const hFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
    const hAlign: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "center", wrapText: true };

    const columns = [
      { header: "No",                        key: "no",            width: 5  },
      { header: "ID Tiket",                  key: "id",            width: 10 },
      { header: "Reporter Information",      key: "reporter",      width: 26 },
      { header: "Division",                  key: "division",      width: 20 },
      { header: "No Telepon",                key: "noTelepon",     width: 16 },
      { header: "Email",                     key: "email",         width: 28 },
      { header: "ID Device",                 key: "idDevice",      width: 18 },
      { header: "Ruangan",                   key: "ruangan",       width: 18 },
      { header: "Lantai",                    key: "lantai",        width: 12 },
      { header: "Tanggal & Waktu Pemohon",   key: "tanggalWaktu",  width: 24 },
      { header: "Type of Support Requested", key: "typeSupport",   width: 28 },
      { header: "Issue",                     key: "issue",         width: 40 },
      { header: "Jumlah Barang",             key: "jumlahBarang",  width: 14 },
      { header: "Attachment",                key: "attachment",    width: 35 },
      { header: "Status",                    key: "status",        width: 14 },
      { header: "Catatan Status",            key: "statusNote",    width: 26 },
      { header: "Assignee",                  key: "assignee",      width: 26 },
      { header: "Timeline Tindak Lanjut",    key: "timeline",      width: 40 },
      { header: "Summary (AI)",              key: "summary",       width: 40 },
      { header: "Root Cause",                key: "rootCause",     width: 40 },
      { header: "Dibuat (WIB)",              key: "createdAt",     width: 22 },
      { header: "Diperbarui (WIB)",          key: "updatedAt",     width: 22 },
      { header: "Sumber Form",               key: "formId",        width: 20 },
    ];

    ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

    const headerRow = ws.addRow(columns.map((c) => c.header));
    headerRow.height = 36;
    headerRow.eachCell((cell) => {
      cell.fill = hFill; cell.font = hFont; cell.alignment = hAlign;
      cell.border = { top: { style: "thin", color: { argb: "FF0D2137" } }, bottom: { style: "thin", color: { argb: "FF0D2137" } }, left: { style: "thin", color: { argb: "FF0D2137" } }, right: { style: "thin", color: { argb: "FF0D2137" } } };
    });

    const statusMap: Record<string, string> = { OPEN: "Open", PENDING: "Pending", DONE: "Done", REJECT: "Reject", REJECTED: "Reject", APPROVED: "In Progress", IN_PROGRESS: "In Progress" };
    const statusColor: Record<string, string> = { OPEN: "FFD1FAE5", PENDING: "FFFEF3C7", DONE: "FFF1F5F9", REJECT: "FFFEE2E2", REJECTED: "FFFEE2E2", APPROVED: "FFDBEAFE", IN_PROGRESS: "FFDBEAFE" };

    tickets.forEach((t: Record<string, unknown>, i: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ff: any = t.form_fields;
      if (typeof ff === "string") { try { ff = JSON.parse(ff); } catch { ff = {}; } }
      ff = ff || {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let asgn: any = t.assignee;
      if (typeof asgn === "string") { try { asgn = JSON.parse(asgn); } catch { asgn = []; } }
      const assigneeStr = Array.isArray(asgn)
        ? asgn.map((a: unknown) => { if (typeof a === "string") return a; const ao = a as Record<string, string>; return ao.username || ao.displayName || ao.name || ""; }).filter(Boolean).join(", ")
        : "—";

      const rawStatus  = String(t.status_pengusulan || "OPEN");
      const createdWIB = t.created_at ? new Date(t.created_at as string).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";
      const updatedWIB = t.updated_at ? new Date(t.updated_at as string).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";
      const attachmentVal = String(ff["Attachment"] || "");

      const row = ws.addRow({
        no: i + 1, id: `#${t.id}`,
        reporter:     ff["Reporter Information"] || ff["Name"] || "—",
        division:     ff["Division"]             || "—",
        noTelepon:    ff["No Telepon"]           || "—",
        email:        ff["Email"]                || "—",
        idDevice:     ff["ID Device"]            || "—",
        ruangan:      ff["Ruangan"]              || "—",
        lantai:       ff["Lantai"]               || "—",
        tanggalWaktu: ff["Tanggal & Waktu Pemohon"] || createdWIB,
        typeSupport:  ff["Type of Support Requested"] || "—",
        issue:        ff["Issue"]                || "—",
        jumlahBarang: ff["Jumlah Barang"]        || "—",
        attachment:   attachmentVal              || "—",
        status:       statusMap[rawStatus]       || rawStatus,
        statusNote:   String(t.status_note       || "—"),
        assignee:     assigneeStr                || "—",
        timeline:     String(t.timeline_tindak_lanjut || "—"),
        summary:      String(t.summary_ticket    || "—"),
        rootCause:    String(t.root_cause        || "—"),
        createdAt:    createdWIB,
        updatedAt:    updatedWIB,
        formId:       String(t.form_id           || "—"),
      });

      const isEven = i % 2 === 0;
      const rowBg  = isEven ? "FFF8FAFC" : "FFFFFFFF";
      const statusColIdx = columns.findIndex((c) => c.key === "status") + 1;
      const attachColIdx = columns.findIndex((c) => c.key === "attachment") + 1;

      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font      = { size: 10, name: "Calibri", color: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", wrapText: colNumber >= 12 };
        cell.border    = { top: { style: "hair", color: { argb: "FFE2E8F0" } }, bottom: { style: "hair", color: { argb: "FFE2E8F0" } }, left: { style: "hair", color: { argb: "FFE2E8F0" } }, right: { style: "hair", color: { argb: "FFE2E8F0" } } };

        if (colNumber === statusColIdx) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColor[rawStatus] || rowBg } };
          cell.font = { size: 10, name: "Calibri", bold: true, color: { argb: "FF1E293B" } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === attachColIdx && attachmentVal && attachmentVal !== "—") {
          // Hyperlink untuk attachment
          cell.value = { text: "Lihat Lampiran", hyperlink: attachmentVal } as ExcelJS.CellHyperlinkValue;
          cell.font  = { size: 10, name: "Calibri", color: { argb: "FF2563EB" }, underline: true };
          cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
        }
      });
    });

    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + columns.length)}1` };

    ws.addRow([]);
    const infoRow = ws.addRow([`Total: ${tickets.length} tiket support`, "", `Diekspor: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`]);
    infoRow.getCell(1).font = { bold: true, size: 10, color: { argb: "FF64748B" } };
    infoRow.getCell(3).font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    const buffer = await wb.xlsx.writeBuffer();
    const now    = new Date().toISOString().slice(0, 10);

   return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="tiket-support-${now}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[EXPORT/support] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}