-- ================================================================
-- Migration: 0001_init
-- Formbricks Discord Bot — Initial Schema (Baseline)
--
-- CATATAN PENTING:
--   Migration ini menggunakan CREATE TABLE IF NOT EXISTS
--   sehingga AMAN dijalankan pada database yang sudah ada.
--   Jika tabel sudah ada, perintah akan di-skip otomatis.
--
-- Untuk database EXISTING (fix P3005):
--   docker-entrypoint.sh akan otomatis melakukan baseline
--   dengan menandai migration ini sebagai "applied" tanpa
--   menjalankan ulang SQL ini.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. tickets
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
CREATE INDEX IF NOT EXISTS "tickets_created_at"          ON "tickets" ("created_at");
CREATE INDEX IF NOT EXISTS "tickets_search_keywords"     ON "tickets" USING GIN ("search_keywords");

-- ----------------------------------------------------------------
-- 2. submissions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "submissions" (
  "id"         SERIAL       PRIMARY KEY,
  "form_id"    VARCHAR(255) NOT NULL,
  "payload"    JSONB        NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "submissions_form_id"    ON "submissions" ("form_id");
CREATE INDEX IF NOT EXISTS "submissions_created_at" ON "submissions" ("created_at");

-- ----------------------------------------------------------------
-- 3. activities
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "activities" (
  "id"          SERIAL       PRIMARY KEY,
  "ticket_id"   INTEGER      NOT NULL REFERENCES "tickets" ("id") ON DELETE CASCADE,
  "type"        VARCHAR(50)  NOT NULL,
  "description" TEXT,
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "activities_ticket_id"  ON "activities" ("ticket_id");
CREATE INDEX IF NOT EXISTS "activities_created_at" ON "activities" ("created_at");

-- ----------------------------------------------------------------
-- 4. knowledge_base
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "knowledge_base" (
  "id"                  SERIAL           PRIMARY KEY,
  "category"            VARCHAR(100)     NOT NULL,
  "title"               VARCHAR(255)     NOT NULL,
  "content"             TEXT             NOT NULL,
  "keywords"            VARCHAR(255)[]   DEFAULT '{}',
  "related_ticket_ids"  INTEGER[]        DEFAULT '{}',
  "usage_count"         INTEGER          DEFAULT 0,
  "success_rate"        NUMERIC(5,2)     DEFAULT 0.00,
  "created_by"          VARCHAR(255),
  "created_at"          TIMESTAMPTZ      DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ      DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_kb_category" ON "knowledge_base" ("category");
CREATE INDEX IF NOT EXISTS "idx_kb_usage"    ON "knowledge_base" ("usage_count" DESC);
CREATE INDEX IF NOT EXISTS "idx_kb_keywords" ON "knowledge_base" USING GIN ("keywords");

-- ----------------------------------------------------------------
-- 5. chatbot_interactions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chatbot_interactions" (
  "id"                 SERIAL        PRIMARY KEY,
  "ticket_id"          INTEGER,
  "user_id"            VARCHAR(255)  NOT NULL,
  "user_name"          VARCHAR(255)  NOT NULL,
  "question"           TEXT          NOT NULL,
  "answer"             TEXT          NOT NULL,
  "intent"             VARCHAR(100),
  "context_used"       JSONB         DEFAULT '{}',
  "groq_model"         VARCHAR(100)  DEFAULT 'llama-3.3-70b-versatile',
  "processing_time_ms" INTEGER,
  "created_at"         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_chatbot_ticket_id"  ON "chatbot_interactions" ("ticket_id");
CREATE INDEX IF NOT EXISTS "idx_chatbot_intent"     ON "chatbot_interactions" ("intent");
CREATE INDEX IF NOT EXISTS "idx_chatbot_created_at" ON "chatbot_interactions" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chatbot_user_id"    ON "chatbot_interactions" ("user_id");

-- ----------------------------------------------------------------
-- 6. incident_reports
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "incident_reports" (
  "id"             SERIAL        PRIMARY KEY,
  "ticket_id"      INTEGER,
  "report_type"    VARCHAR(50)   DEFAULT 'STANDARD',
  "report_title"   VARCHAR(255)  NOT NULL,
  "report_content" JSONB         NOT NULL,
  "file_path"      VARCHAR(500),
  "file_url"       VARCHAR(500),
  "generated_by"   VARCHAR(255)  NOT NULL,
  "generated_at"   TIMESTAMPTZ   DEFAULT NOW(),
  "report_format"  VARCHAR(20)   DEFAULT 'HTML',
  "download_count" INTEGER       DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_reports_ticket_id"   ON "incident_reports" ("ticket_id");
CREATE INDEX IF NOT EXISTS "idx_reports_generated_at" ON "incident_reports" ("generated_at" DESC);

-- ----------------------------------------------------------------
-- 7. smart_thread_templates
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "smart_thread_templates" (
  "id"                   SERIAL          PRIMARY KEY,
  "template_name"        VARCHAR(255)    NOT NULL,
  "ticket_type"          VARCHAR(50)     NOT NULL,
  "trigger_keywords"     VARCHAR(255)[]  DEFAULT '{}',
  "form_fields_template" JSONB           NOT NULL,
  "auto_assign_rules"    JSONB           DEFAULT '{}',
  "priority_level"       VARCHAR(50)     DEFAULT 'MEDIUM',
  "usage_count"          INTEGER         DEFAULT 0,
  "created_at"           TIMESTAMPTZ     DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_template_type"     ON "smart_thread_templates" ("ticket_type");
CREATE INDEX IF NOT EXISTS "idx_template_keywords" ON "smart_thread_templates" USING GIN ("trigger_keywords");

-- ----------------------------------------------------------------
-- 8. audit_logs
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"          SERIAL          PRIMARY KEY,
  "entity_type" VARCHAR(50)     NOT NULL,
  "entity_id"   INTEGER,
  "action"      VARCHAR(100)    NOT NULL,
  "actor"       VARCHAR(255),
  "details"     JSONB           DEFAULT '{}',
  "ip_address"  INET,
  "created_at"  TIMESTAMPTZ     DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_audit_entity"     ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_actor"      ON "audit_logs" ("actor");
CREATE INDEX IF NOT EXISTS "idx_audit_created_at" ON "audit_logs" ("created_at" DESC);

-- ----------------------------------------------------------------
-- 9. Prisma internal migration tracking
-- ----------------------------------------------------------------
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
