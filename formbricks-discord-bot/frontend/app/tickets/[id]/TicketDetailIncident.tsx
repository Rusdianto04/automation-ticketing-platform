"use client";

import Link from "next/link";
import {
  ArrowLeft
} from "lucide-react";
import type { Ticket } from "@/types";
import { CardSection, TimelineSection } from "./SharedComponents";

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
  ticket, title, orgName, orgDepartment
}: Props) {
  const f = ticket.form_fields;

  const summaryTicket = ticket.summary_ticket || "";
  const rootCause = ticket.root_cause || "";
  const timelineRaw = ticket.timeline_action_taken || ticket.timeline_tindak_lanjut || null;
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

        <div className="max-w-screen-xl mx-auto space-y-5">
          {/* ── LEFT ── */}

          <div className="space-y-5">

            {/* ── Data Formulir Incident — Indicated Issue masuk tabel ── */}
            <CardSection
              header={
                <div className="w-full text-center py-2">

                  {/* TITLE */}
                  <h1 className="text-[20px] font-bold text-white leading-snug">
                    {incidentTitle}
                  </h1>

                  {/* SUBTITLE */}
                  <p className="text-[12px] text-white/70 mt-1">
                    Incident Report
                  </p>

                </div>
              }
            >              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-100">

                  {/* ── SUMMARY ── */}
                  <tr>
                    <td colSpan={2} className="px-5 py-5">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        Summary
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {summaryTicket || "Ringkasan belum tersedia."}
                      </p>
                    </td>
                  </tr>

                  {/* ── ROOT CAUSE ── */}
                  <tr>
                    <td colSpan={2} className="px-5 py-5">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        Root Cause Analysis
                      </h3>

                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {rootCause || "Root cause analysis belum tersedia."}
                      </p>
                    </td>
                  </tr>

                  {/* ── TIMELINE ── */}
                  <tr>
                    <td colSpan={2} className="px-5 py-5">
                      <h3 className="text-[13px] text-slate-700">
                        Timeline
                      </h3>

                      <TimelineSection items={timelineRaw} />
                    </td>
                  </tr>

                </tbody>
              </table>
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