/**
 * src/routes/recommendation.route.js
 * Recommendation Engine API Routes — NEW (v9)
 *
 * Mount in index.js:
 *   app.use("/api/recommend", recommendRoute);
 *
 * Endpoints:
 *   POST /api/recommend/ticket   — get recommendations for a ticket
 *   POST /api/recommend/search   — raw similarity search (for N8N)
 *
 * These endpoints are called:
 *   1. By the enhanced webhook.route.js (after ticket creation, returns recs)
 *   2. By N8N Workflow 3 (Recommendation Engine workflow)
 *   3. By the admin panel (for showing similar tickets in ticket detail)
 */

"use strict";

const router  = require("express").Router();
const RecommendationService = require("../services/recommendation.service");
const { validateApiKey } = require("../middleware/auth");

// ---------------------------------------------------------------------------
// POST /api/recommend/ticket
// ---------------------------------------------------------------------------
/**
 * Body: {
 *   ticketId: number,       — optional (for logging)
 *   issueText: string,      — free-text issue description
 *   keywords: string[],     — optional keywords array
 *   type: "TICKETING"|"INCIDENT"
 * }
 *
 * Returns:
 * {
 *   found: boolean,
 *   similarTickets: [...],
 *   runbooks: [...],
 *   topSuggestion: {...} | null
 * }
 */
router.post("/ticket", validateApiKey, async (req, res) => {
  try {
    const { issueText = "", keywords = [], type = null } = req.body;

    if (!issueText && !keywords.length) {
      return res.status(400).json({ error: "issueText or keywords required" });
    }

    const result = await RecommendationService.getRecommendation({
      issueText,
      keywords: Array.isArray(keywords) ? keywords : [],
      type,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[RECOMMEND] POST /ticket error:", err.message);
    // Always return empty result — never 500 from recommendation engine
    res.json({ success: false, found: false, similarTickets: [], runbooks: [], topSuggestion: null });
  }
});

// ---------------------------------------------------------------------------
// POST /api/recommend/search  (alias, compatible with N8N httpRequest node)
// ---------------------------------------------------------------------------
router.post("/search", validateApiKey, async (req, res) => {
  try {
    const { issueText = "", keywords = [], type = null, limit = 5 } = req.body;

    const result = await RecommendationService.getRecommendation({
      issueText,
      keywords: Array.isArray(keywords) ? keywords : [],
      type,
    });

    res.json({ success: true, count: result.similarTickets.length, ...result });
  } catch (err) {
    console.error("[RECOMMEND] POST /search error:", err.message);
    res.json({ success: false, found: false, similarTickets: [], runbooks: [], topSuggestion: null });
  }
});

module.exports = router;