"use client";

import { useState, useCallback, useRef } from "react";
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

interface Props {
  incidents: IncidentRow[];
  orgName: string;
  orgDepartment: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  OPEN:        { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" }, // sky-biru
  PENDING:     { background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" }, // amber-kuning
  DONE:        { background: "#eff6ff", color: "#1e40af", border: "1px solid #93c5fd" }, // blue-biru tua
  APPROVED:    { background: "#f5f3ff", color: "#4c1d95", border: "1px solid #c4b5fd" }, // violet-ungu
  REJECT:      { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }, // red-merah
  INVESTIGASI: { background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }, // orange
  MITIGASI:    { background: "#fdf2f8", color: "#831843", border: "1px solid #f9a8d4" }, // pink
  RESOLVED:    { background: "#ecfdf5", color: "#065f46", border: "1px solid #6ee7b7" }, // emerald-hijau
};
const DEFAULT_STATUS_STYLE: React.CSSProperties = {
  background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1",
};
// Tetap dibutuhkan untuk fallback className kosong
const STATUS_COLORS: Record<string, string> = {};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High:     "bg-orange-100 text-orange-800 border border-orange-300",
  Medium:   "bg-amber-100 text-amber-800 border border-amber-300",
  Low:      "bg-green-100 text-green-800 border border-green-300",
  high:     "bg-orange-100 text-orange-800 border border-orange-300",
  medium:   "bg-amber-100 text-amber-800 border border-amber-300",
  low:      "bg-green-100 text-green-800 border border-green-300",
};

// Warna dot priority untuk aksen left border card
const PRIORITY_LEFT_BORDER: Record<string, string> = {
  Critical: "#ef4444",
  High:     "#f97316",
  Medium:   "#f59e0b",
  Low:      "#22c55e",
  high:     "#f97316",
  medium:   "#f59e0b",
  low:      "#22c55e",
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

export default function DashboardClient({ incidents, orgName, orgDepartment }: Props) {
  const [searchId,      setSearchId]      = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [searchResult,  setSearchResult]  = useState<null | { found: boolean; ticket?: Record<string, unknown> }>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [modal,            setModal]            = useState<null | "support" | "incident">(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRow | null>(null);

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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#d9e1f2" }}>

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
        <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-20">

            {/* Kiri: Logo + Teks */}
            <div className="flex items-center gap-4">
              {/* Logo — ukuran diperbesar, padding lebih lega */}
              <div
                className="flex items-center justify-center shrink-0 rounded-xl overflow-hidden"
                style={{
                  width: 52,
                  height: 52,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  padding: 4,
                }}
              >
                <Image
                  src="/logo-seamolec.png"
                  alt="Logo SEAMOLEC"
                  width={44}
                  height={44}
                  className="object-contain"
                  style={{ imageRendering: "crisp-edges" }}
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
        {/* 3 Card Utama — stacked vertikal dengan gap */}
        <div className="space-y-4">

          {/* ═══════════════════════════════════════════════════
              CARD 1 — Buat Tiket Baru (tidak berubah)
          ═══════════════════════════════════════════════════ */}
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)", boxShadow: "0 1px 3px rgba(79,70,229,0.3)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#4338ca")}
                onMouseOut={(e)  => (e.currentTarget.style.background = "linear-gradient(135deg, #4f46e5, #6366f1)")}
              >
                <Ticket size={14} />
                Buat Tiket Support
              </button>
              <button
                onClick={() => setModal("incident")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #e11d48, #f43f5e)", boxShadow: "0 1px 3px rgba(225,29,72,0.3)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#bb1e40")}
                onMouseOut={(e)  => (e.currentTarget.style.background = "linear-gradient(135deg, #e11d48, #f43f5e)")}
              >
                <Zap size={14} />
                Laporkan Incident
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              CARD 2 — Search Cek Status Tiket
          ═══════════════════════════════════════════════════ */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e8eaed" }}>

            {/* Header Card 2 */}
            <div
              className="px-4 sm:px-5 py-3.5"
              style={{ background: "#1e293b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">

                {/* Judul */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                    <FileText size={13} className="text-indigo-600" />
                  </div>
                  <h2 className="text-[13px] font-bold text-white">Cek Status Tiket</h2>
                </div>

                {/* Search bar */}
                <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchTicket()}
                      placeholder="Masukkan ID tiket (contoh: 42)"
                      className="w-full pl-8 pr-3 py-2 text-[12px] bg-white text-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      style={{ border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <button
                    onClick={handleSearchTicket}
                    disabled={searchLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-white whitespace-nowrap"
                    style={{ background: "#4f46e5" }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#4338ca")}
                    onMouseOut={(e)  => (e.currentTarget.style.background = "#4f46e5")}
                  >
                    {searchLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    Cari
                  </button>
                  {isSearchMode && (
                    <button
                      onClick={handleClearSearch}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold text-slate-600 whitespace-nowrap"
                      style={{ background: "#f1f3f5", border: "1px solid #e2e8f0" }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                      onMouseOut={(e)  => (e.currentTarget.style.background = "#f1f3f5")}
                    >
                      <X size={12} />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Hint — hanya tampil saat belum search */}
              {!isSearchMode && (
                <p className="text-[11px] mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Cari tiket support atau incident berdasarkan nomor ID. Contoh:{" "}
                  <span className="font-mono font-semibold text-white">42</span> atau{" "}
                  <span className="font-mono font-semibold text-white">#42</span>
                </p>
              )}
            </div>

            {/* Body Card 2 — hanya muncul setelah user melakukan search */}
            {isSearchMode && (
              <div className="p-4 sm:p-5">
                {searchLoading ? (
                  <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                    <Loader2 size={22} className="animate-spin" />
                    <p className="text-[13px]">Mencari tiket #{searchId}...</p>
                  </div>
                ) : searchResult === null ? null : !searchResult.found ? (
                  <div
                    className="flex items-start gap-3 rounded-xl px-4 py-4"
                    style={{ background: "#fff5f5", border: "1px solid #fecaca" }}
                  >
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={15} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-red-700">Tiket #{searchId} tidak ditemukan</p>
                      <p className="text-[11px] text-red-500 mt-0.5">
                        Pastikan nomor ID tiket Anda benar. ID dapat ditemukan di email konfirmasi.
                      </p>
                    </div>
                  </div>
                ) : (
                  <TicketSearchResult ticket={searchResult.ticket!} />
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════
              CARD 3 — Daftar Incident Aktif
              Setiap incident ditampilkan sebagai card TERPISAH
              (bukan tabel, bukan divisi, tapi card-card sendiri)
          ═══════════════════════════════════════════════════ */}
          <div>
            {/* Tidak ada judul section — langsung list card incident */}
            {incidents.length === 0 ? (
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
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <IncidentCard
                    key={inc.id}
                    inc={inc}
                    onDetail={() => setSelectedIncident(inc)}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full bg-[#0f172a] text-white border-t border-white/10 mt-12">
        <div className="w-full px-4 py-2 text-center space-y-1">
          <p className="text-[15px] text-white/70">
            Copyright © {new Date().getFullYear()} SEAMOLEC, Org.
          </p>
          <div className="flex justify-center flex-wrap gap-2 text-[14px] text-white/60">
            <a href="#" className="hover:text-white transition-colors">Legal</a>
            <span>|</span>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <span>|</span>
            <a href="#" className="hover:text-white transition-colors">Security</a>
            <span>|</span>
            <a href="#" className="hover:text-white transition-colors">Accessibility</a>
            <span>|</span>
            <a href="#" className="hover:text-white transition-colors">Cookies</a>
          </div>
        </div>
      </footer>

      {modal === "support"  && <SupportFormModal  onClose={() => setModal(null)} />}
      {modal === "incident" && <IncidentFormModal onClose={() => setModal(null)} />}
      {selectedIncident     && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Incident Card — tampilan card terpisah per incident ──────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function IncidentCard({ inc, onDetail }: { inc: IncidentRow; onDetail: () => void }) {
  return (
    <Link
      href={`/tickets/${inc.id}`}
      className="block bg-white overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px active:scale-[0.99]"
      style={{ border: "1px solid #e2e8f0", borderRadius: "10px" }}
    >
      {/* Flex row: konten kiri (flex-1) + panel kanan (tanggal + ⋮) */}
      <div className="flex items-stretch px-5 py-3 gap-4">

        {/* ── Konten Kiri ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">

          {/* Baris 1: Judul */}
          <p className="font-bold text-slate-800 text-[13px] leading-tight truncate">
            {inc.title}
          </p>

          {/* Baris 2: Kolom-kolom info */}
          <div className="flex items-center gap-0 w-full">

            {/* Kolom: ID */}
            <div className="flex flex-col items-start gap-0.5 pr-4 border-r border-slate-100" style={{ minWidth: 44 }}>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">ID</span>
              <span
                className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded"
                style={{ color: "#1e293b", background: "#f1f5f9" }}
              >
                #{inc.id}
              </span>
            </div>

            {/* Kolom: Status */}
            <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 90 }}>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Status</span>
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={STATUS_STYLE[inc.status] || DEFAULT_STATUS_STYLE}
              >
                {inc.status}
              </span>
            </div>

            {/* Kolom: Type */}
            <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 80 }}>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Type</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }}
              >
                <AlertTriangle size={9} />
                Incident
              </span>
            </div>

            {/* Kolom: Priority */}
            <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 80 }}>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Priority</span>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  PRIORITY_COLORS[inc.priority] || "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {inc.priority}
              </span>
            </div>

            {/* Kolom: Severity */}
            {inc.severity && inc.severity !== "—" && (
              <div className="flex flex-col items-start gap-0.5 px-4 border-r border-slate-100" style={{ minWidth: 100 }}>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Severity</span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                >
                  {inc.severity}
                </span>
              </div>
            )}

            {/* Kolom: Area */}
            {inc.suspect_area && inc.suspect_area !== "—" && (
              <div className="flex flex-col items-start gap-0.5 px-4 flex-1 min-w-0">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Area</span>
                <span className="text-[10px] text-slate-600 font-medium truncate w-full">
                  {inc.suspect_area}
                </span>
              </div>
            )}

          </div>
        </div>

        {/* ── Panel Kanan: Tanggal + ⋮ — rata tengah vertikal penuh ── */}
        <div className="flex flex-col items-end justify-center gap-1.5 shrink-0 border-l border-slate-100 pl-4">
          <span className="text-[10px] text-slate-400 whitespace-nowrap">{inc.created_at}</span>
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDetail();
            }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Lihat ringkasan"
          >
            <MoreVertical size={14} />
          </div>
        </div>

      </div>
    </Link>
  );
}
// ─── Ticket Search Result ─────────────────────────────────────────────────────

function TicketSearchResult({ ticket }: { ticket: Record<string, unknown> }) {
  const ff         = (ticket.form_fields || ticket.formFields || {}) as Record<string, unknown>;
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
    OPEN:        { bg: "#e0f2fe", text: "#0c4a6e", border: "#7dd3fc", dot: "#0ea5e9" },   // sky
    PENDING:     { bg: "#fffbeb", text: "#92400e", border: "#fcd34d", dot: "#f59e0b" },   // amber
    DONE:        { bg: "#eff6ff", text: "#1e40af", border: "#93c5fd", dot: "#3b82f6" },   // blue
    APPROVED:    { bg: "#f5f3ff", text: "#4c1d95", border: "#c4b5fd", dot: "#7c3aed" },   // violet
    REJECT:      { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", dot: "#ef4444" },   // red
    IN_PROGRESS: { bg: "#fdf4ff", text: "#701a75", border: "#e879f9", dot: "#d946ef" },   // fuchsia
    INVESTIGASI: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74", dot: "#f97316" },   // orange
    MITIGASI:    { bg: "#fdf2f8", text: "#831843", border: "#f9a8d4", dot: "#ec4899" },   // pink
    RESOLVED:    { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7", dot: "#10b981" },   // emerald
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
          {typeof ticket.status_note === "string" && ticket.status_note && (
            <InfoItem label="Catatan Status" value={ticket.status_note} />
          )}
        </div>

        <Link
          href={`/tickets/${String(ticket.id)}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold text-white transition-colors"
          style={{ background: "#0f172a" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#0a0f1a")}
          onMouseOut={(e)  => (e.currentTarget.style.background = "#0f172a")}
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

// ─── Incident Detail Modal (popup ringkasan via tombol ⋮) ─────────────────────

function IncidentDetailModal({ incident, onClose }: { incident: IncidentRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600" />
            <h3 className="text-[15px] font-bold text-slate-800">Detail Incident #{incident.id}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Judul Incident</p>
            <p className="text-[15px] font-bold text-slate-800">{incident.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Priority</p>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[12px] font-semibold ${PRIORITY_COLORS[incident.priority] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                {incident.priority}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Severity</p>
              <p className="text-[13px] font-semibold text-slate-700">{incident.severity}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Status</p>
              <span
                className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                style={STATUS_STYLE[incident.status] || DEFAULT_STATUS_STYLE}
              >
                {incident.status}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Tanggal</p>
              <p className="text-[13px] text-slate-700">{incident.created_at}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Suspect Area</p>
            <p className="text-[13px] text-slate-700">{incident.suspect_area}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Indicated Issue</p>
            <p className="text-[13px] text-slate-700">{incident.indicated_issue}</p>
          </div>
          <div className="pt-2">
            <Link
              href={`/tickets/${incident.id}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors"
              style={{ background: "#0f172a" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#0a0f1a")}
              onMouseOut={(e)  => (e.currentTarget.style.background = "#0f172a")}
            >
              Lihat Detail Lengkap <ChevronRight size={14} />
            </Link>
          </div>
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
    idDevice: "", ruangan: "", lantai: "",
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
        "Tanggal & Waktu Pemohon":   now,
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
      <ModalWrapper title="Tiket Support Berhasil Dibuat" onClose={onClose}>
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-2">Tiket Berhasil Dibuat!</p>
          <p className="text-[13px] text-slate-600 mb-2">Nomor tiket Anda:</p>
          <p className="text-3xl font-black text-indigo-600 mb-4">#{ticketId}</p>
          <p className="text-[12px] text-slate-500 mb-6">Simpan nomor tiket ini untuk mengecek status.</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/tickets/${ticketId}`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
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
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Reporter Information *" type="text"  value={form.reporterInfo} onChange={(v) => set("reporterInfo", v)} placeholder="Nama lengkap Anda" />
          <FormField label="Division *"             type="text"  value={form.division}     onChange={(v) => set("division", v)}     placeholder="Divisi / Departemen" />
          <FormField label="No Telepon *"           type="tel"   value={form.noTelepon}    onChange={(v) => set("noTelepon", v)}    placeholder="08xx-xxxx-xxxx" />
          <FormField label="Email *"                type="email" value={form.email}        onChange={(v) => set("email", v)}        placeholder="email@perusahaan.com" />
          <FormField label="ID Device"              type="text"  value={form.idDevice}     onChange={(v) => set("idDevice", v)}     placeholder="Serial number / asset tag" />
          <FormField label="Ruangan *"              type="text"  value={form.ruangan}      onChange={(v) => set("ruangan", v)}      placeholder="Nama ruangan" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lantai *</label>
          <select value={form.lantai} onChange={(e) => set("lantai", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
            <option value="">-- Pilih Lantai --</option>
            {FLOOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Type of Support Requested *</label>
          <select value={form.typeOfSupport} onChange={(e) => set("typeOfSupport", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
            <option value="">-- Pilih Tipe Support --</option>
            {SUPPORT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {form.typeOfSupport === "Other" && (
            <input type="text" value={form.typeOther} onChange={(e) => set("typeOther", e.target.value)} placeholder="Jelaskan tipe support lainnya..." className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400" />
          )}
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Issue — Description of the Issue *</label>
          <textarea value={form.issue} onChange={(e) => set("issue", e.target.value)} rows={4} placeholder="Jelaskan masalah yang Anda alami secara detail..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 resize-none" />
        </div>
        <FormField label="Jumlah Barang" type="text" value={form.jumlahBarang} onChange={(v) => set("jumlahBarang", v)} placeholder="Contoh: 1 unit laptop" />
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
                <p className="text-[11px] text-slate-400">File akan diupload saat tiket dikirim</p>
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
        <div className="flex gap-2 pt-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl text-[13px] font-bold"
            style={{ background: submitting ? "#818cf8" : "#4f46e5" }}>
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim Tiket...</> : <><Ticket size={16} /> Kirim Tiket Support</>}
          </button>
          <button onClick={onClose} className="px-4 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold">
            Batal
          </button>
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
    incidentTitle: "",
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
        "Date & Time Incident": now,
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
      <ModalWrapper title="Incident Berhasil Dilaporkan" onClose={onClose}>
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap size={32} className="text-rose-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-2">Incident Berhasil Dilaporkan!</p>
          <p className="text-[13px] text-slate-600 mb-2">Nomor tiket incident Anda:</p>
          <p className="text-3xl font-black text-rose-600 mb-4">#{ticketId}</p>
          <p className="text-[12px] text-slate-500 mb-6">Tim IT akan segera menangani incident ini.</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/tickets/${ticketId}`} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
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
    <ModalWrapper title="Laporkan Incident" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}
        <FormField label="Incident Title *" type="text" value={form.incidentTitle} onChange={(v) => set("incidentTitle", v)} placeholder="Judul singkat incident yang terjadi" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Priority Incident *</label>
            <select value={form.priorityIncident} onChange={(e) => set("priorityIncident", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400">
              <option value="">-- Pilih Priority --</option>
              {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Severity Incident *</label>
            <select value={form.severityIncident} onChange={(e) => set("severityIncident", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400">
              <option value="">-- Pilih Severity --</option>
              {SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <FormField label="Suspect Area *" type="text" value={form.suspectArea} onChange={(v) => set("suspectArea", v)} placeholder="Area/sistem yang diduga menjadi penyebab" />
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Indicated Issue *</label>
          <textarea value={form.indicatedIssue} onChange={(e) => set("indicatedIssue", e.target.value)} rows={4} placeholder="Jelaskan indikasi masalah / gejala incident yang terjadi..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400 resize-none" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment (Gambar / Screenshot)</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-rose-300 transition-colors">
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
                <p className="text-[11px] text-slate-400">File akan diupload saat tiket dikirim</p>
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
        <div className="flex gap-2 pt-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl text-[13px] font-bold"
            style={{ background: submitting ? "#f87171" : "#e11d48" }}>
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim...</> : <><Zap size={16} /> Laporkan Incident</>}
          </button>
          <button onClick={onClose} className="px-4 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold">
            Batal
          </button>
        </div>
      </div>
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