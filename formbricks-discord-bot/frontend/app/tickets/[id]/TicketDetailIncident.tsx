"use client";

import Link from "next/link";
import {
  ArrowLeft, Hash, User, Clock, FileSearch,
  AlertTriangle, FileText, AlertCircle, Zap,
  Shield, Activity, AlignLeft,
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

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border-red-300",
  High: "bg-orange-100 text-orange-800 border-orange-300",
  Medium: "bg-amber-100 text-amber-800 border-amber-300",
  Low: "bg-green-100 text-green-800 border-green-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low: "bg-green-100 text-green-800 border-green-300",
};

const SEVERITY_COLORS: Record<string, string> = {
  "SEV 1: Critical": "bg-red-100 text-red-800 border-red-300",
  "SEV 2: High": "bg-orange-100 text-orange-800 border-orange-300",
  "SEV 3: Medium": "bg-amber-100 text-amber-800 border-amber-300",
  "SEV 4: Low": "bg-green-100 text-green-800 border-green-300",
};

export default function TicketDetailIncident({
  ticket, title, orgName, orgDepartment, createdAt, updatedAt,
}: Props) {
  const f = ticket.form_fields;
  const status = ticket.status_pengusulan;
  const assignees = Array.isArray(ticket.assignee) ? ticket.assignee : [];

  const summaryTicket = ticket.summary_ticket || "";
  const rootCause = ticket.root_cause || "";
  const timelineRaw = ticket.timeline_action_taken || ticket.timeline_tindak_lanjut || null;

  const priority = (f["Priority Incident"] as string) || "";
  const severity = (f["Severity Incident"] as string) || "";
  const suspectArea = (f["Suspect Area"] as string) || "";
  const indicatedIssue = (f["Indicated Issue"] as string) || (f["Issue"] as string) || "";
  const dateTime = (f["Date & Time Incident"] as string) || (f["Date Incident"] as string) || "";
  const incidentTitle = (f["Incident Title"] as string) || (f["Incident Information"] as string) || title;

  return (
    <div className="min-h-screen" style={{ background: "#d9e1f2" }}>

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg"
        style={{ background: "#1e293b" }}
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
              <p className="text-[11px] text-white font-semibold">{orgName}</p>
              <p className="text-[11px] text-white/80">{orgDepartment}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Title Bar ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">

              <div className="relative group cursor-pointer">
                <AlertTriangle size={14} className="text-rose-500" />

                {/* Tooltip */}
                <div className="absolute left-0 top-5 w-64 bg-white border border-rose-200 text-[11px] text-slate-600 rounded-lg shadow-lg p-3 
                    opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 
                    transition-all duration-200 pointer-events-none z-20">
                  <p className="font-semibold text-rose-700 mb-1">Incident Report</p>
                  <p>
                    Ticket ini merupakan laporan insiden yang memerlukan penanganan dan eskalasi sesuai prosedur.
                  </p>
                </div>
              </div>

              {/* ID Ticket */}
              <span className="text-[11px] font-bold font-mono text-rose-500 bg-rose-50 px-2 py-0.5 rounded">
                #{ticket.id}
              </span>

              <TypeBadge type={ticket.type} />
              <StatusBadge status={status} />

              {priority && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${PRIORITY_COLORS[priority] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {priority}
                </span>
              )}
              {severity && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${SEVERITY_COLORS[severity] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                  {severity}
                </span>
              )}
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

        <div className="max-w-screen-xl mx-auto space-y-5">
          {/* ── LEFT ── */}

          <div className="space-y-5">

            {/* ── Data Formulir Incident — Indicated Issue masuk tabel ── */}
            <CardSection title="Data Formulir Incident" icon={<FileSearch size={15} />} accent="rose">
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-50">

                  {incidentTitle && (
                    <tr className="hover:bg-slate-50">
                      <th className="px-4 py-2.5 text-left w-2/5 bg-slate-50/60">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          <span className="text-rose-400"><Zap size={13} /></span>
                          Incident Title
                        </div>
                      </th>
                      <td className="px-4 py-2.5 font-semibold text-rose-700">{incidentTitle}</td>
                    </tr>
                  )}

                  {/* {dateTime && (
                    <IncidentFieldRow icon={<Clock size={13} />} label="Date &amp; Time Incident" value={dateTime} />
                  )} */}

                  {priority && (
                    <tr className="hover:bg-slate-50">
                      <th className="px-4 py-2.5 text-left w-2/5 bg-slate-50/60">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          <span className="text-rose-400"><Shield size={13} /></span>
                          Priority Incident
                        </div>
                      </th>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${PRIORITY_COLORS[priority] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {priority}
                        </span>
                      </td>
                    </tr>
                  )}

                  {severity && (
                    <tr className="hover:bg-slate-50">
                      <th className="px-4 py-2.5 text-left w-2/5 bg-slate-50/60">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          <span className="text-rose-400"><Activity size={13} /></span>
                          Severity Incident
                        </div>
                      </th>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${SEVERITY_COLORS[severity] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {severity}
                        </span>
                      </td>
                    </tr>
                  )}

                  {suspectArea && (
                    <IncidentFieldRow icon={<AlertTriangle size={13} />} label="Suspect Area" value={suspectArea} />
                  )}

                  {/* ── Indicated Issue — style SAMA dengan Issue di Support ── */}
                  {indicatedIssue && (
                    <tr className="hover:bg-slate-50">
                      <th className="px-4 py-2.5 text-left align-top w-2/5 bg-slate-50/60">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide pt-0.5">
                          <span className="text-rose-400"><AlignLeft size={13} /></span>
                          Indicated Issue
                        </div>
                      </th>
                      <td className="px-4 py-3">
                        <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {indicatedIssue}
                        </p>
                      </td>
                    </tr>

                  )}

                  {/* ── Assigne Petugas ── */}
                  <tr className="hover:bg-slate-50">
                    <th className="px-4 py-2.5 text-left align-top w-2/5 bg-slate-50/60">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide pt-0.5">
                        <span className="text-rose-400">
                          <User size={13} />
                        </span>
                        Assignee / Petugas
                      </div>
                    </th>
                    <td className="px-4 py-3">
                      {assignees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {assignees.map((a, i) => {
                            const label =
                              typeof a === "string"
                                ? a
                                : a?.name || a?.username || "Unknown";

                            return (
                              <span
                                key={i}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[11px] rounded-full font-medium"
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[12px]">
                          Belum ada petugas ditugaskan
                        </span>
                      )}
                    </td>
                  </tr>


                </tbody>
              </table>
            </CardSection>

            {/* ── AI Summary ── */}
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

            {/* ── Root Cause ── */}
            <CardSection title="Root Cause Analysis" icon={<FileSearch size={15} />} accent="rose">
              <div className={`m-4 rounded-lg border-l-4 p-4 text-[13px] leading-relaxed ${rootCause
                ? "bg-amber-50 border-amber-500 text-amber-900"
                : "bg-slate-50 border-slate-300 text-slate-400 italic"
                }`}>
                {rootCause || "Root cause analysis belum diselesaikan oleh tim investigasi."}
              </div>
            </CardSection>

            {/* ── Timeline ── */}
            <CardSection title="Action Taken / Timeline Progress" icon={<Clock size={15} />} accent="rose">
              <TimelineSection items={timelineRaw} />
            </CardSection>

          </div>


        </div>
      </main>
    </div>
  );
}

function IncidentFieldRow({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <tr className="hover:bg-slate-50">
      <th className="px-4 py-2.5 text-left w-2/5 bg-slate-50/60">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
          <span className="text-rose-400">{icon}</span>
          {label}
        </div>
      </th>
      <td className="px-4 py-2.5 text-slate-700 font-medium">{value}</td>
    </tr>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5 shrink-0">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}