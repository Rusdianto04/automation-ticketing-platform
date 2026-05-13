"use strict";

/**
 * src/modules/webhook/services/webhook.service.js
 *
 * Formbricks webhook processing service.
 *
 * ARCHITECTURE FIX v1.8 — Field Normalization:
 *
 * ROOT CAUSE: Formbricks mengirim UUID question ID sebagai key, bukan label.
 *   Raw DB: { "bsq3gnstra5d40chamn1j7bg": "Critical" }   ← SALAH
 *   Benar:  { "Priority Incident": "Critical" }           ← BENAR
 *
 * SOLUSI: 3-layer normalization sebelum data masuk ke TicketService:
 *   Layer 1 — Env mapping  : questionId → label (dari FORMBRICKS_*_FIELD_MAP)
 *   Layer 2 — Label match  : coba cocokkan key dengan label list (V13-style)
 *   Layer 3 — Positional   : mapping berdasarkan urutan field dalam form
 *
 * Setelah normalisasi, delegate ke TicketService.createTicket()
 * agar flow IDENTIK dengan Static Web Form.
 */

const config         = require("../../../config");
const SubmissionRepo = require("../repositories/submission.repository");
const { cleanValue } = require("../../../common/utils/ticket");
const { createLogger } = require("../../../common/logger");

const logger = createLogger("WEBHOOK_SVC");

// ── Lazy-load TicketService (hindari circular dep) ────────────────────────────
let _ticketService = null;
function getTicketService() {
  if (!_ticketService) _ticketService = require("../../ticket/services/ticket.service");
  return _ticketService;
}

// ── Field definitions: [expectedKey, normalizedLabel] ────────────────────────
// expectedKey: bisa berupa questionId (jika form pakai custom ID = label)
// normalizedLabel: label yang akan disimpan ke DB dan dibaca oleh Discord/Portal

const TICKETING_FIELDS = [
  ["Reporter Information",      "Reporter Information"],
  ["Division",                  "Division"],
  ["No Telepon",                "No Telepon"],
  ["Email",                     "Email"],
  ["ID Device",                 "ID Device"],
  ["Ruangan",                   "Ruangan"],
  ["Lantai",                    "Lantai"],
  ["Tanggal & Waktu Pemohon",   "Tanggal & Waktu Pemohon"],
  ["Type of Support Requested", "Type of Support Requested"],
  ["Issue",                     "Issue"],
  ["Jumlah Barang",             "Jumlah Barang"],
  ["Attachment",                "Attachment"],
];

const INCIDENT_FIELDS = [
  ["Incident Title",       "Incident Title"],
  ["Incident Information", "Incident Information"],
  ["Date & Time Incident", "Date & Time Incident"],
  ["Priority Incident",    "Priority Incident"],
  ["Severity Incident",    "Severity Incident"],
  ["Suspect Area",         "Suspect Area"],
  ["Indicated Issue",      "Indicated Issue"],
  ["Attachment",           "Attachment"],
];

// Kunci yang harus dilewati saat parsing payload Formbricks
const FORMBRICKS_SKIP_KEYS = new Set([
  "surveyId", "userId", "finished", "meta", "createdAt",
  "welcomeCard", "welcome", "intro", "start", "end",
]);

// Regex untuk mendeteksi UUID-style question ID Formbricks
// Contoh: "bsq3gnstra5d40chamn1j7bg", "da2u7brsaabl48ympasqqzik"
const FORMBRICKS_UUID_RE = /^[a-z0-9]{15,}$/i;

// ── Parsing helpers ───────────────────────────────────────────────────────────

function extractFormId(body) {
  if (!body) return null;
  for (const f of ["form_id", "formId", "formid", "surveyId", "survey_id", "surveyid"]) {
    if (body[f]) return String(body[f]);
  }
  if (body.survey?.id)         return String(body.survey.id);
  if (body.response?.surveyId) return String(body.response.surveyId);
  if (body.data?.surveyId)     return String(body.data.surveyId);
  const s = JSON.stringify(body).toLowerCase();
  if (s.includes(config.formbricks.formIdTicketing.toLowerCase()))
    return config.formbricks.formIdTicketing;
  if (s.includes(config.formbricks.formIdIncident.toLowerCase()))
    return config.formbricks.formIdIncident;
  return null;
}

