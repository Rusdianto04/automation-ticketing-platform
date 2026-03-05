/**
 * src/database/views.js
 * PostgreSQL Views Setup
 *
 * Membuat ulang view ticket_dashboard dan chatbot_analytics.
 * Dipanggil sekali saat startup — menggantikan logika Sequelize sync.
 *
 * View ini dibaca langsung oleh n8n dan peppermint — SQL TIDAK BERUBAH.
 */

"use strict";

const prisma = require("./client");

/**
 * Drop dan recreate semua views.
 * Aman dipanggil berulang kali — idempotent.
 */
async function setupViews() {
  // Step 1 — Drop existing views (agar recreate bersih)
  try {
    await prisma.$executeRawUnsafe("DROP VIEW IF EXISTS ticket_dashboard CASCADE");
    await prisma.$executeRawUnsafe("DROP VIEW IF EXISTS chatbot_analytics CASCADE");
    console.log("✅ [DB] Views dropped");
  } catch (err) {
    console.warn("⚠ [DB] View drop skipped:", err.message);
  }

  // Step 2 — Recreate chatbot_analytics view
  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW chatbot_analytics AS
      SELECT
        intent,
        COUNT(*)                                                          AS total_interactions,
        AVG(processing_time_ms)                                           AS avg_processing_ms,
        COUNT(DISTINCT user_id)                                           AS unique_users,
        SUM(CASE WHEN context_used->>'hadTicket'    = 'true' THEN 1 ELSE 0 END) AS with_ticket_ctx,
        SUM(CASE WHEN context_used->>'hadKnowledge' = 'true' THEN 1 ELSE 0 END) AS with_kb_ctx,
        DATE_TRUNC('day', created_at)                                     AS interaction_date
      FROM chatbot_interactions
      GROUP BY intent, DATE_TRUNC('day', created_at)
      ORDER BY interaction_date DESC, total_interactions DESC
    `);
    console.log("✅ [DB] View 'chatbot_analytics' created");
  } catch (err) {
    console.warn("⚠ [DB] chatbot_analytics view skipped (non-fatal):", err.message);
  }

  // Step 3 — Recreate ticket_dashboard view
  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE VIEW ticket_dashboard AS
      SELECT
        t.id,
        t.type,
        t.status_pengusulan,
        t.form_fields->>'Issue'                AS issue,
        t.form_fields->>'Incident Information' AS incident_title,
        t.form_fields->>'Reporter Information' AS reporter,
        t.form_fields->>'Division'             AS division,
        CASE WHEN t.summary_ticket IS NOT NULL AND t.summary_ticket <> ''
          THEN true ELSE false END             AS has_summary,
        CASE WHEN t.root_cause IS NOT NULL AND t.root_cause <> ''
          THEN true ELSE false END             AS has_root_cause,
        t.discord->>'threadUrl'                AS thread_url,
        t.created_at,
        t.updated_at,
        t.resolved_at,
        CASE WHEN t.resolved_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60
          ELSE NULL END                        AS resolution_minutes
      FROM tickets t
      ORDER BY t.created_at DESC
    `);
    console.log("✅ [DB] View 'ticket_dashboard' created");
  } catch (err) {
    console.warn("⚠ [DB] ticket_dashboard view skipped (non-fatal):", err.message);
  }
}

module.exports = { setupViews };
