"use strict";

const router                 = require("express").Router();
const RecommendationService  = require("../services/recommendation.service");
const TicketRepo             = require("../repositories/ticket.repository");
const { validateApiKey }     = require("../../../common/middleware/auth");

// POST /api/recommend/ticket
router.post("/ticket", validateApiKey, async (req, res) => {
  try {
    const { issueText = "", keywords = [], type = null, excludeId = null } = req.body;
    if (!issueText && !keywords.length) {
      return res.status(400).json({ error: "issueText or keywords required" });
    }
    const result = await RecommendationService.getRecommendation({
      issueText,
      keywords: Array.isArray(keywords) ? keywords : [],
      type,
      excludeId: excludeId ? Number(excludeId) : null,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[RECOMMEND] POST /ticket error:", err.message);
    res.json({ success: false, found: false, similarTickets: [], runbooks: [], topSuggestion: null });
  }
});

// GET /api/recommend/for-portal/:ticketId
router.get("/for-portal/:ticketId", validateApiKey, async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    if (isNaN(ticketId) || ticketId < 1)
      return res.status(400).json({ error: "ticketId tidak valid" });

    const audience = (req.query.audience || "user").toLowerCase();

    const ticket = await TicketRepo.findById(ticketId);
    if (!ticket)
      return res.status(404).json({ error: "Ticket not found" });

    const ticketType = ticket.type;
    const ff         = ticket.formFields || {};
    const kw         = Array.isArray(ticket.searchKeywords) ? ticket.searchKeywords : [];

    if (audience === "user" && ticketType !== "TICKETING") {
      return res.json({ success: true, found: false, audience });
    }

    const issueText = ticketType === "INCIDENT"
      ? (ff["Incident Information"] || ff["Incident Title"] || ff["Issue"] || "")
      : (ff["Issue"] || "");

    if (!issueText.trim() && kw.length === 0) {
      return res.json({ success: true, found: false, audience });
    }

    const result = await RecommendationService.getRecommendation({
      issueText,
      keywords:  kw,
      type:      ticketType,
      excludeId: ticketId,
    });

    if (!result.found) {
      return res.json({ success: true, found: false, audience });
    }

    const recommendation = audience === "technician"
      ? RecommendationService.buildTechnicianRecommendation(result, ticketType)
      : RecommendationService.buildUserRecommendation(result);

    res.json({ success: true, found: !!recommendation, audience, recommendation });
  } catch (err) {
    console.error("[RECOMMEND] GET /for-portal error:", err.message);
    res.json({ success: false, found: false, error: err.message });
  }
});

// POST /api/recommend/search (alias N8N)
router.post("/search", validateApiKey, async (req, res) => {
  try {
    const { issueText = "", keywords = [], type = null, excludeId = null } = req.body;
    const result = await RecommendationService.getRecommendation({
      issueText,
      keywords: Array.isArray(keywords) ? keywords : [],
      type,
      excludeId: excludeId ? Number(excludeId) : null,
    });
    res.json({ success: true, count: result.similarTickets.length, ...result });
  } catch (err) {
    console.error("[RECOMMEND] POST /search error:", err.message);
    res.json({ success: false, found: false, similarTickets: [], runbooks: [], topSuggestion: null });
  }
});

module.exports = router;
