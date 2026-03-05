/**
 * src/services/report.service.js
 * Incident Report Service
 *
 * Generate HTML enterprise incident report dari data tiket.
 * Menyimpan metadata ke tabel incident_reports (via raw SQL).
 * Output: file HTML + URL yang bisa diakses dari LAN perusahaan.
 */

"use strict";

const fs     = require("fs");
const path   = require("path");
const axios  = require("axios");
const prisma = require("../database/client");
const config = require("../config");
const TicketModel   = require("../models/ticket.model");
const ActivityModel = require("../models/activity.model");
const { formatDateForEmail, formatDateOnly, calcResolutionDuration } = require("../utils/date");
const { getTicketTitle, formatAssigneeForWeb, formatEvidenceForDisplay } = require("../utils/ticket");
const { getPublicUrl } = require("../utils/network");

// ─── Core Generator ──────────────────────────────────────────────────────────

/**
 * Generate incident report untuk satu tiket.
 *
 * @param {number} ticketId
 * @param {string} reportType    — "STANDARD" (default)
 * @param {string} generatedBy   — username / source
 * @returns {object} — { reportId, ticketId, reportTitle, reportUrl, filePath, fileName, reportContent }
 */
async function generateReport(ticketId, reportType = "STANDARD", generatedBy = "System") {
  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) throw new Error(`Ticket #${ticketId} tidak ditemukan di database`);

  const fields     = ticket.formFields || ticket.form_fields || {};
  const createdAt  = ticket.createdAt  || ticket.created_at;
  const resolvedAt = ticket.resolvedAt || ticket.resolved_at;
  const orgName    = config.org.name;
  const orgDept    = config.org.department;

  // ─── Build timeline events ─────────────────────────────────────────────────
  // FIX v2: Support kedua tipe:
  //   INCIDENT → timelineActionTaken (action_taken)
  //   SUPPORT  → timelineTindakLanjut (tindak_lanjut)
  // Equivalent dengan Sequelize original: ticket.timelineActionTaken || ticket.timelineTindakLanjut
  const timelineRaw = ticket.timelineActionTaken
    || ticket.timeline_action_taken
    || ticket.timelineTindakLanjut
    || ticket.timeline_tindak_lanjut
    || "";
  const timelineEvents = timelineRaw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const match = line.match(/^\d+\.\s+\(([^)]+)\)\s+(.+)$/);
      return match ? { datetime: match[1], action: match[2] } : { datetime: "-", action: line };
    });

  // ─── AI Recommendations via Groq ──────────────────────────────────────────
  let recommendations = [];
  if (config.groq.apiKey) {
    try {
      const incidentContext = [
        `Incident: ${getTicketTitle(ticket)}`,
        `Priority: ${fields["Priority Incident"] || "Medium"}`,
        `Severity: ${fields["Severity Incident"] || "Medium"}`,
        `Affected Area: ${fields["Suspect Area"] || "N/A"}`,
        `Indicated Issue: ${fields["Indicated Issue"] || fields["Issue"] || "N/A"}`,
        `Root Cause: ${ticket.rootCause || "Under investigation"}`,
        `Resolution Summary: ${ticket.summaryTicket || "In progress"}`,
      ].join(" | ");

      const groqResp = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model:       config.groq.modelInstant,
          max_tokens:  400,
          temperature: 0.3,
          messages: [
            {
              role:    "system",
              content:
                "You are an IT incident management expert. Generate 4-5 concise actionable recommendations in English. " +
                "Output ONLY a raw JSON array of strings. No markdown, no backticks. Example: [\"Rec 1\",\"Rec 2\"]",
            },
            { role: "user", content: `Generate recommendations for: ${incidentContext}` },
          ],
        },
        {
          headers: { Authorization: `Bearer ${config.groq.apiKey}`, "Content-Type": "application/json" },
          timeout: 12000,
        }
      );

      const raw     = groqResp.data?.choices?.[0]?.message?.content?.trim() || "[]";
      const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
      const parsed  = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        recommendations = parsed;
        console.log(`🤖 [REPORT] AI generated ${recommendations.length} recommendations`);
      }
    } catch (err) {
      console.warn(`⚠ [REPORT] AI recommendations fallback: ${err.message}`);
    }
  }

  // Default recommendations jika AI gagal
  if (recommendations.length === 0) {
    recommendations = [
      "Monitor system stability for 24 hours post-resolution",
      "Verify all affected services have returned to normal operation",
      "Review and update runbook documentation if applicable",
      "Schedule a post-mortem meeting within 48 hours",
      "Evaluate implementation of proactive monitoring alerts",
      "Review related SOPs to prevent recurrence of similar incidents",
    ];
  }

  // ─── Build report content object ──────────────────────────────────────────
  const reportId      = `IR-${ticket.id}-${Date.now()}`;
  const reportTitle   = `Incident Report — ${getTicketTitle(ticket)}`;
  const durationText  = calcResolutionDuration(createdAt, resolvedAt);

  const reportContent = {
    meta: {
      reportId,
      reportType,
      generatedAt:  new Date().toISOString(),
      generatedBy,
      organization: orgName,
      department:   orgDept,
    },
    header: {
      title:      reportTitle,
      incidentId: `#${ticket.id}_${ticket.type}`,
      reportDate: formatDateForEmail(new Date()),
    },
    executive_summary: {
      overview:        ticket.summaryTicket || "Pending AI analysis",
      businessImpact:  fields["Severity Incident"] === "Critical"
        ? "Kritikal — layanan terganggu signifikan"
        : "Medium — dampak terbatas",
      status:          ticket.statusPengusulan || ticket.status_pengusulan,
      resolutionTime:  durationText,
    },
    incident_details: {
      incidentId:      `#${ticket.id}`,
      incidentTitle:   getTicketTitle(ticket),
      reportedBy:      fields["Reporter Information"] || "N/A",
      division:        fields["Division"]             || "N/A",
      phone:           fields["No Telepon"]           || "N/A",
      email:           fields["Email"]                || "N/A",
      incidentDate:    fields["Date Incident"]        || formatDateOnly(createdAt),
      incidentTime:    fields["Time Incident"]        || "N/A",
      reportedDate:    formatDateForEmail(createdAt),
      priority:        fields["Priority Incident"]    || "Medium",
      severity:        fields["Severity Incident"]    || "Medium",
      affectedSystems: fields["Suspect Area"]         || "N/A",
      indicatedIssue:  fields["Indicated Issue"] || fields["Issue"] || "N/A",
      assignedTeam:    formatAssigneeForWeb(ticket.assignee),
    },
    timeline:             { events: timelineEvents },
    root_cause_analysis:  {
      rootCause:          ticket.rootCause || "Dalam investigasi — belum ditentukan",
      affectedComponent:  fields["Suspect Area"] || "N/A",
    },
    resolution: {
      resolutionSummary:  ticket.summaryTicket || "Dalam proses penanganan",
      resolvedAt:         resolvedAt ? formatDateForEmail(resolvedAt) : "Belum resolved",
      resolutionDuration: durationText,
      resolvedBy:         formatAssigneeForWeb(ticket.assignee),
    },
    evidence: {
      attachments:  ticket.evidenceAttachment || ticket.evidence_attachment || [],
      discordThread: (ticket.discord || {}).threadUrl || "N/A",
    },
    recommendations: { items: recommendations },
  };

  // ─── Write HTML file ───────────────────────────────────────────────────────
  const reportDir  = config.portal.reportDir || path.join(process.cwd(), "public", "reports");
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const htmlFileName = `report_${ticket.id}_${Date.now()}.html`;
  const htmlFilePath = path.join(reportDir, htmlFileName);
  const htmlContent  = generateHTML(reportContent);

  fs.writeFileSync(htmlFilePath, htmlContent, "utf8");

  // ─── Save metadata to DB ───────────────────────────────────────────────────
  const portalUrl = getPublicUrl();
  const reportUrl = `${portalUrl}/reports/${htmlFileName}`;

  const insertResult = await prisma.$queryRaw`
    INSERT INTO incident_reports
      (ticket_id, report_type, report_title, report_content, file_path, file_url, generated_by)
    VALUES
      (${ticket.id}, ${reportType}, ${reportTitle}, ${JSON.stringify(reportContent)}::jsonb,
       ${htmlFilePath}, ${reportUrl}, ${generatedBy})
    RETURNING id
  `;
  const dbReportId = insertResult[0].id;

  await ActivityModel.create({
    ticketId:    ticket.id,
    type:        "incident_report_generated",
    description: `Incident Report generated (DB ID: ${dbReportId}, File: ${htmlFileName})`,
  });

  return {
    success:       true,
    reportId:      dbReportId,
    ticketId:      ticket.id,
    reportTitle,
    reportUrl,
    filePath:      htmlFilePath,
    fileName:      htmlFileName,
    reportContent,
  };
}