function detectFormType(body, answers) {
  const explicit = extractFormId(body) || extractFormId(answers);
  if (explicit === config.formbricks.formIdTicketing) return "TICKETING";
  if (explicit === config.formbricks.formIdIncident)  return "INCIDENT";
  const combined = (JSON.stringify(body) + JSON.stringify(answers)).toLowerCase();
  if (combined.includes("ticketing")) return "TICKETING";
  if (combined.includes("incident"))  return "INCIDENT";
  return "TICKETING";
}

/**
 * NORMALISASI FORM FIELDS — 3 Layer Strategy
 *
 * Masalah: Formbricks bisa mengirim UUID sebagai key question.
 * Solusi:  Coba 3 cara dalam urutan prioritas:
 *
 *   Layer 1 — Env mapping:
 *     Gunakan FORMBRICKS_INCIDENT_FIELD_MAP / FORMBRICKS_TICKETING_FIELD_MAP
 *     dari .env untuk map questionId → label
 *
 *   Layer 2 — Label matching (V13-style):
 *     Coba cocokkan key dengan label dari FIELDS list
 *     (bekerja jika form dikonfigurasi dengan custom question ID = label)
 *
 *   Layer 3 — Positional mapping:
 *     Map berdasarkan urutan kemunculan key dalam payload
 *     (bekerja untuk form dengan UUID question ID, urutan sesuai FIELDS list)
 *
 * @param {object} formData - raw payload dari Formbricks
 * @param {string} type     - "INCIDENT" | "TICKETING"
 * @returns {object}        - { "Field Label": "Value" }
 */
function extractFormFields(formData, type) {
  const fieldsOrdered = type === "INCIDENT" ? INCIDENT_FIELDS : TICKETING_FIELDS;
  const envMapping    = type === "INCIDENT"
    ? config.formbricks.incidentFieldMap
    : config.formbricks.ticketingFieldMap;
  const result = {};

  // ── Layer 1: Env mapping (questionId → label dari .env) ──────────────────
  const hasEnvMapping = Object.keys(envMapping).length > 0;
  if (hasEnvMapping) {
    for (const [questionId, label] of Object.entries(envMapping)) {
      if (formData[questionId] !== undefined) {
        const cleaned = cleanValue(formData[questionId]);
        if (cleaned) result[label] = cleaned;
      }
    }
    // Juga coba layer 2 untuk melengkapi field yang mungkin terlewat
  }

  // ── Layer 2: Label matching (V13-style, custom question ID = label) ───────
  for (const [fieldId, label] of fieldsOrdered) {
    if (result[label]) continue; // sudah diisi oleh layer 1
    const raw =
      formData[fieldId] ??
      formData[label] ??
      (formData.answers && (formData.answers[fieldId] ?? formData.answers[label])) ??
      null;
    const cleaned = cleanValue(raw);
    if (cleaned) result[label] = cleaned;
  }

  // ── Layer 3: Positional mapping (UUID question ID) ────────────────────────
  // Hanya berjalan jika result masih kosong setelah layer 1+2
  if (Object.keys(result).length === 0) {
    // Ambil semua key yang merupakan UUID Formbricks (bukan meta key)
    const dataKeys = Object.keys(formData).filter(
      (k) => !FORMBRICKS_SKIP_KEYS.has(k.toLowerCase()) &&
             !FORMBRICKS_SKIP_KEYS.has(k) &&
             FORMBRICKS_UUID_RE.test(k)
    );

    // Jika tidak ada UUID key, ambil semua key yang bukan meta
    const rawKeys = dataKeys.length > 0
      ? dataKeys
      : Object.keys(formData).filter(
          (k) => !FORMBRICKS_SKIP_KEYS.has(k.toLowerCase()) &&
                 !FORMBRICKS_SKIP_KEYS.has(k)
        );

    // Map berdasarkan posisi
    rawKeys.forEach((key, index) => {
      if (index >= fieldsOrdered.length) return;
      const label   = fieldsOrdered[index][1];
      const cleaned = cleanValue(formData[key]);
      if (cleaned) result[label] = cleaned;
    });

    if (Object.keys(result).length > 0) {
      logger.info(`Layer 3 (positional) normalization applied — mapped ${Object.keys(result).length} fields`);
      logger.info(`Tip: Set FORMBRICKS_${type}_FIELD_MAP in .env untuk mapping yang lebih akurat`);
    }
  }

  // ── Fallback akhir: simpan semua key-value mentah ─────────────────────────
  // Ini terjadi jika form punya field dengan UUID key yang tidak bisa di-positional-map
  // karena ada field tambahan (welcome card, skip logic, dll.)
  if (Object.keys(result).length === 0) {
    logger.warn("All normalization layers failed — storing raw form data");
    for (const [key, val] of Object.entries(formData)) {
      if (FORMBRICKS_SKIP_KEYS.has(key.toLowerCase()) || FORMBRICKS_SKIP_KEYS.has(key)) continue;
      const cleaned = cleanValue(val);
      if (cleaned) result[key] = cleaned;
    }
  }

  return result;
}

