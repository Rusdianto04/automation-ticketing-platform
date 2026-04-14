"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Ticket, AlertCircle, Clock, CheckCircle2,
  Search, RefreshCw, Shield, Activity,
  Settings, Plus, ChevronRight, X, Upload, Loader2,
  FileText, Zap, Image,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncidentRow {
  id: number;
  type: "INCIDENT";
  title: string;
  status: string;
  priority: string;
  severity: string;
  suspect_area: string;
  indicated_issue: string;
  created_at: string;
  raw_created: string;
}

interface Stats {
  total: number;
  openCount: number;
  closedCount: number;
}

interface Props {
  incidents: IncidentRow[];
  stats: Stats;
  orgName: string;
  orgDepartment: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-emerald-100 text-emerald-800 border border-emerald-300",
  PENDING:     "bg-amber-100 text-amber-800 border border-amber-300",
  DONE:        "bg-blue-100 text-blue-800 border border-blue-300",
  REJECT:      "bg-red-100 text-red-800 border border-red-300",
  INVESTIGASI: "bg-orange-100 text-orange-800 border border-orange-300",
  MITIGASI:    "bg-purple-100 text-purple-800 border border-purple-300",
  RESOLVED:    "bg-teal-100 text-teal-800 border border-teal-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High:     "bg-orange-100 text-orange-800 border border-orange-300",
  Medium:   "bg-amber-100 text-amber-800 border border-amber-300",
  Low:      "bg-green-100 text-green-800 border border-green-300",
  high:     "bg-orange-100 text-orange-800 border border-orange-300",
  medium:   "bg-amber-100 text-amber-800 border border-amber-300",
  low:      "bg-green-100 text-green-800 border border-green-300",
};

const FLOOR_OPTIONS = ["Lantai 1", "Lantai 2", "Lantai 3"];
const SUPPORT_TYPE_OPTIONS = [
  "Laptop/PC",
  "Printer",
  "Software/Application Error",
  "Network/Wifi User Issue",
  "Other",
];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
const SEVERITY_OPTIONS = [
  "SEV 1: Critical",
  "SEV 2: High",
  "SEV 3: Medium",
  "SEV 4: Low",
];

