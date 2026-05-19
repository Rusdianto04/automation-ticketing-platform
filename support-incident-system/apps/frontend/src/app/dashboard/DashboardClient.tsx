"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle, CheckCircle2,
  Search, Settings,
  Plus, ChevronRight, X, Upload, Loader2,
  FileText, Zap, Image as ImageIcon, MoreVertical,
  AlertTriangle,
} from "lucide-react";
import { Ticket } from "lucide-react";
import { Filter, RefreshCw } from "lucide-react";


// ─── Types ────────────────────────────────────────────────────────────────────

interface IncidentRow {
  id: number;
  type: "INCIDENT" | "TICKETING";
  title: string;
  status: string;
  priority: string;
  severity: string;
  suspect_area: string;
  indicated_issue: string;
  created_at: string;
  raw_created: string;
  assignee: string;
  summary: string;
}

interface Props {
  incidents: IncidentRow[];
  allTickets: IncidentRow[];
  orgName: string;
  orgDepartment: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────



const STATUS_STYLE: Record<string, React.CSSProperties> = {
  OPEN: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" }, // sky-biru
  PENDING: { background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" }, // amber-kuning
  DONE: { background: "#eff6ff", color: "#1e40af", border: "1px solid #93c5fd" }, // blue-biru tua
  APPROVED: { background: "#f5f3ff", color: "#4c1d95", border: "1px solid #c4b5fd" }, // violet-ungu
  REJECT: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }, // red-merah
  INVESTIGASI: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }, // orange
  MITIGASI: { background: "#fdf2f8", color: "#831843", border: "1px solid #f9a8d4" }, // pink
  RESOLVED: { background: "#ecfdf5", color: "#065f46", border: "1px solid #6ee7b7" }, // emerald-hijau
};
const DEFAULT_STATUS_STYLE: React.CSSProperties = {
  background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1",
};
// Tetap dibutuhkan untuk fallback className kosong
const STATUS_COLORS: Record<string, string> = {};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High: "bg-orange-100 text-orange-800 border border-orange-300",
  Medium: "bg-amber-100 text-amber-800 border border-amber-300",
  Low: "bg-green-100 text-green-800 border border-green-300",
  high: "bg-orange-100 text-orange-800 border border-orange-300",
  medium: "bg-amber-100 text-amber-800 border border-amber-300",
  low: "bg-green-100 text-green-800 border border-green-300",
};

