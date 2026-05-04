"use strict";

const router = require("express").Router();
const RecommendationService = require("../services/recommendation.service");
const { validateApiKey }    = require("../middleware/auth");

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

    const prisma = require("../database/client");
    const rows   = await prisma.$queryRaw`
      SELECT id, type, form_fields, search_keywords
      FROM tickets WHERE id = ${ticketId}
    `;
    if (!rows || rows.length === 0)
      return res.status(404).json({ error: "Ticket not found" });

    const row        = rows[0];
    const ticketType = row.type;
    const ff         = typeof row.form_fields === "string"
      ? JSON.parse(row.form_fields)
      : (row.form_fields || {});
    const kw         = Array.isArray(row.search_keywords) ? row.search_keywords : [];

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