"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft, Save, UserCheck, RefreshCw, CheckCircle2,
  XCircle, Clock, Pencil, X, ExternalLink, FileText,
  Paperclip, Image as ImageIcon, AlertTriangle,
} from "lucide-react";
import {
  adminUpdateStatusAction,
  adminReassignAction,
  adminUpdateTicketDataAction,
  adminUpdateFormFieldsAction,
} from "../../actions";

interface Activity {
  id: number;
  type: string;
  description: string;
  created_at: string;
}

interface SimilarTicketItem {
  ticketId:       number;
  title:          string;
  summaryPreview: string | null;
  summary:        string | null;
  rootCause:      string | null;
  timeline:       string | null;
  resolvedAt:     string | null;
  threadUrl:      string | null;
}

interface RunbookItem {
  title:          string;
  category:       string;
  contentPreview: string | null;
  content:        string;
  successRate:    number;
}

interface TopSuggestion {
  source:     string;
  ticketId?:  number;
  title?:     string;
  summary?:   string;
  rootCause?: string;
  timeline?:  string;
  content?:   string;
  threadUrl?: string;
}

interface Recommendation {
  found:          boolean;
  isIncident:     boolean;
  label:          string;
  totalSimilar:   number;
  totalRunbooks:  number;
  similarTickets: SimilarTicketItem[];
  runbooks:       RunbookItem[];
  topSuggestion:  TopSuggestion | null;
}

interface TicketDetail {
  id: number;
  type: string;
  title: string;
  status: string;
  status_note: string;
  requester: string;
  form_fields: Record<string, string>;
  assignee: string[];
  summary_ticket: string;
  root_cause: string;
  discord: { threadUrl?: string; threadId?: string };
  report_url: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  activities: Activity[];
  recommendation?: Recommendation | null;
}

const STATUS_OPTIONS_SUPPORT  = ["OPEN", "PENDING", "DONE", "REJECT"] as const;
const STATUS_OPTIONS_INCIDENT = ["OPEN", "INVESTIGASI", "MITIGASI", "RESOLVED"] as const;

const STATUS_LABELS_SUPPORT: Record<string, string> = {
  OPEN:    "🔄 In Progress",
  PENDING: "⏳ Pending",
  DONE:    "✔️ Done",
  REJECT:  "❌ Reject",
};

const STATUS_LABELS_INCIDENT: Record<string, string> = {
  OPEN:        "✅ Open",
  INVESTIGASI: "🔍 Investigasi",
  MITIGASI:    "🛡️ Mitigasi",
  RESOLVED:    "✅ Resolved",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:     "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED:    "bg-blue-50 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  DONE:        "bg-slate-100 text-slate-600 border-slate-200",
  REJECT:      "bg-red-50 text-red-700 border-red-200",
  REJECTED:    "bg-red-50 text-red-700 border-red-200",
  INVESTIGASI: "bg-orange-50 text-orange-700 border-orange-200",
  MITIGASI:    "bg-purple-50 text-purple-700 border-purple-200",
  RESOLVED:    "bg-teal-50 text-teal-700 border-teal-200",
};

const STATUS_BADGE_LABELS: Record<string, string> = {
  OPEN:        "In Progress",
  PENDING:     "Pending",
  APPROVED:    "In Progress",
  IN_PROGRESS: "In Progress",
  DONE:        "Done",
  REJECT:      "Reject",
  REJECTED:    "Reject",
  INVESTIGASI: "Investigasi",
  MITIGASI:    "Mitigasi",
  RESOLVED:    "Resolved",
};

function normalizeStatusForUI(rawStatus: string, isIncident: boolean): string {
  if (!isIncident) {
    if (rawStatus === "APPROVED" || rawStatus === "IN_PROGRESS") return "OPEN";
    if (rawStatus === "REJECTED" || rawStatus === "REJECT")      return "REJECT";
  }
  return rawStatus;
}

