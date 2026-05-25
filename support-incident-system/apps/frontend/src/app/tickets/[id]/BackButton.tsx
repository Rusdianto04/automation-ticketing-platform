"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const [href, setHref] = useState("/dashboard");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("dashboard_state");
      if (raw) {
        const { filterType, searchQuery, visibleCount } = JSON.parse(raw);
        const params = new URLSearchParams();
        if (filterType) params.set("filter", filterType);
        if (searchQuery) params.set("q", searchQuery);
        if (visibleCount > 12) params.set("page", String(Math.ceil(visibleCount / 12)));
        setHref(`/dashboard?${params.toString()}`);
      }
    } catch { }
  }, []);

  return (
    <Link href={href} className="flex items-center gap-1.5 text-[13px] text-slate-300 hover:text-white transition">
      <ArrowLeft size={15} />
      Kembali
    </Link>
  );
}