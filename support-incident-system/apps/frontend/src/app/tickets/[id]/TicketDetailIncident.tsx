"use client";

import Link from "next/link";
import { BackButton } from "./BackButton";
import type { Ticket } from "@/types";
import { StatusBadge, TimelineSection } from "./SharedComponents";

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
  ticket, title, orgName, orgDepartment, createdAt, updatedAt,
}: Props) {
  const f = ticket.form_fields;
  const status = ticket.status_pengusulan;

  const summaryTicket = ticket.summary_ticket || "";
  const rootCause     = ticket.root_cause     || "";
  const timelineRaw   = ticket.timeline_action_taken || ticket.timeline_tindak_lanjut || null;
  const incidentTitle = (f["Incident Title"] as string) || (f["Incident Information"] as string) || title;

  const reporter = (f["Reporter Information"] as string) ||
    (f["Name"] as string) ||
    (f["Nama"] as string) ||
    "—";

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
              style={{ background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }}
            >
              Incident Report
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-slate-800 leading-snug">{incidentTitle}</h1>
          <p className="text-[12px] text-slate-400 mt-1">{orgName} — {orgDepartment}</p>
        </div>

        {/* Info grid */}
        <div className="bg-white rounded-xl mb-4" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Informasi Incident</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y divide-slate-100">
            <InfoCell label="Priority" value={(f["Priority Incident"] || f["Priority"] || "—") as string} />
            <InfoCell label="Severity" value={(f["Severity Incident"] || f["Severity"] || "—") as string} />
            <InfoCell label="Suspect Area" value={(f["Suspect Area"] || "—") as string} />
            <InfoCell label="Indicated Issue" value={(f["Indicated Issue"] || "—") as string} />
            <InfoCell label="Status" value={<StatusBadge status={status} />} />
            <InfoCell label="Dibuat" value={createdAt} />
            <InfoCell label="Diperbarui" value={updatedAt} />
          </div>
        </div>

        {/* Indicated Issue — deskripsi panjang jika ada */}
        {f["Issue Description"] && (
          <div className="bg-white rounded-xl mb-4" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi Incident</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">{f["Issue Description"] as string}</p>
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
              {summaryTicket || "Summary Ticket belum tersedia."}
            </p>
          </div>
        </div>

        {/* Root Cause */}
        <div className="bg-white rounded-xl mb-4" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Root Cause Analysis</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13px] text-slate-600 whitespace-pre-wrap leading-relaxed">
              {rootCause || "Root cause analysis belum tersedia."}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl" style={{ border: "1px solid #e2e8f0" }}>
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action Taken</p>
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