"use strict";

/**
 * src/modules/report/controllers/report.controller.js
 * Thin controller for report generation endpoints.
 */

const ReportService = require("../services/report.service");
const ReportRepo    = require("../repositories/report.repository");
const { ok, fail }  = require("../../../common/helpers");
const { generateHTML } = require("../services/report.service");
const { getPublicUrl } = require("../../../common/utils/network");
const { createLogger } = require("../../../common/logger");
const config = require("../../../config");
const fs     = require("fs");
const path   = require("path");

const logger = createLogger("REPORT_CTRL");

async function generate(req, res) {
  try {
    const { ticketId, reportType, generatedBy } = req.body;
    if (!ticketId) return res.status(400).json({ error: "ticketId required" });
    const result = await ReportService.generateReport(Number(ticketId), reportType || "STANDARD", generatedBy || "API");
    return ok(res, result);
  } catch (err) {
    logger.error(`generate error: ${err.message}`);
    return fail(res, err);
  }
}

async function regenerateFile(req, res) {
  try {
    const ticketId = Number(req.params.ticketId);
    const existing = await ReportRepo.getReportByTicketId(ticketId);

    if (existing) {
      const reportContent = typeof existing.report_content === "string"
        ? JSON.parse(existing.report_content)
        : existing.report_content;

      const htmlContent = generateHTML(reportContent);
      const fileName    = existing.file_path ? path.basename(existing.file_path) : `report_${ticketId}_${Date.now()}.html`;
      const reportDir   = config.portal.reportDir || path.join(process.cwd(), "public", "reports");

      if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
      fs.writeFileSync(path.join(reportDir, fileName), htmlContent, "utf8");

      const reportUrl = `${getPublicUrl()}/reports/${fileName}`;
      logger.info(`File regenerated from DB: ${fileName}`);
      return ok(res, {
        reportId: existing.id, ticketId, reportUrl,
        filePath: path.join(reportDir, fileName), fileName,
        message:  "File HTML di-regenerate dari DB (existing report)",
      });
    }

    logger.info(`No existing report for #${ticketId} — generating new...`);
    const result = await ReportService.generateReport(ticketId, "STANDARD", "regenerate");
    return ok(res, { ...result, message: "Report baru di-generate dari ticket" });
  } catch (err) {
    logger.error(`regenerateFile error: ${err.message}`);
    return fail(res, err);
  }
}

async function getById(req, res) {
  try {
    const id     = Number(req.params.id);
    const report = await ReportRepo.getReportById(id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    return ok(res, { report });
  } catch (err) {
    logger.error(`getById error: ${err.message}`);
    return fail(res, err);
  }
}

module.exports = { generate, regenerateFile, getById };
