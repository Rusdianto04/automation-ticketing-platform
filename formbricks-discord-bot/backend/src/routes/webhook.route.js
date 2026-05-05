"use strict";

const router  = require("express").Router();
const config  = require("../config");
const TicketModel     = require("../models/ticket.model");
const SubmissionModel = require("../models/submission.model");
const ActivityModel   = require("../models/activity.model");
const DiscordService  = require("../services/discord.service");
const { sendEmail, buildConfirmationEmail } = require("../services/email.service");
const { cleanValue } = require("../utils/ticket");
const { getPublicUrl } = require("../utils/network");
const RecommendationService = require("../services/recommendation.service");
const IncidentService       = require("../services/incident.service");

// ─── Formbricks Field Mappings ────────────────────────────────────────────────

const TICKETING_FIELDS = [
  ["Reporter Information",       "Reporter Information"],
  ["Division",                   "Division"],
  ["No Telepon",                 "No Telepon"],
  ["Email",                      "Email"],
  ["ID Device",                  "ID Device"],
  ["Ruangan",                    "Ruangan"],
  ["Lantai",                     "Lantai"],
  ["Tanggal & Waktu Pemohon",    "Tanggal & Waktu Pemohon"],
  ["Type of Support Requested",  "Type of Support Requested"],
  ["Issue",                      "Issue"],
  ["Jumlah Barang",              "Jumlah Barang"],
  ["Attachment",                 "Attachment"],
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractFormId(body) {
  if (!body) return null;
  for (const f of ["form_id", "formId", "formid", "surveyId", "survey_id", "surveyid"]) {
    if (body[f]) return String(body[f]);
  }
  if (body.survey?.id)           return String(body.survey.id);
  if (body.response?.surveyId)   return String(body.response.surveyId);
  if (body.data?.surveyId)       return String(body.data.surveyId);
  const s = JSON.stringify(body).toLowerCase();
  if (s.includes(config.formbricks.formIdTicketing.toLowerCase())) return config.formbricks.formIdTicketing;
  if (s.includes(config.formbricks.formIdIncident.toLowerCase()))  return config.formbricks.formIdIncident;
  return null;
}

function detectFormType(body, answers) {
  const explicit = extractFormId(body) || extractFormId(answers);
  if (explicit === config.formbricks.formIdTicketing) return "TICKETING";
  if (explicit === config.formbricks.formIdIncident)  return "INCIDENT";
  const combined = (JSON.stringify(body) + JSON.stringify(answers)).toLowerCase();
  if (combined.includes("ticketing")) return "TICKETING";
  if (combined.includes("incident"))  return "INCIDENT";
  return "UNKNOWN";
}

function extractFormFields(formData, type) {
  const fieldsOrdered = type === "INCIDENT" ? INCIDENT_FIELDS : TICKETING_FIELDS;
  const result = {};

  for (const [fieldId, label] of fieldsOrdered) {
    const raw = formData[fieldId]
      ?? formData[label]
      ?? (formData.answers && (formData.answers[fieldId] ?? formData.answers[label]))
      ?? null;
    const cleaned = cleanValue(raw);
    if (cleaned) result[label] = cleaned;
  }

  // Fallback: jika masih kosong ambil semua key-value yang ada
  if (Object.keys(result).length === 0) {
    const allLabels = new Set(fieldsOrdered.map(([, label]) => label));
    for (const [key, val] of Object.entries(formData)) {
      if (["surveyId", "userId", "finished", "meta", "createdAt"].includes(key)) continue;
      const cleaned = cleanValue(val);
      if (!cleaned) continue;
      result[key] = cleaned;
    }
  }

  return result;
}

function extractEmailRecipient(formFields, rawAnswers) {
  if (formFields["Email"]?.trim()) return formFields["Email"].trim();
  if (rawAnswers && typeof rawAnswers === "object") {
    for (const [, val] of Object.entries(rawAnswers)) {
      const s = String(val || "").trim();
      if (s.includes("@") && s.includes(".")) return s;
    }
  }
  return null;
}

// ─── Route ───────────────────────────────────────────────────────────────────

router.post("/formbricks", async (req, res) => {
  // ── Step 1: Parse payload ─────────────────────────────────────────────────
  const body     = req.body || {};
  const answers  = body.answers || body.data || body.response || body || {};
  const formId   = extractFormId(body) || extractFormId(answers) || "unknown_form";
  const type     = detectFormType(body, answers);
  const formData = answers.data || answers || {};

  console.log("📥 [WEBHOOK] NEW SUBMISSION");
  console.log(`   +- Form ID   : ${formId}`);
  console.log(`   +- Form Type : ${type}`);
  console.log(`   +- Payload keys: ${Object.keys(formData).slice(0, 8).join(", ")}`);

  // ── Step 2: Save raw submission ───────────────────────────────────────────
  try {
    await SubmissionModel.create({ formId, payload: answers });
    console.log("✅ [WEBHOOK] Submission saved");
  } catch (subErr) {
    console.error("⚠ [WEBHOOK] Failed to save raw submission (non-fatal):", subErr.message);
  }

  // ── Step 3: Extract form fields ───────────────────────────────────────────
  const formFields = extractFormFields(formData, type);
  console.log(`   +- Fields extracted: ${Object.keys(formFields).filter((k) => formFields[k]).join(", ") || "(none)"}`);

  // ── Step 4: Create ticket ─────────────────────────────────────────────────
  let ticket;
  try {
    ticket = await TicketModel.create({
      type,
      formId,
      formFields,
      statusPengusulan:   "OPEN",
      evidenceAttachment: [],
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "created",
      description: `Ticket created from ${formId}`,
    });

    console.log(`✅ [WEBHOOK] Ticket #${ticket.id} created (${type})`);
  } catch (dbErr) {
    console.error("❌ [WEBHOOK] DB error creating ticket:", dbErr.message);
    return res.status(500).json({ error: "Failed to create ticket", detail: dbErr.message });
  }

  // ── Step 5: Discord thread ────────────────────────────────────────────────
  let discordResult = { ok: false, threadUrl: null, threadId: null, error: null };
  try {
    const { thread, infoMessage, overflowIds, commandsMessage } =
      await DiscordService.createTicketThread(ticket, config.discord.channelId);

    ticket = await TicketModel.update(ticket.id, {
      discord: {
        infoMessageId:      infoMessage.id,
        commandsMessageId:  commandsMessage?.id ?? null,
        threadId:           thread.id,
        threadUrl:          thread.url,
        channelId:          config.discord.channelId,
        overflowMessageIds: overflowIds ?? [],
      },
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "thread_created",
      description: `Thread: ${thread.url}`,
    });

    discordResult = { ok: true, threadUrl: thread.url, threadId: thread.id, error: null };
    console.log(`✅ [WEBHOOK] Discord thread created: ${thread.url}`);
  } catch (discordErr) {
    discordResult.error = discordErr.message;
    console.error("⚠ [WEBHOOK] Discord thread gagal (ticket tetap tersimpan di DB):");
    console.error(`   Error : ${discordErr.message}`);
    console.error(`   Code  : ${discordErr.code ?? "N/A"}`);
    if (discordErr.code === 50013) {
      console.error("   💡 FIX : Bot perlu permission 'Manage Messages' di channel tersebut.");
    }
    try {
      await ActivityModel.create({
        ticketId:    ticket.id,
        type:        "discord_error",
        description: `Discord thread gagal: ${discordErr.message.substring(0, 200)}`,
      });
    } catch (_) {}
  }

  // ── Step 5.5: Smart Recommendation → DALAM thread saja (non-blocking) ─────
  //
  // FIX v11:
  //   - HANYA kirim ke dalam thread tiket baru (bukan channel utama)
  //   - Delay 2000ms: pastikan pinned message + commands message sudah terkirim
  //     sehingga Smart Recommendation menjadi pesan KETIGA di thread
  //   - threadUrl dari kasus serupa disertakan sebagai link referensi Discord
  //   - excludeId = ticket.id: tidak rekomendasikan tiket ini sendiri
  //
  if (discordResult.ok && discordResult.threadId) {
    setTimeout(async () => {
      try {
        const issueText = type === "INCIDENT"
          ? (formFields["Incident Information"] || formFields["Incident Title"] || "")
          : (formFields["Issue"] || "");

        if (!issueText.trim()) return;

        // Cari dari tiket LAIN yang sudah DONE/RESOLVED
        const recResult = await RecommendationService.getRecommendation({
          issueText,
          keywords:  ticket.searchKeywords || ticket.search_keywords || [],
          type,
          excludeId: ticket.id,
        });

        if (!recResult.found) {
          console.log(`ℹ [WEBHOOK] Tidak ada Smart Recommendation untuk Ticket #${ticket.id}`);
          return;
        }

        // Build pesan — sertakan guildId & channelId untuk konteks link
        const recMsg = RecommendationService.buildDiscordRecommendation(
          recResult,
          type,
          config.discord.guildId,
          config.discord.channelId
        );
        if (!recMsg) return;

        // Kirim ke DALAM thread tiket baru
        const thread = await DiscordService.getClient().channels.fetch(discordResult.threadId);
        if (thread?.isThread()) {
          await thread.send(recMsg);
          console.log(`💡 [WEBHOOK] Smart Recommendation terkirim ke DALAM thread #${discordResult.threadId} (Ticket #${ticket.id})`);
        }
      } catch (recErr) {
        console.warn(`⚠ [WEBHOOK] Smart Recommendation error (non-fatal): ${recErr.message}`);
      }
    }, 2000);  // delay 2 detik — pinned + commands message sudah siap
  }

  // ── Incident detection ────────────────────────────────────────────────────
  try {
    const analysis = IncidentService.analyzeForIncident(ticket);
    if (analysis.isIncident) {
      console.log(`🚨 [WEBHOOK] Incident detected: #${ticket.id} | ${analysis.category}`);
      IncidentService.processIncident(ticket).catch((e) =>
        console.warn(`⚠ [WEBHOOK] Incident process error (non-fatal): ${e.message}`)
      );
    }
  } catch (_) {}

  // ── Step 6: Email konfirmasi ──────────────────────────────────────────────
  const emailTo = extractEmailRecipient(formFields, formData);
  if (emailTo) {
    const portalUrl    = getPublicUrl();
    const emailSubject = `Konfirmasi Penerimaan Ticket ${type === "INCIDENT" ? "Incident" : "Support"} #${ticket.id}`;
    const emailHtml    = buildConfirmationEmail(ticket, type === "INCIDENT" ? "INCIDENT" : "TICKETING", portalUrl);

    sendEmail({ to: emailTo, subject: emailSubject, html: emailHtml })
      .then((info) => {
        if (info) console.log(`✅ [WEBHOOK] Email konfirmasi terkirim ke ${emailTo}`);
      })
      .catch((err) => console.error(`❌ [WEBHOOK] Email error ke ${emailTo}:`, err.message));
  } else {
    console.warn(`⚠ [WEBHOOK] Email tidak dikirim — field Email kosong`);
  }

  // ── Step 7: Response ──────────────────────────────────────────────────────
  res.json({
    ok:        true,
    ticketId:  ticket.id,
    thread:    discordResult.threadUrl,
    discord:   discordResult.ok,
    emailSent: !!emailTo,
  });
});

module.exports = router;