"use strict";

const fs     = require("fs");
const path   = require("path");
const router = require("express").Router();
const prisma = require("../database/client");
const config = require("../config");
const { validateApiKey }              = require("../middleware/auth");
const { generateReport, generateHTML } = require("../services/report.service");
const { getPublicUrl }                = require("../utils/network");

// ─── Helper: serialize BigInt dari $queryRaw ──────────────────────────────────
function serialize(data) {
  return JSON.parse(JSON.stringify(data, (_, v) =>
    typeof v === "bigint" ? Number(v) : v
  ));
}

// ─── POST /api/report/generate ────────────────────────────────────────────────
router.post("/generate", validateApiKey, async (req, res) => {
  try {
    const { ticketId, reportType, generatedBy } = req.body;
    if (!ticketId) return res.status(400).json({ error: "ticketId required" });

    const result = await generateReport(
      Number(ticketId),
      reportType || "STANDARD",
      generatedBy || "API"
    );

    res.json(result);
  } catch (err) {
    console.error("[REPORT] Generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/report/regenerate-file/:ticketId ────────────────────────────────
router.get("/regenerate-file/:ticketId", validateApiKey, async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const rows = await prisma.$queryRaw`
      SELECT * FROM incident_reports
      WHERE ticket_id = ${ticketId}
      ORDER BY generated_at DESC
      LIMIT 1
    `;
    const existing = serialize(rows);

    if (existing.length > 0) {
      const dbReport = existing[0];

      const reportContent = typeof dbReport.report_content === "string"
        ? JSON.parse(dbReport.report_content)
        : dbReport.report_content;

      const htmlContent = generateHTML(reportContent);

      const originalFileName = dbReport.file_path
        ? path.basename(dbReport.file_path)
        : `report_${ticketId}_${Date.now()}.html`;

      const reportDir  = config.portal.reportDir || path.join(process.cwd(), "public", "reports");
      const htmlFilePath = path.join(reportDir, originalFileName);

      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(htmlFilePath, htmlContent, "utf8");

      const portalUrl = getPublicUrl();
      const reportUrl = `${portalUrl}/reports/${originalFileName}`;

      console.log(`✅ [REPORT] File regenerated from DB: ${originalFileName}`);

      return res.json({
        success:   true,
        reportId:  dbReport.id,
        ticketId,
        reportUrl,
        filePath:  htmlFilePath,
        fileName:  originalFileName,
        message:   "File HTML di-regenerate dari DB (existing report)",
      });
    }

    console.log(`[REPORT] No existing report for ticket #${ticketId} — generating new...`);
    const result = await generateReport(ticketId, "STANDARD", "regenerate");
    res.json({ ...result, message: "Report baru di-generate dari ticket" });

  } catch (err) {
    console.error("[REPORT] Regenerate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/report/:id ──────────────────────────────────────────────────────
router.get("/:id", validateApiKey, async (req, res) => {
  try {
    const id   = Number(req.params.id);
    const rows = await prisma.$queryRaw`
      SELECT * FROM incident_reports WHERE id = ${id} LIMIT 1
    `;
    const result = serialize(rows);
    if (result.length === 0) return res.status(404).json({ error: "Report not found" });
    res.json({ success: true, report: result[0] });
  } catch (err) {
    console.error("[REPORT] Get error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;