"use strict";

/**
 * src/modules/webhook/routes/webhook.route.js
 * Thin route — delegates to WebhookController.
 * All business logic lives in webhook.service.js.
 *
 * Mount: app.use("/webhook", webhookRoute)
 */

const router = require("express").Router();
const ctrl   = require("../controllers/webhook.controller");

// POST /webhook/formbricks
router.post("/formbricks", ctrl.handleFormbricks);

module.exports = router;
