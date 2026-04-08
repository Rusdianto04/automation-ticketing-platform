"use client";

import { useState, useMemo, useCallback, useRef, ReactNode } from "react";
import Link from "next/link";
import {
  Ticket, AlertCircle, Clock, CheckCircle2, XCircle,
  Search, RefreshCw, Shield, TrendingUp, Activity,
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
  todayTotal: number;
  openCount: number;
  pendingCount: number;
  doneCount: number;
  incidentCount: number;
  rejectCount: number;
}

interface Props {
  incidents: IncidentRow[];
  stats: Stats;
  orgName: string;
  orgDepartment: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:     "bg-amber-50 text-amber-700 border-amber-200",
  DONE:        "bg-slate-100 text-slate-600 border-slate-200",
  REJECT:      "bg-red-50 text-red-700 border-red-200",
  INVESTIGASI: "bg-orange-50 text-orange-700 border-orange-200",
  MITIGASI:    "bg-purple-50 text-purple-700 border-purple-200",
  RESOLVED:    "bg-teal-50 text-teal-700 border-teal-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-300",
  High:     "bg-orange-100 text-orange-700 border-orange-300",
  Medium:   "bg-amber-100 text-amber-700 border-amber-300",
  Low:      "bg-green-100 text-green-700 border-green-300",
  high:     "bg-orange-100 text-orange-700 border-orange-300",
  medium:   "bg-amber-100 text-amber-700 border-amber-300",
  low:      "bg-green-100 text-green-700 border-green-300",
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

// ─── Upload Helper — upload file ke server, return URL ────────────────────────
// Dipanggil HANYA saat submit, bukan saat user pilih file
async function uploadFileToServer(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/tickets/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Gagal upload file");
  return data.url as string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardClient({ incidents, stats, orgName, orgDepartment }: Props) {
  const [searchId, setSearchId]           = useState("");
  const [searchResult, setSearchResult]   = useState<null | { found: boolean; ticket?: Record<string, unknown> }>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [modal, setModal]                 = useState<null | "support" | "incident">(null);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRow | null>(null);

  const handleRefresh = useCallback(() => window.location.reload(), []);

  const handleSearchTicket = useCallback(async () => {
    const rawId = searchId.trim().replace(/^#/, "");
    if (!rawId || !/^\d+$/.test(rawId)) {
      alert("Masukkan nomor ID tiket yang valid (contoh: 42 atau #42)");
      return;
    }
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
  }, [searchId]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* ── Header ── */}
      <header
        className="text-white shadow-lg sticky top-0 z-30"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.25)" }}>
                <Shield size={20} className="text-indigo-300" />
              </div>
              <div>
                <h1 className="text-[15px] font-bold tracking-wide text-white">Support &amp; Incident Portal</h1>
                <p className="text-[11px] text-slate-400 leading-none mt-0.5">{orgName} &mdash; {orgDepartment}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/login" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] text-slate-300 hover:text-white hover:bg-white/10 transition-all">
                <Settings size={14} />
                <span className="hidden sm:inline">Admin Panel</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Tiket"  value={stats.total}         icon={<Ticket size={18} />}       color="indigo" />
          <StatCard label="Open"         value={stats.openCount}     icon={<Activity size={18} />}     color="emerald" />
          <StatCard label="Pending"      value={stats.pendingCount}  icon={<Clock size={18} />}        color="amber" />
          <StatCard label="Done"         value={stats.doneCount}     icon={<CheckCircle2 size={18} />} color="slate" />
          <StatCard label="Reject"       value={stats.rejectCount}   icon={<XCircle size={18} />}      color="red" />
          <StatCard label="Incident"     value={stats.incidentCount} icon={<AlertCircle size={18} />}  color="rose" />
        </div>

        {/* ── Cek Status Tiket by ID ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={18} className="text-indigo-600" />
            <h2 className="text-[15px] font-bold text-slate-800">Cek Status Tiket Support</h2>
          </div>
          <p className="text-[13px] text-slate-500 mb-4">
            Masukkan nomor ID tiket Anda untuk melihat status terkini. Nomor ID dapat ditemukan di email konfirmasi atau notifikasi yang Anda terima.
          </p>
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchTicket()}
                placeholder="Masukkan ID Tiket (contoh: 42)"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
              />
            </div>
            <button
              onClick={handleSearchTicket}
              disabled={searchLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-[13px] font-semibold transition-colors"
            >
              {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Cari
            </button>
          </div>

          {searchResult && (
            <div className={`mt-4 rounded-lg border p-4 ${searchResult.found ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              {!searchResult.found ? (
                <div className="flex items-center gap-2 text-red-700">
                  <XCircle size={16} />
                  <p className="text-[13px] font-semibold">Tiket tidak ditemukan. Pastikan ID tiket Anda benar.</p>
                </div>
              ) : (
                <TicketSearchResult ticket={searchResult.ticket!} />
              )}
            </div>
          )}
        </div>

        {/* ── Buat Tiket Baru ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={18} className="text-indigo-600" />
            <h2 className="text-[15px] font-bold text-slate-800">Buat Tiket Baru</h2>
          </div>
          <p className="text-[13px] text-slate-500 mb-4">
            Pilih jenis tiket yang ingin Anda buat. Tiket support untuk masalah teknis perangkat/aplikasi, tiket incident untuk kejadian gangguan sistem.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setModal("support")}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Ticket size={16} />
              Buat Tiket Support
            </button>
            <button
              onClick={() => setModal("incident")}
              className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Zap size={16} />
              Laporkan Incident
            </button>
          </div>
        </div>

        {/* ── Daftar Incident Aktif ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600" />
              <h2 className="text-[15px] font-bold text-slate-800">Incident Aktif &amp; Terkini</h2>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">{incidents.length}</span>
            </div>
            <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>

          {incidents.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <CheckCircle2 size={40} strokeWidth={1.5} className="text-emerald-400" />
                <p className="text-[14px] font-semibold text-slate-600">Tidak ada incident aktif</p>
                <p className="text-[12px]">Semua sistem berjalan normal</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-16">ID</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Judul Incident</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Severity</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-rose-50/40 transition-colors bg-rose-50/20">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-rose-600 text-[13px]">#{inc.id}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <p className="font-semibold text-slate-800 truncate" title={inc.title}>{inc.title}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5" title={inc.suspect_area}>Area: {inc.suspect_area}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${PRIORITY_COLORS[inc.priority] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {inc.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-slate-600 font-medium">{inc.severity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[inc.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {inc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{inc.created_at}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedIncident(inc)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
                        >
                          Detail <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="text-center text-[11px] text-slate-400 py-4">
          {orgName} &mdash; {orgDepartment} &bull; Support &amp; Incident Management Portal
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
  const status = String(ticket.status || ticket.status_pengusulan || "OPEN");
  const type   = String(ticket.type || "TICKETING");
  const isIncident = type === "INCIDENT";

  const STATUS_LABELS: Record<string, string> = {
    OPEN: "Open", PENDING: "Pending", DONE: "Done", REJECT: "Reject",
    IN_PROGRESS: "In Progress", INVESTIGASI: "Investigasi", MITIGASI: "Mitigasi", RESOLVED: "Resolved",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 size={16} className="text-emerald-600" />
        <p className="text-[13px] font-bold text-emerald-700">Tiket ditemukan!</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <InfoItem label="ID Tiket"  value={`#${String(ticket.id)}`} />
        <InfoItem label="Tipe">
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${isIncident ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
            {isIncident ? "🚨 Incident" : "🎫 Support"}
          </span>
        </InfoItem>
        <InfoItem label="Status">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {STATUS_LABELS[status] || status}
          </span>
        </InfoItem>

        {/* Support fields */}
        {!isIncident && (
          <>
            <InfoItem label="Reporter"     value={String(ff["Reporter Information"] || ff["Name"] || "—")} />
            <InfoItem label="Email"        value={String(ff["Email"] || "—")} />
            <InfoItem label="Type Support" value={String(ff["Type of Support Requested"] || "—")} />
          </>
        )}

        {/* Incident fields */}
        {isIncident && (
          <>
            <InfoItem label="Priority"    value={String(ff["Priority Incident"] || "—")} />
            <InfoItem label="Severity"    value={String(ff["Severity Incident"] || "—")} />
            <InfoItem label="Suspect Area" value={String(ff["Suspect Area"] || "—")} />
          </>
        )}

        {/* Catatan status jika ada */}
        {typeof ticket.status_note === "string" && (
          <InfoItem label="Catatan Status" value={ticket.status_note} />
        )}
      </div>

      <Link
        href={`/tickets/${String(ticket.id)}`}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[12px] font-semibold transition-colors"
      >
        Lihat Detail Lengkap <ChevronRight size={13} />
      </Link>
    </div>
  );
}

function InfoItem({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-0.5">{label}</p>
      {children || <p className="text-[13px] text-slate-800 font-medium">{value || "—"}</p>}
    </div>
  );
}

// ─── Incident Detail Modal ────────────────────────────────────────────────────

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
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[12px] font-semibold border ${PRIORITY_COLORS[incident.priority] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {incident.priority}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Severity</p>
              <p className="text-[13px] font-semibold text-slate-700">{incident.severity}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Status</p>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[incident.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
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
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
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
// FIX: File disimpan di state sebagai File object, TIDAK langsung upload ke server.
// Upload hanya terjadi saat tombol "Kirim Tiket Support" diklik.
// Ini mencegah file orphan di server jika user batal atau ganti file.

function SupportFormModal({ onClose }: { onClose: () => void }) {
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" });

  const [form, setForm] = useState({
    reporterInfo: "", division: "", noTelepon: "", email: "",
    idDevice: "", ruangan: "", lantai: "", tanggalWaktu: now,
    typeOfSupport: "", typeOther: "", issue: "", jumlahBarang: "",
  });

  // Simpan File object di state — belum diupload ke server
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]     = useState<string | null>(null);
  const fileInputRef                       = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [ticketId,   setTicketId]   = useState<number | null>(null);
  const [error,      setError]      = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Hanya simpan file di state lokal — TIDAK upload ke server di sini
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi tipe file
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
    if (!allowed.includes(file.type)) {
      setError("Tipe file tidak didukung. Gunakan: JPG, PNG, GIF, WEBP");
      return;
    }
    // Validasi ukuran (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB");
      return;
    }

    setError("");
    setSelectedFile(file);

    // Buat preview URL lokal menggunakan URL.createObjectURL — TANPA upload
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
      // Upload file ke server HANYA saat submit
      let attachmentUrl: string | null = null;
      if (selectedFile) {
        attachmentUrl = await uploadFileToServer(selectedFile);
      }

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

      const res = await fetch("/api/tickets/create", {
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
      <ModalWrapper title="Tiket Support Berhasil Dibuat" onClose={onClose} icon={<CheckCircle2 size={20} className="text-emerald-600" />}>
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-2">Tiket Berhasil Dibuat!</p>
          <p className="text-[13px] text-slate-600 mb-2">Nomor tiket Anda:</p>
          <p className="text-3xl font-black text-indigo-600 mb-4">#{ticketId}</p>
          <p className="text-[12px] text-slate-500 mb-6">Simpan nomor tiket ini untuk mengecek status tiket Anda.</p>
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
    <ModalWrapper title="Buat Tiket Support" onClose={onClose} icon={<Ticket size={18} className="text-indigo-600" />}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Reporter Information *" type="text" value={form.reporterInfo} onChange={(v) => set("reporterInfo", v)} placeholder="Nama lengkap Anda" />
          <FormField label="Division *" type="text" value={form.division} onChange={(v) => set("division", v)} placeholder="Divisi / Departemen" />
          <FormField label="No Telepon *" type="tel" value={form.noTelepon} onChange={(v) => set("noTelepon", v)} placeholder="08xx-xxxx-xxxx" />
          <FormField label="Email *" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="email@perusahaan.com" />
          <FormField label="ID Device" type="text" value={form.idDevice} onChange={(v) => set("idDevice", v)} placeholder="Serial number / asset tag" />
          <FormField label="Ruangan *" type="text" value={form.ruangan} onChange={(v) => set("ruangan", v)} placeholder="Nama ruangan" />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lantai *</label>
          <select value={form.lantai} onChange={(e) => set("lantai", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
            <option value="">-- Pilih Lantai --</option>
            {FLOOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Tanggal &amp; Waktu Pemohon</label>
          <input type="text" value={form.tanggalWaktu} readOnly className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-slate-50 text-slate-600 cursor-not-allowed" />
          <p className="text-[11px] text-slate-400 mt-1">Terisi otomatis dari sistem</p>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Type of Support Requested *</label>
          <select value={form.typeOfSupport} onChange={(e) => set("typeOfSupport", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
            <option value="">-- Pilih Tipe Support --</option>
            {SUPPORT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {form.typeOfSupport === "Other" && (
            <input type="text" value={form.typeOther} onChange={(e) => set("typeOther", e.target.value)} placeholder="Jelaskan tipe support lainnya..." className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
          )}
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Issue — Description of the Issue *</label>
          <textarea value={form.issue} onChange={(e) => set("issue", e.target.value)} rows={4} placeholder="Jelaskan masalah yang Anda alami secara detail..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none" />
        </div>

        <FormField label="Jumlah Barang" type="text" value={form.jumlahBarang} onChange={(v) => set("jumlahBarang", v)} placeholder="Contoh: 1 unit laptop" />

        {/* Attachment — preview lokal, belum upload ke server */}
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment (Gambar / Screenshot)</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
            {selectedFile ? (
              <div className="space-y-3">
                {/* Preview lokal dari URL.createObjectURL */}
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="max-h-40 rounded-lg border border-slate-200 object-contain" />
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Image size={16} />
                    <span className="text-[13px] font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-[11px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={handleRemoveFile} className="text-red-500 hover:text-red-700 transition-colors p-1">
                    <X size={16} />
                  </button>
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

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-[13px] font-bold transition-colors"
          >
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim Tiket...</> : <><Ticket size={16} /> Kirim Tiket Support</>}
          </button>
          <button onClick={onClose} className="px-4 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold transition-colors">
            Batal
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Incident Form Modal ──────────────────────────────────────────────────────
// FIX: Sama seperti SupportFormModal — upload hanya saat submit

function IncidentFormModal({ onClose }: { onClose: () => void }) {
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" });

  const [form, setForm] = useState({
    incidentTitle: "", dateTimeIncident: now,
    priorityIncident: "", severityIncident: "",
    suspectArea: "", indicatedIssue: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const fileInputRef                     = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [ticketId,   setTicketId]   = useState<number | null>(null);
  const [error,      setError]      = useState("");

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
      // Upload file ke server HANYA saat submit
      let attachmentUrl: string | null = null;
      if (selectedFile) {
        attachmentUrl = await uploadFileToServer(selectedFile);
      }

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

      const res = await fetch("/api/tickets/create", {
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
      <ModalWrapper title="Incident Berhasil Dilaporkan" onClose={onClose} icon={<CheckCircle2 size={20} className="text-emerald-600" />}>
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
    <ModalWrapper title="Laporkan Incident" onClose={onClose} icon={<Zap size={18} className="text-rose-600" />}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}

        <FormField label="Incident Title *" type="text" value={form.incidentTitle} onChange={(v) => set("incidentTitle", v)} placeholder="Judul singkat incident yang terjadi" />

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Date &amp; Time Incident</label>
          <input type="text" value={form.dateTimeIncident} readOnly className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-slate-50 text-slate-600 cursor-not-allowed" />
          <p className="text-[11px] text-slate-400 mt-1">Terisi otomatis dari sistem</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Priority Incident *</label>
            <select value={form.priorityIncident} onChange={(e) => set("priorityIncident", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
              <option value="">-- Pilih Priority --</option>
              {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Severity Incident *</label>
            <select value={form.severityIncident} onChange={(e) => set("severityIncident", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
              <option value="">-- Pilih Severity --</option>
              {SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <FormField label="Suspect Area *" type="text" value={form.suspectArea} onChange={(v) => set("suspectArea", v)} placeholder="Area/sistem yang diduga menjadi penyebab" />

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Indicated Issue *</label>
          <textarea value={form.indicatedIssue} onChange={(e) => set("indicatedIssue", e.target.value)} rows={4} placeholder="Jelaskan indikasi masalah / gejala incident yang terjadi..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none" />
        </div>

        {/* Attachment — preview lokal, belum upload ke server */}
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment (Gambar / Screenshot)</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-rose-300 transition-colors">
            {selectedFile ? (
              <div className="space-y-3">
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="max-h-40 rounded-lg border border-slate-200 object-contain" />
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Image size={16} />
                    <span className="text-[13px] font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-[11px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={handleRemoveFile} className="text-red-500 hover:text-red-700 transition-colors p-1">
                    <X size={16} />
                  </button>
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

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-[13px] font-bold transition-colors"
          >
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim...</> : <><Zap size={16} /> Laporkan Incident</>}
          </button>
          <button onClick={onClose} className="px-4 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold transition-colors">
            Batal
          </button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
          </div>
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
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
    </div>
  );
}

function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode;
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