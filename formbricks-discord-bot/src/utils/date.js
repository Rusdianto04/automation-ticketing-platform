/**
 * src/utils/date.js
 * Date Formatting Utilities — WIB (UTC+7)
 */

"use strict";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const MONTH_ID   = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Get date parts in WIB timezone.
 * @param {Date|string|null} date
 * @returns {{ day, month, year, h24, hStr, min, ampm, raw: Date } | null}
 */
function getWIBParts(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const wib  = new Date(d.getTime() + WIB_OFFSET_MS);
  const day   = String(wib.getUTCDate()).padStart(2, "0");
  const month = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const year  = String(wib.getUTCFullYear());
  const h24   = wib.getUTCHours();
  const min   = String(wib.getUTCMinutes()).padStart(2, "0");
  const ampm  = h24 < 12 ? "AM" : "PM";
  const hStr  = String(h24).padStart(2, "0");

  return { day, month, year, h24, hStr, min, ampm, raw: d };
}

/** Format: "DD-MM-YYYY, HH:MM AM/PM" */
function formatDateTime(date) {
  const p = getWIBParts(date);
  if (!p) return "N/A";
  return `${p.day}-${p.month}-${p.year}, ${p.hStr}:${p.min} ${p.ampm}`;
}

/** Format: "YYYY-MM-DD" */
function formatDateOnly(date) {
  const p = getWIBParts(date);
  if (!p) return "N/A";
  return `${p.year}-${p.month}-${p.day}`;
}

/** Format: "DD Bulan YYYY, HH:MM AM/PM" (Indonesian, untuk email) */
function formatDateForEmail(date) {
  const p = getWIBParts(date);
  if (!p) return "N/A";
  return `${p.day} ${MONTH_ID[parseInt(p.month, 10) - 1]} ${p.year}, ${p.hStr}:${p.min} ${p.ampm}`;
}

/** Format incident date + time: "DD-MM-YYYY / HH:MM" */
function formatIncidentDateTime(dateValue, timeValue) {
  const p = getWIBParts(dateValue);
  if (!p) return "N/A";
  return `${p.day}-${p.month}-${p.year} / ${timeValue || "N/A"}`;
}

/**
 * Format resolved status string dengan durasi penanganan.
 * @returns {string} " (HH:MM AM, DD Mon YYYY - Xh Ym)"
 */
function formatResolvedStatus(createdAt, resolvedAt) {
  const pr = getWIBParts(resolvedAt);
  const pc = getWIBParts(createdAt);
  if (!pr || !pc) return "";

  const timeString = `${pr.hStr}:${pr.min} ${pr.ampm}`;
  const dateString = `${pr.day} ${MONTH_SHORT[parseInt(pr.month, 10) - 1]} ${pr.year}`;
  const diffMs     = Math.abs(pr.raw.getTime() - pc.raw.getTime());

  const totalDays    = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalHours   = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const totalMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  let duration;
  if (totalDays > 0)       duration = `${totalDays} Day${totalDays > 1 ? "s" : ""} ${totalHours} Jam ${totalMinutes} Menit`;
  else if (totalHours > 0) duration = `${totalHours} Jam ${totalMinutes} Menit`;
  else                     duration = `${totalMinutes} Menit`;

  return ` (${timeString}, ${dateString} - ${duration})`;
}

/**
 * Hitung durasi resolusi sebagai string.
 * Digunakan untuk incident report.
 */
function calcResolutionDuration(createdAt, resolvedAt) {
  if (!resolvedAt || !createdAt) return "Ongoing";
  const diff  = Math.abs(new Date(resolvedAt).getTime() - new Date(createdAt).getTime());
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0)   return `${days}d ${hours}h ${mins}m`;
  if (hours > 0)  return `${hours}h ${mins}m`;
  return `${mins} menit`;
}

module.exports = {
  getWIBParts,
  formatDateTime,
  formatDateOnly,
  formatDateForEmail,
  formatIncidentDateTime,
  formatResolvedStatus,
  calcResolutionDuration,
};
