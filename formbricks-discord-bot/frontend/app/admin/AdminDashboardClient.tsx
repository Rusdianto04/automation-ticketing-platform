"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Ticket, CheckCircle2, Clock, XCircle, AlertCircle,
  Activity, Database, Bot, Cpu, RefreshCw,
  TrendingUp, TrendingDown, ArrowRight, Zap,
} from "lucide-react";

interface Stats {
  total: number;
  todayTotal: number;
  openCount: number;
  pendingCount: number;
  doneCount: number;
  incidentCount: number;
  rejectCount: number;
}

interface RecentTicket {
  id: number;
  type: string;
  title: string;
  status: string;
  created_at: string;
}

interface AutomationData {
  successRate: number;
  failed: number;
  avgResolutionHours: number;
  totalToday: number;
}

// FIX: Tambah field detail dinamis dari API
interface SystemData {
  discord_bot:    string;
  discord_detail: string;
  n8n_workflow:   string;
  n8n_detail:     string;
  database:       string;
  db_detail:      string;
  ai_service:     string;
  ai_detail:      string;
  db_response_ms: number;
}

interface Props {
  stats: Stats;
  recentTickets: RecentTicket[];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  DONE:    "bg-slate-100 text-slate-600 border-slate-200",
  REJECT:  "bg-red-50 text-red-700 border-red-200",
};

function formatDatetime(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      timeZone: "Asia/Jakarta",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
    const hour24 = parseInt(
      d.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }),
      10
    );
    const period = hour24 < 12 ? "AM" : "PM";
    return `${dateStr}, ${timeStr} ${period}`;
  } catch {
    return iso;
  }
}

