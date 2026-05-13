"use strict";

/**
 * src/modules/health/health.route.js
 * Health check and system info endpoints.
 */

const router     = require("express").Router();
const ReportRepo = require("../report/repositories/report.repository");

const startTime = Date.now();

// GET /health
router.get("/health", async (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  let dbOk = false;

  try {
    await ReportRepo.pingDb();
    dbOk = true;
  } catch (_) {}

  res.json({
    status:    "ok",
    service:   "support-incident-system",
    version:   "2.0.0",
    uptime,
    database:  dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
