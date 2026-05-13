"use strict";

/**
 * src/modules/report/dto/report.dto.js
 */

class GenerateReportDTO {
  constructor(body) {
    this.ticketId    = body.ticketId;
    this.reportType  = body.reportType  || "STANDARD";
    this.generatedBy = body.generatedBy || "API";
  }

  validate() {
    if (!this.ticketId) return "ticketId required";
    return null;
  }
}

class IncidentStatusDTO {
  constructor(body) {
    this.status = body.status?.toUpperCase();
    this.note   = body.note || "";
  }

  validate() {
    if (!this.status) return "status required";
    const valid = ["INVESTIGASI", "MITIGASI", "RESOLVED", "OPEN"];
    if (!valid.includes(this.status))
      return `status must be one of: ${valid.join(", ")}`;
    return null;
  }
}

// ─── Admin data DTOs (new endpoints consumed by frontend) ─────────────────────
class AdminStatsDTO {
  constructor(stats, system, timestamp) {
    this.stats     = stats;
    this.system    = system;
    this.timestamp = timestamp;
  }
}

class AdminActivitiesQueryDTO {
  constructor(query) {
    this.limit     = Math.min(parseInt(query.limit || "30"), 200);
    this.level     = query.level     || null;
    this.component = query.component || null;
    this.since     = query.since     || null;
  }
}

class ExportQueryDTO {
  constructor(query) {
    this.startDate = query.startDate || null;
    this.endDate   = query.endDate   || null;
    this.status    = query.status    || null;
  }
}

module.exports = {
  GenerateReportDTO,
  IncidentStatusDTO,
  AdminStatsDTO,
  AdminActivitiesQueryDTO,
  ExportQueryDTO,
};
