"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search, Filter, RefreshCw, ChevronRight, Plus,
  Ticket, Zap, X, CheckCircle2, Upload, Loader2, Image,
  ChevronDown,
} from "lucide-react";

interface TicketRow {
  id: number;
  type: string;
  title: string;
  status: string;
  requester: string;
  assignee: string;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDING:     "bg-amber-100 text-amber-700 border-amber-200",
  DONE:        "bg-slate-100 text-slate-600 border-slate-200",
  REJECT:      "bg-red-100 text-red-700 border-red-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  APPROVED:    "bg-blue-100 text-blue-700 border-blue-200",
  INVESTIGASI: "bg-orange-100 text-orange-700 border-orange-200",
  MITIGASI:    "bg-purple-100 text-purple-700 border-purple-200",
  RESOLVED:    "bg-teal-100 text-teal-700 border-teal-200",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "OPEN", PENDING: "PENDING", DONE: "DONE", REJECT: "REJECT",
  IN_PROGRESS: "IN_PROGRESS", APPROVED: "IN_PROGRESS",
  INVESTIGASI: "INVESTIGASI", MITIGASI: "MITIGASI", RESOLVED: "RESOLVED",
};

const FLOOR_OPTIONS    = ["Lantai 1", "Lantai 2", "Lantai 3"];
const SUPPORT_OPTIONS  = ["Laptop/PC", "Printer", "Software/Application Error", "Network/Wifi User Issue", "Other"];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
const SEVERITY_OPTIONS = ["SEV 1: Critical", "SEV 2: High", "SEV 3: Medium", "SEV 4: Low"];

const PAGE_SIZE = 12;

async function uploadFileToServer(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res  = await fetch("/api/tickets/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Gagal upload file");
  return data.url as string;
}

