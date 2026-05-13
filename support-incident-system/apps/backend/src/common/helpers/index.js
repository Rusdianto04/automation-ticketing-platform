"use strict";

/**
 * src/common/helpers/index.js
 * Shared express helpers: response builder, BigInt serializer, async error wrapper.
 */

// ── BigInt serializer ─────────────────────────────────────────────────────────
function serialize(data) {
  return JSON.parse(
    JSON.stringify(data, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
}

// ── Standardized success response ─────────────────────────────────────────────
function ok(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

// ── Standardized error response ───────────────────────────────────────────────
function fail(res, error, statusCode = 500) {
  const message = error instanceof Error ? error.message : String(error);
  const code    = error.code || "INTERNAL_ERROR";
  const status  = error.statusCode || statusCode;
  return res.status(status).json({ success: false, error: message, code });
}

// ── Non-blocking Discord fire-and-forget ──────────────────────────────────────
function fireAndForget(label, fn) {
  try {
    Promise.resolve(fn()).catch((err) =>
      console.warn(`[${label}] async error (non-fatal):`, err.message)
    );
  } catch (err) {
    console.warn(`[${label}] sync error (non-fatal):`, err.message);
  }
}

// ── Pagination helper ─────────────────────────────────────────────────────────
function parsePagination(query) {
  const limit  = Math.min(Math.max(parseInt(query.limit)  || 50, 1), 200);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
}

module.exports = { serialize, ok, fail, fireAndForget, parsePagination };
