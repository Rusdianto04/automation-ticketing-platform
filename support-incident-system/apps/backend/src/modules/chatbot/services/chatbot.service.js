"use strict";

/**
 * src/modules/chatbot/services/chatbot.service.js
 * Business logic for chatbot context building, logging, and knowledge retrieval.
 */

const ChatbotRepo = require("../repositories/chatbot.repository");
const TicketRepo  = require("../../ticket/repositories/ticket.repository");
const { getTicketMode } = require("../../../common/utils/ticket");
const { createLogger }  = require("../../../common/logger");

const logger = createLogger("CHATBOT_SVC");

// ── Context building ──────────────────────────────────────────────────────────

async function buildContext({ ticketId, keywords, needsTicket, needsKB, needsSimilar }) {
  const results = { ticket: null, runbooks: [], similarTickets: [] };
  const tasks   = [];

  if (needsTicket && ticketId) {
    tasks.push((async () => {
      try {
        const t = await TicketRepo.findById(ticketId);
        if (!t) return;
        const ff = t.formFields || {};
        results.ticket = {
          id:                   t.id,
          type:                 t.type,
          title:                t.type === "INCIDENT"
            ? (ff["Incident Information"] || ff["Issue"] || "Incident Report")
            : (ff["Issue"] || "Ticket Support"),
          status:               t.statusPengusulan,
          mode:                 getTicketMode(t),
          timelineActionTaken:  t.timelineActionTaken  || null,
          timelineTindakLanjut: t.timelineTindakLanjut || null,
          summaryTicket:        t.summaryTicket        || null,
          rootCause:            t.rootCause            || null,
          formFields:           t.formFields,
          assignee:             t.assignee             || [],
          evidenceAttachment:   t.evidenceAttachment   || [],
          discord:              t.discord              || {},
          createdAt:            t.createdAt,
          resolvedAt:           t.resolvedAt           || null,
        };
      } catch (err) {
        logger.error(`Ticket context error: ${err.message}`);
      }
    })());
  }

  if (needsKB && Array.isArray(keywords) && keywords.length > 0) {
    tasks.push((async () => {
      try {
        results.runbooks = await ChatbotRepo.searchKnowledgeForChatbot({ keywords });
      } catch (err) {
        logger.error(`KB context error: ${err.message}`);
        results.runbooks = [];
      }
    })());
  }

  if (needsSimilar && Array.isArray(keywords) && keywords.length > 0) {
    tasks.push((async () => {
      try {
        const rows = await ChatbotRepo.findSimilarForChatbot({ keywords, excludeId: ticketId });
        results.similarTickets = rows.map((t) => ({
          ticketId:  t.id,
          type:      t.type,
          issue:     t.type === "INCIDENT"
            ? (t.form_fields?.["Incident Information"] || t.form_fields?.["Issue"] || "N/A")
            : (t.form_fields?.["Issue"] || "N/A"),
          summary:   t.summary_ticket,
          rootCause: t.root_cause,
          keywords:  t.search_keywords,
          resolvedAt: t.resolved_at,
        }));
      } catch (err) {
        logger.error(`Similar tickets error: ${err.message}`);
        results.similarTickets = [];
      }
    })());
  }

  await Promise.all(tasks);
  return results;
}

// ── Logging ───────────────────────────────────────────────────────────────────

async function logInteraction(data) {
  return ChatbotRepo.logInteraction(data);
}

// ── Statistics ────────────────────────────────────────────────────────────────

async function getStats() {
  return ChatbotRepo.getStats();
}

async function getHistory(ticketId, limit = 50) {
  return ChatbotRepo.getHistoryByTicketId(ticketId, limit);
}

module.exports = { buildContext, logInteraction, getStats, getHistory };
