"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2, Search, Plus, ChevronRight, X,
  Upload, Loader2, AlertTriangle, Ticket, MoreVertical,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

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
  reporter?: string;
}

interface Props {
  incidents: IncidentRow[];
  allTickets: IncidentRow[];
  orgName: string;
  orgDepartment: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12;
const STORAGE_KEY = "sis_reporter_profile";

function normalizeStatusForDisplay(status: string): { label: string; style: React.CSSProperties } {
  const inProgress = ["INVESTIGASI", "MITIGASI", "APPROVED", "IN_PROGRESS", "PENDING"];
  const closed = ["RESOLVED", "DONE", "REJECT"];
  if (inProgress.includes(status)) {
    return { label: "In Progress", style: { background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" } };
  }
  if (closed.includes(status)) {
    return { label: "Closed", style: { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" } };
  }
  return { label: "Open", style: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" } };
}

const FLOOR_OPTIONS = ["Lantai 1", "Lantai 2", "Lantai 3"];
const SUPPORT_TYPE_OPTIONS = [
  "Laptop/PC", "Printer", "Software/Application Error",
  "Network/Wifi User Issue", "Other",
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardClient({ allTickets, orgName, orgDepartment }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get("filter") as "INCIDENT" | "TICKETING" | "CLOSED") || "INCIDENT";
  const initialSearch = searchParams.get("q") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filterType, setFilterType] = useState<"INCIDENT" | "TICKETING" | "CLOSED">(initialFilter);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE * initialPage);
  const [modal, setModal] = useState<null | "support">(null);

  const syncUrl = useCallback((filter: string, q: string, page: number) => {
    const params = new URLSearchParams();
    params.set("filter", filter);
    if (q) params.set("q", q);
    if (page > 1) params.set("page", String(page));
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  }, [router]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const inProgress = ["INVESTIGASI", "MITIGASI", "APPROVED", "IN_PROGRESS", "PENDING"];
    const closed = ["RESOLVED", "DONE", "REJECT"];

    return allTickets.filter((inc) => {
      let normalizedStatus: "OPEN" | "IN_PROGRESS" | "CLOSED" = "OPEN";
      if (inProgress.includes(inc.status)) normalizedStatus = "IN_PROGRESS";
      if (closed.includes(inc.status)) normalizedStatus = "CLOSED";

      if (q) {
        const numericQ = q.replace(/^#/, "");
        if (/^\d+$/.test(numericQ)) {
          return inc.id === parseInt(numericQ, 10);
        }
        const emailMatch = (inc.reporter || "").toLowerCase().includes(q);
        const titleMatch = inc.title.toLowerCase().includes(q);
        return emailMatch || titleMatch;
      }

      if (filterType === "CLOSED") return normalizedStatus === "CLOSED";
      if (filterType === "INCIDENT") return inc.type === "INCIDENT" && normalizedStatus !== "CLOSED";
      return inc.type === "TICKETING" && normalizedStatus !== "CLOSED";
    });
  }, [allTickets, filterType, searchQuery]);

  const visibleTickets = filteredTickets.slice(0, visibleCount);
  const hasMore = visibleCount < filteredTickets.length;

  const handleLoadMore = useCallback(() => {
    const nextCount = visibleCount + PAGE_SIZE;
    setVisibleCount(nextCount);
    syncUrl(filterType, searchQuery, Math.ceil(nextCount / PAGE_SIZE));
  }, [visibleCount, filterType, searchQuery, syncUrl]);

  const handleFilterChange = useCallback((type: "INCIDENT" | "TICKETING" | "CLOSED") => {
    setFilterType(type);
    setVisibleCount(PAGE_SIZE);
    setSearchQuery("");
    syncUrl(type, "", 1);
  }, [syncUrl]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setVisibleCount(PAGE_SIZE);
    syncUrl(filterType, val, 1);
  }, [filterType, syncUrl]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f1f5f9" }}>

      {/* ══════════════════════════════════════════
          HEADER — Background putih, font gelap
      ══════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px" }}>
          <div className="flex items-center h-16 gap-3">
            {/* Logo */}
            <div
              className="flex items-center justify-center shrink-0 rounded-xl overflow-hidden"
              style={{ width: 40, height: 40 }}
            >
              <Image
                src="/logo-seamolec.png"
                alt="Logo"
                width={36}
                height={36}
                className="object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = "/logo-seamolec.ico"; }}
              />
            </div>

            {/* Title */}
            <div className="flex flex-col gap-0">
              <h1
                className="text-[15px] font-extrabold leading-tight tracking-tight"
                style={{ color: "#0f172a" }}
              >
                Support &amp; Incident Portal
              </h1>
              <p className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>
                {orgName}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6" style={{ maxWidth: 860, margin: "0 auto", width: "100%", padding: "24px 20px" }}>

        {/* ── Filter Tabs ── */}
        <div className="flex items-center gap-2 mb-4">
          {(["INCIDENT", "TICKETING", "CLOSED"] as const).map((type) => {
            const labels = { INCIDENT: "Incident", TICKETING: "Support", CLOSED: "Closed" };
            const active = filterType === type && !searchQuery;
            return (
              <button
                key={type}
                onClick={() => handleFilterChange(type)}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
                style={{
                  background: active ? "#0f172a" : "#fff",
                  color: active ? "#fff" : "#64748b",
                  border: active ? "1px solid #0f172a" : "1px solid #e2e8f0",
                }}
              >
                {labels[type]}
              </button>
            );
          })}
        </div>

        {/* ── Search + Buat Ticket ── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari berdasarkan ID (#123)..."
              className="w-full pl-9 pr-8 py-2.5 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none"
              style={{ border: "1px solid #e2e8f0" }}
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setModal("support")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-bold text-white shrink-0"
            style={{ background: "#0f172a", border: "1px solid #1e293b" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#0f172a")}
          >
            <Plus size={14} />
            Buat Ticket
          </button>
        </div>

        {/* ── Ticket List ── */}
        {visibleTickets.length === 0 ? (
          <div
            className="bg-white rounded-xl px-5 py-16 text-center"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center" style={{ border: "1px solid #e2e8f0" }}>
                <CheckCircle2 size={22} strokeWidth={1.5} className="text-slate-300" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-600 mb-1">Tidak ada ticket ditemukan</p>
                <p className="text-[12px] text-slate-400">Coba ubah filter atau kata kunci pencarian</p>
              </div>
              <button
                onClick={() => setModal("support")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white mt-1"
                style={{ background: "#0f172a" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#1e293b")}
                onMouseOut={(e) => (e.currentTarget.style.background = "#0f172a")}
              >
                <Plus size={13} />
                Buat Ticket
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTickets.map((inc) => (
              <TicketCard
                key={inc.id}
                inc={inc}
                filterType={filterType}
                searchQuery={searchQuery}
                visibleCount={visibleCount}
              />
            ))}
          </div>
        )}

        {/* ── Next >> ── */}
        {hasMore && (
          <div className="flex justify-end mt-4">
            <button
              onClick={handleLoadMore}
              className="px-5 py-2 rounded-lg text-[12px] font-semibold text-slate-600 bg-white transition-colors hover:bg-slate-50"
              style={{ border: "1px solid #e2e8f0" }}
              >
               Load More ↓
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-40 h-px" style={{ background: "linear-gradient(90deg, transparent, #94a3b8, transparent)" }} />
          <p className="text-[11px] text-slate-400 tracking-wider">
            Copyright © {new Date().getFullYear()} SEAMOLEC, Org.
          </p>
        </div>
      </footer>

      {modal === "support" && <SupportFormModal onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ inc, filterType, searchQuery, visibleCount }: {
  inc: IncidentRow;
  filterType: string;
  searchQuery: string;
  visibleCount: number;
}) {
  const statusDisplay = normalizeStatusForDisplay(inc.status);
  const reporter = inc.reporter || "—";

  return (
    <Link
      href={`/tickets/${inc.id}`}
      onClick={() => {
        sessionStorage.setItem("dashboard_state", JSON.stringify({ filterType, searchQuery, visibleCount }));
      }}
      className="block bg-white rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ border: "1px solid #e2e8f0" }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.border = "1px solid #cbd5e1";
        (e.currentTarget as HTMLAnchorElement).style.background = "#fafafa";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.border = "1px solid #e2e8f0";
        (e.currentTarget as HTMLAnchorElement).style.background = "#ffffff";
      }}
    >
      <div className="px-5 py-4">
        {/* Baris 1: Judul + ikon titik 3 */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="font-bold text-slate-800 text-[14px] leading-snug truncate flex-1">
            {inc.title}
          </p>
          <span className="shrink-0 flex items-center justify-center rounded-md" style={{ color: "#cbd5e1" }}>
            <MoreVertical size={16} strokeWidth={2} />
          </span>
        </div>

        {/* Baris 2: Meta fields */}
        <div className="grid gap-x-4 gap-y-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {/* ID */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">ID</span>
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded w-fit" style={{ background: "#f1f5f9", color: "#475569" }}>
              #{inc.id}
            </span>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Type</span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit"
              style={
                inc.type === "INCIDENT"
                  ? { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }
                  : { background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" }
              }
            >
              {inc.type === "INCIDENT"
                ? <><AlertTriangle size={9} /> Incident</>
                : <><Ticket size={9} /> Support</>}
            </span>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Status</span>
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold w-fit" style={statusDisplay.style}>
              {statusDisplay.label}
            </span>
          </div>

          {/* Reporter — hanya untuk TICKETING */}
          {inc.type === "TICKETING" && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Reporter</span>
              <span className="text-[11px] text-slate-600 font-medium truncate">{reporter}</span>
            </div>
          )}

          {/* Area — hanya untuk INCIDENT */}
          {inc.type === "INCIDENT" && inc.suspect_area && inc.suspect_area !== "—" && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Area</span>
              <span className="text-[11px] text-slate-600 font-medium truncate">{inc.suspect_area}</span>
            </div>
          )}

          {/* Tanggal */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Tanggal</span>
            <span className="text-[11px] text-slate-500">{inc.created_at}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Support Form Modal ───────────────────────────────────────────────────────

interface ReporterProfile {
  email: string;
  reporterInfo: string;
  division: string;
  noTelepon: string;
}

function getAllEmails(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const profiles: ReporterProfile[] = JSON.parse(raw);
    return profiles.map((p) => p.email).filter(Boolean);
  } catch { return []; }
}

function loadProfile(email: string): ReporterProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const profiles: ReporterProfile[] = JSON.parse(raw);
    return profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
  } catch { return null; }
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
  const TOTAL_SLIDES = 2;

  const [email, setEmail] = useState("");
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [reporterInfo, setReporterInfo] = useState("");
  const [division, setDivision] = useState("");
  const [noTelepon, setNoTelepon] = useState("");

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

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setAutoFilled(false);
    if (val.length >= 1) {
      const all = getAllEmails();
      const filtered = all.filter((e) => e.toLowerCase().includes(val.toLowerCase()));
      setEmailSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setEmailSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectEmail = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setShowSuggestions(false);
    const profile = loadProfile(selectedEmail);
    if (profile) {
      setReporterInfo(profile.reporterInfo);
      setDivision(profile.division);
      setNoTelepon(profile.noTelepon);
      setAutoFilled(true);
    }
  };

  useEffect(() => {
    if (email) {
      const profile = loadProfile(email);
      if (profile) {
        setReporterInfo(profile.reporterInfo);
        setDivision(profile.division);
        setNoTelepon(profile.noTelepon);
        setAutoFilled(true);
      } else {
        setAutoFilled(false);
      }
    }
  }, []);

  const handleSlide1Next = () => {
    const trimmed = email.trim();
    if (!trimmed) { setError("Email wajib diisi"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError("Format email tidak valid"); return; }
    if (!reporterInfo.trim() || !division.trim() || !noTelepon.trim()) {
      setError("Harap isi semua field yang wajib diisi (*)"); return;
    }
    setError("");
    setSlide(2);
  };

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
    if (!ruangan.trim() || !lantai || !typeOfSupport || !issue.trim()) {
      setError("Harap isi semua field yang wajib diisi (*)"); return;
    }
    setError(""); setSubmitting(true);
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
    } finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <ModalWrapper title="Tiket Berhasil Dibuat" onClose={onClose}>
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-slate-700" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-1">Tiket Berhasil Dibuat!</p>
          <p className="text-[12px] text-slate-500 mb-1">Nomor tiket Anda:</p>
          <p className="text-3xl font-black text-slate-700 mb-4">#{ticketId}</p>
          <p className="text-[11px] text-slate-400 mb-6">Simpan nomor ini untuk mengecek status.</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/tickets/${ticketId}`}
              className="px-4 py-2 text-white rounded-lg text-[13px] font-semibold"
              style={{ background: "#0f172a" }}>
              Lihat Detail
            </Link>
            <button onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold">
              Tutup
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title="Buat Tiket Support" onClose={onClose}>
      {/* Progress */}
      <div className="mb-5">
        <div className="flex items-center">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: s <= slide ? "#0f172a" : "#e2e8f0", color: s <= slide ? "#fff" : "#94a3b8" }}
              >
                {s < slide ? <CheckCircle2 size={13} /> : s}
              </div>
              <span className="text-[10px] font-semibold ml-1.5 hidden sm:inline"
                style={{ color: s === slide ? "#0f172a" : "#94a3b8" }}>
                {s === 1 ? "Identitas" : "Detail Masalah"}
              </span>
              {s < TOTAL_SLIDES && (
                <div className="flex-1 h-0.5 mx-3" style={{ background: s < slide ? "#0f172a" : "#e2e8f0" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[12px] mb-4">
          {error}
        </div>
      )}

      {/* Slide 1 */}
      {slide === 1 && (
        <div className="space-y-4">
          {autoFilled && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium text-slate-600"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <CheckCircle2 size={13} className="text-slate-500 shrink-0" />
              Data Anda ditemukan dan diisi otomatis.
            </div>
          )}
          <div className="relative">
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Email *</label>
            <input
              type="email" value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => emailSuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="email@perusahaan.com" autoFocus
              className="w-full px-3 py-2.5 border rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none"
              style={{ borderColor: "#e2e8f0" }}
            />
            {showSuggestions && emailSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg z-50 overflow-hidden"
                style={{ border: "1px solid #e2e8f0" }}>
                {emailSuggestions.map((em) => (
                  <button key={em} onMouseDown={() => handleSelectEmail(em)}
                    className="w-full text-left px-3 py-2 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors">
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
          <FormField label="Nama Lengkap *" type="text" value={reporterInfo} onChange={setReporterInfo} placeholder="Nama lengkap Anda" />
          <FormField label="Division / Departemen *" type="text" value={division} onChange={setDivision} placeholder="Divisi / Departemen" />
          <FormField label="No Telepon *" type="tel" value={noTelepon} onChange={setNoTelepon} placeholder="08xx-xxxx-xxxx" />
          <button
            onClick={handleSlide1Next}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-white rounded-lg text-[13px] font-bold"
            style={{ background: "#0f172a" }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#1e293b")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#0f172a")}
          >
            Lanjut <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Slide 2 */}
      {slide === 2 && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="ID Device" type="text" value={idDevice} onChange={setIdDevice} placeholder="Serial number / asset tag" />
            <FormField label="Ruangan *" type="text" value={ruangan} onChange={setRuangan} placeholder="Nama ruangan" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lantai *</label>
            <select value={lantai} onChange={(e) => setLantai(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none">
              <option value="">-- Pilih Lantai --</option>
              {FLOOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Type of Support Requested *</label>
            <select value={typeOfSupport} onChange={(e) => setTypeOfSupport(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none">
              <option value="">-- Pilih Tipe Support --</option>
              {SUPPORT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {typeOfSupport === "Other" && (
              <input type="text" value={typeOther} onChange={(e) => setTypeOther(e.target.value)}
                placeholder="Jelaskan tipe support lainnya..."
                className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none" />
            )}
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Issue — Deskripsi Masalah *</label>
            <textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={4}
              placeholder="Jelaskan masalah yang Anda alami secara detail..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none resize-none" />
          </div>
          <FormField label="Jumlah Barang" type="text" value={jumlahBarang} onChange={setJumlahBarang} placeholder="Contoh: 1 unit laptop" />
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment (Gambar / Screenshot)</label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
              {selectedFile ? (
                <div className="space-y-3">
                  {previewUrl && (
                    <img src={previewUrl} alt="Preview"
                      className="max-h-40 rounded-lg border border-slate-200 object-contain" />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-600 truncate max-w-[200px]">{selectedFile.name}</span>
                    <button onClick={handleRemoveFile} className="text-red-400 hover:text-red-600 p-1">
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400 py-2">
                    <Upload size={20} />
                    <p className="text-[12px]">Klik untuk pilih gambar atau screenshot</p>
                    <p className="text-[11px]">JPG, PNG, GIF, WEBP — Maks 5MB</p>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setSlide(1); setError(""); }}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-[13px] font-semibold">
              ← Kembali
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white rounded-lg text-[13px] font-bold"
              style={{ background: "#0f172a" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#1e293b")}
              onMouseOut={(e) => (e.currentTarget.style.background = "#0f172a")}
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> Mengirim...</>
                : <><Ticket size={15} /> Kirim Tiket Support</>
              }
            </button>
          </div>
        </div>
      )}
    </ModalWrapper>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function ModalWrapper({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-[14px] font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={17} className="text-slate-500" />
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
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none"
      />
    </div>
  );
}