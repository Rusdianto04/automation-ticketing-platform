"use strict";

/**
 * src/modules/chatbot/routes/knowledge.route.js
 * Thin route — delegates to ChatbotController.
 * Mount: app.use("/api/knowledge", knowledgeRoute)
 */

const router = require("express").Router();
const ctrl   = require("../controllers/chatbot.controller");
const { validateApiKey } = require("../../../common/middleware/auth");

router.get("/search-runbooks", validateApiKey, ctrl.searchRunbooks);
router.post("/search",         validateApiKey, ctrl.searchKnowledge);
router.post("/runbook",        validateApiKey, ctrl.createRunbook);
router.get("/runbooks",        validateApiKey, ctrl.listRunbooks);

module.exports = router;