async function uploadFileToServer(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res  = await fetch("/api/tickets/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Gagal upload file");
  return data.url as string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardClient({ incidents, stats, orgName, orgDepartment }: Props) {
  const [searchId,      setSearchId]      = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [searchResult,  setSearchResult]  = useState<null | { found: boolean; ticket?: Record<string, unknown> }>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [modal,             setModal]             = useState<null | "support" | "incident">(null);
  const [selectedIncident,  setSelectedIncident]  = useState<IncidentRow | null>(null);

  const handleRefresh = useCallback(() => window.location.reload(), []);

  const handleSearchTicket = useCallback(async () => {
    const rawId = searchInput.trim().replace(/^#/, "");
    if (!rawId || !/^\d+$/.test(rawId)) {
      alert("Masukkan nomor ID tiket yang valid (contoh: 42 atau #42)");
      return;
    }
    setSearchId(rawId);
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/tickets/${rawId}`);
      if (res.status === 404) {
        setSearchResult({ found: false });
      } else if (res.ok) {
        const data = await res.json();
        setSearchResult({ found: true, ticket: data.ticket });
      } else {
        setSearchResult({ found: false });
      }
    } catch {
      setSearchResult({ found: false });
    } finally {
      setSearchLoading(false);
    }
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearchId("");
    setSearchResult(null);
  }, []);

  const isSearchMode = searchId !== "";

  return (
    <div className="min-h-screen" style={{ background: "#f4f6f9" }}>

      {/* ── Header ── */}
      <header
        className="text-white sticky top-0 z-30"
        style={{ background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}
              >
                <Shield size={16} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="text-[13px] font-bold tracking-wide text-white leading-tight">
                  Support &amp; Incident Portal
                </h1>
                <p className="text-[10px] leading-tight" style={{ color: "rgba(148,163,184,0.8)" }}>
                  {orgName} — {orgDepartment}
                </p>
              </div>
            </div>
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] transition-all"
              style={{ color: "rgba(148,163,184,0.9)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Settings size={13} />
              <span className="hidden sm:inline font-medium">Admin Panel</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-4">

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Tiket" value={stats.total}      icon={<Ticket size={18} />}       color="indigo" sub="Support & Incident" />
          <StatCard label="Open"        value={stats.openCount}  icon={<Activity size={18} />}     color="emerald" sub="On Progress" />
          <StatCard label="Closed"      value={stats.closedCount} icon={<CheckCircle2 size={18} />} color="slate" sub="Done & Rejected" />
        </div>

        {/* ── Buat Tiket Baru ── */}
        <div className="bg-white rounded-xl p-4 sm:p-5" style={{ border: "1px solid #e8eaed" }}>
          <div className="flex items-center gap-2 mb-1">
            <Plus size={15} className="text-indigo-600" />
            <h2 className="text-[14px] font-bold text-slate-800">Buat Tiket Baru</h2>
          </div>
          <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
            Pilih jenis tiket yang ingin Anda buat. Tiket support untuk masalah teknis perangkat/aplikasi, tiket incident untuk kejadian gangguan sistem.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setModal("support")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all text-white"
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)", boxShadow: "0 1px 3px rgba(79,70,229,0.3)" }}
            >
              <Ticket size={14} />
              Buat Tiket Support
            </button>
            <button
              onClick={() => setModal("incident")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all text-white"
              style={{ background: "linear-gradient(135deg, #e11d48, #f43f5e)", boxShadow: "0 1px 3px rgba(225,29,72,0.3)" }}
            >
              <Zap size={14} />
              Laporkan Incident
            </button>
          </div>
        </div>

        {/* ── Card Gabungan: Search + Incident/Search Result ── */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e8eaed" }}>

          {/* Header Card */}
          <div className="px-4 sm:px-5 py-3.5" style={{ borderBottom: "1px solid #f1f3f5", background: "#fafbfc" }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">

              {/* Judul */}
              <div className="flex items-center gap-2 shrink-0">
                {isSearchMode ? (
                  <>
                    <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                      <FileText size={13} className="text-indigo-600" />
                    </div>
                    <h2 className="text-[13px] font-bold text-slate-800">Hasil Cek Status Tiket</h2>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center">
                      <AlertCircle size={13} className="text-rose-600" />
                    </div>
                    <h2 className="text-[13px] font-bold text-slate-800">Incident Aktif &amp; Terkini</h2>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                      {incidents.length}
                    </span>
                  </>
                )}
              </div>

              {/* Search bar */}
              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchTicket()}
                    placeholder="Cek status tiket (ID)"
                    className="w-full pl-8 pr-3 py-2 text-[12px] bg-white text-slate-700 rounded-lg focus:outline-none"
                    style={{ border: "1px solid #d1d5db" }}
                  />
                </div>
                <button
                  onClick={handleSearchTicket}
                  disabled={searchLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors text-white whitespace-nowrap"
                  style={{ background: "#4f46e5" }}
                >
                  {searchLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  Cari
                </button>
                {isSearchMode && (
                  <button
                    onClick={handleClearSearch}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors text-slate-600 whitespace-nowrap"
                    style={{ background: "#f1f3f5", border: "1px solid #e2e8f0" }}
                  >
                    <X size={12} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
                {!isSearchMode && (
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-slate-500 transition-colors"
                    style={{ background: "#f1f3f5", border: "1px solid #e2e8f0" }}
                  >
                    <RefreshCw size={12} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
              </div>
            </div>

            {!isSearchMode && (
              <p className="text-[11px] text-slate-400 mt-2">
                Masukkan nomor ID tiket untuk cek status. Contoh:{" "}
                <span className="font-mono font-semibold text-slate-500">99</span> atau{" "}
                <span className="font-mono font-semibold text-slate-500">#99</span>
              </p>
            )}
          </div>

          {/* Konten: Search Mode */}
          {isSearchMode && (
            <div className="p-4 sm:p-5">
              {searchLoading ? (
                <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
                  <Loader2 size={22} className="animate-spin" />
                  <p className="text-[13px]">Mencari tiket #{searchId}...</p>
                </div>
              ) : searchResult === null ? null : !searchResult.found ? (
                <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: "#fff5f5", border: "1px solid #fecaca" }}>
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                    <X size={15} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-red-700">Tiket #{searchId} tidak ditemukan</p>
                    <p className="text-[11px] text-red-500 mt-0.5">
                      Pastikan nomor ID tiket Anda benar. ID tiket dapat ditemukan di email konfirmasi.
                    </p>
                  </div>
                </div>
              ) : (
                <TicketSearchResult ticket={searchResult.ticket!} />
              )}
            </div>
          )}

          {/* Konten: Incident Mode */}
          {!isSearchMode && (
            incidents.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={24} strokeWidth={1.5} className="text-emerald-400" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-600">Tidak ada incident aktif</p>
                  <p className="text-[11px]">Semua sistem berjalan normal</p>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #f1f3f5", background: "#fafbfc" }}>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-14">ID</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Judul Incident</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">Priority</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">Severity</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">Status</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">Tanggal</th>
                        <th className="px-4 py-2.5 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map((inc, idx) => (
                        <tr
                          key={inc.id}
                          className="transition-colors hover:bg-slate-50"
                          style={{ borderBottom: idx < incidents.length - 1 ? "1px solid #f8f9fa" : "none" }}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-rose-500 text-[12px]">#{inc.id}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="font-semibold text-slate-800 truncate text-[12px]" title={inc.title}>{inc.title}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5" title={inc.suspect_area}>
                              {inc.suspect_area}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${PRIORITY_COLORS[inc.priority] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                              {inc.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] text-slate-600 font-medium">{inc.severity}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[inc.status] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                              {inc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {inc.created_at}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedIncident(inc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-white transition-colors"
                              style={{ background: "#e11d48" }}
                            >
                              Detail <ChevronRight size={10} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-50">
                  {incidents.map((inc) => (
                    <div key={inc.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-rose-500 text-[11px]">#{inc.id}</span>
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_COLORS[inc.status] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                              {inc.status}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800 text-[12px] leading-snug">{inc.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{inc.suspect_area}</p>
                        </div>
                        <button
                          onClick={() => setSelectedIncident(inc)}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-white"
                          style={{ background: "#e11d48" }}
                        >
                          Detail <ChevronRight size={10} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${PRIORITY_COLORS[inc.priority] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                          {inc.priority}
                        </span>
                        <span className="text-[10px] text-slate-500">{inc.severity}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{inc.created_at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </div>

        <footer className="text-center text-[10px] text-slate-400 py-3">
          {orgName} — {orgDepartment} · Support &amp; Incident Management Portal
        </footer>
      </main>

      {modal === "support"  && <SupportFormModal  onClose={() => setModal(null)} />}
      {modal === "incident" && <IncidentFormModal onClose={() => setModal(null)} />}
      {selectedIncident     && <IncidentDetailModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} />}
    </div>
  );
}

// ─── Ticket Search Result ─────────────────────────────────────────────────────

function TicketSearchResult({ ticket }: { ticket: Record<string, unknown> }) {
  const ff = (ticket.form_fields || ticket.formFields || {}) as Record<string, unknown>;
  const status     = String(ticket.status || ticket.status_pengusulan || "OPEN");
  const type       = String(ticket.type || "TICKETING");
  const isIncident = type === "INCIDENT";

  const STATUS_LABELS: Record<string, string> = {
    OPEN:        "Open",
    PENDING:     "Pending",
    DONE:        "Done",
    REJECT:      "Reject",
    IN_PROGRESS: "In Progress",
    INVESTIGASI: "Investigasi",
    MITIGASI:    "Mitigasi",
    RESOLVED:    "Resolved",
  };

  const STATUS_DISPLAY: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    OPEN:        { bg: "#f0fdf4", text: "#166534", border: "#86efac", dot: "#22c55e" },
    PENDING:     { bg: "#fffbeb", text: "#92400e", border: "#fcd34d", dot: "#f59e0b" },
    DONE:        { bg: "#eff6ff", text: "#1e40af", border: "#93c5fd", dot: "#3b82f6" },
    REJECT:      { bg: "#fff5f5", text: "#991b1b", border: "#fca5a5", dot: "#ef4444" },
    IN_PROGRESS: { bg: "#f0f9ff", text: "#075985", border: "#7dd3fc", dot: "#0ea5e9" },
    INVESTIGASI: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74", dot: "#f97316" },
    MITIGASI:    { bg: "#faf5ff", text: "#6b21a8", border: "#c4b5fd", dot: "#8b5cf6" },
    RESOLVED:    { bg: "#f0fdfa", text: "#134e4a", border: "#5eead4", dot: "#14b8a6" },
  };

  const sd = STATUS_DISPLAY[status] || { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", dot: "#94a3b8" };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #d1fae5" }}>
      {/* Header bar */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: "#f0fdf4", borderBottom: "1px solid #d1fae5" }}>
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={14} className="text-emerald-600" />
        </div>
        <p className="text-[13px] font-bold text-emerald-700">Tiket ditemukan!</p>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5" style={{ background: "#fafffe" }}>
        {/* Top row: ID, Type, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 pb-4" style={{ borderBottom: "1px solid #e8f5e9" }}>
          
          {/* ID */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Tiket</span>
            <span className="text-[15px] font-black text-slate-800">#{String(ticket.id)}</span>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipe</span>
            <div>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={
                  isIncident
                    ? { background: "#fff5f5", color: "#991b1b", border: "1px solid #fca5a5" }
                    : { background: "#eff6ff", color: "#1e40af", border: "1px solid #93c5fd" }
                }
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: isIncident ? "#ef4444" : "#3b82f6", display: "inline-block" }} />
                {isIncident ? "Incident" : "Support"}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
            <div>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: sd.bg, color: sd.text, border: `1px solid ${sd.border}` }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: sd.dot, display: "inline-block" }} />
                {STATUS_LABELS[status] || status}
              </span>
            </div>
          </div>
        </div>

        {/* Detail fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {!isIncident && (
            <>
              <InfoItem label="Reporter"     value={String(ff["Reporter Information"] || ff["Name"] || "—")} />
              <InfoItem label="Email"        value={String(ff["Email"] || "—")} />
              <InfoItem label="Type Support" value={String(ff["Type of Support Requested"] || "—")} />
            </>
          )}
          {isIncident && (
            <>
              <InfoItem label="Priority"     value={String(ff["Priority Incident"] || "—")} />
              <InfoItem label="Severity"     value={String(ff["Severity Incident"] || "—")} />
              <InfoItem label="Suspect Area" value={String(ff["Suspect Area"] || "—")} />
            </>
          )}
          {typeof ticket.status_note === "string" && (
            <InfoItem label="Catatan Status" value={ticket.status_note} />
          )}
        </div>

        <Link
          href={`/tickets/${String(ticket.id)}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold text-white transition-colors"
          style={{ background: "#059669" }}
        >
          Lihat Detail Lengkap <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function InfoItem({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      {children || <span className="text-[12px] font-semibold text-slate-700">{value || "—"}</span>}
    </div>
  );
}

// ─── Incident Detail Modal ────────────────────────────────────────────────────

function IncidentDetailModal({ incident, onClose }: { incident: IncidentRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between rounded-t-2xl" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
              <AlertCircle size={14} className="text-rose-600" />
            </div>
            <h3 className="text-[14px] font-bold text-slate-800">Detail Incident #{incident.id}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Judul Incident</p>
            <p className="text-[14px] font-bold text-slate-800">{incident.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3" style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Priority</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${PRIORITY_COLORS[incident.priority] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                {incident.priority}
              </span>
            </div>
            <div className="rounded-xl p-3" style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Severity</p>
              <p className="text-[12px] font-semibold text-slate-700">{incident.severity}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Status</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[incident.status] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                {incident.status}
              </span>
            </div>
            <div className="rounded-xl p-3" style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Tanggal</p>
              <p className="text-[11px] text-slate-700">{incident.created_at}</p>
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Suspect Area</p>
            <p className="text-[12px] text-slate-700">{incident.suspect_area}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#fafbfc", border: "1px solid #f1f3f5" }}>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Indicated Issue</p>
            <p className="text-[12px] text-slate-700 leading-relaxed">{incident.indicated_issue}</p>
          </div>
          <Link
            href={`/tickets/${incident.id}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-colors"
            style={{ background: "#e11d48" }}
          >
            Lihat Detail Lengkap <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Support Form Modal ───────────────────────────────────────────────────────

function SupportFormModal({ onClose }: { onClose: () => void }) {
  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short",
  });

  const [form, setForm] = useState({
    reporterInfo: "", division: "", noTelepon: "", email: "",
    idDevice: "", ruangan: "", lantai: "", tanggalWaktu: now,
    typeOfSupport: "", typeOther: "", issue: "", jumlahBarang: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const fileInputRef                     = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [success,    setSuccess]        = useState(false);
  const [ticketId,   setTicketId]       = useState<number | null>(null);
  const [error,      setError]          = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
    if (!allowed.includes(file.type)) { setError("Tipe file tidak didukung. Gunakan: JPG, PNG, GIF, WEBP"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Ukuran file maksimal 5MB"); return; }
    setError("");
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!form.reporterInfo || !form.division || !form.noTelepon || !form.email ||
        !form.ruangan || !form.lantai || !form.typeOfSupport || !form.issue) {
      setError("Harap isi semua field yang wajib diisi (*)");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (selectedFile) attachmentUrl = await uploadFileToServer(selectedFile);

      const typeValue = form.typeOfSupport === "Other" ? (form.typeOther || "Other") : form.typeOfSupport;
      const formFields: Record<string, string> = {
        "Reporter Information":      form.reporterInfo,
        "Division":                  form.division,
        "No Telepon":                form.noTelepon,
        "Email":                     form.email,
        "ID Device":                 form.idDevice,
        "Ruangan":                   form.ruangan,
        "Lantai":                    form.lantai,
        "Tanggal & Waktu Pemohon":   form.tanggalWaktu,
        "Type of Support Requested": typeValue,
        "Issue":                     form.issue,
        "Jumlah Barang":             form.jumlahBarang,
      };
      if (attachmentUrl) formFields["Attachment"] = attachmentUrl;

      const res  = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TICKETING", formFields, createdBy: form.reporterInfo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat tiket");
      setTicketId(data.ticketId);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <ModalWrapper title="Tiket Support Berhasil Dibuat" onClose={onClose} icon={<CheckCircle2 size={18} className="text-emerald-600" />}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={30} className="text-emerald-600" />
          </div>
          <p className="text-[14px] font-bold text-slate-800 mb-1">Tiket Berhasil Dibuat!</p>
          <p className="text-[12px] text-slate-500 mb-2">Nomor tiket Anda:</p>
          <p className="text-4xl font-black text-indigo-600 mb-3">#{ticketId}</p>
          <p className="text-[11px] text-slate-400 mb-6">Simpan nomor tiket ini untuk mengecek status tiket Anda.</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/tickets/${ticketId}`} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white transition-colors" style={{ background: "#4f46e5" }}>
              Lihat Detail Tiket
            </Link>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-slate-600 transition-colors" style={{ border: "1px solid #e2e8f0" }}>
              Tutup
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title="Buat Tiket Support" onClose={onClose} icon={<Ticket size={16} className="text-indigo-600" />}>
      <div className="space-y-3.5">
        {error && <div className="rounded-lg px-4 py-3 text-[12px] font-medium text-red-700" style={{ background: "#fff5f5", border: "1px solid #fecaca" }}>{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Reporter Information *" type="text"  value={form.reporterInfo} onChange={(v) => set("reporterInfo", v)} placeholder="Nama lengkap Anda" />
          <FormField label="Division *"             type="text"  value={form.division}     onChange={(v) => set("division", v)}     placeholder="Divisi / Departemen" />
          <FormField label="No Telepon *"           type="tel"   value={form.noTelepon}    onChange={(v) => set("noTelepon", v)}    placeholder="08xx-xxxx-xxxx" />
          <FormField label="Email *"                type="email" value={form.email}        onChange={(v) => set("email", v)}        placeholder="email@perusahaan.com" />
          <FormField label="ID Device"              type="text"  value={form.idDevice}     onChange={(v) => set("idDevice", v)}     placeholder="Serial number / asset tag" />
          <FormField label="Ruangan *"              type="text"  value={form.ruangan}      onChange={(v) => set("ruangan", v)}      placeholder="Nama ruangan" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Lantai *</label>
          <select value={form.lantai} onChange={(e) => set("lantai", e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none" style={{ border: "1px solid #d1d5db" }}>
            <option value="">-- Pilih Lantai --</option>
            {FLOOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Tanggal &amp; Waktu Pemohon</label>
          <input type="text" value={form.tanggalWaktu} readOnly className="w-full px-3 py-2.5 rounded-lg text-[12px] text-slate-500 cursor-not-allowed" style={{ border: "1px solid #e2e8f0", background: "#f8fafc" }} />
          <p className="text-[10px] text-slate-400 mt-1">Terisi otomatis dari sistem</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Type of Support Requested *</label>
          <select value={form.typeOfSupport} onChange={(e) => set("typeOfSupport", e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none" style={{ border: "1px solid #d1d5db" }}>
            <option value="">-- Pilih Tipe Support --</option>
            {SUPPORT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {form.typeOfSupport === "Other" && (
            <input type="text" value={form.typeOther} onChange={(e) => set("typeOther", e.target.value)} placeholder="Jelaskan tipe support lainnya..." className="mt-2 w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none" style={{ border: "1px solid #d1d5db" }} />
          )}
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Issue — Description *</label>
          <textarea value={form.issue} onChange={(e) => set("issue", e.target.value)} rows={4} placeholder="Jelaskan masalah yang Anda alami secara detail..." className="w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none resize-none" style={{ border: "1px solid #d1d5db" }} />
        </div>
        <FormField label="Jumlah Barang" type="text" value={form.jumlahBarang} onChange={(v) => set("jumlahBarang", v)} placeholder="Contoh: 1 unit laptop" />
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Attachment (Gambar / Screenshot)</label>
          <div className="rounded-lg p-4 transition-colors" style={{ border: "2px dashed #e2e8f0" }}>
            {selectedFile ? (
              <div className="space-y-3">
                {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-36 rounded-lg object-contain" style={{ border: "1px solid #e2e8f0" }} />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Image size={14} />
                    <span className="text-[12px] font-medium truncate max-w-[180px]">{selectedFile.name}</span>
                    <span className="text-[10px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={handleRemoveFile} className="text-red-400 hover:text-red-600 transition-colors p-1"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400 py-2">
                  <Upload size={20} />
                  <p className="text-[12px]">Klik untuk pilih gambar atau screenshot</p>
                  <p className="text-[10px] text-slate-300">JPG, PNG, GIF, WEBP — Maks 5MB</p>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold text-white transition-colors"
            style={{ background: submitting ? "#818cf8" : "#4f46e5" }}>
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Mengirim Tiket...</> : <><Ticket size={14} /> Kirim Tiket Support</>}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[12px] font-semibold text-slate-600 transition-colors" style={{ border: "1px solid #e2e8f0" }}>Batal</button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Incident Form Modal ──────────────────────────────────────────────────────

function IncidentFormModal({ onClose }: { onClose: () => void }) {
  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short",
  });

  const [form, setForm] = useState({
    incidentTitle: "", dateTimeIncident: now,
    priorityIncident: "", severityIncident: "",
    suspectArea: "", indicatedIssue: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const fileInputRef                     = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [success,    setSuccess]        = useState(false);
  const [ticketId,   setTicketId]       = useState<number | null>(null);
  const [error,      setError]          = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
    if (!allowed.includes(file.type)) { setError("Tipe file tidak didukung. Gunakan: JPG, PNG, GIF, WEBP"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Ukuran file maksimal 5MB"); return; }
    setError("");
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!form.incidentTitle || !form.priorityIncident || !form.severityIncident ||
        !form.suspectArea || !form.indicatedIssue) {
      setError("Harap isi semua field yang wajib diisi (*)");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (selectedFile) attachmentUrl = await uploadFileToServer(selectedFile);

      const formFields: Record<string, string> = {
        "Incident Title":       form.incidentTitle,
        "Incident Information": form.incidentTitle,
        "Date & Time Incident": form.dateTimeIncident,
        "Priority Incident":    form.priorityIncident,
        "Severity Incident":    form.severityIncident,
        "Suspect Area":         form.suspectArea,
        "Indicated Issue":      form.indicatedIssue,
      };
      if (attachmentUrl) formFields["Attachment"] = attachmentUrl;

      const res  = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "INCIDENT", formFields, createdBy: "static_portal" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat tiket");
      setTicketId(data.ticketId);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <ModalWrapper title="Incident Berhasil Dilaporkan" onClose={onClose} icon={<CheckCircle2 size={18} className="text-emerald-600" />}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap size={30} className="text-rose-600" />
          </div>
          <p className="text-[14px] font-bold text-slate-800 mb-1">Incident Berhasil Dilaporkan!</p>
          <p className="text-[12px] text-slate-500 mb-2">Nomor tiket incident Anda:</p>
          <p className="text-4xl font-black text-rose-600 mb-3">#{ticketId}</p>
          <p className="text-[11px] text-slate-400 mb-6">Tim IT akan segera menangani incident ini.</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/tickets/${ticketId}`} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: "#e11d48" }}>
              Lihat Detail Tiket
            </Link>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-slate-600" style={{ border: "1px solid #e2e8f0" }}>
              Tutup
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title="Laporkan Incident" onClose={onClose} icon={<Zap size={16} className="text-rose-600" />}>
      <div className="space-y-3.5">
        {error && <div className="rounded-lg px-4 py-3 text-[12px] font-medium text-red-700" style={{ background: "#fff5f5", border: "1px solid #fecaca" }}>{error}</div>}
        <FormField label="Incident Title *" type="text" value={form.incidentTitle} onChange={(v) => set("incidentTitle", v)} placeholder="Judul singkat incident yang terjadi" />
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Date &amp; Time Incident</label>
          <input type="text" value={form.dateTimeIncident} readOnly className="w-full px-3 py-2.5 rounded-lg text-[12px] text-slate-500 cursor-not-allowed" style={{ border: "1px solid #e2e8f0", background: "#f8fafc" }} />
          <p className="text-[10px] text-slate-400 mt-1">Terisi otomatis dari sistem</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Priority Incident *</label>
            <select value={form.priorityIncident} onChange={(e) => set("priorityIncident", e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none" style={{ border: "1px solid #d1d5db" }}>
              <option value="">-- Pilih Priority --</option>
              {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Severity Incident *</label>
            <select value={form.severityIncident} onChange={(e) => set("severityIncident", e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none" style={{ border: "1px solid #d1d5db" }}>
              <option value="">-- Pilih Severity --</option>
              {SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <FormField label="Suspect Area *" type="text" value={form.suspectArea} onChange={(v) => set("suspectArea", v)} placeholder="Area/sistem yang diduga menjadi penyebab" />
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Indicated Issue *</label>
          <textarea value={form.indicatedIssue} onChange={(e) => set("indicatedIssue", e.target.value)} rows={4} placeholder="Jelaskan indikasi masalah / gejala incident yang terjadi..." className="w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none resize-none" style={{ border: "1px solid #d1d5db" }} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Attachment (Gambar / Screenshot)</label>
          <div className="rounded-lg p-4 transition-colors" style={{ border: "2px dashed #e2e8f0" }}>
            {selectedFile ? (
              <div className="space-y-3">
                {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-36 rounded-lg object-contain" style={{ border: "1px solid #e2e8f0" }} />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Image size={14} />
                    <span className="text-[12px] font-medium truncate max-w-[180px]">{selectedFile.name}</span>
                    <span className="text-[10px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={handleRemoveFile} className="text-red-400 hover:text-red-600 transition-colors p-1"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400 py-2">
                  <Upload size={20} />
                  <p className="text-[12px]">Klik untuk pilih gambar atau screenshot</p>
                  <p className="text-[10px] text-slate-300">JPG, PNG, GIF, WEBP — Maks 5MB</p>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold text-white transition-colors"
            style={{ background: submitting ? "#fb7185" : "#e11d48" }}>
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Mengirim...</> : <><Zap size={14} /> Laporkan Incident</>}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[12px] font-semibold text-slate-600" style={{ border: "1px solid #e2e8f0" }}>Batal</button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function ModalWrapper({ title, onClose, icon, children }: {
  title: string; onClose: () => void; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between rounded-t-2xl z-10" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-[14px] font-bold text-slate-800">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none"
        style={{ border: "1px solid #d1d5db" }}
      />
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }: {
  label: string; value: number; icon: React.ReactNode;
  color: "indigo" | "emerald" | "slate"; sub?: string;
}) {
  const colorMap = {
    indigo:  {
      bg: "#ffffff",
      iconBg: "#eef2ff",
      iconColor: "#4f46e5",
      valColor: "#3730a3",
      accent: "#4f46e5",
    },
    emerald: {
      bg: "#ffffff",
      iconBg: "#ecfdf5",
      iconColor: "#059669",
      valColor: "#065f46",
      accent: "#10b981",
    },
    slate: {
      bg: "#ffffff",
      iconBg: "#f8fafc",
      iconColor: "#64748b",
      valColor: "#334155",
      accent: "#94a3b8",
    },
  }[color];

  return (
    <div
      className="bg-white rounded-xl p-3 sm:p-4 flex items-center gap-3"
      style={{ border: "1px solid #e8eaed", borderTop: `3px solid ${colorMap.accent}` }}
    >
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: colorMap.iconBg, color: colorMap.iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: colorMap.valColor }}>{value}</p>
        {sub && <p className="text-[9px] sm:text-[10px] text-slate-400 leading-tight truncate">{sub}</p>}
      </div>
    </div>
  );
}