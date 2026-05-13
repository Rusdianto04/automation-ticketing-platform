"use strict";

const prisma            = require("../../../infrastructure/prisma/client");
const { toDomain }      = require("../mappers/ticket.mapper");
const { serialize }     = require("../../../common/helpers");

// ─── Helper: konversi BigInt ke Number dalam raw query result ─────────────────
function convertBigInt(row) {
  if (!row) return row;
  const result = {};
  for (const [key, val] of Object.entries(row)) {
    result[key] = typeof val === "bigint" ? Number(val) : val;
  }
  return result;
}

// ─── Read ─────────────────────────────────────────────────────────────────────
async function findById(id) {
  if (!id) return null;
  const row = await prisma.ticket.findUnique({ where: { id: Number(id) } });
  return toDomain(row);
}

async function findAll(options = {}) {
  const rows = await prisma.ticket.findMany(options);
  return rows.map(toDomain);
}

/**
 * @param {string} threadId
 * @returns {object|null} domain ticket atau null
 */
async function findByThreadId(threadId) {
  const rows = await prisma.$queryRaw`
    SELECT * FROM tickets
    WHERE discord->>'threadId' = ${threadId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = convertBigInt(rows[0]);
  return toDomain(row);
}

async function findSimilar(keywords, limit = 5) {
  if (!Array.isArray(keywords) || keywords.length === 0) return [];
  const rows = await prisma.$queryRaw`
    SELECT * FROM tickets
    WHERE search_keywords && ${keywords}::text[]
      AND status_pengusulan IN ('DONE', 'RESOLVED')
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => toDomain(convertBigInt(r)));
}

// ─── Write ────────────────────────────────────────────────────────────────────
async function create(data) {
  const now = new Date();
  const row = await prisma.ticket.create({
    data: {
      type:                     data.type,
      form_id:                  data.formId       ?? data.form_id,
      form_fields:              data.formFields    ?? data.form_fields   ?? {},
      status_pengusulan:        data.statusPengusulan ?? data.status_pengusulan ?? "OPEN",
      status_note:              data.statusNote    ?? data.status_note   ?? null,
      assignee:                 data.assignee      ?? [],
      timeline_tindak_lanjut:   data.timelineTindakLanjut ?? data.timeline_tindak_lanjut ?? null,
      timeline_action_taken:    data.timelineActionTaken  ?? data.timeline_action_taken  ?? null,
      evidence_attachment:      data.evidenceAttachment   ?? data.evidence_attachment    ?? [],
      discord:                  data.discord       ?? null,
      summary_ticket:           data.summaryTicket ?? data.summary_ticket ?? null,
      root_cause:               data.rootCause     ?? data.root_cause    ?? null,
      search_keywords:          data.searchKeywords ?? data.search_keywords ?? [],
      resolved_at:              data.resolvedAt    ?? data.resolved_at   ?? null,
      created_at:               data.createdAt     ?? data.created_at    ?? now,
      updated_at:               data.updatedAt     ?? data.updated_at    ?? now,
    },
  });
  return toDomain(row);
}

/**
 * @param {number}  id
 * @param {object}  data
 */
async function update(id, data) {
  const FIELD_MAP = {
    statusPengusulan:        "status_pengusulan",
    statusNote:              "status_note",
    timelineTindakLanjut:    "timeline_tindak_lanjut",
    timelineActionTaken:     "timeline_action_taken",
    evidenceAttachment:      "evidence_attachment",
    summaryTicket:           "summary_ticket",
    rootCause:               "root_cause",
    searchKeywords:          "search_keywords",
    resolvedAt:              "resolved_at",
    formFields:              "form_fields",
    status_pengusulan:       "status_pengusulan",
    status_note:             "status_note",
    timeline_tindak_lanjut:  "timeline_tindak_lanjut",
    timeline_action_taken:   "timeline_action_taken",
    evidence_attachment:     "evidence_attachment",
    summary_ticket:          "summary_ticket",
    root_cause:              "root_cause",
    search_keywords:         "search_keywords",
    resolved_at:             "resolved_at",
    form_fields:             "form_fields",
    assignee:                "assignee",
    discord:                 "discord",
    type:                    "type",
  };

  const updateData = {};
  for (const [key, dbKey] of Object.entries(FIELD_MAP)) {
    if (data[key] !== undefined) {
      updateData[dbKey] = data[key];
    }
  }

  if (Object.keys(updateData).length === 0) return findById(id);
  updateData.updated_at = new Date();

  const row = await prisma.ticket.update({
    where: { id: Number(id) },
    data:  updateData,
  });
  return toDomain(row);
}

/**
 * @param {object} ticket
 */
async function save(ticket) {
  return update(ticket.id, ticket);
}

/**
 * Full-text search across tickets using raw SQL (ILIKE on form_fields + summary).
 */
async function searchTickets({ search, status, type, limit, offset }) {
  const searchLike = `%${search.trim()}%`;
  return serialize(await prisma.$queryRaw`
    SELECT t.*
    FROM tickets t
    WHERE
      (${status || null}::text IS NULL OR t.status_pengusulan = ${status || null}::text)
      AND (${type   || null}::text IS NULL OR t.type = ${type || null}::text)
      AND (
           t.form_fields->>'Issue'                ILIKE ${searchLike}
        OR t.form_fields->>'Incident Information' ILIKE ${searchLike}
        OR COALESCE(t.summary_ticket, '')          ILIKE ${searchLike}
      )
    ORDER BY t.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
}

/**
 * Count tickets with optional status/type filters.
 */
async function countTickets({ status, type } = {}) {
  const cw = [];
  if (status) cw.push(`status_pengusulan = '${status.replace(/'/g, "''")}'`);
  if (type)   cw.push(`type = '${type.replace(/'/g, "''")}'`);
  const clause = cw.length ? " WHERE " + cw.join(" AND ") : "";
  const result = serialize(await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS cnt FROM tickets${clause}`));
  return Number(result[0]?.cnt ?? 0);
}


module.exports = {
  findById,
  findAll,
  findByThreadId,
  findSimilar,
  searchTickets,
  countTickets,
  create,
  update,
  save,
};