// Warna dot priority untuk aksen left border card
const PRIORITY_LEFT_BORDER: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#f59e0b",
  Low: "#22c55e",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
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
  const res = await fetch("/api/tickets/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Gagal upload file");
  return data.url as string;
}
function normalizeStatusForDisplay(status: string, type: string): { label: string; style: React.CSSProperties } {

  const inProgress = ["INVESTIGASI", "MITIGASI", "APPROVED", "IN_PROGRESS", "PENDING"];
  const closed = ["RESOLVED", "DONE", "REJECT"];

  if (inProgress.includes(status)) {
    return {
      label: "In Progress",
      style: { background: "#eff6ff", color: "#1e40af", border: "1px solid #93c5fd" },
    };
  }
  if (closed.includes(status)) {
    return {
      label: "Closed",
      style: { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" },
    };
  }
  // OPEN
  return {
    label: "Open",
    style: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" },
  };
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardClient({ incidents, allTickets, orgName, orgDepartment }: Props) {
  const [searchId, setSearchId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<null | { found: boolean; ticket?: Record<string, unknown> }>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [modal, setModal] = useState<null | "support" | "incident">(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRow | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [showFilter, setShowFilter] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("INCIDENT");


  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 500));
    window.location.reload();
  }, []);

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim();

    // Saat search aktif, pakai allTickets dan abaikan filter type
    const source = q ? allTickets : (filterType === "TICKETING" ? allTickets : incidents);

    return source.filter((inc) => {
      // Type filter hanya berlaku saat TIDAK ada search query
      const typeMatch = q ? true : (filterType === "ALL" || filterType === "INCIDENT"
        ? inc.type === "INCIDENT"
        : inc.type === "TICKETING");

      const inProgress = ["INVESTIGASI", "MITIGASI", "APPROVED", "IN_PROGRESS", "PENDING"];
      const closed = ["RESOLVED", "DONE", "REJECT"];
      let normalizedStatus = "OPEN";
      if (inProgress.includes(inc.status)) normalizedStatus = "IN_PROGRESS";
      if (closed.includes(inc.status)) normalizedStatus = "CLOSED";

      const statusMatch = filterStatus === "ALL" || normalizedStatus === filterStatus;

      let searchMatch = true;
      if (q) {
        const numericQ = q.replace(/^#/, "");
        if (/^\d+$/.test(numericQ)) {
          searchMatch = inc.id === parseInt(numericQ, 10);
        } else {
          searchMatch = inc.title.toLowerCase().includes(q.toLowerCase());
        }
      }
      return statusMatch && typeMatch && searchMatch;
    });
  }, [incidents, allTickets, filterStatus, filterType, searchQuery]);



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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#e8eaed" }}>

      {/* ═══════════════════════════════════════════════════════
          HEADER — Diperbesar: h-20 (80px), logo lebih besar
      ════════════════════════════════════════════════════════ */}
      <header
        className="text-white sticky top-0 z-30"
        style={{
          background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="w-full px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-20">

            {/* Kiri: Logo + Teks */}
            <div className="flex items-center gap-4">
              {/* Logo — ukuran diperbesar, padding lebih lega */}
              <div
                className="flex items-center justify-center shrink-0 rounded-xl overflow-hidden"
                style={{
                  width: 52,
                  height: 52,
                }}
              >
                <Image
                  src="/logo-seamolec.png"
                  alt="Logo SEAMOLEC"
                  width={44}
                  height={44}
                  className="object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logo-seamolec.ico";
                  }}
                />
              </div>

              {/* Teks header — ukuran sedikit lebih besar */}
              <div className="flex flex-col gap-0.5">
                <h1 className="text-[15px] font-bold tracking-wide text-white leading-tight">
                  Support &amp; Incident Portal
                </h1>
                <p className="text-[11px] leading-tight" style={{ color: "rgba(148,163,184,0.85)" }}>
                  {orgName} — {orgDepartment}
                </p>
              </div>
            </div>

            {/* Kanan: Tombol Admin Panel */}
            <Link
              href="/admin/login"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium text-white transition-all duration-200 hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.5)" }}
            >
              <Settings size={14} />
              <span className="hidden sm:inline">Admin Panel</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto px-3 sm:px-6 lg:px-8 py-5 w-full">


        {/* ═══════════════════════════════════════════════════
              CARD 2 — Search Cek Status Tiket
          ═══════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl overflow-visible" style={{ border: "1px solid #e8eaed" }}>

          {/* Header Card */}
          <div
            className="px-4 sm:px-5 py-3.5 relative"
            style={{ background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2">

              {/* Kiri: Buat Tiket Support */}
              <button
                onClick={() => setModal("support")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white shrink-0"
                style={{ background: showFilter ? "#4b5563" : "#374151", border: "1px solid rgba(255,255,255,0.15)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#4b5563")}
                onMouseOut={(e) => !showFilter && (e.currentTarget.style.background = "#374151")}
              >
                <Ticket size={13} />
                Buat Tiket Support
              </button>

              {/* Kanan: Filter + Search */}
              <div className="flex items-center gap-2 sm:ml-auto">

                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari Ticket..."
                    className="pl-8 pr-7 py-1.5 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none w-44"
                    style={{ border: "1px solid #d1d5db" }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Filter Button + Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFilter(!showFilter)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap"
                    style={{ background: showFilter ? "#4b5563" : "#374151", border: "1px solid rgba(255,255,255,0.15)" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#4b5563")}
                    onMouseOut={(e) => !showFilter && (e.currentTarget.style.background = "#374151")}
                  >
                    <Filter size={12} />
                    Filter
                    {(filterStatus !== "ALL" || filterType !== "ALL") && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                  </button>

                  {showFilter && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setShowFilter(false)} />

                      {/* Dropdown */}
                      <div
                        className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl z-20 py-2"
                        style={{ border: "1px solid #e2e8f0", minWidth: 180 }}
                      >
                        {/* Type */}
                        <div className="px-3 pb-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tipe</p>
                          <div className="space-y-0.5">
                            {[
                              { val: "INCIDENT", label: "Incident" },
                              { val: "TICKETING", label: "Support" },
                            ].map((o) => (
                              <button
                                key={o.val}
                                onClick={() => setFilterType(o.val)}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] transition-colors"
                                style={{
                                  background: filterType === o.val ? "#f1f5f9" : "transparent",
                                  color: filterType === o.val ? "#1e293b" : "#64748b",
                                  fontWeight: filterType === o.val ? 600 : 400,
                                }}
                              >
                                {o.label}
                                {filterType === o.val && <CheckCircle2 size={12} className="text-indigo-500" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-slate-100 mx-3 my-1" />

                        {/* Status */}
                        <div className="px-3 pt-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</p>
                          <div className="space-y-0.5">
                            {[
                              { val: "ALL", label: "Semua Status" },
                              { val: "OPEN", label: "Open" },
                              { val: "IN_PROGRESS", label: "In Progress" },
                              { val: "CLOSED", label: "Closed" },
                            ].map((o) => (
                              <button
                                key={o.val}
                                onClick={() => setFilterStatus(o.val)}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] transition-colors"
                                style={{
                                  background: filterStatus === o.val ? "#f1f5f9" : "transparent",
                                  color: filterStatus === o.val ? "#1e293b" : "#64748b",
                                  fontWeight: filterStatus === o.val ? 600 : 400,
                                }}
                              >
                                {o.label}
                                {filterStatus === o.val && <CheckCircle2 size={12} className="text-indigo-500" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Reset */}
                        {(filterStatus !== "ALL" || filterType !== "ALL") && (
                          <>
                            <div className="h-px bg-slate-100 mx-3 my-1" />
                            <div className="px-3 pt-1 pb-1">
                              <button
                                onClick={() => { setFilterStatus("ALL"); setFilterType("ALL"); }}
                                className="w-full text-[11px] text-red-500 hover:text-red-600 font-semibold text-center py-1 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                Reset Filter
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              CARD 3 — Daftar Incident Aktif
              Setiap incident ditampilkan sebagai card TERPISAH
              (bukan tabel, bukan divisi, tapi card-card sendiri)
          ═══════════════════════════════════════════════════ */}

          <div className="divide-y divide-slate-100">
            {filteredIncidents.length === 0 ? (
              /* Kosong */
              <div
                className="bg-white rounded-xl px-5 py-14 text-center"
                style={{ border: "1px solid #e8eaed" }}
              >
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 size={24} strokeWidth={1.5} className="text-emerald-400" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-600">Tidak ada incident aktif</p>
                  <p className="text-[11px]">Semua sistem berjalan normal</p>
                </div>
              </div>
            ) : (
              /* List card incident — setiap incident = 1 card terpisah */
              <div className="p-3 space-y-2">
                {filteredIncidents.map((inc) => (
                  <IncidentCard key={inc.id} inc={inc} />
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}

      <footer className="w-full py-8">
        <div className="flex flex-col items-center justify-center gap-3">

          {/* GARIS GRADIENT + FADE */}
          <div className="w-40 h-[2px] bg-gradient-to-r from-transparent via-slate-500/60 to-transparent animate-fadeIn"></div>

          {/* TEXT */}
          <p className="text-[12px] text-slate-500/80 tracking-wider">
            Copyright © {new Date().getFullYear()} SEAMOLEC, Org.
          </p>

        </div>
      </footer>
      {modal === "support" && <SupportFormModal onClose={() => setModal(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Incident Card — tampilan card terpisah per incident ──────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function IncidentCard({ inc }: { inc: IncidentRow }) {
  return (
    <Link
      href={`/tickets/${inc.id}`}
      className="block bg-white transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      style={{ borderRadius: "10px", border: "1px solid #e2e8f0" }}
    >
      {/* Flex row: konten kiri (flex-1) + panel kanan (tanggal + ⋮) */}
      <div className="flex items-stretch px-5 py-3 gap-4">

        {/* ── Konten Kiri ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">

          {/* Baris 1: Judul */}
          <p className="font-bold text-slate-800 text-[18px] leading-tight truncate">
            {inc.title}
          </p>

          {/* Baris 2: Kolom-kolom info */}
          <div className="flex items-center gap-0 w-full">

            {/* Kolom: ID */}
            <div className="flex flex-col items-start gap-0.5 pr-4 border-r border-slate-100" style={{ minWidth: 44 }}>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">ID</span>
              <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded" style={{ color: "#1e293b", background: "#f1f5f9" }}>
                #{inc.id}
              </span>
            </div>

            {/* Kolom: Type */}
            <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 80 }}>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Type</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={
                  inc.type === "INCIDENT"
                    ? { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }
                    : { background: "#eff6ff", color: "#1e40af", border: "1px solid #93c5fd" }
                }
              >
                {inc.type === "INCIDENT"
                  ? <><AlertTriangle size={9} /> Incident</>
                  : <><Ticket size={9} /> Support</>
                }
              </span>
            </div>

            {/* Kolom: Status */}
            <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 100 }}>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Status</span>
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={normalizeStatusForDisplay(inc.status, inc.type).style}
              >
                {normalizeStatusForDisplay(inc.status, inc.type).label}
              </span>
            </div>

            {/* Kolom: Area (hanya incident) */}
            {inc.type === "INCIDENT" && inc.suspect_area && inc.suspect_area !== "—" && (
              <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 100 }}>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Area</span>
                <span className="text-[10px] text-slate-600 font-medium truncate w-full">{inc.suspect_area}</span>
              </div>
            )}

            {/* Kolom: Petugas (hanya support) */}
            {inc.type === "TICKETING" && (
              <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 120 }}>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Petugas</span>
                <span className="text-[10px] text-slate-600 font-medium truncate w-full">
                  {inc.assignee && inc.assignee !== "—" ? inc.assignee : <span className="text-slate-300 italic">Belum assigned</span>}
                </span>
              </div>
            )}

            {/* Kolom: AI Summary */}
            <div className="flex flex-col items-start gap-0.5 px-4 flex-1 min-w-0">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Summary</span>
              <span className="text-[10px] text-slate-500 italic truncate w-full">
                {inc.summary || "Belum ada ringkasan"}
              </span>
            </div>

          </div>
        </div>

        {/* ── Panel Kanan: Tanggal + ⋮ — rata tengah vertikal penuh ── */}
        <div className="flex flex-col items-end justify-center shrink-0 border-l border-slate-100 pl-4">
          <span className="text-[10px] text-slate-400 whitespace-nowrap">{inc.created_at}</span>
          <div
            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Lihat ringkasan"
          >
          </div>
        </div>

      </div>
    </Link>);
}
// ─── Ticket Search Result ─────────────────────────────────────────────────────

function TicketSearchResult({ ticket }: { ticket: Record<string, unknown> }) {
  const ff = (ticket.form_fields || ticket.formFields || {}) as Record<string, unknown>;
  const status = String(ticket.status || ticket.status_pengusulan || "OPEN");
  const type = String(ticket.type || "TICKETING");
  const isIncident = type === "INCIDENT";

  const STATUS_LABELS: Record<string, string> = {
    OPEN: "Open",
    PENDING: "Pending",
    DONE: "Done",
    REJECT: "Reject",
    IN_PROGRESS: "In Progress",
    INVESTIGASI: "Investigasi",
    MITIGASI: "Mitigasi",
    RESOLVED: "Resolved",
  };

  const STATUS_DISPLAY: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    OPEN: { bg: "#e0f2fe", text: "#0c4a6e", border: "#7dd3fc", dot: "#0ea5e9" },   // sky
    PENDING: { bg: "#fffbeb", text: "#92400e", border: "#fcd34d", dot: "#f59e0b" },   // amber
    DONE: { bg: "#eff6ff", text: "#1e40af", border: "#93c5fd", dot: "#3b82f6" },   // blue
    APPROVED: { bg: "#f5f3ff", text: "#4c1d95", border: "#c4b5fd", dot: "#7c3aed" },   // violet
    REJECT: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", dot: "#ef4444" },   // red
    IN_PROGRESS: { bg: "#fdf4ff", text: "#701a75", border: "#e879f9", dot: "#d946ef" },   // fuchsia
    INVESTIGASI: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74", dot: "#f97316" },   // orange
    MITIGASI: { bg: "#fdf2f8", text: "#831843", border: "#f9a8d4", dot: "#ec4899" },   // pink
    RESOLVED: { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7", dot: "#10b981" },   // emerald
  };

  const sd = STATUS_DISPLAY[status] || { bg: "#f8fafc", text: "#475569", border: "#cbd5e1", dot: "#94a3b8" };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #d1fae5" }}>
      {/* Header bar */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "#f0fdf4", borderBottom: "1px solid #d1fae5" }}
      >
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 size={14} className="text-emerald-600" />
        </div>
        <p className="text-[13px] font-bold text-emerald-700">Tiket ditemukan!</p>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5" style={{ background: "#fafffe" }}>
        {/* Top row: ID, Type, Status */}
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 pb-4"
          style={{ borderBottom: "1px solid #e8f5e9" }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Tiket</span>
            <span className="text-[15px] font-black text-slate-800">#{String(ticket.id)}</span>
          </div>
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
              <InfoItem label="Reporter" value={String(ff["Reporter Information"] || ff["Name"] || "—")} />
              <InfoItem label="Email" value={String(ff["Email"] || "—")} />
              <InfoItem label="Type Support" value={String(ff["Type of Support Requested"] || "—")} />
            </>
          )}
          {isIncident && (
            <>
              <InfoItem label="Priority" value={String(ff["Priority Incident"] || "—")} />
              <InfoItem label="Severity" value={String(ff["Severity Incident"] || "—")} />
              <InfoItem label="Suspect Area" value={String(ff["Suspect Area"] || "—")} />
            </>
          )}
          {typeof ticket.status_note === "string" && ticket.status_note && (
            <InfoItem label="Catatan Status" value={ticket.status_note} />
          )}
        </div>

        <Link
          href={`/tickets/${String(ticket.id)}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold text-white transition-colors"
          style={{ background: "#374151" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#4b5563")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#374151")}
        >
          Lihat Detail Lengkap <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-[12px] font-medium text-slate-700">{value}</span>
    </div>
  );
}


// ─── Support Form Modal — Multi-Slide dengan Auto-fill Email ─────────────────

const STORAGE_KEY = "sis_reporter_profile";

interface ReporterProfile {
  email: string;
  reporterInfo: string;
  division: string;
  noTelepon: string;
}

function loadProfile(email: string): ReporterProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const profiles: ReporterProfile[] = JSON.parse(raw);
    return profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
  } catch {
    return null;
  }
}

function saveProfile(profile: ReporterProfile) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const profiles: ReporterProfile[] = raw ? JSON.parse(raw) : [];
    const idx = profiles.findIndex((p) => p.email.toLowerCase() === profile.email.toLowerCase());
    if (idx >= 0) profiles[idx] = profile;
    else profiles.push(profile);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch { }
}

export function SupportFormModal({ onClose }: { onClose: () => void }) {
  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short",
  });

  const [slide, setSlide] = useState(1);
  const TOTAL_SLIDES = 3;

  // Slide 1
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);

  // Slide 2
  const [reporterInfo, setReporterInfo] = useState("");
  const [division, setDivision] = useState("");
  const [noTelepon, setNoTelepon] = useState("");

  // Slide 3
  const [idDevice, setIdDevice] = useState("");
  const [ruangan, setRuangan] = useState("");
  const [lantai, setLantai] = useState("");
  const [typeOfSupport, setTypeOfSupport] = useState("");
  const [typeOther, setTypeOther] = useState("");
  const [issue, setIssue] = useState("");
  const [jumlahBarang, setJumlahBarang] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [error, setError] = useState("");

  // ── Slide 1 → 2: cek email & auto-fill ──
  const handleSlide1Next = () => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailError("Email wajib diisi"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Format email tidak valid");
      return;
    }
    setEmailError("");

    // Reset data diri dulu sebelum cek profile
    setReporterInfo("");
    setDivision("");
    setNoTelepon("");
    setAutoFilled(false);

    // Auto-fill dari localStorage
    const profile = loadProfile(trimmed);
    if (profile) {
      setReporterInfo(profile.reporterInfo);
      setDivision(profile.division);
      setNoTelepon(profile.noTelepon);
      setAutoFilled(true);
    }
    setSlide(2);
  };

  // ── Slide 2 → 3 ──
  const handleSlide2Next = () => {
    if (!reporterInfo.trim() || !division.trim() || !noTelepon.trim()) {
      setError("Harap isi semua field yang wajib diisi (*)");
      return;
    }
    setError("");
    setSlide(3);
  };

  // ── File handling ──
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

  // ── Submit ──
  const handleSubmit = async () => {
    if (!ruangan.trim() || !lantai || !typeOfSupport || !issue.trim()) {
      setError("Harap isi semua field yang wajib diisi (*)");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (selectedFile) {
        const fd = new FormData();
        fd.append("file", selectedFile);
        const r = await fetch("/api/tickets/upload", { method: "POST", body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Gagal upload file");
        attachmentUrl = d.url;
      }

      const typeValue = typeOfSupport === "Other" ? (typeOther || "Other") : typeOfSupport;
      const formFields: Record<string, string> = {
        "Reporter Information": reporterInfo,
        "Division": division,
        "No Telepon": noTelepon,
        "Email": email,
        "ID Device": idDevice,
        "Ruangan": ruangan,
        "Lantai": lantai,
        "Tanggal & Waktu Pemohon": now,
        "Type of Support Requested": typeValue,
        "Issue": issue,
        "Jumlah Barang": jumlahBarang,
      };
      if (attachmentUrl) formFields["Attachment"] = attachmentUrl;

      // Simpan profile ke localStorage untuk auto-fill berikutnya
      saveProfile({ email, reporterInfo, division, noTelepon });

      const res = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TICKETING", formFields, createdBy: reporterInfo }),
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

  // ── Success screen ──
  if (success) {
    return (
      <ModalWrapper title="Tiket Support Berhasil Dibuat" onClose={onClose}>
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-2">Tiket Berhasil Dibuat!</p>
          <p className="text-[13px] text-slate-600 mb-2">Nomor tiket Anda:</p>
          <p className="text-3xl font-black text-slate-600 mb-4">#{ticketId}</p>
          <p className="text-[12px] text-slate-500 mb-6">Simpan nomor tiket ini untuk mengecek status.</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/tickets/${ticketId}`} className="px-4 py-2 text-white rounded-lg text-[13px] font-semibold transition-colors"
              style={{ background: "#374151" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#4b5563")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#374151")}>
              Lihat Detail Tiket
            </Link>
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-semibold transition-colors">
              Tutup
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title="Buat Tiket Support" onClose={onClose}>
      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all"
                style={{
                  background: s < slide ? "#374151" : s === slide ? "#374151" : "#e2e8f0",
                  color: s <= slide ? "#fff" : "#94a3b8",
                }}
              >
                {s < slide ? <CheckCircle2 size={14} /> : s}
              </div>
              <div className="text-[10px] font-semibold hidden sm:block" style={{ color: s === slide ? "#374151" : "#94a3b8" }}>
                {s === 1 ? "Email" : s === 2 ? "Data Diri" : "Detail Masalah"}
              </div>
              {s < TOTAL_SLIDES && (
                <div className="flex-1 h-0.5 mx-2" style={{ background: s < slide ? "#374151" : "#e2e8f0" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px] mb-4">{error}</div>
      )}

      {/* ── Slide 1: Email ── */}
      {slide === 1 && (
        <div className="space-y-4">
          <div className="text-center mb-2">
            <p className="text-[13px] text-slate-500">Masukkan email Anda untuk memulai pengisian formulir.</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSlide1Next()}
              placeholder="email@perusahaan.com"
              className="w-full px-3 py-2.5 border rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400"
              style={{ borderColor: emailError ? "#fca5a5" : "#d1d5db" }}
              autoFocus
            />
            {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSlide1Next}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-[13px] font-bold"
              style={{ background: "#374151" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#4b5563")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#374151")}
            >
              Lanjut <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Slide 2: Data Diri ── */}
      {slide === 2 && (
        <div className="space-y-4">
          {autoFilled && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium text-emerald-700" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              Data Anda ditemukan dan telah diisi otomatis. Silakan cek dan ubah jika perlu.
            </div>
          )}
          <div className="text-[12px] text-slate-400 mb-1">Email: <strong className="text-slate-600">{email}</strong></div>
          <FormField label="Nama Lengkap *" type="text" value={reporterInfo} onChange={setReporterInfo} placeholder="Nama lengkap Anda" />
          <FormField label="Division / Departemen *" type="text" value={division} onChange={setDivision} placeholder="Divisi / Departemen" />
          <FormField label="No Telepon *" type="tel" value={noTelepon} onChange={setNoTelepon} placeholder="08xx-xxxx-xxxx" />
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setSlide(1); setError(""); }}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-[13px] font-semibold"
            >
              ← Kembali
            </button>
            <button
              onClick={handleSlide2Next}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-[13px] font-bold"
              style={{ background: "#374151" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#4b5563")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#374151")}
            >
              Lanjut <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Slide 3: Detail Masalah ── */}
      {slide === 3 && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="ID Device" type="text" value={idDevice} onChange={setIdDevice} placeholder="Serial number / asset tag" />
            <FormField label="Ruangan *" type="text" value={ruangan} onChange={setRuangan} placeholder="Nama ruangan" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lantai *</label>
            <select value={lantai} onChange={(e) => setLantai(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
              <option value="">-- Pilih Lantai --</option>
              {FLOOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Type of Support Requested *</label>
            <select value={typeOfSupport} onChange={(e) => setTypeOfSupport(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
              <option value="">-- Pilih Tipe Support --</option>
              {SUPPORT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {typeOfSupport === "Other" && (
              <input type="text" value={typeOther} onChange={(e) => setTypeOther(e.target.value)} placeholder="Jelaskan tipe support lainnya..." className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400" />
            )}
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Issue — Deskripsi Masalah *</label>
            <textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={4} placeholder="Jelaskan masalah yang Anda alami secara detail..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
          <FormField label="Jumlah Barang" type="text" value={jumlahBarang} onChange={setJumlahBarang} placeholder="Contoh: 1 unit laptop" />
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment (Gambar / Screenshot)</label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
              {selectedFile ? (
                <div className="space-y-3">
                  {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-40 rounded-lg border border-slate-200 object-contain" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <ImageIcon size={16} />
                      <span className="text-[13px] font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                      <span className="text-[11px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button onClick={handleRemoveFile} className="text-red-500 hover:text-red-700 p-1"><X size={16} /></button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400 py-2">
                    <Upload size={24} />
                    <p className="text-[13px]">Klik untuk pilih gambar atau screenshot</p>
                    <p className="text-[11px]">JPG, PNG, GIF, WEBP — Maks 5MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setSlide(2); setError(""); }} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-[13px] font-semibold">
              ← Kembali
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-[13px] font-bold"
              style={{ background: "#374151" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#4b5563")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#374151")}
            >
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim Tiket...</> : <><Ticket size={16} /> Kirim Tiket Support</>}
            </button>
          </div>
        </div>

      )}

    </ModalWrapper>

  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function ModalWrapper({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
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
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400" />
    </div>
  );
}