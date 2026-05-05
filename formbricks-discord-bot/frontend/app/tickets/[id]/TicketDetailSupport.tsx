"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Ticket } from "@/types";
import { StatusBadge, CardSection, TimelineSection } from "./SharedComponents";

// ── Interface UserRecommendation — v11 final ──────────────────────────────────
// Flat structure: 1 layout terpadu, bukan array steps
interface UserRecommendation {
  found:       boolean;
  count:       number;
  message:     string;
  summary:     string;          // rangkuman terpadu dari semua kasus serupa
  actionSteps: string[];        // langkah-langkah bersih tanpa timestamp
  stepSource:  string;          // "ticket" | nama runbook
  disclaimer:  string;
}

interface Props {
  ticket:             Ticket;
  title:              string;
  requester:          string;
  orgName:            string;
  orgDepartment:      string;
  createdAt:          string;
  updatedAt:          string;
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

  const rec    = userRecommendation;
  const hasRec = rec?.found && (rec.summary || rec.actionSteps?.length > 0);

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

                {/* ── Info ── */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoBlock label="Reporter"        value={requester} />
                      <InfoBlock label="Division"        value={(f["Division"] || f["Departemen"] || f["Department"]) as string} />
                      <InfoBlock label="ID Device"       value={f["ID Device"] as string} />
                      <InfoBlock label="Type of Support" value={(f["Type of Support Requested"] || f["Kategori"]) as string} />
                      <InfoBlock label="Status"          value={<StatusBadge status={status} />} />
                      <InfoBlock label="Petugas"         value={<AssigneeInline assignees={assignees} />} />
                    </div>
                  </td>
                </tr>

                {/* ── Summary ── */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Summary</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {summaryTicket || "Hasil Belum Ditemukan"}
                    </p>
                  </td>
                </tr>

                {/* ── SMART RECOMMENDATION — 1 Layout Terpadu ──
                    v12: Simplified — hapus pesan intro & disclaimer
                    Hanya header + ringkasan + langkah-langkah ── */}
                {hasRec && (
                  <tr>
                    <td colSpan={2} className="px-5 pb-6">
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{ border: "1px solid #e2e8f0" }}
                      >
                        {/* ── Card Header ── */}
                        <div
                          className="px-4 py-3 flex items-center gap-2"
                          style={{ background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)" }}
                        >
                          <span className="text-white text-[11px] font-bold uppercase tracking-wider">
                            💡 Panduan Sementara
                          </span>
                          <span className="ml-auto text-white/50 text-[10px]">
                            Berdasarkan kasus serupa
                          </span>
                        </div>

                        {/* ── Card Body ── */}
                        <div className="px-4 py-4 space-y-3" style={{ background: "#f8fafc" }}>

                          {/* Ringkasan singkat (jika ada) */}
                          {rec!.summary && (
                            <p
                              className="text-[12px] text-slate-600 leading-relaxed border-l-4 pl-3"
                              style={{ borderColor: "#334155" }}
                            >
                              {rec!.summary}
                            </p>
                          )}

                          {/* Langkah-langkah — numbered, tanpa tanggal/waktu */}
                          {rec!.actionSteps && rec!.actionSteps.length > 0 && (
                            <div>
                              <p
                                className="text-[10px] font-bold uppercase tracking-wide mb-3"
                                style={{ color: "#64748b" }}
                              >
                                📋 Langkah-langkah yang Dapat Anda Coba:
                              </p>
                              <ol className="space-y-2.5">
                                {rec!.actionSteps.map((action, ai) => (
                                  <li key={ai} className="flex items-start gap-3">
                                    {/* Nomor lingkaran */}
                                    <span
                                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
                                      style={{ background: "#1e293b", minWidth: "1.5rem" }}
                                    >
                                      {ai + 1}
                                    </span>
                                    <span className="text-[12px] text-slate-700 leading-relaxed">
                                      {action}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {/* Fallback jika tidak ada konten sama sekali */}
                          {(!rec!.actionSteps || rec!.actionSteps.length === 0) && !rec!.summary && (
                            <p className="text-[12px] text-slate-500 italic">
                              Saat ini belum ada langkah spesifik yang tersedia. Teknisi kami akan segera membantu Anda.
                            </p>
                          )}

                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Root Cause ── */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Root Cause</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {rootCause || "Permasalahan Belum Ditemukan"}
                    </p>
                  </td>
                </tr>

                {/* ── Timeline ── */}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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