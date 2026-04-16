"use client";

import type { TicketStatus, TicketType } from "@/types";

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: TicketStatus | string }) {
  const map: Record<string, { cls: string; label: string }> = {
    OPEN: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Open" },
    PENDING: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Pending" },
    IN_PROGRESS: { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "In Progress" },
    APPROVED: { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "In Progress" }, // raw DB fallback
    DONE: { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Done" },
    REJECT: { cls: "bg-red-50 text-red-700 border-red-200", label: "Reject" },
    REJECTED: { cls: "bg-red-50 text-red-700 border-red-200", label: "Reject" },     // raw DB fallback
    INVESTIGASI: { cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Investigasi" },
    MITIGASI: { cls: "bg-purple-50 text-purple-700 border-purple-200", label: "Mitigasi" },
    RESOLVED: { cls: "bg-teal-50 text-teal-700 border-teal-200", label: "Resolved" },
  };
  const s = map[status] || { cls: "bg-slate-100 text-slate-600 border-slate-200", label: status };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Type Badge ────────────────────────────────────────────────────────────────
export function TypeBadge({ type }: { type: TicketType | string }) {
  if (type === "INCIDENT") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        🚨 Incident
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
      🎫 Ticketing Support
    </span>
  );
}

// ── Card Section ──────────────────────────────────────────────────────────────
export function CardSection({
  title, icon, accent, children,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: "indigo" | "rose";
  children: React.ReactNode;
}) {
  const headerColor = "text-white ";


  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className={`px-4 py-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider ${headerColor}`} style={{ background: "#1e293b" }}>
        {icon}
        {title}
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}

// ── Assignee List ─────────────────────────────────────────────────────────────
// Menampilkan nama petugas apa adanya dari data Discord tag / input manual admin.
// Tidak ada mapping statis — petugas bersifat tentatif.
interface AssigneeRaw {
  username?: string;
  displayName?: string;
  name?: string;
  id?: string;
}

export function AssigneeList({
  assignees,
}: {
  assignees: (string | AssigneeRaw)[];
}) {
  if (!assignees || assignees.length === 0) {
    return (
      <div className="px-4 py-4 text-[13px] text-slate-400 italic">
        Belum ada petugas yang ditugaskan.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {assignees.map((a, i) => {
        // Ambil nama dari string langsung atau dari object Discord/manual
        const displayName =
          typeof a === "string"
            ? a
            : a.displayName || a.username || a.name || `Petugas ${i + 1}`;

        const initials = displayName
          .split(" ")
          .slice(0, 2)
          .map((n: string) => n[0] || "")
          .join("")
          .toUpperCase() || "?";

        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400">IT Staff</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline Section ──────────────────────────────────────────────────────────
interface TimelineItem {
  timestamp?: string;
  date?: string;
  action?: string;
  status?: string;
  note?: string;
  actionBy?: string;
  by?: string;
}

function parseTimeline(
  raw: string | TimelineItem[] | null | undefined
): TimelineItem[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return (raw as TimelineItem[]).filter(
      (item) => item && (item.action || item.status || item.note)
    );
  }

  if (typeof raw !== "string") return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return (parsed as TimelineItem[]).filter(
          (item) => item && (item.action || item.status || item.note)
        );
      }
    } catch {
      // bukan JSON valid → lanjut ke text parser
    }
  }

  // Parse plain text per baris
  // Format utama backend: "1. (12:10, 16/03/2026) Replaced patchcord on port 23"
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: TimelineItem[] = [];

  for (const line of lines) {
    if (!line) continue;

    // Format: "N. (timestamp) action"
    const mainMatch = line.match(/^\d+\.\s*\(([^)]+)\)\s*(.+)$/);
    if (mainMatch) {
      items.push({ timestamp: mainMatch[1].trim(), action: mainMatch[2].trim() });
      continue;
    }

    // Format: "(timestamp) action" tanpa nomor
    const noNumMatch = line.match(/^\(([^)]+)\)\s*(.+)$/);
    if (noNumMatch) {
      items.push({ timestamp: noNumMatch[1].trim(), action: noNumMatch[2].trim() });
      continue;
    }

    // Format: "N. action" tanpa timestamp
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      items.push({ action: numberedMatch[1].trim() });
      continue;
    }

    // Fallback: baris teks bebas
    if (line.length > 2) {
      items.push({ action: line });
    }
  }

  return items;
}

export function TimelineSection({
  items,
}: {
  items: string | TimelineItem[] | null | undefined;
}) {
  const parsed = parseTimeline(items);

  if (!parsed || parsed.length === 0) {
    return (
      <div className="px-4 py-4 text-[13px] text-slate-400 italic">
        Belum ada progress atau tindak lanjut yang dicatat.
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <ol className="relative border-l-2 border-slate-200 space-y-5 ml-2">
        {parsed.map((item, i) => {
          const tsRaw = item.timestamp || item.date || "";
          return (
            <li key={i} className="ml-5 relative">
              <span className="absolute -left-[22px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white ring-2 ring-indigo-200" />
              {tsRaw && (
                <p className="text-[11px] text-slate-400 mb-0.5">{tsRaw}</p>
              )}
              <p className="text-[13px] font-semibold text-slate-700">
                {item.action || item.status || `Step ${i + 1}`}
              </p>
              {item.note && (
                <p className="text-[12px] text-slate-500 mt-0.5">{item.note}</p>
              )}
              {(item.actionBy || item.by) && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  👤 {item.actionBy || item.by}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}