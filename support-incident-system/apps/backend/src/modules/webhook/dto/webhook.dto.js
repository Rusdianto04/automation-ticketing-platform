"use strict";

/**
 * src/modules/webhook/dto/webhook.dto.js
 * DTOs for Formbricks webhook processing.
 */

class WebhookSubmissionDTO {
  constructor(body) {
    this.rawBody  = body || {};
    this.formId   = null;
    this.type     = null;
    this.formData = {};
    this.answers  = body.answers || body.data || body.response || body || {};
  }
}

class WebhookResponseDTO {
  constructor({ ok, ticketId, threadUrl, discordOk, emailSent }) {
    this.ok        = ok;
    this.ticketId  = ticketId;
    this.thread    = threadUrl;
    this.discord   = discordOk;
    this.emailSent = emailSent;
  }
}

module.exports = { WebhookSubmissionDTO, WebhookResponseDTO };