function extractEmailRecipient(formFields) {
  if (formFields["Email"]?.trim()) return formFields["Email"].trim();
  // Cari nilai yang terlihat seperti email di semua field
  for (const val of Object.values(formFields)) {
    const s = String(val || "").trim();
    if (s.includes("@") && s.includes(".") && !s.includes(" ")) return s;
  }
  return null;
}

// ── Main service method ───────────────────────────────────────────────────────

/**
 * Process Formbricks webhook submission.
 *
 * Normalizes payload → delegates to TicketService.createTicket()
 * → IDENTIK dengan Static Web Form flow.
 */
async function processSubmission(body) {
  // ── Step 1: Parse Formbricks payload ─────────────────────────────────────
  const answers  = body.answers || body.data || body.response || body || {};
  const formId   = extractFormId(body) || extractFormId(answers) || "formbricks_webhook";
  const type     = detectFormType(body, answers);
  const formData = answers.data || answers || {};

  logger.info(`New submission — formId: ${formId}, type: ${type}`);
  logger.info(`Raw keys: ${Object.keys(formData).slice(0, 10).join(", ")}`);

  // ── Step 2: Save raw submission (non-blocking, non-fatal) ─────────────────
  try {
    await SubmissionRepo.create({ formId, payload: answers });
  } catch (err) {
    logger.warn(`Failed to save raw submission (non-fatal): ${err.message}`);
  }

  // ── Step 3: Normalize form fields (3-layer strategy) ─────────────────────
  const formFields = extractFormFields(formData, type);
  const fieldKeys  = Object.keys(formFields);
  logger.info(`Fields normalized (${fieldKeys.length}): ${fieldKeys.join(", ") || "(none)"}`);

  // Validasi: cek apakah normalisasi berhasil (tidak ada UUID key tersisa)
  const hasUuidKeys = fieldKeys.some((k) => FORMBRICKS_UUID_RE.test(k) && k.length > 15);
  if (hasUuidKeys) {
    logger.warn(
      `Some UUID keys remain after normalization. ` +
      `Set FORMBRICKS_${type}_FIELD_MAP in .env for accurate mapping. ` +
      `Raw keys: ${fieldKeys.filter((k) => FORMBRICKS_UUID_RE.test(k)).join(", ")}`
    );
  }

  // ── Step 4: Delegate ke TicketService — IDENTIK dengan Static Web Form ────
  //
  // TicketService.createTicket() menangani:
  //   ✅ generateKeywords(title)          — search_keywords terisi
  //   ✅ TicketRepo.create()              — DB insert
  //   ✅ ActivityRepo.create()            — activity log proper
  //   ✅ DiscordService.createTicketThread() — Discord thread
  //   ✅ _runBackgroundTasks()            — recommendation + incident detection
  //   ✅ EmailService.sendEmail()         — email konfirmasi
  //
  const TicketService = getTicketService();
  const result = await TicketService.createTicket({
    type,
    formFields,               // ✅ sudah dinormalisasi, key = label
    formId,                   // Formbricks form ID
    createdBy: "formbricks_webhook",
    autoCreateDiscord: true,
  });

  const ticket        = result.ticket;
  const discordThread = result.discordThread;

  logger.info(`Ticket #${ticket.id} created via Formbricks (${type})`);
  if (discordThread?.threadUrl) {
    logger.info(`Discord thread: ${discordThread.threadUrl}`);
  }

  return {
    ok:        true,
    ticketId:  ticket.id,
    thread:    discordThread?.threadUrl ?? null,
    discord:   !!discordThread,
    emailSent: result.emailSent,
  };
}

module.exports = {
  processSubmission,
  extractFormId,
  detectFormType,
  extractFormFields,
};