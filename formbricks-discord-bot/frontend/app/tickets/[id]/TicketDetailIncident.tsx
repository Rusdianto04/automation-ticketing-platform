"use client";

import Link from "next/link";
import {
  ArrowLeft, Hash, User, Clock, FileSearch, AlertTriangle,
  FileText, AlertCircle,
} from "lucide-react";
import type { Ticket } from "@/types";
import { StatusBadge, TypeBadge, CardSection, AssigneeList, TimelineSection } from "./SharedComponents";

interface Props {
  ticket: Ticket;
  title: string;
  requester: string;
  orgName: string;
  orgDepartment: string;
  createdAt: string;
  updatedAt: string;
}

export default function TicketDetailIncident({
  ticket, title, requester, orgName, orgDepartment, createdAt, updatedAt,
}: Props) {
  const f         = ticket.form_fields;
  const status    = ticket.status_pengusulan;
  const assignees = Array.isArray(ticket.assignee) ? ticket.assignee : [];

  const summaryTicket = ticket.summary_ticket || "";
  const rootCause     = ticket.root_cause     || "";

  const timelineRaw = ticket.timeline_action_taken || ticket.timeline_tindak_lanjut || null;

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #4c0519 100%)" }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 text-[13px] font-medium transition-all group"
            >
              <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
              Kembali ke Dashboard
            </Link>
            <span className="text-slate-600">›</span>
            <div className="flex items-center gap-2">
              <TypeBadge type={ticket.type} />
              <span className="text-white font-bold text-[14px]">#{ticket.id}</span>
            </div>
            <div className="ml-auto text-right hidden sm:block">
              <p className="text-[11px] text-slate-400">{orgName}</p>
              <p className="text-[11px] text-slate-500">{orgDepartment}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Alert banner */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <AlertTriangle size={20} className="text-rose-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-rose-800">Incident Report</p>
            <p className="text-[12px] text-rose-600 mt-0.5">
              Ticket ini merupakan laporan insiden yang memerlukan penanganan dan eskalasi sesuai prosedur.
            </p>
          </div>
        </div>

        {/* Title bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-bold font-mono text-rose-500 bg-rose-50 px-2 py-0.5 rounded">
                #{ticket.id}
              </span>
              <TypeBadge type={ticket.type} />
              <StatusBadge status={status} />
            </div>
            <h1 className="text-[18px] font-bold text-slate-800 leading-snug">{title}</h1>
          </div>
          <div className="text-right text-[12px] text-slate-400 shrink-0 space-y-1">
            <div className="flex items-center justify-end gap-1.5">
              <Clock size={12} />
              <span>Dibuat: <strong className="text-slate-600">{createdAt}</strong></span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <Clock size={12} />
              <span>Diperbarui: <strong className="text-slate-600">{updatedAt}</strong></span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── LEFT ── */}
          <div className="lg:col-span-2 space-y-5">

            <CardSection title="Data Formulir Incident" icon={<FileSearch size={15} />} accent="rose">
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-50">
                  {Object.entries(f).map(([key, val]) => (
                    <tr key={key} className="hover:bg-slate-50">
                      <th className="px-4 py-2.5 text-left w-2/5 bg-slate-50/60">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          {key}
                        </span>
                      </th>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">
                        {Array.isArray(val) ? val.join(", ") : String(val || "—")}
                      </td>
                    </tr>
                  ))}
                  {Object.keys(f).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-5 text-slate-400 italic text-center text-[13px]">
                        Tidak ada data formulir tersedia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardSection>

            <CardSection title="Ringkasan Incident (AI Summary)" icon={<FileText size={15} />} accent="rose">
              {summaryTicket ? (
                <div className="m-4 bg-rose-50 rounded-lg border-l-4 border-rose-400 p-4 text-[13px] text-rose-900 whitespace-pre-wrap leading-relaxed">
                  {summaryTicket}
                </div>
              ) : (
                <div className="px-4 py-5 text-[13px] text-slate-400 italic flex items-center gap-2">
                  <AlertCircle size={14} className="text-slate-300 shrink-0" />
                  Ringkasan belum tersedia. Diisi otomatis setelah klasifikasi AI selesai.
                </div>
              )}
            </CardSection>

            <CardSection title="Root Cause Analysis" icon={<FileSearch size={15} />} accent="rose">
              <div className={`m-4 rounded-lg border-l-4 p-4 text-[13px] leading-relaxed ${
                rootCause
                  ? "bg-amber-50 border-amber-500 text-amber-900"
                  : "bg-slate-50 border-slate-300 text-slate-400 italic"
              }`}>
                {rootCause || "Root cause analysis belum diselesaikan oleh tim investigasi."}
              </div>
            </CardSection>

            <CardSection title="Action Taken / Timeline Progress" icon={<Clock size={15} />} accent="rose">
              <TimelineSection items={timelineRaw} />
            </CardSection>

          </div>

          {/* ── RIGHT ── */}
          <div className="space-y-5">

            <CardSection title="Informasi Ticket" icon={<Hash size={15} />}>
              <dl className="px-4 py-3 space-y-3 text-[13px]">
                <InfoItem
                  label="ID Ticket"
                  value={<span className="font-mono font-bold text-rose-600">#{ticket.id}</span>}
                />
                <InfoItem label="Status" value={<StatusBadge status={status} />} />
                <InfoItem
                  label="Type"
                  value={<span className="font-medium text-slate-700">Incident</span>}
                />
              </dl>
            </CardSection>

            <CardSection title="Assignee / Petugas" icon={<User size={15} />}>
              <AssigneeList assignees={assignees} />
            </CardSection>

          </div>
        </div>
      </main>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}