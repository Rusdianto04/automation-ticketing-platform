/**
 * src/routes/report.route.js
 * Incident Report API Routes
 *
 * POST /api/report/generate              — generate HTML report baru
 * GET  /api/report/regenerate-file/:id   — regenerate file dari existing report
 * GET  /api/report/:id                   — ambil metadata report
 *
 * FIX v2 (production):
 *   regenerate-file: SELALU rebuild HTML file dari report_content di DB.
 *   Original index.js (Sequelize v4) melakukan rebuild setiap kali dipanggil.
 *   Versi sebelumnya hanya mengembalikan URL tanpa rebuild → file hilang setelah
 *   container restart jika volume `/app/public/reports` tidak persistent.
 *
 *   Sekarang: ambil report_content dari DB → generateHTML() → tulis ke disk → return URL.
 *   Ini menjamin file selalu ada di disk setelah regenerate-file dipanggil.
 *
 * ⚠️  ROUTE ORDER KRITIS:
 *   "/regenerate-file/:ticketId" HARUS sebelum "/:id"
 *   agar Express tidak mencocokkan "regenerate-file" sebagai /:id.
 */

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
//
// FIX: SELALU rebuild HTML file dari report_content di DB.
//
// Alasan:
//   Setelah container restart tanpa persistent volume untuk /app/public/reports,
//   semua file HTML hilang. Memanggil endpoint ini harus selalu memastikan
//   file ada di disk — bukan hanya mengembalikan URL yang mungkin broken.
//
// Flow:
//   1. Cari report terbaru di incident_reports WHERE ticket_id = :ticketId
//   2. Jika ada: ambil report_content → generateHTML() → tulis file → return URL
//   3. Jika tidak ada: panggil generateReport() untuk generate baru dari ticket

router.get("/regenerate-file/:ticketId", validateApiKey, async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);

    // Cek apakah report sudah ada di DB
    const rows = await prisma.$queryRaw`
      SELECT * FROM incident_reports
      WHERE ticket_id = ${ticketId}
      ORDER BY generated_at DESC
      LIMIT 1
    `;
    const existing = serialize(rows);

    if (existing.length > 0) {
      // FIX: Rebuild HTML dari data DB — identik dengan original index.js
      // Ini menjamin file ada di disk setelah container restart
      const dbReport = existing[0];

      const reportContent = typeof dbReport.report_content === "string"
        ? JSON.parse(dbReport.report_content)
        : dbReport.report_content;

      // Rebuild HTML menggunakan fungsi yang sama saat pertama generate
      const htmlContent = generateHTML(reportContent);

      // Gunakan nama file yang sama agar URL tidak berubah
      const originalFileName = dbReport.file_path
        ? path.basename(dbReport.file_path)
        : `report_${ticketId}_${Date.now()}.html`;

      const reportDir  = config.portal.reportDir || path.join(process.cwd(), "public", "reports");
      const htmlFilePath = path.join(reportDir, originalFileName);

      // Pastikan direktori ada
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      // Tulis ulang file ke disk
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

    // Belum ada report di DB — generate baru dari data ticket
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
