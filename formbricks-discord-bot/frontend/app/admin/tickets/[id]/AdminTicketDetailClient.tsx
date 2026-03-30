"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft, Save, UserCheck, RefreshCw, CheckCircle2,
  XCircle, Clock, Pencil, X, ExternalLink, FileText,
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
}

const STATUS_OPTIONS_SUPPORT  = ["OPEN", "PENDING", "DONE", "REJECT"] as const;
const STATUS_OPTIONS_INCIDENT = ["OPEN", "INVESTIGASI", "MITIGASI", "RESOLVED"] as const;

// STATUS_LABELS_SUPPORT: tombol OPEN dilabel "In Progress" karena di konteks Support,
// memilih tombol ini berarti mengerjakan ticket (equivalent !status approve di Discord).
const STATUS_LABELS_SUPPORT: Record<string, string> = {
  OPEN:    "🔄 In Progress",
  PENDING: "⏳ Pending",
  DONE:    "✔️ Done",
  REJECT:  "❌ Reject",
};

// STATUS_LABELS_INCIDENT: semua label sesuai nama asli status, tidak ada perubahan.
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

// Label yang ditampilkan di badge header untuk setiap status DB
const STATUS_BADGE_LABELS: Record<string, string> = {
  OPEN:        "In Progress",  // Support: OPEN di DB = In Progress
  PENDING:     "Pending",
  APPROVED:    "In Progress",  // raw dari Discord !status approve
  IN_PROGRESS: "In Progress",  // hasil mapping dari lib/tickets.ts
  DONE:        "Done",
  REJECT:      "Reject",
  REJECTED:    "Reject",
  INVESTIGASI: "Investigasi",
  MITIGASI:    "Mitigasi",
  RESOLVED:    "Resolved",
};
/**
 * Normalisasi status dari DB ke nilai tombol yang tersedia di STATUS_OPTIONS.
 * Diperlukan agar tombol yang aktif bisa ter-highlight dengan benar.
 *
 * Mapping:
 *   APPROVED  → "OPEN"   (Support: tombol "In Progress" = key OPEN)
 *   REJECTED  → "REJECT" (normalisasi legacy)
 *   lainnya   → tidak berubah
 */
function normalizeStatusForUI(rawStatus: string, isIncident: boolean): string {
  if (!isIncident) {
    // APPROVED   = dari Discord !status approve
    // IN_PROGRESS = dari mapping lib/tickets.ts (APPROVED → IN_PROGRESS)
    // Keduanya dipetakan ke tombol "OPEN" (berlabel "In Progress") di portal admin
    if (rawStatus === "APPROVED" || rawStatus === "IN_PROGRESS") return "OPEN";
    if (rawStatus === "REJECTED" || rawStatus === "REJECT")      return "REJECT";
  }
  return rawStatus;
}

