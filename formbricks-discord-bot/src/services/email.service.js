/**
 * src/services/email.service.js
 * Email Service — SMTP via Nodemailer
 *
 * Mengirim konfirmasi tiket ke pelapor.
 * Tidak blocking — error dilog tapi tidak di-throw.
 */

"use strict";

const nodemailer = require("nodemailer");
const config     = require("../config");
const { formatDateForEmail } = require("../utils/date");

// ─── Transporter ─────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host:   config.smtp.host,
  port:   config.smtp.port,
  secure: config.smtp.secure,
  auth:   { user: config.smtp.user, pass: config.smtp.pass },
  tls:    { rejectUnauthorized: false },
});

transporter.verify((err) => {
  if (err) console.error("❌ [EMAIL] SMTP connection error:", err.message);
  else     console.log("✅ [EMAIL] SMTP server ready");
});

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * Kirim email generic.
 * @param {{ to: string, subject: string, html: string }}
 */
async function sendEmail({ to, subject, html }) {
  if (!to) {
    console.warn("⚠ [EMAIL] No recipient — skipping");
    return null;
  }
  try {
    const info = await transporter.sendMail({
      from: config.smtp.from,
      to, subject, html,
    });
    console.log(`✅ [EMAIL] Sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ [EMAIL] Failed to send to ${to}:`, err.message);
    return null;
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

/**
 * Template konfirmasi penerimaan tiket.
 *
 * @param {object} ticket      — normalized ticket
 * @param {string} ticketType  — "TICKETING" | "INCIDENT"
 * @param {string} portalUrl   — base URL portal
 */
function buildConfirmationEmail(ticket, ticketType, portalUrl) {
  const fields       = ticket.formFields || ticket.form_fields || {};
  const reporterName = fields["Reporter Information"] || "Pelapor";
  const ticketLabel  = ticketType === "INCIDENT" ? `#${ticket.id}_Incident` : `#${ticket.id}_Support`;
  const serviceType  = ticketType === "INCIDENT"
    ? (fields["Priority Incident"] || "Incident Report")
    : (fields["Type of Support Requested"] || "General Support");
  const reportDate   = formatDateForEmail(ticket.createdAt || ticket.created_at || new Date());
  const orgName      = config.org.name;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body        { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container  { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header     { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1  { margin: 0; font-size: 24px; }
    .content    { background: #fff; padding: 30px; border: 1px solid #e0e0e0; }
    .info-box   { background: #f8f9fa; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
    .info-box strong { color: #667eea; }
    .info-item  { margin: 10px 0; }
    .footer     { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; color: #666; }
    .button     { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>✅ Konfirmasi Penerimaan Ticket</h1></div>
    <div class="content">
      <p><strong>Yth. Bapak/Ibu ${reporterName},</strong></p>
      <p>Terima kasih telah menghubungi <strong>IT Support ${orgName}</strong>.</p>
      <div class="info-box">
        <h3 style="margin-top:0;color:#667eea">📋 Informasi Ticket</h3>
        <div class="info-item"><strong>Nomor Ticket:</strong> ${ticketLabel}</div>
        <div class="info-item"><strong>Jenis Layanan:</strong> ${serviceType}</div>
        <div class="info-item"><strong>Status:</strong> <span style="color:#28a745;font-weight:bold">Open (Dalam Proses)</span></div>
        <div class="info-item"><strong>Tanggal Laporan:</strong> ${reportDate}</div>
      </div>
      <p>Tim IT Support akan segera meninjau dan menindaklanjuti permasalahan Anda.</p>
      <div style="text-align:center">
        <a href="${portalUrl}/tickets/${ticket.id}" class="button">📊 Pantau Status Ticket</a>
      </div>
    </div>
    <div class="footer">
      <p><strong>IT Support Team — ${orgName}</strong></p>
      <p style="font-size:11px;color:#999">Email ini dikirim otomatis, mohon tidak membalas.</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendEmail, buildConfirmationEmail };
