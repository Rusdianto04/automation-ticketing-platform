"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Ticket, AlertCircle, Clock, CheckCircle2, XCircle,
  Search, RefreshCw, Filter, ChevronRight, Shield,
  TrendingUp, Activity, Settings,
} from "lucide-react";

interface TicketRow {
  id: number;
  type: "TICKETING" | "INCIDENT";
  title: string;
  status: string;
  requester: string;
  assignee: string;
  created_at: string;
  updated_at: string;
  raw_created: string;
}

interface Stats {
  total: number;
  todayTotal: number;
  openCount: number;
  pendingCount: number;
  doneCount: number;
  incidentCount: number;
  rejectCount: number;
}

interface Props {
  tickets: TicketRow[];
  stats: Stats;
  orgName: string;
  orgDepartment: string;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  PENDING: "Pending",
  DONE: "Done",
  REJECT: "Reject",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  DONE:    "bg-slate-100 text-slate-600 border-slate-200",
  REJECT:  "bg-red-50 text-red-700 border-red-200",
};

export default function DashboardClient({ tickets, stats, orgName, orgDepartment }: Props) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType]     = useState("");
  const [searchQuery, setSearchQuery]   = useState("");

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus = !filterStatus || t.status === filterStatus;
      const matchType   = !filterType   || t.type   === filterType;

      const q = searchQuery.trim();
      if (!q) return matchStatus && matchType;

      // FIX #3: Search ID — exact match saja
      // User ketik "1" → hanya cocok dengan ticket ID = 1, bukan 10, 11, 100
      // Support format: "1", "#1", "#01"
      const numericQ = q.replace(/^#/, "").trim();
      const isNumericSearch = /^\d+$/.test(numericQ);

      let matchQ: boolean;
      if (isNumericSearch) {
        // Exact match ID
        matchQ = t.id === parseInt(numericQ, 10);
      } else {
        // Text search: judul atau nama reporter (case-insensitive)
        const ql = q.toLowerCase();
        matchQ =
          t.title.toLowerCase().includes(ql) ||
          t.requester.toLowerCase().includes(ql);
      }

      return matchStatus && matchType && matchQ;
    });
  }, [tickets, filterStatus, filterType, searchQuery]);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-navy-900 to-navy-800 text-white shadow-lg sticky top-0 z-30"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.25)" }}>
                <Shield size={20} className="text-indigo-300" />
              </div>
              <div>
                <h1 className="text-[15px] font-bold tracking-wide text-white">
                  Support &amp; Incident Portal
                </h1>
                <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                  {orgName} &mdash; {orgDepartment}
                </p>
              </div>
            </div>

            {/* Right nav */}
            <div className="flex items-center gap-2">
              <Link
                href="/admin/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              >
                <Settings size={14} />
                <span className="hidden sm:inline">Admin Panel</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total Tiket" value={stats.total}         icon={<Ticket size={18} />}       color="indigo" />
          <StatCard label="Open"        value={stats.openCount}     icon={<Activity size={18} />}     color="emerald" />
          <StatCard label="Pending"     value={stats.pendingCount}  icon={<Clock size={18} />}        color="amber" />
          <StatCard label="Done"        value={stats.doneCount}     icon={<CheckCircle2 size={18} />} color="slate" />
          <StatCard label="Reject"      value={stats.rejectCount}   icon={<XCircle size={18} />}      color="red" />
          <StatCard label="Incident"    value={stats.incidentCount} icon={<AlertCircle size={18} />}  color="rose" />
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
          <Filter size={15} className="text-slate-400 shrink-0" />

          <div className="flex items-center gap-2">
            <label className="text-[12px] font-semibold text-slate-500 whitespace-nowrap">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            >
              <option value="">Semua Status</option>
              <option value="OPEN">Open</option>
              <option value="PENDING">Pending</option>
              <option value="DONE">Done</option>
              <option value="REJECT">Reject</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[12px] font-semibold text-slate-500 whitespace-nowrap">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
            >
              <option value="">Semua Tipe</option>
              <option value="TICKETING">Support</option>
              <option value="INCIDENT">Incident</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 ml-auto flex-1 min-w-[200px] max-w-[320px]">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ID, judul, nama pemohon..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-semibold transition-colors shrink-0"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[12px] text-slate-500">
            Menampilkan <strong className="text-slate-700">{filtered.length}</strong> dari {tickets.length} tiket
          </p>
          <div className="flex gap-2 items-center">
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <TrendingUp size={12} />
              Hari ini: {stats.todayTotal} tiket baru
            </span>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-10">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Judul</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reporter</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assignee</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Ticket size={40} strokeWidth={1.5} />
                        <p className="text-[14px]">Tidak ada tiket ditemukan</p>
                        <p className="text-[12px]">Coba ubah filter atau kata kunci pencarian</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, i) => (
                    <tr
                      key={t.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        t.type === "INCIDENT" ? "bg-rose-50/30 hover:bg-rose-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-400 text-[12px]">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-indigo-600 text-[13px]">
                          #{t.id}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="font-medium text-slate-800 truncate" title={t.title}>
                          {t.title}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            t.type === "INCIDENT"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          }`}
                        >
                          {t.type === "INCIDENT" ? "🚨 Incident" : "🎫 Support"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[150px]">
                        <span className="text-slate-600 truncate block" title={t.requester}>
                          {t.requester}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[150px]">
                        <span className="text-slate-500 truncate block text-[12px]" title={t.assignee}>
                          {t.assignee || <span className="text-slate-300 italic">Belum assigned</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/tickets/${t.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap"
                        >
                          Detail
                          <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 text-center text-[11px] text-slate-400 py-4">
          {orgName} &mdash; {orgDepartment} &bull; Support &amp; Incident Management Portal
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "indigo" | "emerald" | "amber" | "slate" | "red" | "rose";
}) {
  const colorMap = {
    indigo:  { border: "border-l-indigo-500",  icon: "text-indigo-500",  bg: "bg-indigo-50" },
    emerald: { border: "border-l-emerald-500", icon: "text-emerald-500", bg: "bg-emerald-50" },
    amber:   { border: "border-l-amber-500",   icon: "text-amber-500",   bg: "bg-amber-50" },
    slate:   { border: "border-l-slate-400",   icon: "text-slate-500",   bg: "bg-slate-50" },
    red:     { border: "border-l-red-500",     icon: "text-red-500",     bg: "bg-red-50" },
    rose:    { border: "border-l-rose-500",    icon: "text-rose-500",    bg: "bg-rose-50" },
  }[color];

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 ${colorMap.border} p-4 flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-lg ${colorMap.bg} ${colorMap.icon} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold truncate">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 leading-tight">{value}</p>
      </div>
    </div>
  );
}