export default function AdminTicketDetailClient({ ticket }: { ticket: TicketDetail }) {
  const isIncident    = ticket.type === "INCIDENT";
  const statusOptions = isIncident ? STATUS_OPTIONS_INCIDENT : STATUS_OPTIONS_SUPPORT;

  // Normalisasi status awal agar tombol yang aktif bisa ter-highlight
  const [status, setStatus] = useState(() =>
    normalizeStatusForUI(ticket.status, isIncident)
  );

  const [assigneeInput, setAssigneeInput] = useState(ticket.assignee.join(", "));

  const [editingTicket, setEditingTicket] = useState(false);
  const [requesterEdit, setRequesterEdit] = useState(ticket.requester);

  const [editingForm, setEditingForm] = useState(false);
  const [formEdits,   setFormEdits]   = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(ticket.form_fields).map(([k, v]) => [
        k,
        Array.isArray(v) ? (v as string[]).join(", ") : (v || ""),
      ])
    )
  );

  const [message,   setMessage]   = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    if (type === "success") setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateStatus = () => {
    startTransition(async () => {
      // FIX: Khusus Ticketing Support, tombol "OPEN" = "In Progress" secara tampilan.
      // Di DB dan Discord disimpan sebagai "APPROVED" (konsisten dengan !status approve).
      // Untuk Incident, tombol "OPEN" tetap dikirim sebagai "OPEN" — tidak ada mapping.
      const statusToSave = (!isIncident && status === "OPEN") ? "APPROVED" : status;
      const result = await adminUpdateStatusAction(
        ticket.id,
        statusToSave as "OPEN" | "PENDING" | "APPROVED" | "DONE" | "REJECT"
      );
      if (result?.error) showMsg("error", result.error);
      else showMsg("success", "Status berhasil diperbarui dan disinkronkan ke Discord.");
    });
  };

  // Label untuk tombol status — berbeda antara Support dan Incident
  const statusLabels = isIncident ? STATUS_LABELS_INCIDENT : STATUS_LABELS_SUPPORT;

  // Label dan warna untuk badge di header — berdasarkan status raw dari DB
  const rawStatus       = ticket.status;
  const badgeLabel      = isIncident
    ? (STATUS_LABELS_INCIDENT[rawStatus] || rawStatus).replace(/^[^\w]*/, "").trim()
    : (STATUS_BADGE_LABELS[rawStatus] || rawStatus);
  const badgeColorClass = STATUS_COLORS[rawStatus] || "bg-slate-100 text-slate-600 border-slate-200";

  const handleReassign = () => {
    const assignees: string[] = assigneeInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const result = await adminReassignAction(ticket.id, assignees);
      if (result?.error) showMsg("error", result.error);
      else showMsg("success", "Assignee berhasil diperbarui dan disinkronkan ke Discord.");
    });
  };

  const handleSaveTicketData = () => {
    startTransition(async () => {
      const result = await adminUpdateTicketDataAction(ticket.id, {
        requester: requesterEdit,
      });
      if (result?.error) showMsg("error", result.error);
      else {
        showMsg("success", "Data Ticket berhasil disimpan.");
        setEditingTicket(false);
      }
    });
  };

  const handleSaveFormFields = () => {
    startTransition(async () => {
      const result = await adminUpdateFormFieldsAction(ticket.id, formEdits);
      if (result?.error) showMsg("error", result.error);
      else {
        showMsg("success", "Data Formulir berhasil disimpan.");
        setEditingForm(false);
      }
    });
  };

  const reportUrl = ticket.report_url || "";

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/tickets"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-[13px] font-medium transition-colors"
          >
            <ArrowLeft size={15} />
            Kembali
          </Link>
          <span className="text-slate-300">|</span>
          <div>
            <h1 className="text-[15px] font-bold text-slate-800">
              Kelola Ticket #{ticket.id}
            </h1>
            <p className="text-[12px] text-slate-400">{ticket.title}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              isIncident
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"
            }`}>
              {isIncident ? "🚨 Incident" : "🎫 Support"}
            </span>
            {/* Badge status: tampilkan label yang human-readable, bukan raw DB value */}
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

            {/* Data Ticket (editable) */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider flex items-center justify-between">
                <span>📋 Data Ticket</span>
                <button
                  onClick={() => {
                    if (editingTicket) setRequesterEdit(ticket.requester);
                    setEditingTicket((v) => !v);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors"
                >
                  {editingTicket ? <X size={12} /> : <Pencil size={12} />}
                  {editingTicket ? "Batal" : "Edit"}
                </button>
              </div>
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase w-2/5">
                      Reporter
                    </th>
                    <td className="px-4 py-2.5 text-slate-700">
                      {editingTicket ? (
                        <input
                          value={requesterEdit}
                          onChange={(e) => setRequesterEdit(e.target.value)}
                          className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-[13px] focus:outline-none focus:border-indigo-500"
                        />
                      ) : (
                        requesterEdit || ticket.requester
                      )}
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
                  <button
                    onClick={handleSaveTicketData}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-[12px] font-bold transition-colors"
                  >
                    {isPending ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    Simpan Data Ticket
                  </button>
                </div>
              )}
            </div>

            {/* Data Formulir (editable) */}
            {Object.keys(ticket.form_fields).length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>📝 Data Formulir</span>
                  <button
                    onClick={() => {
                      if (editingForm) {
                        setFormEdits(
                          Object.fromEntries(
                            Object.entries(ticket.form_fields).map(([k, v]) => [
                              k,
                              Array.isArray(v) ? (v as string[]).join(", ") : (v || ""),
                            ])
                          )
                        );
                      }
                      setEditingForm((v) => !v);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors"
                  >
                    {editingForm ? <X size={12} /> : <Pencil size={12} />}
                    {editingForm ? "Batal" : "Edit"}
                  </button>
                </div>
                <table className="w-full text-[13px]">
                  <tbody className="divide-y divide-slate-50">
                    {Object.entries(formEdits).map(([k, v]) => (
                      <tr key={k}>
                        <th className="px-4 py-2.5 text-left bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase w-2/5">
                          {k}
                        </th>
                        <td className="px-4 py-2.5 text-slate-700">
                          {editingForm ? (
                            <input
                              value={v}
                              onChange={(e) =>
                                setFormEdits((prev) => ({ ...prev, [k]: e.target.value }))
                              }
                              className="w-full px-2 py-1 border border-indigo-300 rounded-lg text-[13px] focus:outline-none focus:border-indigo-500"
                            />
                          ) : (
                            v || "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editingForm && (
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={handleSaveFormFields}
                      disabled={isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-[12px] font-bold transition-colors"
                    >
                      {isPending ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                      Simpan Data Formulir
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Summary AI */}
            {ticket.summary_ticket && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider">
                  📄 Ringkasan AI
                </div>
                <div className="p-4 text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 border-l-4 border-l-indigo-400 m-4 rounded-r-lg">
                  {ticket.summary_ticket}
                </div>
              </div>
            )}

            {/* Root Cause */}
            {ticket.root_cause && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-amber-800 text-amber-100 text-[12px] font-bold uppercase tracking-wider">
                  🔍 Root Cause
                </div>
                <div className="p-4 text-[13px] text-amber-900 leading-relaxed whitespace-pre-wrap bg-amber-50 border-l-4 border-l-amber-400 m-4 rounded-r-lg">
                  {ticket.root_cause}
                </div>
              </div>
            )}

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
                        <p className="text-slate-600">{act.description || act.type}</p>
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
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Status Baru
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`py-2 px-3 rounded-lg text-[12px] font-bold border transition-all ${
                          status === s
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400"
                        }`}
                      >
                        {statusLabels[s] || s}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleUpdateStatus}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-[13px] font-bold transition-colors"
                >
                  {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Simpan Status
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
                  <textarea
                    value={assigneeInput}
                    onChange={(e) => setAssigneeInput(e.target.value)}
                    rows={3}
                    placeholder="Contoh: Budi, Siti, Tim Jaringan"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] resize-none focus:outline-none focus:border-indigo-400"
                  />
                </div>
                <button
                  onClick={handleReassign}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white rounded-lg text-[13px] font-bold transition-colors"
                >
                  {isPending ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  Simpan Assignee
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  Assignee akan diperbarui di database, portal user, dan Discord.
                </p>
              </div>
            </div>

            {/* Laporan Incident — hanya untuk ticket INCIDENT */}
            {isIncident && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-rose-800 text-rose-100 text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
                  <FileText size={13} />
                  Laporan Incident
                </div>
                <div className="p-4 space-y-3">
                  {reportUrl ? (
                    <a
                      href={`/api/admin/report-view/${ticket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-semibold transition-colors w-full justify-center"
                    >
                      <ExternalLink size={14} />
                      Buka Laporan HTML
                    </a>
                  ) : (
                    <p className="text-[13px] text-slate-400 italic">
                      Laporan belum tersedia. Generate terlebih dahulu via Discord Bot.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    ⚠️ Laporan hanya dapat diakses dari jaringan internal perusahaan.
                  </p>
                </div>
              </div>
            )}

            {/* Discord link */}
            {ticket.discord?.threadUrl && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Discord</p>
                <a
                  href={ticket.discord.threadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-indigo-600 hover:underline break-all"
                >
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