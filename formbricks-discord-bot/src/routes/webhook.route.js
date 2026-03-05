/**
 * src/routes/webhook.route.js
 * Formbricks Webhook Route
 *
 * POST /webhook/formbricks
 *   Menerima submission dari Formbricks, membuat tiket,
 *   membuka thread Discord, dan mengirim email konfirmasi.
 *
 * FIX v2:
 *   - Discord createTicketThread diisolasi dalam try-catch sendiri
 *     → Email konfirmasi SELALU terkirim meski Discord gagal (Missing Permissions, dsb)
 *     → Webhook SELALU return { ok: true } selama DB berhasil — tidak 500 karena Discord error
 *   - Tambah logging untuk field extraction agar mudah debug payload Formbricks
 *   - Email recipient diambil dari multiple field candidates
 */

"use strict";

const router  = require("express").Router();
const config  = require("../config");
const TicketModel     = require("../models/ticket.model");
const SubmissionModel = require("../models/submission.model");
const ActivityModel   = require("../models/activity.model");
const DiscordService  = require("../services/discord.service");
const { sendEmail, buildConfirmationEmail } = require("../services/email.service");
const { normalizeTicket, cleanValue } = require("../utils/ticket");
const { getPublicUrl } = require("../utils/network");

// ─── Formbricks Field Maps ────────────────────────────────────────────────────

const TICKETING_FIELDS = [
  ["furan0qd44wk06zh1x7eol86", "Reporter Information"],
  ["wxro33g8v747alp0f5h5rjiu", "Division"],
  ["ubv5h3uuh9lqwgw2rb1xcl0t", "No Telepon"],
  ["q4jlog6h436dwbdqdxoxnhy0", "Email"],
  ["pekxomijpxixcvhkyx1ax0kh", "ID Device"],
  ["q0exb43ez6zw9o5xti6isu4w", "Ruangan"],
  ["u7n6ai5rt0ro8iybkfmle7li", "Lantai"],
  ["ngwljbqzvr6mg1xq33v0zhk5", "Tanggal & Waktu Pemohon"],
  ["j5hge2t3a59uw9zuw0l4s63c", "Type of Support Requested"],
  ["funs3653dc10m0ohm7regqm6", "Issue"],
  ["da2u7brsaabl48ympasqqzik", "Jumlah Barang"],
];

const INCIDENT_FIELDS = [
  ["j5hge2t3a59uw9zuw0l4s63c", "Incident Information"],
  ["it9s4530lxie67jogjhbvl8z", "Date Incident"],
  ["dw20caznxsng3uprsnxvt5nr", "Time Incident"],
  ["bsq3gnstra5d40chamn1j7bg", "Priority Incident"],
  ["f3r029x47v9su3w173fwn4ki", "Severity Incident"],
  ["sbt48laul3xtcm3kwggf4tpi", "Suspect Area"],
  ["lzwo9voycdeywln54rv68f2q", "Indicated Issue"],
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

/**
 * Cari email recipient dari berbagai kemungkinan field.
 * Formbricks terkadang menyimpan field "Email" di berbagai path.
 */
function extractEmailRecipient(formFields, rawAnswers) {
  // Prioritas 1: dari formFields yang sudah diparsing
  if (formFields["Email"]?.trim()) return formFields["Email"].trim();

  // Prioritas 2: cari di raw answers dengan berbagai key
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
  const body    = req.body || {};
  const answers = body.answers || body.data || body.response || body || {};
  const formId  = extractFormId(body) || extractFormId(answers) || "unknown_form";
  const type    = detectFormType(body, answers);
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
    // Non-fatal — lanjut proses
  }

  // ── Step 3: Extract form fields ───────────────────────────────────────────
  const fieldsOrdered = type === "INCIDENT" ? INCIDENT_FIELDS : TICKETING_FIELDS;
  const formFields    = {};
  for (const [fieldId, label] of fieldsOrdered) {
    const raw = formData[fieldId] || (formData.answers && formData.answers[fieldId]);
    formFields[label] = cleanValue(raw) || null;
  }
  console.log(`   +- Fields   : ${Object.entries(formFields).filter(([, v]) => v).map(([k]) => k).join(", ") || "(none extracted)"}`);

  // ── Step 4: Create ticket (BLOCKING — harus berhasil) ────────────────────
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

    console.log(`✅ [WEBHOOK] Ticket created: ${ticket.id}`);
  } catch (dbErr) {
    // DB error: ini memang fatal — tidak bisa lanjut
    console.error("❌ [WEBHOOK] DB error creating ticket:", dbErr.message);
    return res.status(500).json({ error: "Failed to create ticket", detail: dbErr.message });
  }

  // ── Step 5: Discord thread (NON-BLOCKING — tidak boleh crash webhook) ─────
  // FIX: Discord diisolasi di sini. Error Missing Permissions, rate limit, dsb
  // tidak boleh menyebabkan email gagal terkirim atau webhook return 500.
  let discordResult = { ok: false, threadUrl: null, threadId: null, error: null };
  try {
    const { thread, infoMessage, overflowIds, commandsMessage } =
      await DiscordService.createTicketThread(ticket, config.discord.channelId);

    ticket = await TicketModel.update(ticket.id, {
      discord: {
        infoMessageId:     infoMessage.id,
        commandsMessageId: commandsMessage?.id ?? null,
        threadId:          thread.id,
        threadUrl:         thread.url,
        channelId:         config.discord.channelId,
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
    // Catat error tapi JANGAN throw — email harus tetap terkirim
    discordResult.error = discordErr.message;
    console.error("⚠ [WEBHOOK] Discord thread gagal (ticket tetap tersimpan di DB):");
    console.error(`   Error : ${discordErr.message}`);
    console.error(`   Code  : ${discordErr.code ?? "N/A"}`);

    if (discordErr.code === 50013) {
      console.error("   💡 FIX : Bot perlu permission 'Manage Messages' di channel tersebut.");
      console.error("            Di Discord → Channel Settings → Permissions → Bot Role → ✅ Manage Messages");
    }

    // Simpan activity bahwa Discord gagal
    try {
      await ActivityModel.create({
        ticketId:    ticket.id,
        type:        "discord_error",
        description: `Discord thread gagal: ${discordErr.message.substring(0, 200)}`,
      });
    } catch (_) {}
  }

  // ── Step 6: Send confirmation email (SELALU — terlepas dari Discord) ──────
  // FIX: Email dijalankan SETELAH Discord block (sukses maupun gagal)
  // sehingga email selalu terkirim ke pelapor
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
    console.warn(`⚠ [WEBHOOK] Email tidak dikirim — field Email kosong atau tidak ditemukan di payload`);
  }

  // ── Step 7: Response ──────────────────────────────────────────────────────
  // Selalu OK selama tiket berhasil dibuat di DB
  res.json({
    ok:         true,
    ticketId:   ticket.id,
    thread:     discordResult.threadUrl,
    discord:    discordResult.ok,
    emailSent:  !!emailTo,
  });
});

module.exports = router;