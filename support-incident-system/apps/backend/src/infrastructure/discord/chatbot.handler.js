"use strict";

const fs      = require("fs");
const axios   = require("axios");
const { AttachmentBuilder } = require("discord.js");

const config            = require("../../config");
const TicketModel       = require("../../modules/ticket/repositories/ticket.repository");
const ActivityModel     = require("../../modules/activity/repositories/activity.repository");
const DiscordService    = require("./discord.service");
const { generateReport } = require("../../modules/report/services/report.service");
const { classifyTicketFields } = require("../../modules/ticket/services/classifier.service");
const { isRateLimited, markRequest } = require("../../common/middleware/rateLimit");
const { splitDiscordMessage } = require("../../common/utils/discord");

// ─── Conversation History (per userId, in-memory) ─────────────────────────────
const conversationHistory = new Map();

// Periodic cleanup — hapus history > 1 jam
setInterval(() => {
  const now   = Date.now();
  const TTL   = config.chatbot.historyTtlMs;
  let cleaned = 0;
  for (const [userId, history] of conversationHistory.entries()) {
    const fresh = history.filter((t) => now - new Date(t.timestamp).getTime() < TTL);
    if (fresh.length === 0) { conversationHistory.delete(userId); cleaned++; }
    else if (fresh.length < history.length) conversationHistory.set(userId, fresh);
  }
  if (cleaned > 0) console.log(`🧹 [CHATBOT] Cleaned ${cleaned} stale conversation histories`);
}, config.chatbot.cleanupIntervalMs);

// ─── Helper: push to history ──────────────────────────────────────────────────
function pushHistory(userId, question, answer) {
  const history = conversationHistory.get(userId) || [];
  history.push({ question, answer: answer.substring(0, 500), timestamp: new Date().toISOString() });
  if (history.length > config.chatbot.maxHistoryPerUser) history.shift();
  conversationHistory.set(userId, history);
}

