/**
 * src/models/submission.model.js
 * Submission — Prisma Model Layer
 */

"use strict";

const prisma = require("../database/client");

async function create(data) {
  return prisma.submission.create({
    data: {
      form_id:    data.formId ?? data.form_id,
      payload:    data.payload,
      // FIX: sertakan created_at eksplisit — Prisma 5.x memerlukan
      // nilai DateTime NOT NULL meskipun ada @default(now()) di schema.
      created_at: data.createdAt ?? data.created_at ?? new Date(),
    },
  });
}

async function findAll(options = {}) {
  return prisma.submission.findMany(options);
}

module.exports = { create, findAll };