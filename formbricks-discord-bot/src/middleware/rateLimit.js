/**
 * src/middleware/rateLimit.js
 * In-Memory Rate Limiter (per Discord userId)
 *
 * Mencegah spam ke chatbot — 1 request per WINDOW_MS per user.
 * Tidak menggunakan Redis (in-process map cukup untuk skala ini).
 */

"use strict";

const config   = require("../config");

const { windowMs, purgeAfterMs } = config.rateLimit;
const requestMap = new Map();

// Cleanup periodic — hapus entry yang sudah kadaluarsa
setInterval(() => {
  const cutoff = Date.now() - purgeAfterMs;
  for (const [k, v] of requestMap.entries()) {
    if (v < cutoff) requestMap.delete(k);
  }
}, config.rateLimit.cleanupMs);

/**
 * Cek apakah userId sedang dalam window rate limit.
 * @param {string} userId
 * @returns {boolean}
 */
function isRateLimited(userId) {
  const last = requestMap.get(userId);
  return last ? (Date.now() - last) < windowMs : false;
}

/**
 * Tandai request dari userId.
 * @param {string} userId
 */
function markRequest(userId) {
  requestMap.set(userId, Date.now());
}

module.exports = { isRateLimited, markRequest };
