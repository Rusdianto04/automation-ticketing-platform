"use strict";

/**
 * src/modules/chatbot/routes/chatbot.route.js
 * Thin route — delegates to ChatbotController.
 * Mount: app.use("/api/chatbot", chatbotRoute)
 */

const router = require("express").Router();
const ctrl   = require("../controllers/chatbot.controller");
const { validateApiKey } = require("../../../common/middleware/auth");

router.post("/context",          validateApiKey, ctrl.getContext);
router.post("/log-interaction",  validateApiKey, ctrl.logInteraction);
router.get("/stats",             validateApiKey, ctrl.getStats);
router.get("/history/:ticketId", validateApiKey, ctrl.getHistory);

module.exports = router;
