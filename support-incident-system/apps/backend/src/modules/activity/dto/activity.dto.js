"use strict";

/**
 * src/modules/activity/dto/activity.dto.js
 */

class CreateActivityDTO {
  constructor(data) {
    this.ticketId   = data.ticketId   ?? data.ticket_id;
    this.type       = data.type;
    this.description = data.description ?? null;
    this.createdAt  = data.createdAt ?? data.created_at ?? new Date();
  }

  validate() {
    if (!this.ticketId) return "ticketId required";
    if (!this.type)     return "type required";
    return null;
  }
}

function activityResponseDTO(row) {
  return {
    id:          row.id,
    ticketId:    row.ticket_id,
    type:        row.type,
    description: row.description,
    createdAt:   row.created_at,
  };
}

module.exports = { CreateActivityDTO, activityResponseDTO };
