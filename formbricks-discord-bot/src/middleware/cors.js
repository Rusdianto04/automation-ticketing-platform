/**
 * src/middleware/cors.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CORS Middleware — mengizinkan Peppermint portal mengakses API backend
 *
 * Konfigurasi:
 *   CORS_ORIGINS di .env  → comma-separated list URL yang diizinkan
 *   Contoh: CORS_ORIGINS=http://localhost:3001,http://192.168.50.121:3001
 *
 * Default: izinkan semua origin (development-friendly).
 *          Di production: set CORS_ORIGINS eksplisit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

/**
 * CORS middleware — tanpa package tambahan (native Express)
 */
function corsMiddleware(req, res, next) {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["*"];

  const origin = req.headers.origin;

  if (allowedOrigins.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    // Server-to-server (N8N, internal services) — izinkan
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods",  "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.setHeader("Access-Control-Allow-Headers",  "Content-Type, X-API-Key, Authorization, Accept");
  res.setHeader("Access-Control-Max-Age",        "86400"); // 24 jam cache preflight
  res.setHeader("Access-Control-Allow-Credentials", "false");

  // Preflight response
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
}

module.exports = { corsMiddleware };