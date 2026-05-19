-- ================================================================
-- Migration: 0001_init_complete
-- Support & Incident Automation System — FINAL COMPLETE SCHEMA

-- CATATAN PENTING:
--   Semua tabel menggunakan CREATE TABLE IF NOT EXISTS dan
--   CREATE INDEX IF NOT EXISTS — AMAN dijalankan pada database
--   yang sudah ada tabelnya. Tidak akan error atau duplikat.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. tickets
--    Tabel utama sistem. Menyimpan tiket support (TICKETING) dan
--    insiden (INCIDENT) yang masuk melalui:
--    - Static Form Portal (Next.js frontend)
--    - Discord Bot (slash command / thread)
--    - Peppermint Portal (via form_id = 'peppermint_portal')
--
--    Kolom penting:
--    - type           : 'TICKETING' atau 'INCIDENT'
--    - form_id        : identifier sumber tiket
--    - form_fields    : JSONB semua field form (fleksibel)
--    - status_pengusulan: OPEN/INVESTIGASI/MITIGASI/RESOLVED/DONE/REJECT
--    - discord        : JSONB metadata Discord thread
--    - assignee       : JSONB array tim yang di-assign
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tickets" (
  "id"                      SERIAL          PRIMARY KEY,
  "type"                    VARCHAR(50)     NOT NULL,
  "form_id"                 VARCHAR(255)    NOT NULL,
  "form_fields"             JSONB           NOT NULL DEFAULT '{}',
  "status_pengusulan"       VARCHAR(50)     NOT NULL DEFAULT 'OPEN',
  "status_note"             TEXT,
  "assignee"                JSONB           DEFAULT '[]',
  "timeline_tindak_lanjut"  TEXT,
  "timeline_action_taken"   TEXT,
  "evidence_attachment"     JSONB           DEFAULT '[]',
  "discord"                 JSONB,
  "summary_ticket"          TEXT,
  "root_cause"              TEXT,
  "search_keywords"         VARCHAR(255)[]  DEFAULT '{}',
  "resolved_at"             TIMESTAMPTZ,
  "created_at"              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "tickets_type"                ON "tickets" ("type");
CREATE INDEX IF NOT EXISTS "tickets_status_pengusulan"   ON "tickets" ("status_pengusulan");
CREATE INDEX IF NOT EXISTS "tickets_form_id"             ON "tickets" ("form_id");
CREATE INDEX IF NOT EXISTS "tickets_created_at"          ON "tickets" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "tickets_search_keywords_gin" ON "tickets" USING GIN ("search_keywords");

