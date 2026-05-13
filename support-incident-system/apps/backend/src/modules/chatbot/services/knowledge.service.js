"use strict";

/**
 * src/modules/chatbot/services/knowledge.service.js
 * Knowledge base and runbook business logic.
 */

const ChatbotRepo = require("../repositories/chatbot.repository");
const TicketRepo  = require("../../ticket/repositories/ticket.repository");
const { getTicketTitle } = require("../../../common/utils/ticket");
const { createLogger }   = require("../../../common/logger");

const logger = createLogger("KNOWLEDGE_SVC");

async function searchRunbooks({ keywords, category, limit }) {
  return ChatbotRepo.searchKnowledge({ keywords, category, limit });
}

async function searchSimilarTickets({ keywords, limit }) {
  const tickets = await TicketRepo.findSimilar(keywords, Math.min(parseInt(limit) || 5, 10));
  return tickets.map((t) => ({
    ticketId:   t.id,
    type:       t.type,
    issue:      getTicketTitle(t),
    summary:    t.summaryTicket,
    rootCause:  t.rootCause,
    timeline:   t.type === "INCIDENT" ? t.timelineActionTaken : t.timelineTindakLanjut,
    keywords:   t.searchKeywords,
    resolvedAt: t.resolvedAt,
  }));
}

async function createRunbook(data) {
  return ChatbotRepo.createRunbook(data);
}

async function listRunbooks({ category, keyword, limit }) {
  return ChatbotRepo.listRunbooks({ category, keyword, limit });
}

module.exports = { searchRunbooks, searchSimilarTickets, createRunbook, listRunbooks };
