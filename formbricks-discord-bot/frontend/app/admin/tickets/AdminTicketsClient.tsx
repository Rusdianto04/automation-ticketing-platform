"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search, Filter, RefreshCw, ChevronRight, Plus,
  Ticket, Zap, X, CheckCircle2, Upload, Loader2,
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
  OPEN:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:     "bg-amber-50 text-amber-700 border-amber-200",
  DONE:        "bg-slate-100 text-slate-600 border-slate-200",
  REJECT:      "bg-red-50 text-red-700 border-red-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  INVESTIGASI: "bg-orange-50 text-orange-700 border-orange-200",
  MITIGASI:    "bg-purple-50 text-purple-700 border-purple-200",
  RESOLVED:    "bg-teal-50 text-teal-700 border-teal-200",
};

const FLOOR_OPTIONS    = ["Lantai 1", "Lantai 2", "Lantai 3"];
const SUPPORT_OPTIONS  = ["Laptop/PC", "Printer", "Software/Application Error", "Network/Wifi User Issue", "Other"];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];
const SEVERITY_OPTIONS = ["SEV 1: Critical", "SEV 2: High", "SEV 3: Medium", "SEV 4: Low"];

export default function AdminTicketsClient({ tickets }: { tickets: TicketRow[] }) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState<null | "support" | "incident">(null);

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
        matchQ =
          t.title.toLowerCase().includes(ql) ||
          t.requester.toLowerCase().includes(ql);
      }
      return matchStatus && matchType && matchQ;
    });
  }, [tickets, filterStatus, filterType, search]);

  return (
    <div className="space-y-4">
      {/* ── Header Actions ── */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h2 className="text-[16px] font-bold text-slate-800">Manajemen Tiket</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setModal("support")}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-semibold transition-colors"
          >
            <Plus size={14} />
            <Ticket size={13} />
            Tiket Support
          </button>
          <button
            onClick={() => setModal("incident")}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[12px] font-semibold transition-colors"
          >
            <Plus size={14} />
            <Zap size={13} />
            Incident
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-3 flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400 shrink-0" />

        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-slate-500 whitespace-nowrap">Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
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
          <label className="text-[12px] font-semibold text-slate-500 whitespace-nowrap">Type</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
            <option value="">Semua Tipe</option>
            <option value="TICKETING">Support</option>
            <option value="INCIDENT">Incident</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-1 min-w-[200px] max-w-[320px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID, judul, nama pemohon..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
          </div>
        </div>

        <button onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-semibold transition-colors shrink-0">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <p className="text-[12px] text-slate-500">
        Menampilkan <strong className="text-slate-700">{filtered.length}</strong> dari {tickets.length} tiket
      </p>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-16">ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Judul</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reporter</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assignee</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dibuat</th>
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
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${t.type === "INCIDENT" ? "bg-rose-50/30 hover:bg-rose-50" : ""}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-indigo-600 text-[13px]">#{t.id}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="font-medium text-slate-800 truncate" title={t.title}>{t.title}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${t.type === "INCIDENT" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                        {t.type === "INCIDENT" ? "🚨 Incident" : "🎫 Support"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[150px]">
                      <span className="text-slate-600 truncate block" title={t.requester}>{t.requester}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[150px]">
                      <span className="text-slate-500 truncate block text-[12px]">
                        {t.assignee || <span className="text-slate-300 italic">Belum assigned</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{t.created_at}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/tickets/${t.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap">
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

      {/* Modals */}
      {modal === "support" && <AdminSupportFormModal onClose={() => { setModal(null); window.location.reload(); }} />}
      {modal === "incident" && <AdminIncidentFormModal onClose={() => { setModal(null); window.location.reload(); }} />}
    </div>
  );
}

// ─── Admin Support Form Modal ─────────────────────────────────────────────────

function AdminSupportFormModal({ onClose }: { onClose: () => void }) {
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" });
  const [form, setForm] = useState({
    reporterInfo: "", division: "", noTelepon: "", email: "",
    idDevice: "", ruangan: "", lantai: "", tanggalWaktu: now,
    typeOfSupport: "", typeOther: "", issue: "", jumlahBarang: "",
  });
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [ticketId,   setTicketId]   = useState<number | null>(null);
  const [error,      setError]      = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/tickets/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setAttachment({ url: data.url, name: data.name });
      else setError(data.error || "Gagal upload file");
    } catch { setError("Gagal upload file"); }
    finally { setUploading(false); }
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
      if (attachment) formFields["Attachment"] = attachment.url;
      const res = await fetch("/api/tickets/create", {
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
      <ModalWrapper title="Tiket Support Dibuat" onClose={onClose}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-indigo-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-2">Tiket Berhasil Dibuat!</p>
          <p className="text-3xl font-black text-indigo-600 mb-6">#{ticketId}</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/admin/tickets/${ticketId}`} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
              Lihat Detail
            </Link>
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-semibold transition-colors">
              Tutup & Refresh
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title="Buat Tiket Support (Admin)" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AField label="Reporter Information *" type="text" value={form.reporterInfo} onChange={(v) => set("reporterInfo", v)} placeholder="Nama lengkap" />
          <AField label="Division *" type="text" value={form.division} onChange={(v) => set("division", v)} placeholder="Divisi" />
          <AField label="No Telepon *" type="tel" value={form.noTelepon} onChange={(v) => set("noTelepon", v)} placeholder="08xx-xxxx-xxxx" />
          <AField label="Email *" type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="email@domain.com" />
          <AField label="ID Device" type="text" value={form.idDevice} onChange={(v) => set("idDevice", v)} placeholder="Asset tag / serial" />
          <AField label="Ruangan *" type="text" value={form.ruangan} onChange={(v) => set("ruangan", v)} placeholder="Nama ruangan" />
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
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Type of Support Requested *</label>
          <select value={form.typeOfSupport} onChange={(e) => set("typeOfSupport", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200">
            <option value="">-- Pilih Tipe --</option>
            {SUPPORT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {form.typeOfSupport === "Other" && (
            <input type="text" value={form.typeOther} onChange={(e) => set("typeOther", e.target.value)} placeholder="Jelaskan tipe lainnya..." className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
          )}
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Issue *</label>
          <textarea value={form.issue} onChange={(e) => set("issue", e.target.value)} rows={3} placeholder="Deskripsi masalah..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none" />
        </div>
        <AField label="Jumlah Barang" type="text" value={form.jumlahBarang} onChange={(v) => set("jumlahBarang", v)} placeholder="Contoh: 1 unit laptop" />
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-indigo-300 transition-colors">
            {attachment ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 size={16} />
                  <span className="text-[13px]">{attachment.name}</span>
                </div>
                <button onClick={() => setAttachment(null)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
                  <p className="text-[13px]">{uploading ? "Mengupload..." : "Upload gambar / screenshot"}</p>
                  <p className="text-[11px]">JPG, PNG, GIF, WEBP — Maks 5MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFile} disabled={uploading} />
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-[13px] font-bold transition-colors">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Membuat...</> : <><Ticket size={15} /> Buat Tiket Support</>}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold transition-colors">
            Batal
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Admin Incident Form Modal ────────────────────────────────────────────────

function AdminIncidentFormModal({ onClose }: { onClose: () => void }) {
  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short" });
  const [form, setForm] = useState({
    incidentTitle: "", dateTimeIncident: now,
    priorityIncident: "", severityIncident: "",
    suspectArea: "", indicatedIssue: "",
  });
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [ticketId,   setTicketId]   = useState<number | null>(null);
  const [error,      setError]      = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/tickets/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setAttachment({ url: data.url, name: data.name });
      else setError(data.error || "Gagal upload file");
    } catch { setError("Gagal upload file"); }
    finally { setUploading(false); }
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
      const formFields: Record<string, string> = {
        "Incident Title":       form.incidentTitle,
        "Incident Information": form.incidentTitle,
        "Date & Time Incident": form.dateTimeIncident,
        "Priority Incident":    form.priorityIncident,
        "Severity Incident":    form.severityIncident,
        "Suspect Area":         form.suspectArea,
        "Indicated Issue":      form.indicatedIssue,
      };
      if (attachment) formFields["Attachment"] = attachment.url;
      const res = await fetch("/api/tickets/create", {
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
      <ModalWrapper title="Incident Dilaporkan" onClose={onClose}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-rose-600" />
          </div>
          <p className="text-[15px] font-bold text-slate-800 mb-2">Incident Berhasil Dilaporkan!</p>
          <p className="text-3xl font-black text-rose-600 mb-6">#{ticketId}</p>
          <div className="flex gap-2 justify-center">
            <Link href={`/admin/tickets/${ticketId}`} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-semibold transition-colors">
              Lihat Detail
            </Link>
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-semibold transition-colors">
              Tutup & Refresh
            </button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper title="Laporkan Incident (Admin)" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-[13px]">{error}</div>}
        <AField label="Incident Title *" type="text" value={form.incidentTitle} onChange={(v) => set("incidentTitle", v)} placeholder="Judul singkat incident" />
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Date &amp; Time Incident</label>
          <input type="text" value={form.dateTimeIncident} readOnly className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-slate-50 text-slate-600 cursor-not-allowed" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Priority Incident *</label>
            <select value={form.priorityIncident} onChange={(e) => set("priorityIncident", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200">
              <option value="">-- Pilih Priority --</option>
              {PRIORITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Severity Incident *</label>
            <select value={form.severityIncident} onChange={(e) => set("severityIncident", e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200">
              <option value="">-- Pilih Severity --</option>
              {SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <AField label="Suspect Area *" type="text" value={form.suspectArea} onChange={(v) => set("suspectArea", v)} placeholder="Area/sistem yang diduga bermasalah" />
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Indicated Issue *</label>
          <textarea value={form.indicatedIssue} onChange={(e) => set("indicatedIssue", e.target.value)} rows={4} placeholder="Jelaskan indikasi masalah..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 resize-none" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Attachment</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-rose-300 transition-colors">
            {attachment ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 size={16} />
                  <span className="text-[13px]">{attachment.name}</span>
                </div>
                <button onClick={() => setAttachment(null)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
                  <p className="text-[13px]">{uploading ? "Mengupload..." : "Upload gambar / screenshot"}</p>
                  <p className="text-[11px]">JPG, PNG, GIF, WEBP — Maks 5MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFile} disabled={uploading} />
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-[13px] font-bold transition-colors">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Melaporkan...</> : <><Zap size={15} /> Laporkan Incident</>}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[13px] font-semibold transition-colors">
            Batal
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

function AField({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200" />
    </div>
  );
}