"use strict";

/**
 * src/modules/webhook/controllers/webhook.controller.js
 * Thin controller — parse request → call service → return response.
 */

const WebhookService = require("../services/webhook.service");
const { createLogger } = require("../../../common/logger");

const logger = createLogger("WEBHOOK_CTRL");

async function handleFormbricks(req, res) {
  try {
    const result = await WebhookService.processSubmission(req.body || {});
    return res.json(result);
  } catch (err) {
    logger.error(`handleFormbricks error: ${err.message}`);
    return res.status(500).json({ error: "Failed to process webhook", detail: err.message });
  }
}

module.exports = { handleFormbricks };