function formatActivityDescription(description: string, type: string): string {
  if (!description) return type;
  let d = description;
  d = d.replace(/peppermint[_ ]portal/gi, "Portal");
  d = d.replace(/Tiket dibuat dari Portal/gi, "Ticket dibuat melalui Portal Users");
  d = d.replace(/Tiket dibuat dari admin_portal/gi, "Ticket dibuat melalui Portal Admin");
  d = d.replace(/Tiket dibuat dari static_portal/gi, "Ticket dibuat melalui Portal Users");
  d = d.replace(/Tiket dibuat dari Portal oleh admin:/gi, "Ticket dibuat oleh Admin:");
  d = d.replace(/Tiket dibuat dari Portal oleh/gi, "Ticket dibuat oleh");
  d = d.replace(/peppermint/gi, "Portal");
  return d;
}

export default function AdminTicketDetailClient({ ticket }: { ticket: TicketDetail }) {
  const isIncident    = ticket.type === "INCIDENT";
  const statusOptions = isIncident ? STATUS_OPTIONS_INCIDENT : STATUS_OPTIONS_SUPPORT;
  const doneStatus    = isIncident ? "RESOLVED" : "DONE";

  const [status, setStatus] = useState(() =>
    normalizeStatusForUI(ticket.status, isIncident)
  );

  const [assigneeInput, setAssigneeInput] = useState(ticket.assignee.join(", "));
  const [editingTicket, setEditingTicket] = useState(false);
  const [requesterEdit, setRequesterEdit] = useState(ticket.requester);
  const [editingForm,   setEditingForm]   = useState(false);
  const [formEdits,     setFormEdits]     = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(ticket.form_fields).map(([k, v]) => [
        k,
        Array.isArray(v) ? (v as string[]).join(", ") : (v || ""),
      ])
    )
  );

  // ── Summary / Root Cause / Timeline ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timelineData = ((ticket as any).timeline_action_taken || (ticket as any).timeline_tindak_lanjut || "") as string;

  const [summaryValue,   setSummaryValue]   = useState(ticket.summary_ticket || "");
  const [rootCauseValue, setRootCauseValue] = useState(ticket.root_cause || "");
  const [timelineValue,  setTimelineValue]  = useState(timelineData || "");

  const [editingSummary,   setEditingSummary]   = useState(false);
  const [editingRootCause, setEditingRootCause] = useState(false);
  const [editingTimeline,  setEditingTimeline]  = useState(false);

  // ── KUNCI LOGIKA BARU ─────────────────────────────────────────────────────
  // `doneSelected` = true ketika admin mengklik tombol DONE atau RESOLVED.
  // Card langsung merah saat ini. Tombol Simpan Status disabled jika belum komplit.
  // Reset ke false jika admin memilih status lain.
  const [doneSelected, setDoneSelected] = useState(false);

  const [message,   setMessage]   = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    if (type === "success") setTimeout(() => setMessage(null), 3500);
  };

  const summaryFilled    = summaryValue.trim().length > 0;
  const rootCauseFilled  = rootCauseValue.trim().length > 0;
  const timelineFilled   = timelineValue.trim().length > 0;
  const allRequiredFilled = summaryFilled && rootCauseFilled && timelineFilled;

  // Card merah aktif saat: tombol Done/Resolved sudah diklik DAN field masih kosong
  const showSummaryError   = doneSelected && !summaryFilled;
  const showRootCauseError = doneSelected && !rootCauseFilled;
  const showTimelineError  = doneSelected && !timelineFilled;

  // Tombol Simpan Status disabled jika: Done dipilih tapi belum semua field terisi
  const saveDisabled = isPending || (doneSelected && !allRequiredFilled);

  // Handler klik tombol status
  const handleSetStatus = (s: string) => {
    setStatus(s);
    if (s === doneStatus) {
      // Aktifkan mode doneSelected → card langsung merah jika kosong
      setDoneSelected(true);
      // Scroll halus ke area card jika ada yang kosong
      if (!allRequiredFilled) {
        setTimeout(() => window.scrollTo({ top: 350, behavior: "smooth" }), 50);
      }
    } else {
      // Pilih status lain → reset, card kembali normal
      setDoneSelected(false);
    }
  };

  const handleUpdateStatus = () => {
    if (saveDisabled) return;
    startTransition(async () => {
      const statusToSave = (!isIncident && status === "OPEN") ? "APPROVED" : status;
      const result = await adminUpdateStatusAction(
        ticket.id,
        statusToSave as "OPEN" | "PENDING" | "APPROVED" | "DONE" | "REJECT"
      );
      if (result?.error) showMsg("error", result.error);
      else showMsg("success", "Status berhasil diperbarui dan disinkronkan ke Discord.");
    });
  };

  const statusLabels    = isIncident ? STATUS_LABELS_INCIDENT : STATUS_LABELS_SUPPORT;
  const rawStatus       = ticket.status;
  const badgeLabel      = isIncident
    ? (STATUS_LABELS_INCIDENT[rawStatus] || rawStatus).replace(/^[^\w]*/, "").trim()
    : (STATUS_BADGE_LABELS[rawStatus] || rawStatus);
  const badgeColorClass = STATUS_COLORS[rawStatus] || "bg-slate-100 text-slate-600 border-slate-200";

  const handleReassign = () => {
    const assignees = assigneeInput.split(",").map((s) => s.trim()).filter(Boolean);
    startTransition(async () => {
      const result = await adminReassignAction(ticket.id, assignees);
      if (result?.error) showMsg("error", result.error);
      else showMsg("success", "Assignee berhasil diperbarui dan disinkronkan ke Discord.");
    });
  };

  const handleSaveTicketData = () => {
    startTransition(async () => {
      const result = await adminUpdateTicketDataAction(ticket.id, { requester: requesterEdit });
      if (result?.error) showMsg("error", result.error);
      else { showMsg("success", "Data Ticket berhasil disimpan."); setEditingTicket(false); }
    });
  };

  const handleSaveFormFields = () => {
    startTransition(async () => {
      const result = await adminUpdateFormFieldsAction(ticket.id, formEdits);
      if (result?.error) showMsg("error", result.error);
      else { showMsg("success", "Data Formulir berhasil disimpan."); setEditingForm(false); }
    });
  };

  const reportUrl     = ticket.report_url || "";
  const attachmentUrl = (ticket.form_fields["Attachment"] as string) || "";
  const isImageUrl    = attachmentUrl && /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(attachmentUrl);
  const displayFormFields = Object.entries(formEdits).filter(([k]) => k !== "Attachment");
  const rec = ticket.recommendation;

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/admin/tickets"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-[13px] font-medium transition-colors">
            <ArrowLeft size={15} /> Kembali
          </Link>
          <span className="text-slate-300">|</span>
          <div>
            <h1 className="text-[15px] font-bold text-slate-800">Kelola Ticket #{ticket.id}</h1>
            <p className="text-[12px] text-slate-400">{ticket.title}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              isIncident ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}>
              {isIncident ? "🚨 Incident" : "🎫 Support"}
            </span>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${badgeColorClass}`}>
              {badgeLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="px-6 py-6">

        {/* Notification */}
        {message && (
          <div className={`mb-4 flex items-center gap-2.5 rounded-lg px-4 py-3 text-[13px] font-medium ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {message.type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── LEFT ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Data Ticket */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider flex items-center justify-between">
                <span>📋 Data Ticket</span>
                <button
                  onClick={() => { if (editingTicket) setRequesterEdit(ticket.requester); setEditingTicket((v) => !v); }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors">
                  {editingTicket ? <X size={12} /> : <Pencil size={12} />}
                  {editingTicket ? "Batal" : "Edit"}
                </button>
              </div>
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase w-2/5">Reporter</th>
                    <td className="px-4 py-2.5 text-slate-700">
                      {editingTicket ? (
                        <input value={requesterEdit} onChange={(e) => setRequesterEdit(e.target.value)}
                          className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-[13px] focus:outline-none focus:border-indigo-500" />
                      ) : (requesterEdit || ticket.requester)}
                    </td>
                  </tr>
                  <tr>
                    <th className="px-4 py-2.5 text-left bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase">Dibuat</th>
                    <td className="px-4 py-2.5 text-slate-700">{ticket.created_at}</td>
                  </tr>
                  <tr>
                    <th className="px-4 py-2.5 text-left bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase">Diperbarui</th>
                    <td className="px-4 py-2.5 text-slate-700">{ticket.updated_at}</td>
                  </tr>
                  {ticket.resolved_at && (
                    <tr>
                      <th className="px-4 py-2.5 text-left bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase">Diselesaikan</th>
                      <td className="px-4 py-2.5 text-emerald-700 font-semibold">{ticket.resolved_at}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {editingTicket && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button onClick={handleSaveTicketData} disabled={isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-[12px] font-bold transition-colors">
                    {isPending ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    Simpan Data Ticket
                  </button>
                </div>
              )}
            </div>

            {/* Data Formulir */}
            {displayFormFields.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>📝 Data Formulir</span>
                  <button
                    onClick={() => {
                      if (editingForm) {
                        setFormEdits(Object.fromEntries(
                          Object.entries(ticket.form_fields).map(([k, v]) => [k, Array.isArray(v) ? (v as string[]).join(", ") : (v || "")])
                        ));
                      }
                      setEditingForm((v) => !v);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors">
                    {editingForm ? <X size={12} /> : <Pencil size={12} />}
                    {editingForm ? "Batal" : "Edit"}
                  </button>
                </div>
                <table className="w-full text-[13px]">
                  <tbody className="divide-y divide-slate-50">
                    {displayFormFields.map(([k, v]) => (
                      <tr key={k}>
                        <th className="px-4 py-2.5 text-left bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase w-2/5">{k}</th>
                        <td className="px-4 py-2.5 text-slate-700">
                          {editingForm ? (
                            <input value={v} onChange={(e) => setFormEdits((prev) => ({ ...prev, [k]: e.target.value }))}
                              className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-[13px] focus:outline-none focus:border-indigo-500" />
                          ) : (v || "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editingForm && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={handleSaveFormFields} disabled={isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-[12px] font-bold transition-colors">
                      {isPending ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                      Simpan Data Formulir
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Attachment */}
            {attachmentUrl && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-700 text-slate-100 text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
                  <Paperclip size={13} /> Attachment / Lampiran
                </div>
                <div className="p-4 space-y-3">
                  {isImageUrl ? (
                    <div className="space-y-3">
                      <img src={attachmentUrl} alt="Attachment"
                        className="max-w-full rounded-lg border border-slate-200 shadow-sm"
                        style={{ maxHeight: "320px", objectFit: "contain" }} />
                      <a href={attachmentUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[12px] font-medium transition-colors">
                        <ImageIcon size={13} /> Buka Gambar di Tab Baru ↗
                      </a>
                    </div>
                  ) : (
                    <a href={attachmentUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[13px] font-medium transition-colors">
                      <ExternalLink size={13} /> Buka Attachment ↗
                    </a>
                  )}
                  <p className="text-[11px] text-slate-400">ℹ️ Attachment dapat diakses dari jaringan internal.</p>
                </div>
              </div>
            )}

            {/* ── Summary AI ── merah saat Done dipilih + kosong ── */}
            <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
              showSummaryError ? "border-red-400 ring-2 ring-red-100" : "border-slate-200"
            }`}>
              <div className={`px-4 py-3 text-[12px] font-bold uppercase tracking-wider flex items-center justify-between transition-colors duration-200 ${
                showSummaryError ? "bg-red-600 text-white" : "bg-slate-800 text-slate-100"
              }`}>
                <span className="flex items-center gap-2">
                  📄 Ringkasan AI (Summary)
                  {showSummaryError && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> Wajib diisi sebelum {doneStatus}
                    </span>
                  )}
                </span>
                <button onClick={() => setEditingSummary((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors">
                  {editingSummary ? <X size={12} /> : <Pencil size={12} />}
                  {editingSummary ? "Batal" : "Edit"}
                </button>
              </div>
              {editingSummary ? (
                <div className="p-4 space-y-3">
                  <textarea value={summaryValue} onChange={(e) => setSummaryValue(e.target.value)} rows={5}
                    placeholder="Isi ringkasan / summary tiket ini..."
                    className={`w-full px-3 py-2.5 border rounded-lg text-[13px] text-slate-700 focus:outline-none resize-y ${
                      showSummaryError ? "border-red-300 focus:border-red-500" : "border-indigo-300 focus:border-indigo-500"
                    }`} />
                  <div className="flex justify-end">
                    <button onClick={() => setEditingSummary(false)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[12px] font-bold transition-colors">
                      <Save size={13} /> Simpan
                    </button>
                  </div>
                </div>
              ) : summaryValue ? (
                <div className="p-4 text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap bg-indigo-50 border-l-4 border-l-indigo-400 m-4 rounded-r-lg">
                  {summaryValue}
                </div>
              ) : (
                <div className={`px-4 py-4 text-[13px] italic flex items-center gap-2 ${
                  showSummaryError ? "text-red-600 bg-red-50/50" : "text-slate-400"
                }`}>
                  <AlertTriangle size={14} className={showSummaryError ? "text-red-500" : "text-amber-400"} />
                  {showSummaryError
                    ? <span>Belum diisi — klik <strong>Edit</strong> di atas untuk mengisi sekarang.</span>
                    : "Ringkasan AI belum tersedia. Klik Edit untuk mengisi secara manual."}
                </div>
              )}
            </div>

            {/* ── Smart Recommendation ── */}
            {rec && rec.found && (
              <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
                <div className="px-4 py-3 bg-emerald-700 text-white text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
                  💡 Smart Recommendation
                  <span className="ml-2 text-[10px] font-normal bg-emerald-600 px-2 py-0.5 rounded-full">
                    {rec.totalSimilar ?? rec.similarTickets.length} kasus serupa
                  </span>
                  <span className="ml-auto text-[10px] font-normal opacity-80 normal-case">
                    {rec.isIncident ? "Referensi Mitigasi Insiden" : "Referensi Solusi Teknisi"}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-[12px] text-emerald-700 font-medium border-l-4 border-emerald-400 pl-3 bg-emerald-50 py-2 rounded-r">
                    {rec.label}
                  </p>
                  {rec.topSuggestion && (
                    <div className="rounded-lg border border-emerald-300 overflow-hidden">
                      <div className="px-3 py-2 bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wide flex items-center gap-2">
                        🏆 Referensi Terbaik
                        {rec.topSuggestion.source === "ticket" && rec.topSuggestion.ticketId && (
                          <span className="ml-auto font-normal text-emerald-200">#{rec.topSuggestion.ticketId}</span>
                        )}
                      </div>
                      <div className="p-3 space-y-2 bg-emerald-50 text-[12px]">
                        <p className="font-semibold text-slate-700 truncate">{rec.topSuggestion.title}</p>
                        {rec.topSuggestion.summary && (
                          <div className="border-l-2 border-emerald-400 pl-2">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">✅ Solusi</p>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{rec.topSuggestion.summary}</p>
                          </div>
                        )}
                        {rec.topSuggestion.rootCause && (
                          <div className="border-l-2 border-amber-400 pl-2">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">🔍 Root Cause</p>
                            <p className="text-slate-600">{rec.topSuggestion.rootCause}</p>
                          </div>
                        )}
                        {rec.topSuggestion.timeline && (
                          <div className="border-l-2 border-blue-400 pl-2">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">📅 Action Steps</p>
                            <p className="text-slate-600 whitespace-pre-wrap">{rec.topSuggestion.timeline}</p>
                          </div>
                        )}
                        {rec.topSuggestion.threadUrl && (
                          <a href={rec.topSuggestion.threadUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 underline mt-1">
                            🔗 Lihat thread Discord referensi
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {rec.similarTickets.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition text-[12px] font-semibold text-slate-600 select-none">
                          <span>📋 Kasus Serupa Lainnya ({rec.similarTickets.length})</span>
                          <span className="ml-auto text-[10px] text-slate-400 group-open:hidden">▼ Tampilkan</span>
                          <span className="ml-auto text-[10px] text-slate-400 hidden group-open:block">▲ Sembunyikan</span>
                        </div>
                      </summary>
                      <div className="mt-2 space-y-2">
                        {rec.similarTickets.map((t) => (
                          <details key={t.ticketId} className="group/item rounded-lg border border-slate-200 overflow-hidden">
                            <summary className="cursor-pointer list-none">
                              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition select-none">
                                <div className="flex-1 min-w-0">
                                  <span className="text-[12px] font-semibold text-slate-700">#{t.ticketId} — </span>
                                  <span className="text-[12px] text-slate-600 truncate">{t.title}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {t.resolvedAt && <span className="text-[10px] text-slate-400">{new Date(t.resolvedAt).toLocaleDateString("id-ID")}</span>}
                                  <span className="text-[10px] text-slate-400 group-open/item:hidden">▼</span>
                                  <span className="text-[10px] text-slate-400 hidden group-open/item:block">▲</span>
                                </div>
                              </div>
                            </summary>
                            <div className="px-3 pb-3 pt-2 bg-white space-y-2 text-[12px]">
                              {t.summary && <div className="border-l-2 border-emerald-400 pl-2"><p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">✅ Solusi</p><p className="text-slate-600 whitespace-pre-wrap">{t.summary}</p></div>}
                              {t.rootCause && <div className="border-l-2 border-amber-400 pl-2"><p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">🔍 Root Cause</p><p className="text-slate-600">{t.rootCause}</p></div>}
                              {t.timeline && <div className="border-l-2 border-blue-400 pl-2"><p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">📅 Action Steps</p><p className="text-slate-600 whitespace-pre-wrap">{t.timeline}</p></div>}
                              {t.threadUrl && <a href={t.threadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 underline">🔗 Lihat thread Discord</a>}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  )}
                  {rec.runbooks.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-[12px] font-semibold text-blue-700 select-none">
                          <span>📚 Knowledge Base ({rec.runbooks.length})</span>
                          <span className="ml-auto text-[10px] text-blue-400 group-open:hidden">▼ Tampilkan</span>
                          <span className="ml-auto text-[10px] text-blue-400 hidden group-open:block">▲ Sembunyikan</span>
                        </div>
                      </summary>
                      <div className="mt-2 space-y-2">
                        {rec.runbooks.map((r, i) => (
                          <details key={i} className="group/rb rounded-lg border border-blue-200 overflow-hidden">
                            <summary className="cursor-pointer list-none">
                              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 transition select-none">
                                <span className="text-[12px] font-semibold text-blue-700 flex-1 truncate">[{r.category}] {r.title}</span>
                                {r.successRate > 0 && <span className="text-[10px] text-blue-500 flex-shrink-0">✅ {r.successRate}%</span>}
                                <span className="text-[10px] text-blue-400 group-open/rb:hidden flex-shrink-0">▼</span>
                                <span className="text-[10px] text-blue-400 hidden group-open/rb:block flex-shrink-0">▲</span>
                              </div>
                            </summary>
                            <div className="px-3 pb-3 pt-2 bg-white text-[12px]">
                              <p className="text-slate-600 whitespace-pre-wrap">{r.content}</p>
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* ── Root Cause ── merah saat Done dipilih + kosong ── */}
            <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
              showRootCauseError ? "border-red-400 ring-2 ring-red-100" : "border-slate-200"
            }`}>
              <div className={`px-4 py-3 text-[12px] font-bold uppercase tracking-wider flex items-center justify-between transition-colors duration-200 ${
                showRootCauseError ? "bg-red-600 text-white" : "bg-amber-800 text-amber-100"
              }`}>
                <span className="flex items-center gap-2">
                  🔍 Root Cause Analysis
                  {showRootCauseError && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> Wajib diisi sebelum {doneStatus}
                    </span>
                  )}
                </span>
                <button onClick={() => setEditingRootCause((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors">
                  {editingRootCause ? <X size={12} /> : <Pencil size={12} />}
                  {editingRootCause ? "Batal" : "Edit"}
                </button>
              </div>
              {editingRootCause ? (
                <div className="p-4 space-y-3">
                  <textarea value={rootCauseValue} onChange={(e) => setRootCauseValue(e.target.value)} rows={4}
                    placeholder="Isi analisis root cause..."
                    className={`w-full px-3 py-2.5 border rounded-lg text-[13px] text-slate-700 focus:outline-none resize-y ${
                      showRootCauseError ? "border-red-300 focus:border-red-500" : "border-amber-300 focus:border-amber-500"
                    }`} />
                  <div className="flex justify-end">
                    <button onClick={() => setEditingRootCause(false)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[12px] font-bold transition-colors">
                      <Save size={13} /> Simpan
                    </button>
                  </div>
                </div>
              ) : rootCauseValue ? (
                <div className="p-4 text-[13px] text-amber-900 leading-relaxed whitespace-pre-wrap bg-amber-50 border-l-4 border-l-amber-400 m-4 rounded-r-lg">
                  {rootCauseValue}
                </div>
              ) : (
                <div className={`px-4 py-4 text-[13px] italic flex items-center gap-2 ${
                  showRootCauseError ? "text-red-600 bg-red-50/50" : "text-slate-400"
                }`}>
                  <AlertTriangle size={14} className={showRootCauseError ? "text-red-500" : "text-amber-400"} />
                  {showRootCauseError
                    ? <span>Belum diisi — klik <strong>Edit</strong> di atas untuk mengisi sekarang.</span>
                    : "Root cause belum diisi. Klik Edit untuk mengisi secara manual."}
                </div>
              )}
            </div>

            {/* ── Timeline Progress ── merah saat Done dipilih + kosong ── */}
            <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${
              showTimelineError ? "border-red-400 ring-2 ring-red-100" : "border-slate-200"
            }`}>
              <div className={`px-4 py-3 text-[12px] font-bold uppercase tracking-wider flex items-center justify-between transition-colors duration-200 ${
                showTimelineError ? "bg-red-600 text-white" : "bg-slate-800 text-slate-100"
              }`}>
                <span className="flex items-center gap-2">
                  ⏱️ {isIncident ? "Action Taken / Timeline" : "Timeline Progress / Tindak Lanjut"}
                  {showTimelineError && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> Wajib diisi sebelum {doneStatus}
                    </span>
                  )}
                </span>
                <button onClick={() => setEditingTimeline((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors">
                  {editingTimeline ? <X size={12} /> : <Pencil size={12} />}
                  {editingTimeline ? "Batal" : "Edit"}
                </button>
              </div>
              {editingTimeline ? (
                <div className="p-4 space-y-3">
                  <textarea value={timelineValue} onChange={(e) => setTimelineValue(e.target.value)} rows={5}
                    placeholder={isIncident ? "Isi action taken / timeline penanganan..." : "Isi timeline progress / tindak lanjut..."}
                    className={`w-full px-3 py-2.5 border rounded-lg text-[13px] text-slate-700 focus:outline-none resize-y ${
                      showTimelineError ? "border-red-300 focus:border-red-500" : "border-slate-300 focus:border-slate-500"
                    }`} />
                  <div className="flex justify-end">
                    <button onClick={() => setEditingTimeline(false)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-[12px] font-bold transition-colors">
                      <Save size={13} /> Simpan
                    </button>
                  </div>
                </div>
              ) : timelineValue ? (
                <div className="p-4 text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {timelineValue}
                </div>
              ) : (
                <div className={`px-4 py-4 text-[13px] italic flex items-center gap-2 ${
                  showTimelineError ? "text-red-600 bg-red-50/50" : "text-slate-400"
                }`}>
                  <AlertTriangle size={14} className={showTimelineError ? "text-red-500" : "text-amber-400"} />
                  {showTimelineError
                    ? <span>Belum diisi — klik <strong>Edit</strong> di atas untuk mengisi sekarang.</span>
                    : "Belum ada progress yang dicatat. Klik Edit untuk mengisi."}
                </div>
              )}
            </div>

            {/* Activity Log */}
            {ticket.activities.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider">
                  📋 Log Aktivitas
                </div>
                <div className="p-4 space-y-3">
                  {ticket.activities.map((act) => (
                    <div key={act.id} className="flex gap-3 text-[12px]">
                      <Clock size={13} className="text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-400">{act.created_at}</p>
                        <p className="text-slate-600">{formatActivityDescription(act.description, act.type)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT ── */}
          <div className="space-y-5">

            {/* Ubah Status */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-700 text-white text-[12px] font-bold uppercase tracking-wider">
                🔧 Ubah Status {isIncident ? "Incident" : "Ticketing Support"}
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Status Baru</label>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((s) => (
                      <button key={s}
                        onClick={() => handleSetStatus(s)}
                        className={`py-2 px-3 rounded-lg text-[12px] font-bold border transition-all ${
                          status === s
                            ? s === doneStatus
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400"
                        }`}>
                        {statusLabels[s] || s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inline checklist — muncul saat Done dipilih + ada yang kosong */}
                {doneSelected && !allRequiredFilled && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 space-y-1.5">
                    <p className="text-[12px] font-bold text-red-700 flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      Data wajib sebelum {doneStatus}:
                    </p>
                    <div className="space-y-1">
                      <p className={`flex items-center gap-1.5 text-[12px] ${summaryFilled ? "text-emerald-600" : "text-red-600"}`}>
                        {summaryFilled ? <CheckCircle2 size={12} className="flex-shrink-0" /> : <XCircle size={12} className="flex-shrink-0" />}
                        Ringkasan AI (Summary)
                      </p>
                      <p className={`flex items-center gap-1.5 text-[12px] ${rootCauseFilled ? "text-emerald-600" : "text-red-600"}`}>
                        {rootCauseFilled ? <CheckCircle2 size={12} className="flex-shrink-0" /> : <XCircle size={12} className="flex-shrink-0" />}
                        Root Cause Analysis
                      </p>
                      <p className={`flex items-center gap-1.5 text-[12px] ${timelineFilled ? "text-emerald-600" : "text-red-600"}`}>
                        {timelineFilled ? <CheckCircle2 size={12} className="flex-shrink-0" /> : <XCircle size={12} className="flex-shrink-0" />}
                        {isIncident ? "Action Taken / Timeline" : "Timeline Progress"}
                      </p>
                    </div>
                    <p className="text-[11px] text-red-400 pt-0.5">↑ Scroll ke atas, isi card yang berwarna merah.</p>
                  </div>
                )}

                {/* Semua sudah terisi saat Done dipilih */}
                {doneSelected && allRequiredFilled && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                    <p className="text-[12px] text-emerald-700 font-semibold">
                      Semua data lengkap — siap simpan sebagai {doneStatus}.
                    </p>
                  </div>
                )}

                {/* Tombol Simpan Status — disabled jika Done dipilih tapi belum komplit */}
                <button
                  onClick={handleUpdateStatus}
                  disabled={saveDisabled}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold transition-colors ${
                    saveDisabled
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}>
                  {isPending
                    ? <><RefreshCw size={14} className="animate-spin" /> Menyimpan...</>
                    : saveDisabled
                      ? <><XCircle size={14} /> Lengkapi data dulu</>
                      : <><Save size={14} /> Simpan Status</>
                  }
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  Status akan diperbarui di database, portal user, dan Discord.
                </p>
              </div>
            </div>

            {/* Reassign Petugas */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-700 text-white text-[12px] font-bold uppercase tracking-wider">
                👤 Reassign Petugas
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Nama Petugas (pisah dengan koma)
                  </label>
                  <textarea value={assigneeInput} onChange={(e) => setAssigneeInput(e.target.value)} rows={3}
                    placeholder="Contoh: Budi, Siti, Tim Jaringan"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] resize-none focus:outline-none focus:border-indigo-400" />
                </div>
                <button onClick={handleReassign} disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg text-[13px] font-bold transition-colors">
                  {isPending ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  Simpan Assignee
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  Assignee akan diperbarui di database, portal user, dan Discord.
                </p>
              </div>
            </div>

            {/* Laporan Incident */}
            {isIncident && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-rose-800 text-rose-100 text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
                  <FileText size={13} /> Laporan Incident
                </div>
                <div className="p-4 space-y-3">
                  {reportUrl ? (
                    <a href={`/api/admin/report-view/${ticket.id}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-semibold transition-colors w-full justify-center">
                      <ExternalLink size={14} /> Buka Laporan HTML
                    </a>
                  ) : (
                    <p className="text-[13px] text-slate-400 italic">Laporan belum tersedia. Generate via Discord Bot.</p>
                  )}
                  <p className="text-[11px] text-slate-400">⚠️ Laporan hanya dapat diakses dari jaringan internal.</p>
                </div>
              </div>
            )}

            {/* Discord Thread */}
            {ticket.discord?.threadUrl && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Discord Thread</p>
                <a href={ticket.discord.threadUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[13px] text-indigo-600 hover:underline break-all">
                  Buka Thread Discord ↗
                </a>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}