-- ----------------------------------------------------------------
-- 2. submissions
--    Raw payload dari setiap pengiriman form sebelum diproses
--    menjadi tiket. Digunakan sebagai backup, audit trail,
--    dan kemampuan replay jika pemrosesan tiket gagal.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "submissions" (
  "id"         SERIAL       PRIMARY KEY,
  "form_id"    VARCHAR(255) NOT NULL,
  "payload"    JSONB        NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "submissions_form_id"    ON "submissions" ("form_id");
CREATE INDEX IF NOT EXISTS "submissions_created_at" ON "submissions" ("created_at" DESC);

-- ----------------------------------------------------------------
-- 3. activities
--    Audit log per tiket: mencatat setiap perubahan status,
--    assignment, penambahan komentar, dan aksi sistem.
--    Berelasi ke tickets dengan CASCADE DELETE agar activity
--    terhapus otomatis jika tiket dihapus.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "activities" (
  "id"          SERIAL       PRIMARY KEY,
  "ticket_id"   INTEGER      NOT NULL
                             REFERENCES "tickets" ("id") ON DELETE CASCADE,
  "type"        VARCHAR(50)  NOT NULL,
  "description" TEXT,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "activities_ticket_id"  ON "activities" ("ticket_id");
CREATE INDEX IF NOT EXISTS "activities_created_at" ON "activities" ("created_at" DESC);

-- ----------------------------------------------------------------
-- 4. knowledge_base
--    Runbook, SOP, dan artikel knowledge base.
--    Digunakan oleh AI chatbot untuk menjawab pertanyaan
--    dan diakses melalui endpoint /api/chatbot/context.
--
--    Kolom:
--    - keywords         : array untuk pencarian GIN
--    - related_ticket_ids: referensi tiket terkait (soft link)
--    - usage_count      : berapa kali artikel digunakan chatbot
--    - success_rate     : persentase feedback positif
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "knowledge_base" (
  "id"                  SERIAL          PRIMARY KEY,
  "category"            VARCHAR(100)    NOT NULL,
  "title"               VARCHAR(500)    NOT NULL,
  "content"             TEXT            NOT NULL,
  "keywords"            VARCHAR(255)[]  DEFAULT '{}',
  "related_ticket_ids"  INTEGER[]       DEFAULT '{}',
  "usage_count"         INTEGER         NOT NULL DEFAULT 0,
  "success_rate"        NUMERIC(5,2)    NOT NULL DEFAULT 0.00,
  "created_by"          VARCHAR(100)    NOT NULL DEFAULT 'system',
  "created_at"          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "kb_category"         ON "knowledge_base" ("category");
CREATE INDEX IF NOT EXISTS "kb_usage_count"      ON "knowledge_base" ("usage_count" DESC);
CREATE INDEX IF NOT EXISTS "kb_keywords_gin"     ON "knowledge_base" USING GIN ("keywords");

-- ----------------------------------------------------------------
-- 5. chatbot_interactions
--    Log setiap sesi tanya-jawab dengan AI chatbot.
--    Data ini digunakan untuk:
--    - View chatbot_analytics (statistik per intent per hari)
--    - Monitoring performa chatbot
--    - Penelusuran interaksi user tertentu
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chatbot_interactions" (
  "id"                  SERIAL        PRIMARY KEY,
  "ticket_id"           INTEGER,
  "user_id"             VARCHAR(50)   NOT NULL,
  "user_name"           VARCHAR(255)  NOT NULL,
  "question"            TEXT          NOT NULL,
  "answer"              TEXT          NOT NULL,
  "intent"              VARCHAR(50)   NOT NULL DEFAULT 'general',
  "context_used"        JSONB         DEFAULT '{}',
  "groq_model"          VARCHAR(100),
  "processing_time_ms"  INTEGER       DEFAULT 0,
  "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "chatbot_ticket_id"  ON "chatbot_interactions" ("ticket_id");
CREATE INDEX IF NOT EXISTS "chatbot_intent"     ON "chatbot_interactions" ("intent");
CREATE INDEX IF NOT EXISTS "chatbot_created_at" ON "chatbot_interactions" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "chatbot_user_id"    ON "chatbot_interactions" ("user_id");

-- ----------------------------------------------------------------
-- 6. incident_reports
--    Laporan insiden yang digenerate oleh sistem dalam format
--    HTML atau PDF. File disimpan di filesystem, path/URL
--    dicatat di sini. Diakses via /api/admin/report-view/[id].
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "incident_reports" (
  "id"             SERIAL        PRIMARY KEY,
  "ticket_id"      INTEGER,
  "report_type"    VARCHAR(50)   NOT NULL DEFAULT 'STANDARD',
  "report_title"   VARCHAR(500)  NOT NULL,
  "report_content" JSONB         NOT NULL,
  "file_path"      VARCHAR(500),
  "file_url"       VARCHAR(500),
  "generated_by"   VARCHAR(255)  NOT NULL DEFAULT 'system',
  "generated_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "report_format"  VARCHAR(20)   DEFAULT 'HTML',
  "download_count" INTEGER       DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "reports_ticket_id"    ON "incident_reports" ("ticket_id");
CREATE INDEX IF NOT EXISTS "reports_generated_at" ON "incident_reports" ("generated_at" DESC);

-- ----------------------------------------------------------------
-- 7. smart_thread_templates
--    Template untuk auto-format Discord thread berdasarkan
--    jenis tiket. Menyimpan aturan auto-assign dan template
--    field form. Digunakan oleh discord.service.js saat
--    membuat thread baru untuk tiket masuk.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "smart_thread_templates" (
  "id"                    SERIAL          PRIMARY KEY,
  "template_name"         VARCHAR(255)    NOT NULL,
  "ticket_type"           VARCHAR(50)     NOT NULL,
  "trigger_keywords"      VARCHAR(255)[]  DEFAULT '{}',
  "form_fields_template"  JSONB           NOT NULL DEFAULT '{}',
  "auto_assign_rules"     JSONB           DEFAULT '{}',
  "priority_level"        VARCHAR(50)     NOT NULL DEFAULT 'MEDIUM',
  "usage_count"           INTEGER         NOT NULL DEFAULT 0,
  "created_at"            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "template_ticket_type"  ON "smart_thread_templates" ("ticket_type");
CREATE INDEX IF NOT EXISTS "template_keywords_gin" ON "smart_thread_templates" USING GIN ("trigger_keywords");

-- ----------------------------------------------------------------
-- 8. audit_logs  (nama JAMAK — bukan 'audit_log' milik n8n)
--    Audit log level sistem: mencatat aksi admin, API call
--    sensitif, dan event penting lainnya.
--
--    PERHATIAN: Tabel ini BERBEDA dari:
--    - 'audit_log' (singular) = internal n8n, jangan disentuh
--    - 'activities' = log per tiket, ada di tabel #3
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"          SERIAL       PRIMARY KEY,
  "entity_type" VARCHAR(50)  NOT NULL,
  "entity_id"   INTEGER,
  "action"      VARCHAR(100) NOT NULL,
  "actor"       VARCHAR(255),
  "details"     JSONB        DEFAULT '{}',
  "ip_address"  INET,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_entity"     ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_actor"      ON "audit_logs" ("actor");
CREATE INDEX IF NOT EXISTS "audit_created_at" ON "audit_logs" ("created_at" DESC);

-- ================================================================
-- VIEWS — Dibuat oleh aplikasi (views.js), bukan tabel fisik.
-- Dimasukkan di migration agar konsisten saat fresh deploy.
-- ================================================================

-- View: ticket_dashboard
-- Ringkasan tiket untuk halaman admin dashboard.
-- Dibaca via prisma.$queryRaw di report.repository.js
CREATE OR REPLACE VIEW "ticket_dashboard" AS
  SELECT
    t.id,
    t.type,
    t.status_pengusulan,
    t.form_fields->>'Issue'                AS issue,
    t.form_fields->>'Incident Information' AS incident_title,
    t.form_fields->>'Reporter Information' AS reporter,
    t.form_fields->>'Division'             AS division,
    CASE WHEN t.summary_ticket IS NOT NULL AND t.summary_ticket <> ''
      THEN TRUE ELSE FALSE END             AS has_summary,
    CASE WHEN t.root_cause IS NOT NULL AND t.root_cause <> ''
      THEN TRUE ELSE FALSE END             AS has_root_cause,
    t.discord->>'threadUrl'                AS thread_url,
    t.created_at,
    t.updated_at,
    t.resolved_at,
    CASE WHEN t.resolved_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60
      ELSE NULL END                        AS resolution_minutes
  FROM "tickets" t
  ORDER BY t.created_at DESC;

-- View: chatbot_analytics
-- Statistik chatbot per intent per hari.
-- Dibaca dari admin panel untuk monitoring AI.
CREATE OR REPLACE VIEW "chatbot_analytics" AS
  SELECT
    intent,
    COUNT(*)                                                               AS total_interactions,
    AVG(processing_time_ms)                                                AS avg_processing_ms,
    COUNT(DISTINCT user_id)                                                AS unique_users,
    SUM(CASE WHEN context_used->>'hadTicket'    = 'true' THEN 1 ELSE 0 END) AS with_ticket_ctx,
    SUM(CASE WHEN context_used->>'hadKnowledge' = 'true' THEN 1 ELSE 0 END) AS with_kb_ctx,
    DATE_TRUNC('day', created_at)                                          AS interaction_date
  FROM "chatbot_interactions"
  GROUP BY intent, DATE_TRUNC('day', created_at)
  ORDER BY interaction_date DESC, total_interactions DESC;

-- ================================================================
-- _prisma_migrations — Internal Prisma
-- Tabel tracking migration Prisma. Dibuat di sini agar bisa
-- di-baseline manual tanpa menjalankan 'prisma migrate deploy'.
-- ================================================================
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                  TEXT        PRIMARY KEY,
  "checksum"            TEXT        NOT NULL,
  "finished_at"         TIMESTAMPTZ,
  "migration_name"      TEXT        NOT NULL,
  "logs"                TEXT,
  "rolled_back_at"      TIMESTAMPTZ,
  "started_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "applied_steps_count" INTEGER     NOT NULL DEFAULT 0
);