function detectIntent(question) {
  const q = question.toLowerCase();
  const ticketIdMatch = question.match(/#(\d+)/);
  const ticketId      = ticketIdMatch ? parseInt(ticketIdMatch[1]) : null;

  // ── Incident Report Request ──────────────────────────────────────────────────
  const isIncidentReportReq = (
    ticketId &&
    (q.includes("incident report") || q.includes("laporan insiden") || q.includes("buatkan laporan"))
  );

  const OLD_CREATE_PATTERNS = (
    q.includes("buat ticket")         ||
    q.includes("buat tiket")          ||
    q.includes("laporkan masalah")    ||
    q.includes("buat laporan ticket") ||
    q.includes("create ticket")       ||
    q.includes("open ticket")         ||
    q.includes("buatkan ticket")      ||
    q.includes("buatkan tiket")       ||
    /^(buat|bikin|laporkan|report|buka)\s+(ticket|tiket|laporan)/.test(q)
  );

  // Pattern baru — menangkap variasi bahasa Indonesia natural:
  const NEW_CREATE_PATTERNS = (
    // "buatkan saya ticket ..." / "buatkan ticket incident ..."
    /buatkan\s+(?:\w+\s+){0,4}(ticket|tiket)/.test(q)                      ||
    // "buatkan threads ticket ..." / "buatkan thread untuk ticket"
    /buatkan\s+threads?\s+(ticket|tiket|incident|insiden)/.test(q)          ||
    // "buatkan saya threads ..." (tanpa kata ticket pun cukup jika ada incident/insiden)
    /buatkan\s+(?:\w+\s+){0,3}threads?\s+(?:\w+\s+){0,3}(ticket|tiket|incident|insiden)/.test(q) ||
    // "buat threads ticket ..." / "buat thread incident ..."
    /buat\s+threads?\s+(ticket|tiket|incident|insiden)/.test(q)             ||
    // "tolong buatkan thread/ticket ..."
    /tolong\s+buatkan\s+(?:threads?\s+)?(ticket|tiket)/.test(q)            ||
    // "laporkan insiden ..." / "laporkan incident ..."
    q.includes("laporkan insiden")   || q.includes("laporkan incident")     ||
    // "bikin laporan ticket ..." / "bikin incident ..."
    /bikin\s+(?:laporan\s+)?(ticket|tiket|incident|insiden)/.test(q)       ||
    // "buatkan laporan incident" (tanpa ticket ID → bukan report, tapi create)
    (!ticketId && /buatkan\s+laporan\s+(incident|insiden)/.test(q))
  );

  const isAutoCreateReq = !isIncidentReportReq && (OLD_CREATE_PATTERNS || NEW_CREATE_PATTERNS);

  // ── Incident Type Detection ──────────────────────────────────────────────────
  const isIncidentType = (
    q.includes("incident")            ||
    q.includes("insiden")             ||
    q.includes("mati total")          ||
    q.includes("down")                ||
    q.includes("darurat")             ||
    q.includes("kritis")              ||
    q.includes("server mati")         ||
    q.includes("jaringan mati")       ||
    q.includes("internet mati")       ||
    q.includes("koneksi mati")        ||
    q.includes("loss connection")     ||
    q.includes("internet loss")       ||
    q.includes("network down")        ||
    q.includes("service down")        ||
    q.includes("tidak bisa internet") ||
    q.includes("mati lampu")          ||
    q.includes("listrik mati")
  );

  return { isIncidentReportReq, isAutoCreateReq, isIncidentType, ticketId };
}

// ─── Handler: Incident Report ────────────────────────────────────────────────
async function handleIncidentReport(message, ticketId, question, startTime) {
  const userId = message.author.id;
  await message.channel.sendTyping();
  try {
    console.log(`📋 [CHATBOT] Generating Incident Report #${ticketId} for ${message.author.tag}`);

    const reportData     = await generateReport(ticketId, "STANDARD", message.author.tag);
    const processingTime = Date.now() - startTime;
    const { reportUrl, reportId, reportTitle } = reportData;

    const summaryMsg = [
      `📋 **Incident Report Ticket #${ticketId} berhasil dibuat!**`,
      ``,
      `📄 **Report ID:** ${reportId}`,
      `🏷️ **Judul:** ${reportTitle}`,
      `📅 **Generated:** ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
      ``,
      `🌐 **Akses Laporan HTML (jaringan internal):**`,
      `Buka Portal Admin → Ticket #${ticketId} → Klik tombol **"Buka Laporan HTML"**`,
      `*(URL otomatis disesuaikan dengan IP server terkini)*`,
    ].join("\n");

    await message.reply({ content: summaryMsg });

    pushHistory(userId, question, `Incident Report #${ticketId} berhasil dibuat. URL: ${reportUrl}`);
    console.log(`✅ [CHATBOT] Incident Report #${ticketId} done in ${processingTime}ms`);

  } catch (err) {
    console.error(`❌ [CHATBOT] Report error:`, err.message);
    const errMsg = err.message.includes("tidak ditemukan")
      ? `❌ **Ticket #${ticketId} tidak ditemukan.**\nPastikan ID ticket sudah benar.`
      : `❌ **Gagal generate Incident Report.**\nError: ${err.message}`;
    await message.reply({ content: errMsg });
  }
}

// ─── Handler: Auto Create Ticket ─────────────────────────────────────────────
async function handleAutoCreate(message, question, isIncidentType, startTime) {
  const userId = message.author.id;
  const ticketType = isIncidentType ? "INCIDENT" : "TICKETING";

  await message.channel.sendTyping();

  try {
    console.log(`🆕 [CHATBOT] Auto-creating ${ticketType} for ${message.author.tag}`);
    const classified = await classifyTicketFields(question, ticketType);
    const { title, priority, severity, suspectArea, indicatedIssue, dateStr, timeStr } = classified;
    console.log(`   Title: "${title}" | ${priority}/${severity} | Area: ${suspectArea} | ${dateStr} ${timeStr}`);
    const stopwords = ["yang","untuk","dari","dengan","adalah","pada","tidak","sudah","akan","juga","telah","dapat","atau","oleh","ini","itu","saja","bisa","maka","tapi","namun"];
    const keywords  = title.split(/\s+/).filter((w) => w.length > 3 && !stopwords.includes(w.toLowerCase())).slice(0, 10);

    const formFields = ticketType === "INCIDENT"
      ? {
          "Incident Information": title,
          "Reporter Information": message.author.username,
          "Division":             "N/A",
          "No Telepon":           "N/A",
          "Email":                "N/A",
          "Date Incident":        dateStr,
          "Time Incident":        timeStr,
          "Priority Incident":    priority,
          "Severity Incident":    severity,
          "Suspect Area":         suspectArea,
          "Indicated Issue":      indicatedIssue,
        }
      : {
          "Issue":                title,
          "Reporter Information": message.author.username,
          "Division":             "N/A",
          "No Telepon":           "N/A",
          "Email":                "N/A",
          "Location":             suspectArea !== "N/A" ? suspectArea : "N/A",
          "Device":               "N/A",
          "Support Type":         "General",
        };

    let ticket = await TicketModel.create({
      type:               ticketType,
      formId:             "chatbot_auto_create",
      formFields,
      statusPengusulan:   "OPEN",
      evidenceAttachment: [],
      searchKeywords:     keywords,
    });

    await ActivityModel.create({
      ticketId:    ticket.id,
      type:        "chatbot_auto_create",
      description: `Ticket #${ticket.id} auto-created via Discord Chatbot by ${message.author.tag}`,
    });

    const { thread, infoMessage, overflowIds, commandsMessage } =
      await DiscordService.createTicketThread(ticket, config.discord.channelId, {
        source: "chatbot",
      });

    ticket = await TicketModel.update(ticket.id, {
      discord: {
        infoMessageId:      infoMessage.id,
        commandsMessageId:  commandsMessage.id,
        threadId:           thread.id,
        threadUrl:          thread.url,
        channelId:          config.discord.channelId,
        overflowMessageIds: overflowIds,
      },
    });

    axios.post(config.n8n.webhookUrl, {
      ticketId: ticket.id,
      threadId: thread.id,
      mode:     "MONITOR",
      type:     ticketType,
      formFields,
    }, {
      headers: { "X-API-Key": config.n8n.apiKey },
      timeout: 5000,
    }).catch((err) => console.error("[CHATBOT] N8N trigger error:", err.message));

    pushHistory(
      userId, question,
      `Ticket #${ticket.id} (${ticketType}) dibuat: ${title}. Thread: ${thread.url}`
    );
    console.log(`✅ [CHATBOT] Ticket #${ticket.id} | ${ticketType} | ${priority}/${severity} | Thread: ${thread.url}`);

  } catch (err) {
    console.error("❌ [CHATBOT] Auto-create error:", err.message);
    await message.reply(`❌ **Gagal membuat ticket.**\nSilakan coba lagi atau hubungi administrator.`);
  }
}

// ─── Handler: Normal Question → N8N ──────────────────────────────────────────
async function handleNormalQuestion(message, question, ticketId, startTime) {
  const userId = message.author.id;

  try {
    const userHistory = conversationHistory.get(userId) || [];
    const response    = await axios.post(
      config.n8n.chatbotWebhook,
      {
        userId:      message.author.id,
        userName:    message.author.tag,
        question,
        ticketId,
        channelId:   message.channel.id,
        messageId:   message.id,
        conversationHistory: userHistory,
        context: {
          isThread: message.channel.isThread?.() ?? false,
          isDM:     message.channel.type === "DM",
          hasHistory: userHistory.length > 0,
        },
      },
      {
        headers: { "Content-Type": "application/json", "X-API-Key": config.n8n.apiKey },
        timeout: 60_000,
      }
    );

    const processingTime = Date.now() - startTime;
    const rawAnswer       = response.data?.answer;
    const questionCategory = response.data?.questionCategory || "general";
    const answer = (rawAnswer && String(rawAnswer).trim())
      ? String(rawAnswer).trim()
      : "Maaf, tidak ada respons dari AI. Silakan coba lagi atau coba pertanyaan yang lebih spesifik.";

    const CATEGORY_EMOJI = {
      ticket_specific: "🎫", troubleshooting: "🔧", explanation: "📚",
      recommendation: "💡", howto: "📖", incident_report: "📋",
      historical: "🔗", auto_create: "🆕", general: "🤖",
    };
    const emoji = CATEGORY_EMOJI[questionCategory] || "🤖";

    if (questionCategory === "incident_report" && response.data.reportData) {
      const reportData = response.data.reportData;
      const { reportUrl, filePath, reportId, reportTitle, ticketId: repTicketId } = reportData;

      await message.reply({
        content: [
          `📋 **Incident Report Ticket #${repTicketId} berhasil dibuat!**`,
          ``, `📄 **Report ID:** ${reportId}`, `🏷️ **Judul:** ${reportTitle}`,
          `📅 **Generated:** ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
          ``, `🌐 **Link HTML:** ${reportUrl}`,
        ].join("\n"),
      });

      if (filePath && fs.existsSync(filePath)) {
        const attachment = new AttachmentBuilder(filePath, {
          name: `incident_report_ticket_${repTicketId}.html`,
        });
        await message.channel.send({ content: `📎 **Download Incident Report:**`, files: [attachment] });
      }
    } else {
      const safeAnswer = answer && String(answer).trim() ? String(answer).trim() : "(Tidak ada respons)";
      const chunks = splitDiscordMessage(safeAnswer);
      const firstChunk = chunks[0] || safeAnswer;
      await message.reply({ content: `${emoji} ${firstChunk}` });
      for (let i = 1; i < chunks.length; i++) {
        if (chunks[i]) await message.channel.send({ content: chunks[i] });
      }
    }

    pushHistory(userId, question, String(answer || "").substring(0, 500));
    console.log(`✅ [CHATBOT] Response in ${processingTime}ms (category: ${questionCategory})`);
  } catch (err) {
    console.error(`❌ [CHATBOT] N8N error:`, err.message);
    if (err.code === "ECONNREFUSED") {
      await message.reply("⚠️ Chatbot service sedang tidak tersedia. Silakan coba lagi nanti.");
    } else if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
      await message.reply("⏱️ Request timeout. Pertanyaan terlalu kompleks. Coba lebih spesifik.");
    } else {
      await message.reply("❌ Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan coba lagi.");
    }
  }
}

// ─── Main Handler (dipanggil dari index.js) ───────────────────────────────────
/**
 * Register semua chatbot-related event listeners ke Discord client.
 * @param {Client} client
 */
function register(client) {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith("!")) return;

    const isMentioned = message.mentions.has(client.user);
    const isDM        = message.channel.type === "DM";
    if (!isMentioned && !isDM) return;

    const userId = message.author.id;
    if (isRateLimited(userId)) { await message.react("⏳"); return; }
    markRequest(userId);

    const question = message.content.replace(/<@!?\d+>/g, "").trim();
    if (!question || question.length < 2) {
      return message.reply(
        `❓ Silakan tanyakan apapun! Contoh:\n` +
        `• \`@bot summary ticket #5\`\n` +
        `• \`@bot laptop tidak bisa menyala\`\n` +
        `• \`@bot buat ticket printer ruang rapat\`\n` +
        `• \`@bot buatkan incident report ticket #3\``
      );
    }
    const startTime = Date.now();
    const { isIncidentReportReq, isAutoCreateReq, isIncidentType, ticketId } = detectIntent(question);

    await message.channel.sendTyping();

    if (isIncidentReportReq) {
      return handleIncidentReport(message, ticketId, question, startTime);
    }
    if (isAutoCreateReq) {
      return handleAutoCreate(message, question, isIncidentType, startTime);
    }
    return handleNormalQuestion(message, question, ticketId, startTime);
  });

  // ── !clear-history ───────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!clear-history")) return;
    conversationHistory.delete(message.author.id);
    await message.reply("✅ Conversation history cleared. Mulai conversation baru!");
  });

  // ── !chatbot-help ────────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!chatbot-help")) return;
    await message.reply(
      `🤖 **AI CHATBOT ASSISTANT — ENTERPRISE MODE**\n\n` +
      `**Cara Penggunaan:**\nMention bot (\`@BotName\`) atau kirim DM — tanya **APAPUN**!\n\n` +
      `**Contoh Pertanyaan:**\n` +
      `🎫 **Ticket:** \`@bot summary ticket #5\` | \`@bot root cause ticket #3\`\n` +
      `🔧 **Troubleshoot:** \`@bot laptop lemot kenapa\` | \`@bot printer tidak print\`\n` +
      `📚 **Konsep IT:** \`@bot jelaskan RAID 5\` | \`@bot perbedaan TCP vs UDP\`\n` +
      `🔗 **Historical:** \`@bot cari ticket serupa masalah wifi\`\n` +
      `📋 **Laporan:** \`@bot buatkan incident report ticket #7\`\n` +
      `🆕 **Buat Ticket:** \`@bot buat ticket printer ruang rapat lantai 2 tidak bisa print\`\n\n` +
      `**Commands:**\n` +
      `\`!clear-history\` — Reset conversation history\n` +
      `\`!chatbot-stats\` — Usage statistics\n` +
      `\`!chatbot-help\`  — Panduan ini\n\n` +
      `**Status:** ✅ Online | Model: Groq Llama 3.3 70B | Response: ~3-8s`
    );
  });

  // ── !chatbot-stats ───────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith("!chatbot-stats")) return;
    try {
      const selfBase = config.portal.backendSelfUrl
        || (config.env === "production" ? `http://backend:${config.port}` : `http://localhost:${config.port}`);
      const response = await axios.get(
        `${selfBase}/api/chatbot/stats`,
        { headers: { "X-API-Key": config.n8n.apiKey }, timeout: 5000 }
      );

      if (!response.data.success) throw new Error("Stats unavailable");

      const { statistics: stats, recentInteractions: recent } = response.data;
      const totalUsers        = conversationHistory.size;
      const totalHistoryTurns = Array.from(conversationHistory.values()).reduce((s, h) => s + h.length, 0);
      const totalInteractions = (stats || []).reduce((s, x) => s + parseInt(x.intent_count), 0);

      let statsText = `📊 **CHATBOT STATISTICS**\n\n`;
      if (stats?.length > 0) {
        statsText += `**Total Interactions:** ${totalInteractions}\n`;
        statsText += `**Active Conversations:** ${totalUsers} users (${totalHistoryTurns} turns)\n`;
        statsText += `**Avg Response Time:** ${Math.round(stats[0].avg_processing_time || 0)}ms\n\n`;
        statsText += `**By Category:**\n`;
        stats.forEach((s) => {
          const pct = ((s.intent_count / totalInteractions) * 100).toFixed(1);
          statsText += `- ${s.intent}: ${s.intent_count} (${pct}%)\n`;
        });
      } else {
        statsText += `No interactions yet.\n`;
      }
      statsText += `\n**Recent Activity:**\n`;
      (recent || []).slice(0, 5).forEach((r) => {
        const time = new Date(r.created_at).toLocaleTimeString("id-ID");
        statsText += `- ${time} | ${r.user_name} | ${r.intent}\n`;
      });
      statsText += `\n💬 **Conversational Mode:** ACTIVE ✅`;

      await message.reply(statsText);
    } catch (err) {
      console.error("[CHATBOT-STATS] Error:", err.message);
      await message.reply("❌ Failed to fetch statistics");
    }
  });

  console.log("✅ [CHATBOT] All chatbot handlers registered");
}

module.exports = { register };