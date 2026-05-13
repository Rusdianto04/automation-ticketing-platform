"use strict";

/**
 * src/modules/activity/services/activity.service.js
 * Business logic for activity log management.
 */

const ActivityRepo = require("../repositories/activity.repository");
const { createLogger } = require("../../../common/logger");

const logger = createLogger("ACTIVITY_SVC");

async function logActivity({ ticketId, type, description }) {
  try {
    return await ActivityRepo.create({ ticketId, type, description });
  } catch (err) {
    logger.error(`logActivity error: ${err.message}`);
    throw err;
  }
}

async function getByTicketId(ticketId, limit = 50) {
  return ActivityRepo.findByTicketId(ticketId, limit);
}

module.exports = { logActivity, getByTicketId };
