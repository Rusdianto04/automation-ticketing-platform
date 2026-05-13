/**
 * features/admin/index.ts
 * Public API for the admin feature module.
 *
 * Usage:
 *   import { apiGetAdminStats, formatSystemStatus } from "@/features/admin"
 */

// Types
export * from "./admin.types";

// Display utilities
export { getSystemStatusColor, getActivityLevelColor, getActivityLevelBadge, formatSystemStatus } from "./admin.utils";

// Data access (all via backend API)
export {
  apiGetAdminStats,
  apiGetActivities,
  apiGetRecentTickets,
  apiExportTickets,
  apiGetReportView,
} from "@/lib/api";
