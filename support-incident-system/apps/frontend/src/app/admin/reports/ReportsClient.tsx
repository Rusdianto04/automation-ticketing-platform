"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Calendar } from "lucide-react";

type RangeMode = "month" | "range";

export default function ReportsClient() {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay   = now.getDate();

  const [rangeMode, setRangeMode] = useState<RangeMode>("month");

  // Per Bulan
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [selYear,  setSelYear]  = useState(currentYear);

  // Range — masing-masing field INDEPENDEN, tidak saling reset
  const [startDay,   setStartDay]   = useState(1);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [startYear,  setStartYear]  = useState(currentYear);
  const [endDay,     setEndDay]     = useState(currentDay);
  const [endMonth,   setEndMonth]   = useState(currentMonth);
  const [endYear,    setEndYear]    = useState(currentYear);

  const [dlSupport,  setDlSupport]  = useState(false);
  const [dlIncident, setDlIncident] = useState(false);

  const MONTHS = [
    { v: 1,  l: "Januari" },  { v: 2,  l: "Februari" }, { v: 3,  l: "Maret" },
    { v: 4,  l: "April" },    { v: 5,  l: "Mei" },       { v: 6,  l: "Juni" },
    { v: 7,  l: "Juli" },     { v: 8,  l: "Agustus" },   { v: 9,  l: "September" },
    { v: 10, l: "Oktober" },  { v: 11, l: "November" },  { v: 12, l: "Desember" },
  ];

  const YEARS = Array.from({ length: 4 }, (_, i) => currentYear - 3 + i);

  // Hari yang valid untuk bulan tertentu — TIDAK reset field lain
  const daysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

  // Generate array hari 1..N — clamp nilai jika melebihi max
  const startDays = Array.from({ length: daysInMonth(startMonth, startYear) }, (_, i) => i + 1);
  const endDays   = Array.from({ length: daysInMonth(endMonth,   endYear)   }, (_, i) => i + 1);

  // Pastikan startDay & endDay tidak melebihi hari maks bulan yang dipilih
  const clampedStartDay = Math.min(startDay, daysInMonth(startMonth, startYear));
  const clampedEndDay   = Math.min(endDay,   daysInMonth(endMonth,   endYear));

  const monthLabel      = MONTHS.find((m) => m.v === selMonth)?.l      || `Bulan${selMonth}`;
  const startMonthLabel = MONTHS.find((m) => m.v === startMonth)?.l    || `Bulan${startMonth}`;
  const endMonthLabel   = MONTHS.find((m) => m.v === endMonth)?.l      || `Bulan${endMonth}`;

  const getPeriodLabel = () => {
    if (rangeMode === "month") return `${monthLabel} ${selYear}`;
    const sd = clampedStartDay, sm = startMonth, sy = startYear;
    const ed = clampedEndDay,   em = endMonth,   ey = endYear;
    if (sy === ey && sm === em && sd === ed) return `${sd} ${startMonthLabel} ${sy}`;
    if (sy === ey && sm === em) return `${sd}–${ed} ${startMonthLabel} ${sy}`;
    if (sy === ey) return `${sd} ${startMonthLabel} – ${ed} ${endMonthLabel} ${sy}`;
    return `${sd} ${startMonthLabel} ${sy} – ${ed} ${endMonthLabel} ${ey}`;
  };

  const getFilenameSuffix = (type: "support" | "incident") => {
    const base = type === "support" ? "Support" : "Incident";
    if (rangeMode === "month") return `Laporan_${base}_${monthLabel}_${selYear}.xlsx`;
    return `Laporan_${base}_${clampedStartDay}${startMonthLabel}${startYear}_sd_${clampedEndDay}${endMonthLabel}${endYear}.xlsx`;
  };

  const handleDownload = async (type: "support" | "incident") => {
    const setLoading = type === "support" ? setDlSupport : setDlIncident;
    setLoading(true);
    try {
      let url: string;
      if (rangeMode === "month") {
        url = `/api/admin/export/${type}?month=${selMonth}&year=${selYear}`;
      } else {
        url = `/api/admin/export/${type}?startDay=${clampedStartDay}&startMonth=${startMonth}&startYear=${startYear}&endDay=${clampedEndDay}&endMonth=${endMonth}&endYear=${endYear}&rangeMode=range`;
      }
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Gagal generate Excel" }));
        alert(`Error: ${(err as { error?: string }).error || "Gagal generate Excel"}`);
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href     = URL.createObjectURL(blob);
      link.download = getFilenameSuffix(type);
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

  // Preset kuartal — pakai currentYear otomatis (tidak perlu pilih tahun)
  const applyQuartal = (sm: number, em: number) => {
    const lastDay = daysInMonth(em, currentYear);
    setStartDay(1);       setStartMonth(sm); setStartYear(currentYear);
    setEndDay(lastDay);   setEndMonth(em);   setEndYear(currentYear);
    setRangeMode("range");
  };

  // Full Year — selalu pakai currentYear secara otomatis
  const applyFullYear = () => {
    setStartDay(1);  setStartMonth(1);  setStartYear(currentYear);
    setEndDay(31);   setEndMonth(12);   setEndYear(currentYear);
    setRangeMode("range");
  };

  return (
    <div className="min-h-screen bg-slate-100">

      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div>
          <h1 className="text-[16px] font-bold text-slate-800">Reports &amp; Analytics</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Download laporan ticket dalam format Excel — per bulan, range tanggal, atau kuartal
          </p>
        </div>
      </header>

      <div className="px-6 py-6 space-y-5 max-w-3xl">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-800 text-slate-100 text-[12px] font-bold uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet size={14} />
            Download Laporan Excel
          </div>

          <div className="p-6 space-y-6">
            <p className="text-[13px] text-slate-500 leading-relaxed">
              Pilih periode waktu, lalu unduh laporan Excel untuk masing-masing tipe ticket.
              Setiap file berisi <strong>1 sheet</strong> dengan seluruh data ticket dalam periode tersebut.
            </p>

            {/* Toggle Mode */}
            <div className="flex gap-2">
              <button onClick={() => setRangeMode("month")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                  rangeMode === "month"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}>
                📅 Per Bulan
              </button>
              <button onClick={() => setRangeMode("range")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                  rangeMode === "range"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}>
                <Calendar size={13} /> Range Tanggal
              </button>
            </div>

            {/* Per Bulan */}
            {rangeMode === "month" && (
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Bulan</label>
                  <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                    {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tahun</label>
                  <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="text-[12px] text-slate-400 pb-2">
                  Periode: <strong className="text-slate-600">{monthLabel} {selYear}</strong>
                </div>
              </div>
            )}

            {/* Range Tanggal */}
            {rangeMode === "range" && (
              <div className="space-y-5">

                {/* Preset Kuartal */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Preset Cepat <span className="text-slate-300 font-normal normal-case">(otomatis tahun {currentYear})</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Q1 (Jan–Mar)", sm: 1,  em: 3  },
                      { label: "Q2 (Apr–Jun)", sm: 4,  em: 6  },
                      { label: "Q3 (Jul–Sep)", sm: 7,  em: 9  },
                      { label: "Q4 (Okt–Des)", sm: 10, em: 12 },
                    ].map((q) => (
                      <button key={q.label} onClick={() => applyQuartal(q.sm, q.em)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors">
                        {q.label}
                      </button>
                    ))}
                    <button onClick={applyFullYear}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition-colors">
                      Full Year {currentYear}
                    </button>
                  </div>
                </div>

                {/* Dari Tanggal — field INDEPENDEN, tidak reset field lain */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Dari Tanggal</label>
                    <div className="flex gap-2">
                      {/* Tanggal */}
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400">Tgl</p>
                        <select value={clampedStartDay} onChange={(e) => setStartDay(Number(e.target.value))}
                          className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                          {startDays.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      {/* Bulan — tidak reset tanggal */}
                      <div className="space-y-1 flex-1">
                        <p className="text-[10px] text-slate-400">Bulan</p>
                        <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}
                          className="w-full px-2 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                          {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                      </div>
                      {/* Tahun — tidak reset tanggal/bulan */}
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400">Tahun</p>
                        <select value={startYear} onChange={(e) => setStartYear(Number(e.target.value))}
                          className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Sampai Tanggal — field INDEPENDEN */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sampai Tanggal</label>
                    <div className="flex gap-2">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400">Tgl</p>
                        <select value={clampedEndDay} onChange={(e) => setEndDay(Number(e.target.value))}
                          className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                          {endDays.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1 flex-1">
                        <p className="text-[10px] text-slate-400">Bulan</p>
                        <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}
                          className="w-full px-2 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                          {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400">Tahun</p>
                        <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))}
                          className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-[13px] bg-white text-slate-700 focus:outline-none focus:border-indigo-400">
                          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[12px] text-slate-400 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                  Periode terpilih: <strong className="text-slate-700">{getPeriodLabel()}</strong>
                </div>
              </div>
            )}

            {/* Tombol Download */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  Tanggal, Type Support, Jumlah Barang, Keluhan, Assign Team, Summary, Attachment, Status.
                </p>
                <button onClick={() => handleDownload("support")} disabled={dlSupport}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-[13px] font-bold transition-colors">
                  {dlSupport
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating...</>
                    : <><Download size={14} /> Download Excel Support</>}
                </button>
              </div>

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
                <button onClick={() => handleDownload("incident")} disabled={dlIncident}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-[13px] font-bold transition-colors">
                  {dlIncident
                    ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating...</>
                    : <><Download size={14} /> Download Excel Incident</>}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              ⓘ File Excel otomatis terunduh setelah proses selesai. Nama file menyesuaikan periode yang dipilih.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}