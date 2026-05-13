"use strict";

const config = require("../../config");

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