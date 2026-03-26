"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

export default function ReportsClient() {
  const now = new Date();

  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear,  setSelYear]  = useState(now.getFullYear());
  const [dlSupport,  setDlSupport]  = useState(false);
  const [dlIncident, setDlIncident] = useState(false);

  const MONTHS = [
    { v: 1,  l: "Januari" },  { v: 2,  l: "Februari" }, { v: 3,  l: "Maret" },
    { v: 4,  l: "April" },    { v: 5,  l: "Mei" },       { v: 6,  l: "Juni" },
    { v: 7,  l: "Juli" },     { v: 8,  l: "Agustus" },   { v: 9,  l: "September" },
    { v: 10, l: "Oktober" },  { v: 11, l: "November" },  { v: 12, l: "Desember" },
  ];

  // Tahun: 3 tahun ke belakang s/d tahun sekarang
  const YEARS = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 3 + i);

  const monthLabel = MONTHS.find((m) => m.v === selMonth)?.l || `Bulan${selMonth}`;

  const handleDownload = async (type: "support" | "incident") => {
    const setLoading = type === "support" ? setDlSupport : setDlIncident;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/export/${type}?month=${selMonth}&year=${selYear}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Gagal generate Excel" }));
        alert(`Error: ${err.error || "Gagal generate Excel"}`);
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href  = URL.createObjectURL(blob);
      link.download = `Laporan_${type === "support" ? "Support" : "Incident"}_${monthLabel}_${selYear}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      alert("Gagal mengunduh laporan. Pastikan server berjalan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div>
          <h1 className="text-[16px] font-bold text-slate-800">Reports &amp; Analytics</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Download laporan ticket dalam format Excel per bulan
          </p>
        </div>
      </header>

      <div className="px-6 py-6 space-y-5 max-w-3xl">

        {/* ── Panel Download ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet size={14} />
            Download Laporan Excel
          </div>

          <div className="p-6 space-y-6">
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Pilih bulan dan tahun, lalu unduh laporan Excel untuk masing-masing tipe ticket.
              Setiap file berisi <strong>1 sheet</strong> dengan seluruh data ticket dalam periode tersebut.
            </p>

            {/* ── Filter Bulan & Tahun ── */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Bulan
                </label>
                <select
                  value={selMonth}
                  onChange={(e) => setSelMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                >
                  {MONTHS.map((m) => (
                    <option key={m.v} value={m.v}>{m.l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Tahun
                </label>
                <select
                  value={selYear}
                  onChange={(e) => setSelYear(Number(e.target.value))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="text-[12px] text-slate-400 pb-2">
                Periode: <strong className="text-slate-600">{monthLabel} {selYear}</strong>
              </div>
            </div>

            {/* ── Tombol Download ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Support */}
              <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <FileText size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-700">Ticketing Support</p>
                    <p className="text-[11px] text-slate-400">Data tiket layanan IT</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Reporter, Divisi, No Telepon, Email, ID Device, Ruangan, Lantai,
                  Tanggal, Type Support, Jumlah Barang, Keluhan, Assign Team,
                  Tindak Lanjut, Attachment, Status.
                </p>
                <button
                  onClick={() => handleDownload("support")}
                  disabled={dlSupport}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-[13px] font-bold transition-colors"
                >
                  {dlSupport ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Download Excel Support
                    </>
                  )}
                </button>
              </div>

              {/* Incident */}
              <div className="border border-rose-100 bg-rose-50/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center">
                    <FileText size={18} className="text-rose-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-700">Incident</p>
                    <p className="text-[11px] text-slate-400">Data laporan Incident IT</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Title, Date/Time, Priority, Severity, Suspect Area, Assign Team,
                  Action Taken, Indicated Issue, Handling, Evidence Attachment, Status.
                </p>
                <button
                  onClick={() => handleDownload("incident")}
                  disabled={dlIncident}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-[13px] font-bold transition-colors"
                >
                  {dlIncident ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Download Excel Incident
                    </>
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              ⓘ File Excel otomatis terunduh setelah proses selesai.
              Nama file: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">Laporan_Support_{monthLabel}_{selYear}.xlsx</code> dan <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">Laporan_Incident_{monthLabel}_{selYear}.xlsx</code>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}