export default function AdminDashboardClient({ stats: initialStats, recentTickets: initialTickets }: Props) {
  const [currentTime, setCurrentTime] = useState("");

  const [stats, setStats]                 = useState<Stats>(initialStats);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>(initialTickets);
  const [automation, setAutomation]       = useState<AutomationData>({
    successRate: 0, failed: 0, avgResolutionHours: 0, totalToday: 0,
  });
  const [systemStatus, setSystemStatus]   = useState<SystemData>({
    discord_bot:    "CHECKING",
    discord_detail: "Memeriksa koneksi ke backend...",
    n8n_workflow:   "CHECKING",
    n8n_detail:     "Memeriksa koneksi ke N8N...",
    database:       "CHECKING",
    db_detail:      "Memeriksa koneksi database...",
    ai_service:     "CHECKING",
    ai_detail:      "Memeriksa aktivitas AI...",
    db_response_ms: 0,
  });
  const [lastRefresh, setLastRefresh]     = useState("");
  const [isRefreshing, setIsRefreshing]   = useState(false);

  // Jam realtime — update tiap detik
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString("id-ID", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Jakarta",
      }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch realtime stats dari API
  const fetchStats = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();

      if (data.stats)      setStats(data.stats);
      if (data.automation) setAutomation(data.automation);
      if (data.system)     setSystemStatus(data.system);

      setLastRefresh(new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Jakarta",
      }));
    } catch {
      // Gagal fetch — tetap tampilkan data lama
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch recent tickets realtime
  const fetchRecentTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/recent-tickets", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.tickets) setRecentTickets(data.tickets);
    } catch { /* non-fatal */ }
  }, []);

  // Auto-refresh tiap 30 detik
  useEffect(() => {
    fetchStats();
    fetchRecentTickets();
    const interval = setInterval(() => {
      fetchStats();
      fetchRecentTickets();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchRecentTickets]);

  const handleRefresh = () => {
    fetchStats();
    fetchRecentTickets();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Admin Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-[16px] font-bold text-slate-800">Dashboard Monitoring</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{currentTime}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[11px] text-slate-400">
              Update: {lastRefresh}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6">

        {/* ── Kondisi Ticket Hari Ini ── */}
        <div>
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Kondisi Ticket Hari Ini
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatCard
              label="Ticket Hari Ini"
              value={stats.todayTotal}
              icon={<Ticket size={20} />}
              color="indigo"
              sub={`Total: ${stats.total} tiket`}
            />
            <AdminStatCard
              label="Open Tickets"
              value={stats.openCount}
              icon={<Activity size={20} />}
              color="emerald"
              sub={`${stats.pendingCount} pending`}
            />
            <AdminStatCard
              label="Resolved"
              value={stats.doneCount}
              icon={<CheckCircle2 size={20} />}
              color="slate"
              sub="Done & Resolved"
            />
            <AdminStatCard
              label="Incident Aktif"
              value={stats.incidentCount}
              icon={<AlertCircle size={20} />}
              color="rose"
              sub={`${stats.rejectCount} rejected`}
            />
          </div>
        </div>

        {/* ── Automation Performance ── */}
        <div>
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Automation Performance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Zap size={22} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-slate-500 font-semibold">Automation Success Rate</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-2xl font-extrabold text-slate-800">
                    {automation.totalToday > 0 ? `${automation.successRate}%` : "—"}
                  </p>
                  {automation.successRate >= 80 && automation.totalToday > 0 && (
                    <TrendingUp size={16} className="text-emerald-500" />
                  )}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${automation.successRate || 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {automation.totalToday} aktivitas hari ini
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <XCircle size={22} className="text-red-500" />
              </div>
              <div>
                <p className="text-[12px] text-slate-500 font-semibold">Automation Failed</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-2xl font-extrabold text-slate-800">{automation.failed}</p>
                  {automation.failed > 0 && <TrendingDown size={16} className="text-red-500" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {automation.failed > 0 ? "Perlu penanganan manual" : "Tidak ada kegagalan hari ini"}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock size={22} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[12px] text-slate-500 font-semibold">Avg Resolution Time</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-2xl font-extrabold text-slate-800">
                    {automation.avgResolutionHours > 0 ? `${automation.avgResolutionHours}h` : "—"}
                  </p>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {automation.avgResolutionHours > 0 ? "Rata-rata per ticket" : "Belum ada ticket selesai"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Status Sistem — LIVE HTTP ping ── */}
        <div>
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Status Sistem
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            <SystemStatusRow
              label="Discord Bot"
              icon={<Bot size={16} className="text-indigo-500" />}
              status={systemStatus.discord_bot}
              detail={systemStatus.discord_detail || "Memeriksa status..."}
            />
            <SystemStatusRow
              label="N8N Workflow"
              icon={<Activity size={16} className="text-purple-500" />}
              status={systemStatus.n8n_workflow}
              detail={systemStatus.n8n_detail || "Memeriksa status..."}
            />
            <SystemStatusRow
              label="Database"
              icon={<Database size={16} className="text-green-500" />}
              status={systemStatus.database}
              detail={systemStatus.db_detail || "Memeriksa koneksi..."}
            />
            <SystemStatusRow
              label="AI Service (Groq)"
              icon={<Cpu size={16} className="text-amber-500" />}
              status={systemStatus.ai_service}
              detail={systemStatus.ai_detail || "Memeriksa aktivitas AI..."}
            />
          </div>
        </div>

        {/* ── Ticket Terbaru ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
              Ticket Terbaru
            </h2>
            <Link
              href="/admin/tickets"
              className="flex items-center gap-1 text-[12px] text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Lihat semua <ArrowRight size={13} />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Judul</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Dibuat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">#{t.id}</td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <span className="truncate block text-slate-700 font-medium">{t.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.type === "INCIDENT"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}>
                        {t.type === "INCIDENT" ? "🚨 Incident" : "🎫 Support"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">
                      {formatDatetime(t.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tickets/${t.id}`}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold"
                      >
                        Kelola <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub Components ─────────────────────────────────────────────────────────────

function AdminStatCard({
  label, value, icon, color, sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "slate" | "rose";
  sub?: string;
}) {
  const colorMap = {
    indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-600",  val: "text-indigo-700" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", val: "text-emerald-700" },
    slate:   { bg: "bg-slate-100",  icon: "text-slate-600",   val: "text-slate-700" },
    rose:    { bg: "bg-rose-50",    icon: "text-rose-600",    val: "text-rose-700" },
  }[color];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[12px] font-semibold text-slate-500">{label}</p>
        <div className={`w-9 h-9 rounded-lg ${colorMap.bg} ${colorMap.icon} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-extrabold ${colorMap.val}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function SystemStatusRow({
  label, icon, status, detail,
}: {
  label: string;
  icon: React.ReactNode;
  status: string;
  detail: string;
}) {
  const isOnline   = ["ONLINE", "RUNNING", "HEALTHY", "ACTIVE"].includes(status);
  const isChecking = ["CHECKING", "STARTING"].includes(status);
  const isIdle     = status === "IDLE";

  const dotClass    = isOnline ? "status-dot online"
    : isChecking    ? "status-dot checking"
    : isIdle        ? "status-dot checking"
    : "status-dot offline";

  const statusColor = isOnline  ? "text-emerald-600"
    : isChecking    ? "text-amber-500"
    : isIdle        ? "text-amber-500"
    : "text-red-500";

  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400 truncate">{detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={dotClass} />
        <span className={`text-[12px] font-bold ${statusColor}`}>{status}</span>
      </div>
    </div>
  );
}