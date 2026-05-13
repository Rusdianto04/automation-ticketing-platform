"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw,
  Filter,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "SUCCESS" | "ERROR" | "WARN";
  component: string;
  message: string;
  ticket_id?: number | null;
}

interface LogStats {
  total: number;
  success: number;
  errors: number;
  warns: number;
}

const LEVEL_CONFIG = {
  INFO: {
    cls: "text-blue-600 bg-blue-50 border-blue-200",
    icon: <Info size={12} />,
  },
  SUCCESS: {
    cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
    icon: <CheckCircle2 size={12} />,
  },
  ERROR: {
    cls: "text-red-700 bg-red-50 border-red-200",
    icon: <AlertCircle size={12} />,
  },
  WARN: {
    cls: "text-amber-700 bg-amber-50 border-amber-200",
    icon: <AlertTriangle size={12} />,
  },
};

const COMPONENT_COLORS: Record<string, string> = {
  DISCORD_BOT: "bg-indigo-50 text-indigo-700",
  N8N_WORKFLOW: "bg-purple-50 text-purple-700",
  AI_SERVICE: "bg-cyan-50 text-cyan-700",
  DATABASE: "bg-green-50 text-green-700",
  EMAIL: "bg-orange-50 text-orange-700",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  } catch {
    return iso;
  }
}

export default function AutomationLogClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dbStats, setDbStats] = useState<LogStats>({
    total: 0,
    success: 0,
    errors: 0,
    warns: 0,
  });

  const [filterLevel, setFilterLevel] = useState("");
  const [filterComp, setFilterComp] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const latestTimestampRef = useRef<string>("");

  const fetchLogs = useCallback(
    async (opts: { append?: boolean } = {}) => {
      try {
        setErrorMsg("");

        const params = new URLSearchParams({ limit: "30" });

        if (filterLevel) params.set("level", filterLevel);
        if (filterComp) params.set("component", filterComp);

        if (opts.append && latestTimestampRef.current) {
          params.set("since", latestTimestampRef.current);
        }

        const res = await fetch(`/api/admin/activities?${params}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`API error ${res.status}`);

        const data = await res.json();

        if (data.error) throw new Error(data.error);

        const newLogs: LogEntry[] = data.logs || [];
        const newStats: LogStats = data.stats || {
          total: 0,
          success: 0,
          errors: 0,
          warns: 0,
        };

        setDbStats(newStats);

        if (opts.append && newLogs.length > 0) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const unique = newLogs.filter((l) => !existingIds.has(l.id));
            return [...unique, ...prev].slice(0, 200);
          });
        } else {
          setLogs(newLogs);
        }

        if (newLogs.length > 0) {
          latestTimestampRef.current = newLogs[0].timestamp;
        }

        setLastFetch(
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Asia/Jakarta",
          })
        );
      } catch (err: any) {
        setErrorMsg(err.message || "Gagal mengambil log dari database");
      } finally {
        setIsLoading(false);
      }
    },
    [filterLevel, filterComp]
  );

  useEffect(() => {
    setIsLoading(true);
    latestTimestampRef.current = "";
    fetchLogs();
  }, [filterLevel, filterComp, fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs({ append: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const displayStats = {
    total: dbStats.total,
    success: dbStats.success,
    errors: dbStats.errors,
    warns: dbStats.warns,
  };

  const handleReset = () => {
    setFilterLevel("");
    setFilterComp("");
    latestTimestampRef.current = "";
    fetchLogs();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-bold text-slate-800">
              Automation Activity Log
            </h1>

            <p className="text-[12px] text-slate-400 mt-0.5">
              Real-time log aktivitas sistem
              {lastFetch && (
                <span className="ml-2 text-slate-300">
                  — Update: {lastFetch}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
              <div
                onClick={() => setAutoRefresh((v) => !v)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  autoRefresh ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    autoRefresh ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              Auto-refresh
            </label>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[12px] font-semibold transition-colors"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 py-5">

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-[13px] text-red-700 flex items-center gap-2">
            <AlertCircle size={14} />
            {errorMsg}
          </div>
        )}

        {/* Log Entries */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden font-mono">
          <div className="max-h-[560px] overflow-y-auto p-4 space-y-1">
            {logs.map((log) => {
              const lvlCfg =
                LEVEL_CONFIG[log.level] || LEVEL_CONFIG.INFO;

              const compColor =
                COMPONENT_COLORS[log.component] ||
                "bg-slate-700 text-slate-200";

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 py-1.5 px-3 rounded-lg text-[12px]"
                >
                  <span className="text-slate-600 whitespace-nowrap shrink-0 text-[11px] mt-0.5">
                    {fmtTime(log.timestamp)}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${lvlCfg.cls}`}
                  >
                    {lvlCfg.icon}
                    {log.level}
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${compColor}`}
                  >
                    {log.component}
                  </span>

                  <span className="text-slate-300 flex-1">
                    {log.message}

                    {log.ticket_id && (
                      <a
                        href={"/admin/tickets/" + log.ticket_id}
                        className="ml-1.5 text-indigo-400 hover:text-indigo-300 underline text-[11px]"
                      >
                        #{log.ticket_id}
                      </a>
                    )}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </div>
  );
}