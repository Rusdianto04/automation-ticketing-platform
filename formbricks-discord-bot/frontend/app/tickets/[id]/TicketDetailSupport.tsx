"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Ticket } from "@/types";
import { StatusBadge, CardSection, TimelineSection } from "./SharedComponents";

interface UserRecommendationStep {
  type: "similar" | "runbook";
  label: string;
  category?: string;
  hint: string | null;
}

interface UserRecommendation {
  found: boolean;
  count: number;
  message: string;
  steps: UserRecommendationStep[];
}

interface Props {
  ticket: Ticket;
  title: string;
  requester: string;
  orgName: string;
  orgDepartment: string;
  createdAt: string;
  updatedAt: string;
  userRecommendation?: UserRecommendation | null;
}

export default function TicketDetailSupport({
  ticket, title, requester, orgName, orgDepartment,
  userRecommendation,
}: Props) {
  const f         = ticket.form_fields;
  const status    = ticket.status_pengusulan;
  const assignees = Array.isArray(ticket.assignee) ? ticket.assignee : [];

  const summaryTicket = ticket.summary_ticket || "";
  const rootCause     = ticket.root_cause     || "";
  const timelineRaw   = ticket.timeline_tindak_lanjut || null;

  return (
    <div className="min-h-screen" style={{ background: "#d9e1f2" }}>

      {/* ── Header ── */}
      <header
        className="text-white sticky top-0 z-30"
        style={{
          background:   "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="w-full px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2 text-[13px]">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-slate-300 hover:text-white transition"
              >
                <ArrowLeft size={15} />
                Kembali ke Dashboard
              </Link>
              <ChevronRight size={14} className="text-slate-500" />
              <span className="font-mono text-indigo-300">#{ticket.id}</span>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold">{orgName}</p>
              <p className="text-[11px] text-slate-400">{orgDepartment}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-5">
          <CardSection
            header={
              <div className="w-full text-center py-2">
                <h1 className="text-[20px] font-bold text-white">{title}</h1>
                <p className="text-[12px] text-white/70 mt-1">Ticket Report</p>
              </div>
            }
          >
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-slate-100">

                {/* Info */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoBlock label="Reporter"       value={requester} />
                      <InfoBlock label="Division"       value={(f["Division"] || f["Departemen"] || f["Department"]) as string} />
                      <InfoBlock label="ID Device"      value={f["ID Device"] as string} />
                      <InfoBlock label="Type of Support" value={(f["Type of Support Requested"] || f["Kategori"]) as string} />
                      <InfoBlock label="Status"         value={<StatusBadge status={status} />} />
                      <InfoBlock label="Petugas"        value={<AssigneeInline assignees={assignees} />} />
                    </div>
                  </td>
                </tr>

                {/* Summary */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Summary</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {summaryTicket || "Ringkasan belum tersedia."}
                    </p>
                  </td>
                </tr>

                {/* ── SMART RECOMMENDATION — User Portal*/}
                {userRecommendation?.found && userRecommendation.steps.length > 0 && (
                  <tr>
                    <td colSpan={2} className="px-5 pb-5">
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">

                        {/* Header */}
                        <div
                          className="px-4 py-2.5 flex items-center gap-2"
                          style={{
                            background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
                          }}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                            💡 Smart Recommendation
                          </span>
                          <span className="ml-auto text-[10px] font-normal text-white/60">
                            Berdasarkan kasus serupa
                          </span>
                        </div>

                        <div className="p-4 space-y-3">
                          {/* Pesan intro */}
                          <p className="text-[12px] text-slate-600 leading-relaxed">
                            {userRecommendation.message}
                          </p>

                          {/* Steps — max 2, tanpa ID tiket */}
                          {userRecommendation.steps.slice(0, 2).map((step, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-slate-100 p-3"
                              style={{ background: "#f8f9fb" }}
                            >
                              {/* Label step */}
                              <p className="text-[11px] font-bold mb-1 text-slate-800">
                                {step.type === "runbook" ? "📖" : "✅"} {step.label}
                                {step.category && (
                                  <span className="ml-1 text-[10px] text-slate-400 font-normal">
                                    [{step.category}]
                                  </span>
                                )}
                              </p>

                              {/* Konten solusi */}
                              {step.hint && (
                                <p className="text-[12px] text-slate-600 whitespace-pre-wrap leading-relaxed">
                                  {step.hint}
                                </p>
                              )}
                            </div>
                          ))}

                          {/* Disclaimer */}
                          <p className="text-[10px] text-slate-400 italic">
                            ℹ️ Rekomendasi ini bersifat sementara. Teknisi kami akan segera menangani permasalahan Anda.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Root Cause */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Root Cause</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {rootCause || "Root cause belum tersedia."}
                    </p>
                  </td>
                </tr>

                {/* Timeline */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Timeline</h3>
                    <TimelineSection items={timelineRaw} />
                  </td>
                </tr>

              </tbody>
            </table>
          </CardSection>
        </div> 
      </main>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <div className="text-[13px] font-medium text-slate-700">{value}</div>
    </div>
  );
}

function AssigneeInline({ assignees }: { assignees: any[] }) {
  if (!assignees || assignees.length === 0)
    return <span className="text-slate-400 italic">-</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {assignees.map((a, i) => {
        const name = typeof a === "string" ? a : a?.name || a?.username || "Unknown";
        return (
          <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] rounded-full">
            {name}
          </span>
        );
      })}
    </div>
  );
}