"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Filter, RefreshCw, ChevronRight } from "lucide-react";

interface TicketRow {
  id: number;
  type: string;
  title: string;
  status: string;
  requester: string;
  assignee: string;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:     "bg-amber-50 text-amber-700 border-amber-200",
  DONE:        "bg-slate-100 text-slate-600 border-slate-200",
  REJECT:      "bg-red-50 text-red-700 border-red-200",
  INVESTIGASI: "bg-orange-50 text-orange-700 border-orange-200",
  MITIGASI:    "bg-purple-50 text-purple-700 border-purple-200",
  RESOLVED:    "bg-teal-50 text-teal-700 border-teal-200",
};

export default function AdminTicketsClient({ tickets }: { tickets: TicketRow[] }) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType,   setFilterType]   = useState("");
  const [search,       setSearch]       = useState("");

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus = !filterStatus || t.status === filterStatus;
      const matchType   = !filterType   || t.type   === filterType;

      const q = search.trim();
      if (!q) return matchStatus && matchType;

      // FIX: Search ID — exact match saja (sama seperti DashboardClient)
      const numericQ = q.replace(/^#/, "").trim();
      const isNumeric = /^\d+$/.test(numericQ);

      let matchQ: boolean;
      if (isNumeric) {
        matchQ = t.id === parseInt(numericQ, 10);
      } else {
        const ql = q.toLowerCase();
        matchQ =
          t.title.toLowerCase().includes(ql) ||
          t.requester.toLowerCase().includes(ql);
      }

      return matchStatus && matchType && matchQ;
    });
  }, [tickets, filterStatus, filterType, search]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-bold text-slate-800">Ticket Monitoring</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {filtered.length} dari {tickets.length} tiket ditampilkan
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[12px] font-semibold transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </header>

      <div className="px-6 py-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
          <Filter size={14} className="text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400"
          >
            <option value="">Semua Status</option>
            <option value="OPEN">Open</option>
            <option value="PENDING">Pending</option>
            <option value="INVESTIGASI">Investigasi</option>
            <option value="MITIGASI">Mitigasi</option>
            <option value="DONE">Done</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECT">Reject</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400"
          >
            <option value="">Semua Tipe</option>
            <option value="TICKETING">Support</option>
            <option value="INCIDENT">Incident</option>
          </select>
          <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID (#1), judul, nama..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Judul</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Reporter</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Assignee</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Dibuat</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase">Diperbarui</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t) => (
                  <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${t.type === "INCIDENT" ? "bg-rose-50/20" : ""}`}>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">#{t.id}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <span className="truncate block font-medium text-slate-700" title={t.title}>{t.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.type === "INCIDENT" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}>
                        {t.type === "INCIDENT" ? "🚨 Incident" : "🎫 Support"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[t.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[130px]">
                      <span className="truncate block">{t.requester}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[12px] max-w-[130px]">
                      <span className="truncate block">{t.assignee || <span className="italic text-slate-300">—</span>}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">{t.created_at}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">{t.updated_at}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tickets/${t.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap"
                      >
                        Kelola <ChevronRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-[13px]">
                      Tidak ada ticket yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}