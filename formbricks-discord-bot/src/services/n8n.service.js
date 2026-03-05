/**
 * src/services/n8n.service.js
 * N8N Integration Service
 *
 * Trigger N8N workflows via HTTP webhook.
 * Event-driven — bot hanya kirim event, N8N yang proses.
 * Error tidak blocking — dicatat dan diabaikan.
 */

"use strict";

const axios  = require("axios");
const config = require("../config");

/**
 * Trigger N8N workflow dengan event payload.
 *
 * @param {object} eventData — payload dikirim ke N8N
 * @returns {object|null}    — N8N response atau null jika gagal
 */
async function triggerWorkflow(eventData) {
  try {
    console.log(
      `🔔 [N8N] Triggering Ticket #${eventData.ticketId} (mode: ${eventData.mode || eventData.eventType || "N/A"})`
    );

    const response = await axios.post(config.n8n.webhookUrl, eventData, {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":     config.n8n.apiKey,
      },
      timeout: 5000,
    });

    console.log(`✅ [N8N] Triggered — Thread: ${eventData.threadId}`);
    return response.data;
  } catch (err) {
    // Non-blocking — N8N tidak boleh crash aplikasi utama
    console.error(`❌ [N8N] Trigger failed:`, err.message);
    return null;
  }
}

module.exports = { triggerWorkflow };
