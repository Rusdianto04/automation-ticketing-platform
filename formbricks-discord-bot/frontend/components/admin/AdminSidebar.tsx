"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Ticket, Activity,
  BarChart3, Shield, LogOut, ChevronRight,
} from "lucide-react";
import { logoutAdminAction } from "@/app/admin/actions";

const NAV_ITEMS = [
  { href: "/admin",            label: "Dashboard",           icon: LayoutDashboard },
  { href: "/admin/tickets",    label: "Ticket Monitoring",   icon: Ticket },
  { href: "/admin/automation", label: "Automation Log",      icon: Activity },
  { href: "/admin/reports",    label: "Reports & Analytics", icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-700 text-white">Admin Portal</p>
            <p className="text-[10px] text-slate-500">Support & Incident Mgmt</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3">
        <p className="px-5 py-2 text-[10px] font-700 text-slate-600 uppercase tracking-widest">
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
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight size={13} className="opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-[11px] font-700 text-white">
            A
          </div>
          <div>
            <p className="text-[12px] font-600 text-slate-300">Administrator</p>
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
}