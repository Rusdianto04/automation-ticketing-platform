"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
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

export default function TicketDetailSupport({
  ticket, title, requester, orgName, orgDepartment, createdAt, updatedAt,
}: Props) {
  const f = ticket.form_fields;
  const status = ticket.status_pengusulan;
  const assignees = Array.isArray(ticket.assignee) ? ticket.assignee : [];

  const summaryTicket = ticket.summary_ticket || "";
  const rootCause = ticket.root_cause || "";
  const timelineRaw = ticket.timeline_tindak_lanjut || null;

  return (
    <div className="min-h-screen" style={{ background: "#d9e1f2" }}>

      {/* ── Header ── */}
      <header
        className="text-white sticky top-0 z-30"
        style={{
          background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="w-full px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-20 relative">

            {/* ── KIRI: BACK + ID ── */}
            <div className="flex items-center gap-2 text-[13px]">

              {/* BACK */}
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-slate-300 hover:text-white transition"
              >
                <ArrowLeft size={15} />
                Kembali ke Dashboard
              </Link>

              {/* SEPARATOR */}
              <ChevronRight size={14} className="text-slate-500" />

              {/* ID */}
              <span className="font-mono text-indigo-300">
                #{ticket.id}
              </span>

            </div>

            {/* ── KANAN: ORG ── */}
            <div className="text-right">
              <p className="text-[12px] font-semibold">{orgName}</p>
              <p className="text-[11px] text-slate-400">{orgDepartment}</p>
            </div>

          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── LEFT ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Data Formulir Support — Issue masuk ke dalam tabel ── */}
          <CardSection
            header={
              <div className="w-full text-center py-2">
                <h1 className="text-[20px] font-bold text-white">
                  {title}
                </h1>
                <p className="text-[12px] text-white/70 mt-1">
                  Ticket Report
                </p>
              </div>
            }
          >
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-slate-100">

                {/* ── CONTEXT INFO (NEW) ── */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">

                      <InfoBlock label="Reporter" value={requester} />
                      <InfoBlock label="Division" value={(f["Division"] || f["Departemen"] || f["Department"]) as string} />
                      <InfoBlock label="ID Device" value={f["ID Device"] as string} />
                      <InfoBlock label="Type of Support" value={(f["Type of Support Requested"] || f["Kategori"]) as string} />
                      <InfoBlock label="Status" value={<StatusBadge status={status} />} />
                      <InfoBlock label="Petugas" value={<AssigneeInline assignees={assignees} />} />

                    </div>

                  </td>
                </tr>

                {/* ── SUMMARY ── */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">
                      Summary
                    </h3>

                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {summaryTicket || "Ringkasan belum tersedia."}
                    </p>
                  </td>
                </tr>

                {/* ── ROOT CAUSE ── */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">
                      Root Cause
                    </h3>

                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {rootCause || "Root cause belum tersedia."}
                    </p>
                  </td>
                </tr>

                {/* ── TIMELINE ── */}
                <tr>
                  <td colSpan={2} className="px-5 py-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">
                      Timeline
                    </h3>

                    <TimelineSection items={timelineRaw} />
                  </td>
                </tr>

              </tbody>
            </table>
          </CardSection>
        </div>

      </main>
    </div>);
}

// ─── Field Row ─────────────────────────────────────────────────────────────────

function FieldRow({ icon, label, value }: {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
}) {
  if (!value) return null;
  return (
    <tr className="hover:bg-slate-50">
      <th className="px-4 py-2.5 text-left w-2/5 bg-slate-50/60">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
          <span className="text-slate-400">{icon}</span>
          {label}
        </div>
      </th>
      <td className="px-4 py-2.5 text-slate-700 font-medium">{value}</td>
    </tr>
  );
}

// ─── Info Item ─────────────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5 shrink-0">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function InfoBlock({ label, value }: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;

  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <div className="text-[13px] font-medium text-slate-700">
        {value}
      </div>
    </div>
  );
}

function AssigneeInline({ assignees }: {
  assignees: any[];
}) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-slate-400 italic">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {assignees.map((a, i) => {
        const name =
          typeof a === "string"
            ? a
            : a?.name || a?.username || "Unknown";

        return (
          <span
            key={i}
            className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] rounded-full"
          >
            {name}
          </span>
        );
      })}
    </div>
  );
}