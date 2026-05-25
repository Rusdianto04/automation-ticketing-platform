"use client";

import Link from "next/link";
import { BackButton } from "./BackButton";
import type { Ticket } from "@/types";
import { StatusBadge, TimelineSection } from "./SharedComponents";

interface UserRecommendation {
  found: boolean;
  count: number;
  message: string;
  summary: string;
  actionSteps: string[];
  stepSource: string;
  disclaimer: string;
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
  createdAt, updatedAt, userRecommendation,
}: Props) {
  const f         = ticket.form_fields;
  const status    = ticket.status_pengusulan;
  const assignees = Array.isArray(ticket.assignee) ? ticket.assignee : [];
  const summaryTicket = ticket.summary_ticket || "";
  const rootCause     = ticket.root_cause     || "";
  const timelineRaw   = ticket.timeline_tindak_lanjut || null;

  const rec    = userRecommendation;
  const hasRec = rec?.found && (rec.summary || rec.actionSteps?.length > 0);

  const assigneeNames = assignees.map((a) =>
    typeof a === "string" ? a : (a as any)?.displayName || (a as any)?.username || (a as any)?.name || "—"
  ).join(", ") || "—";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f1f5f9" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-30 text-white"
        style={{ background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px" }}>
          <div className="flex items-center justify-between h-16">
            <BackButton />
            <div className="flex items-center gap-3">
              <span className="font-mono text-[12px] text-slate-400">#{ticket.id}</span>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6" style={{ maxWidth: 860, margin: "0 auto", width: "100%", padding: "24px 20px" }}>

        {/* Title block */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" }}
            >
              Support Ticket
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-slate-800 leading-snug">{title}</h1>
          <p className="text-[12px] text-slate-400 mt-1">{orgName} — {orgDepartment}</p>
        </div>

        {/* Info grid */}
        <div className="bg-white rounded-xl mb-4" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Informasi Tiket</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y divide-slate-100">
            <InfoCell label="Reporter" value={requester} />
            <InfoCell label="Division" value={(f["Division"] || f["Departemen"] || f["Department"] || "—") as string} />
            <InfoCell label="Type of Support" value={(f["Type of Support Requested"] || f["Kategori"] || "—") as string} />
            <InfoCell label="Ruangan" value={(f["Ruangan"] || "—") as string} />
            <InfoCell label="Lantai" value={(f["Lantai"] || "—") as string} />
            <InfoCell label="Petugas" value={assigneeNames} />
            <InfoCell label="Dibuat" value={createdAt} />
            <InfoCell label="Diperbarui" value={updatedAt} />
            <InfoCell label="Status" value={<StatusBadge status={status} />} />
          </div>
        </div>

        {/* Issue */}
        {f["Issue"] && (
          <div className="bg-white rounded-xl mb-4" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi Masalah</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">{f["Issue"] as string}</p>
            </div>
          </div>
        )}

        {/* Smart Recommendation */}
        {hasRec && (
          <div className="bg-white rounded-xl mb-4 overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-5 py-3 border-b border-slate-100" style={{ background: "#0f172a" }}>
              <p className="text-[11px] font-bold text-white uppercase tracking-wider">Panduan Sementara</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Berdasarkan kasus serupa</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {rec!.summary && (
                <p className="text-[13px] text-slate-600 leading-relaxed border-l-2 pl-3" style={{ borderColor: "#334155" }}>
                  {rec!.summary}
                </p>
              )}
              {rec!.actionSteps && rec!.actionSteps.length > 0 && (
                <ol className="space-y-2">
                  {rec!.actionSteps.map((action, ai) => (
                    <li key={ai} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5" style={{ background: "#1e293b" }}>
                        {ai + 1}
                      </span>
                      <span className="text-[12px] text-slate-700 leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-xl mb-4" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Summary</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13px] text-slate-600 whitespace-pre-wrap leading-relaxed">
              {summaryTicket || "Summary belum tersedia."}
            </p>
          </div>
        </div>

        {/* Root Cause */}
        <div className="bg-white rounded-xl mb-4" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Root Cause</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13px] text-slate-600 whitespace-pre-wrap leading-relaxed">
              {rootCause || "Root Cause belum ditemukan."}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Progress Tindak Lanjut</p>
          </div>
          <div className="px-5 py-4">
            <TimelineSection items={timelineRaw} />
          </div>
        </div>

      </main>

      <footer className="py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-40 h-px" style={{ background: "linear-gradient(90deg, transparent, #94a3b8, transparent)" }} />
          <p className="text-[11px] text-slate-400 tracking-wider">Copyright © {new Date().getFullYear()} SEAMOLEC, Org.</p>
        </div>
      </footer>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-3.5 flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-[13px] font-medium text-slate-700">{value || "—"}</span>
    </div>
  );
}