"use strict";
const router = require("express").Router();
const config = require("../config");

// URL Next.js frontend — dipakai untuk redirect
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  `http://localhost:${process.env.FRONTEND_PORT || 3001}`;

// ─── GET /health ──────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({
    status:      "ok",
    timestamp:   new Date().toISOString(),
    uptime:      Math.round(process.uptime()),
    service:     "sis-backend",
    version:     "5.0.0",
    environment: config.env,
    frontend:    FRONTEND_URL,
  });
});

// ─── Redirect semua web route ke Next.js frontend ─────────────────────────────
router.get("/",              (req, res) => res.redirect(302, `${FRONTEND_URL}/dashboard`));
router.get("/dashboard",     (req, res) => res.redirect(302, `${FRONTEND_URL}/dashboard`));
router.get("/tickets/:id",   (req, res) => res.redirect(302, `${FRONTEND_URL}/tickets/${req.params.id}`));

module.exports = router;