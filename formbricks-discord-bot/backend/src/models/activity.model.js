/**
 * src/models/activity.model.js
 * Activity — Prisma Model Layer
 */

"use strict";

const prisma = require("../database/client");

async function create(data) {
  return prisma.activity.create({
    data: {
      ticket_id:   data.ticketId ?? data.ticket_id,
      type:        data.type,
      description: data.description ?? null,
      // FIX: sertakan created_at eksplisit — Prisma 5.x memerlukan
      // nilai DateTime NOT NULL meskipun ada @default(now()) di schema.
      created_at:  data.createdAt ?? data.created_at ?? new Date(),
    },
  });
}

async function findByTicketId(ticketId, limit = 100) {
  return prisma.activity.findMany({
    where:   { ticket_id: Number(ticketId) },
    orderBy: { created_at: "desc" },
    take:    limit,
  });
}

module.exports = { create, findByTicketId };