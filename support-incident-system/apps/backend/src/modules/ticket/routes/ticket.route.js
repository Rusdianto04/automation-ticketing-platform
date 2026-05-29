"use strict";

/**
 * src/modules/ticket/routes/ticket.route.js
 *
 * Thin route layer: validates request → delegates to controller.
 * All business logic lives in the controller/service layer.
 *
 * Mount: app.use("/api/ticket", ticketRoute)
 *        app.use("/api/tickets", ticketRoute)
 */

const router = require("express").Router();
const ctrl   = require("../controllers/ticket.controller");
const { validateApiKey } = require("../../../common/middleware/auth");
const {
  validateId,
  validateCreateBody,
  validateStatusBody,
  validateAssignBody,
  validateCommentBody,
  validateAutoCreateBody,
} = require("../validators/ticket.validator");
const uploadCtrl = require("../controllers/upload.controller");

// ── Static routes (MUST come before /:id) ────────────────────────────────────

// GET  /api/ticket                  — list all tickets
router.get("/", validateApiKey, ctrl.list);

// POST /api/ticket/create
router.post("/create",      validateApiKey, validateCreateBody,     ctrl.create);

// POST /api/ticket/auto-create
router.post("/auto-create", validateApiKey, validateAutoCreateBody, ctrl.autoCreate);

// POST /api/ticket/find-similar
router.post("/find-similar", validateApiKey, ctrl.findSimilar);

// POST /api/ticket/summary
router.post("/summary", validateApiKey, ctrl.summary);

// POST /api/ticket/timeline/append
router.post("/timeline/append", validateApiKey, ctrl.appendTimeline);

// POST /api/ticket/repair-discord
router.post("/repair-discord", validateApiKey, ctrl.repairDiscord);

// POST /api/ticket/upload — upload attachment gambar dari frontend portal
router.post("/upload", uploadCtrl.uploadTicketAttachment);

// ── Dynamic routes — /:id ─────────────────────────────────────────────────────

// GET  /api/ticket/:id
router.get("/:id", validateApiKey, validateId, ctrl.getById);

// PUT  /api/ticket/:id/status
router.put("/:id/status", validateApiKey, validateId, validateStatusBody, ctrl.updateStatus);

// PUT  /api/ticket/:id/assign
router.put("/:id/assign", validateApiKey, validateId, validateAssignBody, ctrl.assign);

// POST /api/ticket/:id/comment
router.post("/:id/comment", validateApiKey, validateId, validateCommentBody, ctrl.comment);

// POST /api/ticket/:id/sync-discord
router.post("/:id/sync-discord", validateApiKey, validateId, ctrl.syncDiscord);

// PATCH /api/ticket/:id/data — update ticket data fields (reporter, resolved_at, etc.)
router.patch("/:id/data",       validateApiKey, validateId, ctrl.updateData);

// PATCH /api/ticket/:id/form-fields — replace form_fields object
router.patch("/:id/form-fields", validateApiKey, validateId, ctrl.updateFormFields);


module.exports = router;