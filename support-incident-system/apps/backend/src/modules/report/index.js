"use strict";
/**
 * src/modules/report/index.js
 * Public API of the report module.
 */
module.exports = {
  reportRouter:       require("./routes/report.route"),
  incidentRouter:     require("./routes/incident.route"),
  adminRouter:        require("./routes/admin.route"),
  ReportService:      require("./services/report.service"),
  IncidentService:    require("./services/incident.service"),
  ReportRepository:   require("./repositories/report.repository"),
  ReportController:   require("./controllers/report.controller"),
  IncidentController: require("./controllers/incident.controller"),
};
