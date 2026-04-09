// app/api/admin/stats/route.ts
// API endpoint realtime: stats ticket + LIVE system health check
// UPDATE: Automation Performance section dihapus (tidak diperlukan)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function httpPing(url: string, timeoutMs = 4000): Promise<{ ok: boolean; statusCode?: number; body?: any; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store", headers: { "Accept": "application/json" } });
    clearTimeout(timer);
    let body: any = null;
    try { body = await res.json(); } catch { /* non-json */ }
    return { ok: res.ok, statusCode: res.status, body, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export async function GET() {
  try {
    const p = prisma as any;

    const BACKEND_URL = process.env.BACKEND_SELF_URL || process.env.BACKEND_URL || "http://backend:3000";
    const N8N_URL     = process.env.N8N_INTERNAL_URL || "http://n8n:5678";

    const now = new Date();
    const todayWIB = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(),
      now.getUTCHours() >= 17 ? now.getUTCDate() : now.getUTCDate() - 1,
      17, 0, 0, 0
    ));

    const [
      total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount,
      recentAiActivity, backendPing, n8nPing, dbPingResult,
    ] = await Promise.all([
      p.ticket.count(),
      p.ticket.count({ where: { created_at: { gte: todayWIB } } }),
      p.ticket.count({ where: { status_pengusulan: "OPEN" } }),
      p.ticket.count({ where: { status_pengusulan: "PENDING" } }),
      p.ticket.count({ where: { status_pengusulan: { in: ["DONE", "RESOLVED"] } } }),
      p.ticket.count({ where: { type: "INCIDENT" } }),
      p.ticket.count({ where: { status_pengusulan: { in: ["REJECT", "REJECTED"] } } }),

      // AI Service check dari aktivitas dalam 1 jam terakhir
      p.activity.findFirst({
        where: {
          type: { in: ["AI_CLASSIFIED", "CHATBOT_RESPONSE", "AI_ERROR"] },
          created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        orderBy: { created_at: "desc" },
      }),

      httpPing(`${BACKEND_URL}/health`, 4000),
      httpPing(`${N8N_URL}/healthz`, 4000),

      (async () => {
        const s = Date.now();
        await p.ticket.count();
        return Date.now() - s;
      })(),
    ]);

    // ── Discord Bot status ────────────────────────────────────────────────────
    const backendUptime: number = backendPing.ok && backendPing.body?.uptime ? Number(backendPing.body.uptime) : 0;
    let discordStatus: string;
    let discordDetail: string;

    if (!backendPing.ok) {
      discordStatus = "OFFLINE";
      discordDetail = `Backend container tidak merespons (timeout ${backendPing.ms}ms)`;
    } else if (backendUptime > 0 && backendUptime < 30) {
      discordStatus = "STARTING";
      discordDetail = `Bot baru restart — uptime: ${backendUptime}s`;
    } else {
      discordStatus = "ONLINE";
      discordDetail = backendUptime > 0
        ? `Connected — uptime ${Math.round(backendUptime / 60)}m ${backendUptime % 60}s`
        : `Connected — backend merespons (${backendPing.ms}ms)`;
    }

    // ── N8N Workflow status ───────────────────────────────────────────────────
    const n8nStatus = n8nPing.ok ? "RUNNING" : "OFFLINE";
    const n8nDetail = n8nPing.ok
      ? `Workflow engine aktif — merespons dalam ${n8nPing.ms}ms`
      : `N8N container tidak merespons (timeout ${n8nPing.ms}ms)`;

    // ── Database status ───────────────────────────────────────────────────────
    const dbMs = dbPingResult as number;
    const dbStatus = dbMs < 200 ? "HEALTHY" : "DEGRADED";
    const dbDetail = dbMs < 200
      ? `PostgreSQL — response time: ${dbMs}ms`
      : `PostgreSQL — response lambat: ${dbMs}ms`;

    // ── AI Service status ─────────────────────────────────────────────────────
    let aiStatus: string;
    let aiDetail: string;
    if (recentAiActivity) {
      const minsAgo = Math.round((Date.now() - new Date(recentAiActivity.created_at).getTime()) / 60000);
      aiStatus = "ACTIVE";
      aiDetail = `Aktif — klasifikasi terakhir ${minsAgo} menit yang lalu`;
    } else {
      aiStatus = "IDLE";
      aiDetail = "Tidak ada aktivitas AI dalam 1 jam terakhir";
    }

    return NextResponse.json({
      stats: { total, todayTotal, openCount, pendingCount, doneCount, incidentCount, rejectCount },
      system: {
        discord_bot:    discordStatus,
        discord_detail: discordDetail,
        n8n_workflow:   n8nStatus,
        n8n_detail:     n8nDetail,
        database:       dbStatus,
        db_detail:      dbDetail,
        ai_service:     aiStatus,
        ai_detail:      aiDetail,
        db_response_ms: dbMs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}