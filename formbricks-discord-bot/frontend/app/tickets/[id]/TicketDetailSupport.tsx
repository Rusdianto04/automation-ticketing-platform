"use client";

import Link from "next/link";
import {
  ArrowLeft, Building2, MapPin, Layers, Hash, Package,
  Calendar, Wrench, User, Clock, FileSearch, FileText,
  AlertCircle, Phone, Mail, Monitor,
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

export default function TicketDetailSupport({
  ticket, title, requester, orgName, orgDepartment, createdAt, updatedAt,
}: Props) {
  const f         = ticket.form_fields;
  const status    = ticket.status_pengusulan;
  const assignees = Array.isArray(ticket.assignee) ? ticket.assignee : [];

  const summaryTicket = ticket.summary_ticket || "";
  const rootCause     = ticket.root_cause     || "";
  const timelineRaw   = ticket.timeline_tindak_lanjut || null;
  const issueText     = (f["Issue"] as string) || "";

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Header ── */}
      <header
        className="text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
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

        {/* ── Title Bar ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-bold font-mono text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
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

            {/* Data Formulir — Issue masuk ke sini sebagai baris terakhir multiline */}
            <CardSection title="Data Formulir Support" icon={<FileSearch size={15} />}>
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-50">
                  <FieldRow icon={<User size={13} />}      label="Reporter Information"       value={requester} />
                  <FieldRow icon={<Building2 size={13} />} label="Division / Departemen"      value={(f["Division"] || f["Departemen"] || f["Department"]) as string} />
                  <FieldRow icon={<Phone size={13} />}     label="No Telepon"                 value={f["No Telepon"] as string} />
                  <FieldRow icon={<Mail size={13} />}      label="Email"                      value={f["Email"] as string} />
                  <FieldRow icon={<Monitor size={13} />}   label="ID Device"                  value={f["ID Device"] as string} />
                  <FieldRow icon={<MapPin size={13} />}    label="Ruangan / Lokasi"           value={(f["Ruangan"] || f["Room"] || f["Location"]) as string} />
                  <FieldRow icon={<Layers size={13} />}    label="Lantai"                     value={(f["Lantai"] || f["Floor"]) as string} />
                  <FieldRow icon={<Calendar size={13} />}  label="Tanggal & Waktu Pemohon"    value={(f["Tanggal & Waktu Pemohon"] || f["Tanggal"] || f["Date"] || createdAt) as string} />
                  <FieldRow icon={<Wrench size={13} />}    label="Type of Support Requested"  value={(f["Type of Support Requested"] || f["Type of Support"] || f["Kategori"]) as string} />
                  <FieldRow icon={<Package size={13} />}   label="Jumlah Barang"              value={(f["Jumlah Barang"] || f["Quantity"]) as string} />
                  {/* Issue — baris terakhir, multiline dengan background card sesuai CardSection template */}
                  {issueText && (
                    <tr className="hover:bg-slate-50">
                      <th className="px-4 py-2.5 text-left align-top w-2/5 bg-slate-50/60">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide pt-0.5">
                          <span className="text-slate-400"><FileText size={13} /></span>
                          Issue — Deskripsi Masalah
                        </div>
                      </th>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{issueText}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardSection>

            {/* AI Summary */}
            <CardSection title="Ringkasan Ticket (AI Summary)" icon={<FileText size={15} />}>
              {summaryTicket ? (
                <div className="m-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-400 p-4 text-[13px] text-indigo-900 whitespace-pre-wrap leading-relaxed">
                  {summaryTicket}
                </div>
              ) : (
                <div className="px-4 py-5 text-[13px] text-slate-400 italic flex items-center gap-2">
                  <AlertCircle size={14} className="text-slate-300 shrink-0" />
                  Ringkasan belum tersedia. Akan diisi otomatis setelah proses klasifikasi AI selesai.
                </div>
              )}
            </CardSection>

            {/* Root Cause */}
            <CardSection title="Root Cause" icon={<FileSearch size={15} />}>
              <div className={`m-4 rounded-lg border-l-4 p-4 text-[13px] leading-relaxed ${
                rootCause
                  ? "bg-amber-50 border-amber-400 text-amber-800"
                  : "bg-slate-50 border-slate-300 text-slate-400 italic"
              }`}>
                {rootCause || "Root cause belum diisi oleh petugas."}
              </div>
            </CardSection>

            {/* Timeline */}
            <CardSection title="Timeline Progress / Tindak Lanjut" icon={<Clock size={15} />}>
              <TimelineSection items={timelineRaw} />
            </CardSection>

          </div>

          {/* ── RIGHT ── */}
          <div className="space-y-5">
            <CardSection title="Informasi Ticket" icon={<Hash size={15} />}>
              <dl className="px-4 py-3 space-y-3 text-[13px]">
                <InfoItem label="ID Ticket" value={
                  <span className="font-mono font-bold text-indigo-600">#{ticket.id}</span>
                } />
                <InfoItem label="Status" value={<StatusBadge status={status} />} />
                <InfoItem label="Type" value={
                  <span className="font-medium text-slate-700">Ticketing Support</span>
                } />
                {(f["Tanggal & Waktu Pemohon"] as string) && (
                  <InfoItem label="Tgl Pemohon" value={
                    <span className="text-slate-600 text-[12px]">{f["Tanggal & Waktu Pemohon"] as string}</span>
                  } />
                )}
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

function FieldRow({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string | undefined;
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

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5 shrink-0">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}