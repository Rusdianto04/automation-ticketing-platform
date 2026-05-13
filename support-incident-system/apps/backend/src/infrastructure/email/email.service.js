
"use strict";

const nodemailer = require("nodemailer");
const config     = require("../../config");
const { formatDateForEmail } = require("../../common/utils/date");

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body        { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
    .container  { max-width: 600px; margin: 20px auto; padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header     { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 30px; text-align: center; }
    .header h1  { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.3px; }
    .header p   { margin: 8px 0 0; font-size: 13px; opacity: 0.85; }
    .content    { background: #ffffff; padding: 30px; }
    .greeting   { font-size: 15px; color: #334155; margin-bottom: 16px; }
    .info-box   { background: #f8f9ff; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .info-box h3 { margin: 0 0 14px; font-size: 14px; color: #4f46e5; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-item  { margin: 8px 0; font-size: 13px; color: #475569; }
    .info-item strong { color: #334155; }
    .status-badge { display: inline-block; background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .message    { font-size: 13px; color: #64748b; margin: 16px 0; line-height: 1.7; }
    .btn-wrap   { text-align: center; margin: 28px 0 10px; }
    /* FIX: tombol dengan warna putih eksplisit di inline style agar tidak terpengaruh email client */
    .footer     { background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e8eaed; }
    .footer p   { margin: 4px 0; font-size: 12px; color: #94a3b8; }
    .footer strong { color: #64748b; }
    .divider    { border: none; border-top: 1px solid #e8eaed; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Konfirmasi Penerimaan Ticket</h1>
      <p>${orgName} — IT Support Team</p>
    </div>
    <div class="content">
      <p class="greeting">Yth. Bapak/Ibu <strong>${reporterName}</strong>,</p>
      <p class="message">
        Terima kasih telah menghubungi <strong>IT Support ${orgName}</strong>. 
        Ticket Anda telah berhasil diterima dan sedang dalam antrian penanganan.
      </p>

      <div class="info-box">
        <h3>📋 Informasi Ticket</h3>
        <div class="info-item"><strong>Nomor Ticket :</strong> ${ticketLabel}</div>
        <div class="info-item"><strong>Jenis Layanan :</strong> ${serviceType}</div>
        <div class="info-item"><strong>Status :</strong> <span class="status-badge">🟢 Open — Sedang Diproses</span></div>
        <div class="info-item"><strong>Tanggal Laporan :</strong> ${reportDate}</div>
      </div>

      <p class="message">
        Tim IT Support akan segera meninjau dan menindaklanjuti permasalahan Anda. 
        Gunakan tombol di bawah untuk memantau status ticket secara realtime.
      </p>

      <hr class="divider" />

      <div class="btn-wrap">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${portalUrl}/tickets/${ticket.id}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="25%" stroke="f" fillcolor="#667eea">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">📊 Pantau Status Ticket</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${portalUrl}/tickets/${ticket.id}"
           target="_blank"
           style="display:inline-block;padding:13px 32px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff !important;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(102,126,234,0.4);">
          📊 Pantau Status Ticket
        </a>
        <!--<![endif]-->
      </div>

      <p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:12px;">
        Atau buka link: <a href="${portalUrl}/tickets/${ticket.id}" style="color:#667eea;">${portalUrl}/tickets/${ticket.id}</a>
      </p>
    </div>
    <div class="footer">
      <p><strong>IT Support Team — ${orgName}</strong></p>
      <p>Email ini dikirim otomatis, mohon tidak membalas langsung.</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { sendEmail, buildConfirmationEmail };