/**
 * pages/index.js
 * Dashboard utama Peppermint Portal — menampilkan semua tiket dari DB backend
 *
 * Server-Side Rendering (SSR) via getServerSideProps:
 *   - Fetch data di server → tidak ada CORS issue
 *   - Data selalu fresh setiap load
 */

import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { getTickets, getStats } from "../lib/api";
import {
  formatDate, timeAgo,
  getStatusBadge, getTypeBadge,
  isActiveStatus,
} from "../lib/utils";

const ORG_NAME       = process.env.NEXT_PUBLIC_ORG_NAME       || "SEAMOLEC";
const ORG_DEPARTMENT = process.env.NEXT_PUBLIC_ORG_DEPARTMENT || "IT Department";

// ─── Server-Side Rendering ────────────────────────────────────────────────────
export async function getServerSideProps(context) {
  const { status, type, search, page = "1" } = context.query;
  const limit  = 50;
  const offset = (parseInt(page) - 1) * limit;

  try {
    const [ticketsData, statsData] = await Promise.all([
      getTickets({ status, type, search, limit, offset }),
      getStats(),
    ]);

    return {
      props: {
        tickets:       ticketsData.tickets    || [],
        total:         ticketsData.total      || 0,
        stats:         statsData.totals       || {},
        byTypeStatus:  statsData.byTypeStatus || [],
        recentActivity:statsData.recentActivity || [],
        filters:       { status: status || "", type: type || "", search: search || "" },
        pagination:    { page: parseInt(page), limit, offset, total: ticketsData.total || 0 },
        error:         null,
      },
    };
  } catch (err) {
    return {
      props: {
        tickets: [], total: 0, stats: {}, byTypeStatus: [], recentActivity: [],
        filters: { status: "", type: "", search: "" },
        pagination: { page: 1, limit, offset: 0, total: 0 },
        error: err.message,
      },
    };
  }
}

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "border-indigo-400", icon }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${color} p-5 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-gray-800">{value ?? "—"}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function Badge({ label, colors }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
      {label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Dashboard({ tickets, total, stats, recentActivity, filters, pagination, error }) {
  const [search, setSearch]   = useState(filters.search || "");
  const [status, setStatus]   = useState(filters.status || "");
  const [type,   setType]     = useState(filters.type   || "");

  function applyFilter() {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (type)   q.set("type",   type);
    if (search.trim()) q.set("search", search.trim());
    window.location.href = `/` + (q.toString() ? `?${q.toString()}` : "");
  }

  function clearFilter() {
    window.location.href = "/";
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <>
      <Head>
        <title>Dashboard Tiket — {ORG_NAME}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] text-white px-8 py-5 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-wide">🎫 Dashboard Tiket Helpdesk</h1>
          <p className="text-sm text-gray-400 mt-0.5">{ORG_NAME} — {ORG_DEPARTMENT}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/knowledge" className="text-sm text-gray-300 hover:text-white transition-fast">
            📚 Knowledge Base
          </Link>
          <span className="text-xs text-gray-500">Portal v1.0 | Prisma</span>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mx-8 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ Gagal memuat data: {error}. Pastikan backend berjalan di {process.env.NEXT_PUBLIC_API_URL}.
        </div>
      )}

      {/* ── Stats ── */}
      <section className="px-8 py-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Total Tiket"    value={stats.total_tickets}    color="border-indigo-400"  icon="🎫" />
        <StatCard label="Open / Aktif"   value={stats.open_tickets}     color="border-green-400"   icon="🔔"
          sub={`${stats.new_today || 0} baru hari ini`} />
        <StatCard label="Selesai"        value={stats.closed_tickets}   color="border-blue-400"    icon="✅"
          sub={`${stats.resolved_today || 0} hari ini`} />
        <StatCard label="Incident"       value={stats.incidents}        color="border-red-400"     icon="🚨" />
        <StatCard label="Support"        value={stats.support_tickets}  color="border-purple-400"  icon="🛠" />
        <StatCard label="Avg Resolusi"   value={stats.avg_resolution_hours ? `${stats.avg_resolution_hours}j` : "—"}
          color="border-yellow-400" icon="⏱" sub="rata-rata" />
      </section>

      {/* ── Filters ── */}
      <section className="px-8 pb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:border-indigo-400">
            <option value="">Semua</option>
            {["OPEN","PENDING","APPROVED","REJECTED","DONE","INVESTIGASI","MITIGASI","RESOLVED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Tipe</label>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:border-indigo-400">
            <option value="">Semua</option>
            <option value="TICKETING">TICKETING</option>
            <option value="INCIDENT">INCIDENT</option>
          </select>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilter()}
          placeholder="🔍  Cari judul, reporter, summary..."
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-indigo-400"
        />

        <button onClick={applyFilter}
          className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-fast">
          Cari
        </button>

        {(filters.status || filters.type || filters.search) && (
          <button onClick={clearFilter}
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-fast">
            × Reset
          </button>
        )}

        <span className="ml-auto text-sm text-gray-500">
          Menampilkan {tickets.length} dari {total} tiket
        </span>
      </section>

      {/* ── Ticket Table ── */}
      <section className="px-8 pb-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#2d3748] text-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Judul</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Tipe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Assignee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Reporter</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">Dibuat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      <div className="text-4xl mb-3">📭</div>
                      <div className="font-medium">Tidak ada tiket ditemukan</div>
                      <div className="text-sm mt-1">Coba ubah filter atau buat tiket baru</div>
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => {
                    const statusColors = getStatusBadge(ticket.status);
                    const typeColors   = getTypeBadge(ticket.type);
                    const isIncident   = ticket.type === "INCIDENT";
                    return (
                      <tr key={ticket.id}
                        className={`hover:bg-gray-50 transition-fast ${isIncident ? "bg-red-50/30" : ""}`}>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-600 whitespace-nowrap">
                          #{ticket.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 truncate max-w-xs" title={ticket.title}>
                            {ticket.title}
                          </div>
                          {ticket.summary && (
                            <div className="text-xs text-gray-400 truncate max-w-xs mt-0.5" title={ticket.summary}>
                              {ticket.summary}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge label={ticket.type} colors={typeColors} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge label={ticket.status} colors={statusColors} />
                          {ticket.statusNote && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]" title={ticket.statusNote}>
                              {ticket.statusNote}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-600 max-w-[150px] truncate">
                            {Array.isArray(ticket.assignee) && ticket.assignee.length > 0
                              ? ticket.assignee.map((a) => a.username || a.name || "?").join(", ")
                              : <span className="text-gray-300 italic">Belum assigned</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {ticket.reporter}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          <div>{timeAgo(ticket.createdAt)}</div>
                          <div className="text-gray-400">{formatDate(ticket.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/tickets/${ticket.id}`}
                            className="inline-block px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-fast">
                            Detail
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Halaman {pagination.page} dari {totalPages}
              </span>
              <div className="flex gap-2">
                {pagination.page > 1 && (
                  <Link href={`/?page=${pagination.page - 1}${status ? `&status=${status}` : ""}${type ? `&type=${type}` : ""}`}
                    className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-fast">
                    ← Prev
                  </Link>
                )}
                {pagination.page < totalPages && (
                  <Link href={`/?page=${pagination.page + 1}${status ? `&status=${status}` : ""}${type ? `&type=${type}` : ""}`}
                    className="px-3 py-1 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-fast">
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}