// app/api/admin/export/incident/route.ts
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
    const where: Record<string, unknown> = { type: "INCIDENT" };
    if (status && status !== "ALL") where.status_pengusulan = status;

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

    const ws = wb.addWorksheet("Incident Report", {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });

    // Header style — warna merah gelap konsisten untuk incident
    const hFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7F1D1D" } };
    const hFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
    const hAlign: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "center", wrapText: true };

    const columns = [
      { header: "No",                   key: "no",              width: 5  },
      { header: "ID Tiket",             key: "id",              width: 10 },
      { header: "Incident Title",       key: "incidentTitle",   width: 42 },
      { header: "Date & Time Incident", key: "dateTime",        width: 26 },
      { header: "Priority",             key: "priority",        width: 14 },
      { header: "Severity",             key: "severity",        width: 18 },
      { header: "Suspect Area",         key: "suspectArea",     width: 30 },
      { header: "Indicated Issue",      key: "indicatedIssue",  width: 45 },
      { header: "Attachment",           key: "attachment",      width: 35 },
      { header: "Status",               key: "status",          width: 14 },
      { header: "Catatan Status",       key: "statusNote",      width: 26 },
      { header: "Assignee",             key: "assignee",        width: 26 },
      { header: "Action Taken",         key: "actionTaken",     width: 45 },
      { header: "Summary / Handling",   key: "summary",         width: 45 },
      { header: "Root Cause",           key: "rootCause",       width: 45 },
      { header: "Dibuat (WIB)",         key: "createdAt",       width: 22 },
      { header: "Diperbarui (WIB)",     key: "updatedAt",       width: 22 },
      { header: "Resolved (WIB)",       key: "resolvedAt",      width: 22 },
      { header: "Sumber Form",          key: "formId",          width: 20 },
    ];

    ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));

    const headerRow = ws.addRow(columns.map((c) => c.header));
    headerRow.height = 36;
    headerRow.eachCell((cell) => {
      cell.fill = hFill; cell.font = hFont; cell.alignment = hAlign;
      cell.border = { top: { style: "thin", color: { argb: "FF5C0A0A" } }, bottom: { style: "thin", color: { argb: "FF5C0A0A" } }, left: { style: "thin", color: { argb: "FF5C0A0A" } }, right: { style: "thin", color: { argb: "FF5C0A0A" } } };
    });

    const statusMap: Record<string, string> = { OPEN: "Open", PENDING: "Pending", INVESTIGASI: "Investigasi", MITIGASI: "Mitigasi", RESOLVED: "Resolved", REJECT: "Reject", REJECTED: "Reject", APPROVED: "In Progress", IN_PROGRESS: "In Progress" };
    const statusColor: Record<string, string> = { OPEN: "FFFEF9C3", PENDING: "FFFEF3C7", INVESTIGASI: "FFFED7AA", MITIGASI: "FFE9D5FF", RESOLVED: "FFCCFBF1", REJECT: "FFFEE2E2", REJECTED: "FFFEE2E2" };
    const priorityColor: Record<string, string> = { Critical: "FFFEE2E2", High: "FFFED7AA", Medium: "FFFEF3C7", Low: "FFD1FAE5", high: "FFFED7AA", medium: "FFFEF3C7", low: "FFD1FAE5" };

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

      const rawStatus   = String(t.status_pengusulan || "OPEN");
      const rawPriority = String(ff["Priority Incident"] || "");
      const incidentTitle = ff["Incident Title"] || ff["Incident Information"] || ff["Issue"] || "—";
      const attachmentVal = String(ff["Attachment"] || "");

      const createdWIB  = t.created_at  ? new Date(t.created_at  as string).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";
      const updatedWIB  = t.updated_at  ? new Date(t.updated_at  as string).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";
      const resolvedWIB = t.resolved_at ? new Date(t.resolved_at as string).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—";

      const row = ws.addRow({
        no: i + 1, id: `#${t.id}`,
        incidentTitle:  incidentTitle,
        dateTime:       ff["Date & Time Incident"] || ff["Date Incident"] || createdWIB,
        priority:       ff["Priority Incident"]    || "—",
        severity:       ff["Severity Incident"]    || "—",
        suspectArea:    ff["Suspect Area"]         || "—",
        indicatedIssue: ff["Indicated Issue"] || ff["Issue"] || "—",
        attachment:     attachmentVal              || "—",
        status:         statusMap[rawStatus]       || rawStatus,
        statusNote:     String(t.status_note       || "—"),
        assignee:       assigneeStr                || "—",
        actionTaken:    String(t.timeline_action_taken || "—"),
        summary:        String(t.summary_ticket    || "—"),
        rootCause:      String(t.root_cause        || "—"),
        createdAt:      createdWIB,
        updatedAt:      updatedWIB,
        resolvedAt:     resolvedWIB,
        formId:         String(t.form_id           || "—"),
      });

      const isEven = i % 2 === 0;
      const rowBg  = isEven ? "FFFFF8F8" : "FFFFFFFF";
      const statusColIdx   = columns.findIndex((c) => c.key === "status")   + 1;
      const priorityColIdx = columns.findIndex((c) => c.key === "priority") + 1;
      const attachColIdx   = columns.findIndex((c) => c.key === "attachment") + 1;

      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font      = { size: 10, name: "Calibri", color: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", wrapText: colNumber >= 8 };
        cell.border    = { top: { style: "hair", color: { argb: "FFFFE4E6" } }, bottom: { style: "hair", color: { argb: "FFFFE4E6" } }, left: { style: "hair", color: { argb: "FFFFE4E6" } }, right: { style: "hair", color: { argb: "FFFFE4E6" } } };

        if (colNumber === statusColIdx) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColor[rawStatus] || rowBg } };
          cell.font = { size: 10, name: "Calibri", bold: true, color: { argb: "FF1E293B" } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === priorityColIdx && rawPriority) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: priorityColor[rawPriority] || rowBg } };
          cell.font = { size: 10, name: "Calibri", bold: true, color: { argb: "FF1E293B" } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (colNumber === attachColIdx && attachmentVal && attachmentVal !== "—") {
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
    const infoRow = ws.addRow([`Total: ${tickets.length} incident`, "", `Diekspor: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}`]);
    infoRow.getCell(1).font = { bold: true, size: 10, color: { argb: "FF64748B" } };
    infoRow.getCell(3).font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    const buffer = await wb.xlsx.writeBuffer();
    const now    = new Date().toISOString().slice(0, 10);

   return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="incident-report-${now}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[EXPORT/incident] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}