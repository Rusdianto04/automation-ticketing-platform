/**
 * features/report/index.ts
 * Public API for the report feature module.
 */

export * from "./report.types";

export {
  apiGetActiveIncidents,
  apiGetIncidentStats,
  apiGetIncidentById,
  apiUpdateIncidentStatus,
  apiGetReportView,
} from "@/lib/api";
