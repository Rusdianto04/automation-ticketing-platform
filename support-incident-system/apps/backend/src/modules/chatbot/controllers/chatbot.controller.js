"use strict";

/**
 * src/modules/chatbot/controllers/chatbot.controller.js
 * Thin controller — parse → service → respond.
 */

const ChatbotService   = require("../services/chatbot.service");
const KnowledgeService = require("../services/knowledge.service");
const { ok, fail }     = require("../../../common/helpers");
const { createLogger } = require("../../../common/logger");

const logger = createLogger("CHATBOT_CTRL");

async function getContext(req, res) {
  try {
    const { ticketId, keywords, needsTicket, needsKB, needsSimilar } = req.body;
    const results = await ChatbotService.buildContext({ ticketId, keywords, needsTicket, needsKB, needsSimilar });
    return ok(res, { ...results });
  } catch (err) {
    logger.error(`getContext error: ${err.message}`);
    return fail(res, err);
  }
}

async function logInteraction(req, res) {
  try {
    const { ticketId, userId, userName, question, answer, intent, contextUsed, processingTimeMs } = req.body;
    if (!userId || !userName || !question || !answer) {
      return res.status(400).json({ error: "userId, userName, question, answer required" });
    }
    const result = await ChatbotService.logInteraction({
      ticketId, userId, userName, question, answer, intent, contextUsed, processingTimeMs,
    });
    return ok(res, { interactionId: result?.id });
  } catch (err) {
    logger.error(`logInteraction error: ${err.message}`);
    return fail(res, err);
  }
}

async function getStats(req, res) {
  try {
    const data = await ChatbotService.getStats();
    return ok(res, data);
  } catch (err) {
    logger.error(`getStats error: ${err.message}`);
    return fail(res, err);
  }
}

async function getHistory(req, res) {
  try {
    const ticketId = Number(req.params.ticketId);
    const data     = await ChatbotService.getHistory(ticketId);
    return ok(res, { count: data.length, interactions: data });
  } catch (err) {
    logger.error(`getHistory error: ${err.message}`);
    return fail(res, err);
  }
}

// Knowledge endpoints
async function searchRunbooks(req, res) {
  try {
    const { keywords: kwStr, category, limit = 5 } = req.query;
    const keywords = kwStr ? kwStr.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) : [];
    const runbooks = await KnowledgeService.searchRunbooks({ keywords, category, limit });
    return ok(res, { count: runbooks.length, runbooks });
  } catch (err) {
    logger.error(`searchRunbooks error: ${err.message}`);
    return fail(res, err);
  }
}

async function searchKnowledge(req, res) {
  try {
    const { keywords, limit = 5 } = req.body;
    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: "keywords array required" });
    }
    const tickets = await KnowledgeService.searchSimilarTickets({ keywords, limit });
    return ok(res, { count: tickets.length, tickets });
  } catch (err) {
    logger.error(`searchKnowledge error: ${err.message}`);
    return fail(res, err);
  }
}

async function createRunbook(req, res) {
  try {
    const { category, title, content, keywords, createdBy } = req.body;
    if (!category || !title || !content) {
      return res.status(400).json({ error: "category, title, content required" });
    }
    const result = await KnowledgeService.createRunbook({ category, title, content, keywords, createdBy });
    return ok(res, { runbookId: result?.id }, 201);
  } catch (err) {
    logger.error(`createRunbook error: ${err.message}`);
    return fail(res, err);
  }
}

async function listRunbooks(req, res) {
  try {
    const { category, keyword, limit = 10 } = req.query;
    const runbooks = await KnowledgeService.listRunbooks({ category, keyword, limit });
    return ok(res, { count: runbooks.length, runbooks });
  } catch (err) {
    logger.error(`listRunbooks error: ${err.message}`);
    return fail(res, err);
  }
}

module.exports = {
  getContext, logInteraction, getStats, getHistory,
  searchRunbooks, searchKnowledge, createRunbook, listRunbooks,
};
