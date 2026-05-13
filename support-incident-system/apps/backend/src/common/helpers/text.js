"use strict";

/**
 * src/common/helpers/text.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized text processing utilities.
 * Single source of truth for:
 *   - STOPWORDS (Indonesian + English)
 *   - tokenize()
 *   - generateKeywords()
 *
 * Previously duplicated across:
 *   - ticket/services/ticket.service.js
 *   - ticket/services/recommendation.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STOPWORDS = new Set([
  // Bahasa Indonesia
  "yang", "untuk", "dari", "dengan", "adalah", "pada", "ke", "di",
  "dan", "atau", "ini", "itu", "ada", "tidak", "bisa", "cara",
  "saya", "kami", "sudah", "belum", "akan", "kan", "ya", "nih",
  "dong", "aja", "sih", "juga", "lagi", "lah",
  // English
  "the", "is", "in", "on", "at", "to", "of", "a", "an", "and",
  "or", "for", "with",
]);

/**
 * Tokenize a string into lowercase words, filtering stopwords.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Generate search keywords from a title string.
 * Used when creating tickets to populate search_keywords column.
 * @param {string} title
 * @param {number} [maxKeywords=12]
 * @returns {string[]}
 */
function generateKeywords(title = "", maxKeywords = 12) {
  return tokenize(title).slice(0, maxKeywords);
}

/**
 * Compute Jaccard overlap score between two keyword arrays.
 * @param {string[]} kw1
 * @param {string[]} kw2
 * @returns {number} 0..1
 */
function overlapScore(kw1 = [], kw2 = []) {
  if (!kw1.length || !kw2.length) return 0;
  const s1 = new Set(kw1);
  const s2 = new Set(kw2);
  let inter = 0;
  for (const k of s1) if (s2.has(k)) inter++;
  const union = s1.size + s2.size - inter;
  return union === 0 ? 0 : inter / union;
}

module.exports = { STOPWORDS, tokenize, generateKeywords, overlapScore };
