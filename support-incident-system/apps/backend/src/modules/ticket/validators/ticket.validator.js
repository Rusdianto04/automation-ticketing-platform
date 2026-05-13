"use strict";

/**
 * src/modules/ticket/validators/ticket.validator.js
 * Express middleware validators for ticket endpoints.
 */

const { TICKET_TYPE } = require("../../../common/constants");

function validateId(req, res, next) {
  const id = Number(req.params.id);
  if (isNaN(id) || id < 1) {
    return res.status(400).json({ error: "id tidak valid" });
  }
  req.ticketId = id;
  next();
}

function validateCreateBody(req, res, next) {
  let type = req.body.type;
  if (type === "SUPPORT") type = req.body.type = "TICKETING";
  if (!type) return res.status(400).json({ error: "type wajib diisi" });
  if (!Object.values(TICKET_TYPE).includes(type))
    return res.status(400).json({ error: `type tidak valid. Gunakan: ${Object.values(TICKET_TYPE).join(", ")}` });
  if (!req.body.formFields || Object.keys(req.body.formFields).length === 0)
    return res.status(400).json({ error: "formFields wajib diisi" });
  next();
}

function validateStatusBody(req, res, next) {
  if (!req.body.status) return res.status(400).json({ error: "status wajib diisi" });
  next();
}

function validateAssignBody(req, res, next) {
  if (!Array.isArray(req.body.assignees))
    return res.status(400).json({ error: "assignees harus berupa array" });
  next();
}

function validateCommentBody(req, res, next) {
  if (!req.body.comment?.trim())
    return res.status(400).json({ error: "comment wajib diisi" });
  next();
}

function validateAutoCreateBody(req, res, next) {
  let type = req.body.type;
  if (type === "SUPPORT") type = req.body.type = "TICKETING";
  if (!type)             return res.status(400).json({ error: "type wajib diisi" });
  if (!req.body.title)   return res.status(400).json({ error: "title wajib diisi" });
  if (!Object.values(TICKET_TYPE).includes(type))
    return res.status(400).json({ error: `type tidak valid. Gunakan: ${Object.values(TICKET_TYPE).join(", ")}` });
  next();
}

module.exports = {
  validateId,
  validateCreateBody,
  validateStatusBody,
  validateAssignBody,
  validateCommentBody,
  validateAutoCreateBody,
};
