"use strict";

/**
 * src/modules/chatbot/dto/chatbot.dto.js
 */

class ChatbotContextDTO {
  constructor(body) {
    this.ticketId    = body.ticketId    || null;
    this.keywords    = Array.isArray(body.keywords) ? body.keywords : [];
    this.needsTicket = !!body.needsTicket;
    this.needsKB     = !!body.needsKB;
    this.needsSimilar= !!body.needsSimilar;
  }
}

class LogInteractionDTO {
  constructor(body) {
    this.ticketId       = body.ticketId       || null;
    this.userId         = body.userId;
    this.userName       = body.userName;
    this.question       = body.question;
    this.answer         = body.answer;
    this.intent         = body.intent         || "general";
    this.contextUsed    = body.contextUsed    || {};
    this.processingTimeMs = body.processingTimeMs || 0;
  }

  validate() {
    if (!this.userId)   return "userId required";
    if (!this.userName) return "userName required";
    if (!this.question) return "question required";
    if (!this.answer)   return "answer required";
    return null;
  }
}

module.exports = { ChatbotContextDTO, LogInteractionDTO };
