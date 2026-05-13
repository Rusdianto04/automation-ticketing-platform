"use strict";

/**
 * src/modules/report/routes/incident.route.js
 * Thin route — delegates to IncidentController.
 * Mount: app.use("/api/incident", incidentRoute)
 */

const router = require("express").Router();
const ctrl   = require("../controllers/incident.controller");
const { validateApiKey } = require("../../../common/middleware/auth");

router.get("/active",          validateApiKey, ctrl.getActive);
router.get("/stats",           validateApiKey, ctrl.getStats);
router.get("/:id",             validateApiKey, ctrl.getById);
router.post("/:id/status",     validateApiKey, ctrl.updateStatus);
router.post("/:id/broadcast",  validateApiKey, ctrl.broadcast);

module.exports = router;
