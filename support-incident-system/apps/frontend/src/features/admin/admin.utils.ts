/**
 * features/admin/admin.utils.ts
 * Shared display helpers for the admin panel.
 */

import type { SystemStatus } from "./admin.types";

export function getSystemStatusColor(
  status: string,
  variant: "badge" | "dot" = "badge"
): string {
  const map: Record<string, Record<string, string>> = {
    badge: {
      ONLINE:   "bg-green-100  text-green-800",
      RUNNING:  "bg-green-100  text-green-800",
      HEALTHY:  "bg-green-100  text-green-800",
      ACTIVE:   "bg-green-100  text-green-800",
      STARTING: "bg-yellow-100 text-yellow-800",
      DEGRADED: "bg-yellow-100 text-yellow-800",
      IDLE:     "bg-gray-100   text-gray-600",
      OFFLINE:  "bg-red-100    text-red-800",
    },
    dot: {
      ONLINE:   "bg-green-500",
      RUNNING:  "bg-green-500",
      HEALTHY:  "bg-green-500",
      ACTIVE:   "bg-green-500",
      STARTING: "bg-yellow-400",
      DEGRADED: "bg-yellow-400",
      IDLE:     "bg-gray-400",
      OFFLINE:  "bg-red-500",
    },
  };
  return (map[variant] ?? map.badge)[status] ?? map[variant].OFFLINE;
}

export function getActivityLevelColor(level: string): string {
  const map: Record<string, string> = {
    SUCCESS: "text-green-600",
    ERROR:   "text-red-600",
    WARN:    "text-yellow-600",
    INFO:    "text-blue-600",
  };
  return map[level] ?? "text-gray-500";
}

export function getActivityLevelBadge(level: string): string {
  const map: Record<string, string> = {
    SUCCESS: "bg-green-100  text-green-800",
    ERROR:   "bg-red-100    text-red-800",
    WARN:    "bg-yellow-100 text-yellow-800",
    INFO:    "bg-blue-100   text-blue-800",
  };
  return map[level] ?? "bg-gray-100 text-gray-600";
}

export function formatSystemStatus(system: SystemStatus) {
  return [
    { key: "discord",  label: "Discord Bot",     status: system.discord_bot,   detail: system.discord_detail },
    { key: "n8n",      label: "N8N Workflow",     status: system.n8n_workflow,  detail: system.n8n_detail },
    { key: "database", label: "Database",         status: system.database,      detail: system.db_detail },
    { key: "ai",       label: "AI Service",       status: system.ai_service,    detail: system.ai_detail },
  ];
}
