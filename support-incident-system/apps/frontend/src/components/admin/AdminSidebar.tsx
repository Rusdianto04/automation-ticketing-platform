"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Ticket,
  BarChart3, Shield, LogOut, ChevronRight, Menu, X,
} from "lucide-react";
import { logoutAdminAction } from "@/app/admin/actions";

const NAV_ITEMS = [
  { href: "/admin",         label: "Dashboard",           icon: LayoutDashboard },
  { href: "/admin/tickets", label: "Ticket Monitoring",   icon: Ticket },
  { href: "/admin/reports", label: "Reports & Analytics", icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname    = usePathname();
  const [open, setOpen] = useState(false);

  // Tutup sidebar saat navigasi (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Tutup saat klik overlay
  const handleOverlayClick = () => setOpen(false);

  const SidebarContent = () => (
    <aside className={`admin-sidebar flex flex-col ${open ? "open" : ""}`}>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-tight">Admin Portal</p>
              <p className="text-[10px] text-slate-500 leading-tight">Support &amp; Incident Mgmt</p>
            </div>
          </div>
          {/* Close button — hanya tampil di mobile */}
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Tutup menu"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        <p className="px-5 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
          Main Menu
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${isActive ? "active" : ""}`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight size={13} className="opacity-50 shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-slate-300 truncate">Administrator</p>
            <p className="text-[10px] text-slate-600">Super Admin</p>
          </div>
        </div>
        <form action={logoutAdminAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-all"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </form>
        <Link
          href="/dashboard"
          className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
        >
          <ChevronRight size={13} />
          Lihat Portal Publik
        </Link>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <SidebarContent />

      {/* Mobile: overlay backdrop */}
      {open && (
        <div
          className="sidebar-overlay open"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Mobile: hamburger toggle button — muncul di kiri atas halaman */}
      <button
        onClick={() => setOpen(true)}
        className="mobile-nav-toggle fixed top-3 left-3 z-50"
        aria-label="Buka menu navigasi"
      >
        <Menu size={18} />
      </button>
    </>
  );
}