// ─── HTML Generator ───────────────────────────────────────────────────────────

function cleanDashes(str) {
  if (!str) return str;
  return String(str).replace(/---+/g, "").replace(/--/g, "").trim();
}

function generateHTML(data) {
  const {
    meta, header, executive_summary, incident_details,
    timeline, root_cause_analysis, resolution, evidence, recommendations,
  } = data;

  const orgName = meta.organization || "SEAMOLEC";
  const orgDept = meta.department   || "IT Division";

  const timelineRows = (timeline.events || [])
    .map((e, i) => `
      <tr>
        <td style="padding:6px 12px;border:1px solid #c8d0e0;font-size:11px;white-space:nowrap;color:#334155;width:155px;background:${i % 2 === 0 ? "#f0f3f9" : "#ffffff"};">${cleanDashes(e.datetime)}</td>
        <td style="padding:6px 12px;border:1px solid #c8d0e0;font-size:11px;color:#1e293b;background:${i % 2 === 0 ? "#f0f3f9" : "#ffffff"};">${cleanDashes(e.action)}</td>
      </tr>`)
    .join("");

  const recListHTML = (recommendations.items || [])
    .map((r, i) => `
      <div style="display:flex;align-items:flex-start;padding:5px 0;border-bottom:1px solid #dde3ef;">
        <span style="min-width:20px;font-size:10.5px;font-weight:700;color:#1a237e;flex-shrink:0;">${i + 1}.</span>
        <span style="font-size:11px;color:#1e293b;line-height:1.55;">${r}</span>
      </div>`)
    .join("");

  const rawAttachments = evidence.attachments || [];
  const flatUrls = [];
  rawAttachments.forEach((att) => {
    if (!att?.url) return;
    String(att.url).trim().split(/[\s\n]+/).filter((t) => t.length > 5).forEach((u) => flatUrls.push(u));
  });

  const evidenceContent = flatUrls.length > 0
    ? flatUrls.map((url, i) => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 2px;border-bottom:1px solid #dde3ef;">
        <span style="color:#1a237e;font-weight:700;font-size:11px;flex-shrink:0;min-width:18px;">${i + 1}.</span>
        <a href="${url}" target="_blank" style="font-size:11px;color:#1a3a8a;text-decoration:underline;word-break:break-all;">${url}</a>
      </div>`).join("")
    : '<p style="font-size:11px;color:#64748b;font-style:italic;padding:6px 0;margin:0;">Tidak ada evidence tersedia.</p>';

  const colorMap = {
    Critical: "#b91c1c",
    High:     "#c2410c",
    Low:      "#166534",
    default:  "#1d4ed8",
  };
  const priorityColor = colorMap[incident_details.priority] || colorMap.default;
  const severityColor = incident_details.severity === "Critical" ? "#b91c1c"
    : incident_details.severity === "High"     ? "#c2410c"
    : incident_details.severity === "Low"      ? "#166534"
    : "#b45309";
  const statusColor   = executive_summary.status === "RESOLVED"    ? "#166534"
    : executive_summary.status === "INVESTIGASI" ? "#c2410c"
    : executive_summary.status === "MITIGASI"    ? "#6b21a8"
    : "#1d4ed8";
  const reportTitle   = cleanDashes(header.title);

  /* ── Inline CSS untuk print-color-adjust (enterprise report) ── */
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'IBM Plex Sans','Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#cbd5e1;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{width:210mm;max-width:210mm;margin:0 auto;background:#fff;box-shadow:0 8px 32px rgba(0,0,0,.20)}
    .conf-strip{background-color:#0f1f6b !important;color:#e2e8f0 !important;text-align:center;padding:5px 0;font-size:9.5px;font-weight:600;letter-spacing:3px;text-transform:uppercase;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .report-header{background-color:#1a237e !important;color:#fff !important;padding:22px 36px 20px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .hdr-row1{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
    .org-name{font-size:18px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#fff !important}
    .org-dept{font-size:10px;color:#a5b4d4 !important;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
    .hdr-meta{text-align:right;font-size:10.5px;color:#c7d2e8 !important;line-height:1.9}
    .hdr-meta b{color:#fff !important;font-weight:600}
    .hdr-sep{height:1px;background-color:rgba(255,255,255,.2) !important;margin-bottom:14px}
    .hdr-title{font-size:17px;font-weight:700;color:#fff !important;line-height:1.35;margin-bottom:12px}
    .hdr-badges{display:flex;gap:8px;flex-wrap:wrap}
    .hdr-badge{background-color:rgba(255,255,255,.14) !important;border:1px solid rgba(255,255,255,.28);color:#f0f4ff !important;padding:3px 11px;border-radius:3px;font-size:10.5px;font-weight:500;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .hdr-badge.main{background-color:rgba(255,255,255,.25) !important;border-color:rgba(255,255,255,.5);font-weight:700;color:#fff !important}
    .content{padding:16px 36px 20px}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .section{margin-bottom:14px}
    .sec-hdr{display:flex;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #1a237e}
    .sec-num{background-color:#1a237e !important;color:#fff !important;width:20px;height:20px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;margin-right:8px;flex-shrink:0;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .sec-title{font-size:11px;font-weight:700;color:#0f1f6b !important;letter-spacing:.8px;text-transform:uppercase}
    .exec-box{background-color:#f1f5fb !important;border:1px solid #c8d0e8;border-left:4px solid #1a237e;border-radius:4px;padding:13px 16px 12px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .exec-text{font-size:11.5px;line-height:1.65;color:#1e293b !important;margin-bottom:12px}
    .kpi-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .kpi-card{background-color:#fff !important;border:1px solid #c8d0e8;border-radius:4px;padding:8px 12px;text-align:center;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .kpi-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b !important;margin-bottom:4px}
    .kpi-val{font-size:13px;font-weight:700}
    .data-table{width:100%;border-collapse:collapse;border:1px solid #c8d0e0}
    .data-table td{padding:7px 11px;vertical-align:middle;border-bottom:1px solid #e8edf5}
    .data-table td.k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#334155 !important;background-color:#eef1f9 !important;white-space:nowrap;width:38%;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .data-table td.v{font-size:11.5px;font-weight:500;color:#1e293b !important}
    .data-table tr:last-child td{border-bottom:none}
    .pill{display:inline-block;padding:2px 12px;border-radius:20px;font-size:10.5px;font-weight:700;color:#fff !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .txt-box{background-color:#f1f5fb !important;border:1px solid #c8d0e0;border-left:3px solid #1a237e;border-radius:3px;padding:9px 13px;font-size:11.5px;line-height:1.62;color:#1e293b !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .txt-box.warn{background-color:#fff7ed !important;border-left-color:#c2410c}
    .tl-table{width:100%;border-collapse:collapse;border:1px solid #c8d0e0}
    .tl-hdr-row{background-color:#1a237e !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .tl-hdr-row th{padding:7px 12px;text-align:left;font-size:10px;font-weight:700;color:#fff !important;text-transform:uppercase;letter-spacing:.5px}
    .panel-box{background-color:#f1f5fb !important;border:1px solid #c8d0e0;border-radius:4px;padding:11px 13px;min-height:60px;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .sig-box{border:1px solid #c8d0e0;border-radius:4px;overflow:hidden}
    .sig-hdr{background-color:#eef1f9 !important;padding:8px 16px;font-size:10px;font-weight:700;color:#0f1f6b !important;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #c8d0e0;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .sig-body{padding:12px 16px 14px;text-align:center;background-color:#fff !important}
    .sig-space{height:50px}
    .sig-line{border-top:1.5px solid #94a3b8;padding-top:8px}
    .sig-name{font-size:12.5px;font-weight:700;color:#1e293b !important;margin-bottom:3px}
    .sig-role{font-size:10.5px;color:#475569 !important;margin-top:2px}
    .report-footer{background-color:#0f1f6b !important;color:#c7d2e8 !important;padding:10px 36px;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    .footer-l{font-size:10.5px;font-weight:600;color:#fff !important}
    .footer-r{font-size:9.5px;text-align:right;line-height:1.7;color:#a5b4d4 !important}
    .sub-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#475569 !important;margin-bottom:5px}
    @media print{@page{size:A4 portrait;margin:10mm 12mm}body{background:white !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}.page{box-shadow:none;width:100%;max-width:100%;margin:0}.section{page-break-inside:avoid}.page-break{page-break-before:always}}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="page">
  <div class="conf-strip">Confidential &bull; For Internal Use Only &bull; ${orgName}</div>

  <div class="report-header">
    <div class="hdr-row1">
      <div>
        <div class="org-name">${orgName}</div>
        <div class="org-dept">${orgDept}</div>
      </div>
      <div class="hdr-meta">
        <div><b>Report ID</b>&ensp;${meta.reportId}</div>
        <div><b>Date</b>&ensp;${header.reportDate}</div>
        <div><b>Ref</b>&ensp;${header.incidentId}</div>
      </div>
    </div>
    <div class="hdr-sep"></div>
    <div class="hdr-title">${reportTitle}</div>
    <div class="hdr-badges">
      <span class="hdr-badge main">${executive_summary.status}</span>
      <span class="hdr-badge">Priority: ${incident_details.priority}</span>
      <span class="hdr-badge">Severity: ${incident_details.severity}</span>
      <span class="hdr-badge">Resolution: ${executive_summary.resolutionTime}</span>
    </div>
  </div>

  <div class="content">
    <!-- 1. Executive Summary -->
    <div class="section">
      <div class="sec-hdr"><div class="sec-num">1</div><div class="sec-title">Executive Summary</div></div>
      <div class="exec-box">
        <div class="exec-text">${cleanDashes(executive_summary.overview)}</div>
        <div class="kpi-row">
          <div class="kpi-card"><div class="kpi-lbl">Status</div><div class="kpi-val" style="color:${statusColor};">${executive_summary.status}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Resolution Time</div><div class="kpi-val" style="color:#1a237e;">${executive_summary.resolutionTime}</div></div>
        </div>
      </div>
    </div>

    <div class="two-col">
      <!-- 2. Incident Details -->
      <div class="section">
        <div class="sec-hdr"><div class="sec-num">2</div><div class="sec-title">Incident Details</div></div>
        <table class="data-table">
          <tr><td class="k">Ticket ID</td><td class="v">${incident_details.incidentId}</td></tr>
          <tr><td class="k">Incident Date</td><td class="v">${incident_details.incidentDate} / ${incident_details.incidentTime}</td></tr>
          <tr><td class="k">Priority</td><td class="v"><span class="pill" style="background-color:${priorityColor} !important;">${incident_details.priority}</span></td></tr>
          <tr><td class="k">Severity</td><td class="v"><span class="pill" style="background-color:${severityColor} !important;">${incident_details.severity}</span></td></tr>
          <tr><td class="k">Affected System</td><td class="v">${incident_details.affectedSystems}</td></tr>
        </table>
        <div style="margin-top:9px;"><div class="sub-lbl">Indicated Issue</div><div class="txt-box">${cleanDashes(incident_details.indicatedIssue)}</div></div>
      </div>

      <!-- 4. Root Cause + 5. Resolution -->
      <div>
        <div class="section">
          <div class="sec-hdr"><div class="sec-num">4</div><div class="sec-title">Root Cause Analysis</div></div>
          <div class="txt-box warn">${cleanDashes(root_cause_analysis.rootCause)}</div>
        </div>
        <div class="section">
          <div class="sec-hdr"><div class="sec-num">5</div><div class="sec-title">Resolution</div></div>
          <table class="data-table" style="margin-bottom:8px;">
            <tr><td class="k">Resolved At</td><td class="v">${resolution.resolvedAt}</td></tr>
            <tr><td class="k">Duration</td><td class="v">${resolution.resolutionDuration}</td></tr>
          </table>
          <div class="sub-lbl">Resolution Summary</div>
          <div class="txt-box">${cleanDashes(resolution.resolutionSummary)}</div>
        </div>
      </div>
    </div>

    <!-- 3. Timeline -->
    <div class="section">
      <div class="sec-hdr"><div class="sec-num">3</div><div class="sec-title">Incident Timeline</div></div>
      ${timelineRows
        ? `<table class="tl-table"><thead><tr class="tl-hdr-row"><th style="width:150px;">Date / Time</th><th>Activity / Action Taken</th></tr></thead><tbody>${timelineRows}</tbody></table>`
        : '<div class="txt-box">No timeline events recorded.</div>'
      }
    </div>

    <div class="page-break"></div>

    <div class="two-col" style="margin-top:4px;">
      <!-- 6. Evidence -->
      <div class="section">
        <div class="sec-hdr"><div class="sec-num">6</div><div class="sec-title">Evidence &amp; Attachments</div></div>
        <div class="panel-box">${evidenceContent}</div>
      </div>
      <!-- 7. Recommendations -->
      <div class="section">
        <div class="sec-hdr"><div class="sec-num">7</div><div class="sec-title">Recommendations</div></div>
        <div class="panel-box">${recListHTML || '<div style="font-size:11px;color:#64748b;font-style:italic;">No recommendations available.</div>'}</div>
      </div>
    </div>

    <!-- 8. Approval & Signature -->
    <div class="section">
      <div class="sec-hdr"><div class="sec-num">8</div><div class="sec-title">Approval &amp; Signature</div></div>
      <div class="sig-grid">
        <div class="sig-box">
          <div class="sig-hdr">Disusun Oleh</div>
          <div class="sig-body"><div class="sig-space"></div>
            <div class="sig-line"><div class="sig-name">Betuah Anugerah</div><div class="sig-role">Pelaksana</div></div>
          </div>
        </div>
        <div class="sig-box">
          <div class="sig-hdr">Diketahui dan Disetujui Oleh</div>
          <div class="sig-body"><div class="sig-space"></div>
            <div class="sig-line"><div class="sig-name">Handi Pradana</div><div class="sig-role">Manager IT &amp; Knowledge Management</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="report-footer">
    <div class="footer-l">${orgName} &bull; ${orgDept} &bull; ${meta.reportId}</div>
    <div class="footer-r">
      <div>${header.reportDate}</div>
      <div>Confidential &bull; IT Incident Management System</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

module.exports = { generateReport };