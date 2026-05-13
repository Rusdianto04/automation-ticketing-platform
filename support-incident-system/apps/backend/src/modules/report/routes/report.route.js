"use strict";

/**
 * src/modules/report/routes/report.route.js
 * Thin route — delegates to ReportController.
 * Mount: app.use("/api/report", reportRoute)
 */

const router = require("express").Router();
const ctrl   = require("../controllers/report.controller");
const { validateApiKey } = require("../../../common/middleware/auth");

router.post("/generate",                    validateApiKey, ctrl.generate);
router.get("/regenerate-file/:ticketId",    validateApiKey, ctrl.regenerateFile);
router.get("/:id",                          validateApiKey, ctrl.getById);

module.exports = router;
