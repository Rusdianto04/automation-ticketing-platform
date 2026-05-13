"use strict";
/**
 * src/modules/webhook/index.js
 * Public API of the webhook module.
 */
module.exports = {
  webhookRouter:        require("./routes/webhook.route"),
  webRouter:            require("./routes/web.route"),
  WebhookService:       require("./services/webhook.service"),
  SubmissionRepository: require("./repositories/submission.repository"),
};