function getNowWIB(): string {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default function AdminTicketsClient({ tickets }: { tickets: TicketRow[] }) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState<null | "support" | "incident">(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus = !filterStatus || t.status === filterStatus;
      const matchType   = !filterType   || t.type   === filterType;
      const q = search.trim();
      if (!q) return matchStatus && matchType;
      const numericQ = q.replace(/^#/, "").trim();
      const isNumeric = /^\d+$/.test(numericQ);
      let matchQ: boolean;
      if (isNumeric) {
        matchQ = t.id === parseInt(numericQ, 10);
      } else {
        const ql = q.toLowerCase();
        matchQ = t.title.toLowerCase().includes(ql) || t.requester.toLowerCase().includes(ql);
      }
      return matchStatus && matchType && matchQ;
    });
  }, [tickets, filterStatus, filterType, search]);

  // Reset visible count kalau filter berubah
  const prevFilterKey = useRef("");
  const filterKey = `${filterStatus}|${filterType}|${search}`;
  if (filterKey !== prevFilterKey.current) {
    prevFilterKey.current = filterKey;
    if (visibleCount !== PAGE_SIZE) setVisibleCount(PAGE_SIZE);
  }

  const visibleTickets = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const remaining = filtered.length - visibleCount;

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Sticky Header ── */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="pl-10 sm:pl-0">
            <h1 className="text-[16px] font-bold text-slate-800">Manajemen Tiket</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Menampilkan <strong className="text-slate-600">{visibleTickets.length}</strong> dari{" "}
              <strong className="text-slate-600">{filtered.length}</strong> tiket
              {filtered.length !== tickets.length && (
                <span className="text-slate-400"> (total {tickets.length})</span>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setModal("support")}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-semibold transition-colors shadow-sm">
              <Plus size={14} /><Ticket size={13} />
              <span className="hidden sm:inline">Tiket Support</span>
            </button>
            <button onClick={() => setModal("incident")}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[12px] font-semibold transition-colors shadow-sm">
              <Plus size={14} /><Zap size={13} />
              <span className="hidden sm:inline">Incident</span>
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 space-y-4">

        {/* ── Filter Bar ── */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap gap-3 items-center">
          <Filter size={15} className="text-slate-400 shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
              <option value="">Semua Status</option>
              <option value="OPEN">Open</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="INVESTIGASI">Investigasi</option>
              <option value="MITIGASI">Mitigasi</option>
              <option value="DONE">Done</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECT">Reject</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
              <option value="">Semua Tipe</option>
              <option value="TICKETING">Support</option>
              <option value="INCIDENT">Incident</option>
            </select>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-1 min-w-[160px] max-w-xs">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari ID, judul, pemohon..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[12px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[12px] font-semibold transition-colors shrink-0">
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ minWidth: "700px" }}>
              <thead>
                <tr className="bg-slate-800 text-slate-100">
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-16">ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Judul</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-28">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-28">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-32">Reporter</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-32 hidden lg:table-cell">Assignee</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider w-28 hidden md:table-cell">Dibuat</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <Ticket size={40} strokeWidth={1.5} />
                        <p className="text-[14px] font-medium">Tidak ada tiket ditemukan</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleTickets.map((t, idx) => (
                    <tr key={t.id} className={`transition-colors hover:bg-slate-50 ${t.type === "INCIDENT" ? "bg-rose-50/20 hover:bg-rose-50/40" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                      <td className="px-4 py-3"><span className="font-mono font-bold text-indigo-600 text-[13px]">#{t.id}</span></td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-semibold text-slate-800 truncate text-[13px]" title={t.title}>{t.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${t.type === "INCIDENT" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                          {t.type === "INCIDENT" ? "🚨 Incident" : "🎫 Support"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[120px]">
                        <span className="text-slate-600 truncate block text-[12px]">{t.requester || "—"}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[120px] hidden lg:table-cell">
                        <span className="text-slate-500 truncate block text-[12px]">
                          {t.assignee || <span className="text-slate-300 italic text-[11px]">Belum assigned</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap hidden md:table-cell">{t.created_at}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/tickets/${t.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap">
                          Detail <ChevronRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Load More Button ── */}
          {hasMore && (
            <div className="border-t border-slate-100 px-4 py-4 flex items-center justify-center gap-3">
              <button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors shadow-sm"
              >
                <ChevronDown size={15} />
                Lihat Selanjutnya
                <span className="bg-indigo-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  +{Math.min(PAGE_SIZE, remaining)}
                </span>
              </button>
              <span className="text-[12px] text-slate-400">
                {remaining} tiket lagi
              </span>
            </div>
          )}
          {!hasMore && filtered.length > PAGE_SIZE && (
            <div className="text-center py-3 text-[12px] text-slate-300 border-t border-slate-100">
              Semua {filtered.length} tiket telah ditampilkan
            </div>
          )}
        </div>
      </div>

      {modal === "support"  && <AdminSupportFormModal  onClose={() => { setModal(null); window.location.reload(); }} />}
      {modal === "incident" && <AdminIncidentFormModal onClose={() => { setModal(null); window.location.reload(); }} />}
    </div>
  );
}

// ─── Admin Support Form Modal ──────────────────────────────────────────────────

function AdminSupportFormModal({ onClose }: { onClose: () => void }) {
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
      setError("Harap isi semua field wajib (*)");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (selectedFile) attachmentUrl = await uploadFileToServer(selectedFile);
      const typeValue = form.typeOfSupport === "Other" ? (form.typeOther || "Other") : form.typeOfSupport;
      const tanggalWaktu = getNowWIB();
      const formFields: Record<string, string> = {
        "Reporter Information":      form.reporterInfo,
        "Division":                  form.division,
        "No Telepon":                form.noTelepon,
        "Email":                     form.email,
        "ID Device":                 form.idDevice,
        "Ruangan":                   form.ruangan,
        "Lantai":                    form.lantai,
        "Tanggal & Waktu Pemohon":   tanggalWaktu,
        "Type of Support Requested": typeValue,
        "Issue":                     form.issue,
        "Jumlah Barang":             form.jumlahBarang,
      };
      if (attachmentUrl) formFields["Attachment"] = attachmentUrl;
      const res  = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "TICKETING", formFields, createdBy: `admin:${form.reporterInfo}` }),
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
      <ModalWrap title="Tiket Support Dibuat" onClose={onClose}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-indigo-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-1">Tiket Berhasil Dibuat!</p>
          <p className="text-[13px] text-slate-500 mb-2">Email konfirmasi dikirim ke <strong>{form.email}</strong></p>
          <p className="text-3xl font-black text-indigo-600 mb-6">#{ticketId}</p>
          <div className="flex gap-2 justify-center">
            <a href={`/admin/tickets/${ticketId}`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors">Lihat Detail</a>
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-semibold transition-colors">Tutup & Refresh</button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  return (
    <ModalWrap title="Buat Tiket Support (Admin)" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AField label="Reporter Information *" type="text"  value={form.reporterInfo} onChange={(v) => set("reporterInfo", v)} placeholder="Nama lengkap" />
          <AField label="Division *"             type="text"  value={form.division}     onChange={(v) => set("division", v)}     placeholder="Divisi / Departemen" />
          <AField label="No Telepon *"           type="tel"   value={form.noTelepon}    onChange={(v) => set("noTelepon", v)}    placeholder="08xx-xxxx-xxxx" />
          <AField label="Email *"                type="email" value={form.email}        onChange={(v) => set("email", v)}        placeholder="email@domain.com" />
          <AField label="ID Device"              type="text"  value={form.idDevice}     onChange={(v) => set("idDevice", v)}     placeholder="Asset tag / serial" />
          <AField label="Ruangan *"              type="text"  value={form.ruangan}      onChange={(v) => set("ruangan", v)}      placeholder="Nama ruangan" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lantai *</label>
          <select value={form.lantai} onChange={(e) => set("lantai", e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
            <option value="">-- Pilih Lantai --</option>
            {FLOOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Type of Support Requested *</label>
          <select value={form.typeOfSupport} onChange={(e) => set("typeOfSupport", e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
            <option value="">-- Pilih Tipe --</option>
            {SUPPORT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {form.typeOfSupport === "Other" && (
            <input type="text" value={form.typeOther} onChange={(e) => set("typeOther", e.target.value)}
              placeholder="Jelaskan tipe lainnya..."
              className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400" />
          )}
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Issue — Deskripsi Masalah *</label>
          <textarea value={form.issue} onChange={(e) => set("issue", e.target.value)} rows={3}
            placeholder="Deskripsi masalah secara detail..."
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 resize-none" />
        </div>
        <AField label="Jumlah Barang" type="text" value={form.jumlahBarang} onChange={(v) => set("jumlahBarang", v)} placeholder="Contoh: 1 unit laptop" />
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment (Gambar / Screenshot)</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
            {selectedFile ? (
              <div className="space-y-3">
                {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-36 rounded-lg border border-slate-200 object-contain" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Image size={15} />
                    <span className="text-[12px] font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-[11px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={handleRemoveFile} className="text-red-500 hover:text-red-700 p-1"><X size={15} /></button>
                </div>
                <p className="text-[11px] text-slate-400">File akan diupload saat tiket dikirim</p>
              </div>
            ) : (
              <label className="cursor-pointer block text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400 py-1">
                  <Upload size={22} />
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
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-[13px] font-bold transition-colors">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim...</> : <><Ticket size={15} /> Buat Tiket Support</>}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold transition-colors">Batal</button>
        </div>
      </div>
    </ModalWrap>
  );
}

// ─── Admin Incident Form Modal ─────────────────────────────────────────────────

function AdminIncidentFormModal({ onClose }: { onClose: () => void }) {
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
      setError("Harap isi semua field wajib (*)");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      let attachmentUrl: string | null = null;
      if (selectedFile) attachmentUrl = await uploadFileToServer(selectedFile);
      const dateTimeIncident = getNowWIB();
      const formFields: Record<string, string> = {
        "Incident Title":       form.incidentTitle,
        "Incident Information": form.incidentTitle,
        "Date & Time Incident": dateTimeIncident,
        "Priority Incident":    form.priorityIncident,
        "Severity Incident":    form.severityIncident,
        "Suspect Area":         form.suspectArea,
        "Indicated Issue":      form.indicatedIssue,
      };
      if (attachmentUrl) formFields["Attachment"] = attachmentUrl;
      const res  = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "INCIDENT", formFields, createdBy: "admin_portal" }),
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
      <ModalWrap title="Incident Dilaporkan" onClose={onClose}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-rose-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-2">Incident Berhasil Dilaporkan!</p>
          <p className="text-3xl font-black text-rose-600 mb-6">#{ticketId}</p>
          <div className="flex gap-2 justify-center">
            <a href={`/admin/tickets/${ticketId}`} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-semibold transition-colors">Lihat Detail</a>
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-semibold transition-colors">Tutup & Refresh</button>
          </div>
        </div>
      </ModalWrap>
    );
  }

  return (
    <ModalWrap title="Laporkan Incident (Admin)" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}
        <AField label="Incident Title *" type="text" value={form.incidentTitle} onChange={(v) => set("incidentTitle", v)} placeholder="Judul singkat incident" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Priority Incident *</label>
            <select value={form.priorityIncident} onChange={(e) => set("priorityIncident", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400">
              <option value="">-- Pilih Priority --</option>
              {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Severity Incident *</label>
            <select value={form.severityIncident} onChange={(e) => set("severityIncident", e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400">
              <option value="">-- Pilih Severity --</option>
              {SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <AField label="Suspect Area *" type="text" value={form.suspectArea} onChange={(v) => set("suspectArea", v)} placeholder="Area/sistem yang bermasalah" />
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Indicated Issue *</label>
          <textarea value={form.indicatedIssue} onChange={(e) => set("indicatedIssue", e.target.value)} rows={4}
            placeholder="Jelaskan indikasi masalah..."
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400 resize-none" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment (Gambar / Screenshot)</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-rose-300 transition-colors">
            {selectedFile ? (
              <div className="space-y-3">
                {previewUrl && <img src={previewUrl} alt="Preview" className="max-h-36 rounded-lg border border-slate-200 object-contain" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Image size={15} />
                    <span className="text-[12px] font-medium truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-[11px] text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={handleRemoveFile} className="text-red-500 hover:text-red-700 p-1"><X size={15} /></button>
                </div>
                <p className="text-[11px] text-slate-400">File akan diupload saat tiket dikirim</p>
              </div>
            ) : (
              <label className="cursor-pointer block text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400 py-1">
                  <Upload size={22} />
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
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-[13px] font-bold transition-colors">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Melaporkan...</> : <><Zap size={15} /> Laporkan Incident</>}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold transition-colors">Batal</button>
        </div>
      </div>
    </ModalWrap>
  );
}

// ─── Shared ────────────────────────────────────────────────────────────────────

function ModalWrap({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function AField({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400" />
    </div>
  );
}