/**
 * src/services/classifier.service.js
 * AI Ticket Field Classifier
 *
 * Mengklasifikasikan field tiket dari free-text menggunakan:
 *   1. Rule-based NLP (priority, severity, suspect area)
 *   2. Groq AI title generation (fallback ke rule-based jika gagal)
 *
 * Digunakan saat chatbot auto-create ticket dari Discord.
 */

"use strict";

const axios  = require("axios");
const config = require("../config");

/**
 * Klasifikasi field tiket dari raw text.
 *
 * @param {string} rawText — pesan asli dari Discord
 * @returns {{ title, priority, severity, suspectArea, indicatedIssue, dateStr, timeStr }}
 */
async function classifyTicketFields(rawText) {
  const text = rawText.toLowerCase();

  // ─── Clean text (hapus mention & command prefix) ────────────────────────────
  const cleanText = rawText
    .replace(/<@[!&]?\d+>/g, "")
    .replace(/buat(kan)?\s+(ticket|tiket|laporan)?/gi, "")
    .replace(/laporkan\s+(masalah|insiden|incident)?/gi, "")
    .replace(/create\s+(ticket|tiket)?/gi, "")
    .replace(/open\s+ticket/gi, "")
    .replace(/^\s*(incident|support|insiden)?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // ─── Title — default dari clean text, override oleh Groq jika tersedia ─────
  let title = cleanText.length > 3
    ? cleanText.charAt(0).toUpperCase() + cleanText.slice(1)
    : "Masalah IT dilaporkan via Discord";

  if (config.groq.apiKey) {
    try {
      const resp = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model:       config.groq.modelSmall,
          max_tokens:  60,
          temperature: 0.3,
          messages: [
            {
              role:    "system",
              content:
                "Kamu adalah IT helpdesk assistant. Buat judul ticket IT yang singkat, jelas, dan profesional " +
                "(maks 80 karakter) dalam Bahasa Indonesia.\n" +
                "Format: [Jenis Masalah] - [Lokasi/Sistem] (jika ada)\n" +
                "Contoh:\n" +
                '- "Gangguan Koneksi Internet - Ruang CPMP Staff Lantai 1"\n' +
                '- "Printer Tidak Bisa Print - Ruang Rapat Lantai 2"\n' +
                "Hanya output judul saja, tanpa penjelasan, tanpa tanda kutip.",
            },
            {
              role:    "user",
              content: `Buat judul ticket untuk masalah berikut: "${cleanText}"`,
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${config.groq.apiKey}`, "Content-Type": "application/json" },
          timeout: 8000,
        }
      );

      const aiTitle = resp.data?.choices?.[0]?.message?.content?.trim();
      if (aiTitle && aiTitle.length > 5 && aiTitle.length <= 100) {
        title = aiTitle.replace(/^["']|["']$/g, "").trim();
        console.log(`🤖 [CLASSIFIER] AI title: "${title}"`);
      }
    } catch (err) {
      console.warn(`⚠ [CLASSIFIER] AI title fallback: ${err.message}`);
    }
  }

  // ─── Priority & Severity — multi-layer rule-based ───────────────────────────
  let priority = "Medium";
  let severity = "Medium";

  const isBroadScope   = /semua|seluruh|all\s+user|entire/.test(text);
  const isMediumScope  = /lantai|gedung|ruangan|departemen|divisi|lab|staff/.test(text);
  const isTotalOutage  = /mati\s+total|total\s+mati|down\s+total|blackout/.test(text);
  const isServiceDown  = /tidak\s+bisa\s+(internet|akses|connect|login)|internet\s+(mati|putus)|network\s+(down|mati)|koneksi\s+(mati|putus)|offline/.test(text);
  const isHardwareDown = /server\s+(mati|down|crash)|switch\s+(mati|rusak)|router\s+(mati|rusak)|hub\s+(mati|rusak)/.test(text);
  const isDeviceError  = /printer\s+(rusak|error|tidak\s+bisa)|komputer\s+(hang|mati|error)|laptop\s+(mati|hang|error)/.test(text);
  const isGeneralError = /mati|error|rusak|hang|crash|tidak\s+berfungsi|gagal|putus|down/.test(text);
  const isPerformance  = /lambat|lemot|slow|delay|lag|tidak\s+stabil/.test(text);
  const isUrgent       = /darurat|emergency|urgent|segera|kritis|critical|production\s+down/.test(text);

  if (isTotalOutage || (isUrgent && isServiceDown) || (isBroadScope && isHardwareDown)) {
    priority = "Critical"; severity = "Critical";
  } else if (isHardwareDown || (isServiceDown && (isMediumScope || isBroadScope)) || (isDeviceError && isUrgent) || isUrgent) {
    priority = "High"; severity = isBroadScope ? "High" : "Medium";
  } else if (isServiceDown || isDeviceError || isGeneralError) {
    priority = "Medium"; severity = isMediumScope ? "Medium" : "Low";
  } else if (isPerformance) {
    priority = "Low"; severity = "Low";
  }

  if (isUrgent && priority !== "Critical") priority = "High";

  // ─── Suspect Area — extract lokasi dari teks ─────────────────────────────────
  let suspectArea = "N/A";
  const areaPatterns = [
    /ruang(?:an)?\s+([\w][\w\s]{1,40}?)(?=\s+(?:mati|tidak|error|rusak|lantai|$)|$)/i,
    /lantai\s+(\d+(?:\s+[\w]+)?)/i,
    /lab(?:oratorium)?\s+([\w][\w\s]{1,30}?)(?=\s+(?:mati|tidak|error|$)|$)/i,
    /gedung\s+([\w][\w\s]{1,30}?)(?=\s+(?:mati|tidak|error|lantai|$)|$)/i,
    /hub\s+([\w][\w\s]{1,20}?)(?=\s+(?:mati|tidak|error|$)|$)/i,
    /(server\s+room|data\s+center|network\s+center|noc|ruang\s+server)/i,
    /\bdi\s+((?:ruang|lantai|lab|gedung|area|lobi|lobby)[\w\s]{2,40}?)(?=\s|$)/i,
  ];

  for (const pattern of areaPatterns) {
    const match = rawText.replace(/<@[!&]?\d+>/g, "").match(pattern);
    if (match) {
      const raw     = (match[1] || match[0]).trim().replace(/\s+/g, " ");
      const cleaned = raw.replace(/\s*(mati|tidak|error|rusak|down|issue).*$/i, "").trim();
      if (cleaned.length > 2 && cleaned.length < 60) {
        suspectArea = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        break;
      }
    }
  }

  // ─── DateTime WIB ────────────────────────────────────────────────────────────
  const now     = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const dateStr = wibTime.toISOString().split("T")[0];      // "YYYY-MM-DD"
  const timeStr = wibTime.toISOString().substring(11, 16);  // "HH:MM"

  console.log(`🎯 [CLASSIFIER] Priority=${priority} Severity=${severity} Area="${suspectArea}"`);

  return { title, priority, severity, suspectArea, indicatedIssue: title, dateStr, timeStr };
}

module.exports = { classifyTicketFields };
