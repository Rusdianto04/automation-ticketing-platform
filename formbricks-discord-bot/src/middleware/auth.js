/**
 * src/middleware/auth.js
 * API Key Validation Middleware
 *
 * Digunakan oleh semua endpoint internal (/api/*) yang diakses
 * oleh n8n, peppermint, dan chatbot.
 */

"use strict";

const config = require("../config");

/**
 * Express middleware — validasi X-API-Key header.
 */
function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== config.n8n.apiKey) {
    return res.status(401).json({
      error:   "Unauthorized",
      message: "Invalid or missing X-API-Key header",
    });
  }

  next();
}

module.exports = { validateApiKey };
