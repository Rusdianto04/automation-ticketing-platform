// app/api/admin/stats/route.ts
// API endpoint realtime: stats ticket + LIVE system health check
//
// Perubahan dari versi sebelumnya:
//   - Discord Bot: HTTP GET ke backend /health (bukan cek tabel activities)
//     → Jika backend container mati → fetch gagal → OFFLINE
//     → Jika backend container hidup → respons ok → ONLINE + baca uptime
//   - N8N Workflow: HTTP GET ke n8n /healthz langsung
//     → Jika n8n container mati → fetch gagal → OFFLINE
//     → Jika n8n hidup → RUNNING
//   - AI Service (Groq): cek dari aktivitas AI dalam 1 jam terakhir di DB
//   - Database: ukur response time query Prisma langsung

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Helper: HTTP ping dengan timeout ──────────────────────────────────────────
async function httpPing(
  url: string,
  timeoutMs = 4000
): Promise<{ ok: boolean; statusCode?: number; body?: any; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timer);

    let body: any = null;
    try { body = await res.json(); } catch { /* non-json response */ }

    return { ok: res.ok, statusCode: res.status, body, ms: Date.now() - start };
  } catch {
    // fetch gagal = container mati / tidak bisa dijangkau
    return { ok: false, ms: Date.now() - start };
  }
}

export async function GET() {
  try {
    const p = prisma as any;

    // ── URL service dalam Docker network ──────────────────────────────────
    // Frontend memanggil backend via Docker internal network name
    const BACKEND_URL = process.env.BACKEND_SELF_URL
      || process.env.BACKEND_URL
      || "http://backend:3000";

    const N8N_URL = process.env.N8N_INTERNAL_URL
      || "http://n8n:5678";

    // ── Midnight WIB (UTC+7 = UTC−17:00) untuk reset harian ──────────────
    const now = new Date();
    const todayWIB = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCHours() >= 17 ? now.getUTCDate() : now.getUTCDate() - 1,
        17, 0, 0, 0
      )
    );

    // ── Jalankan semua cek secara paralel ─────────────────────────────────
    const [
      total,
      todayTotal,
      openCount,
      pendingCount,
      doneCount,
      incidentCount,
      rejectCount,
      activitiesToday,
      resolvedTickets,
      recentAiActivity,
      backendPing,
      n8nPing,
      dbPingResult,
    ] = await Promise.all([
      // ── Stats ticket ──────────────────────────────────────────────────
      p.ticket.count(),
      p.ticket.count({ where: { created_at: { gte: todayWIB } } }),
      p.ticket.count({ where: { status_pengusulan: "OPEN" } }),
      p.ticket.count({ where: { status_pengusulan: "PENDING" } }),
      p.ticket.count({ where: { status_pengusulan: { in: ["DONE", "RESOLVED"] } } }),
      p.ticket.count({ where: { type: "INCIDENT" } }),
      p.ticket.count({ where: { status_pengusulan: { in: ["REJECT", "REJECTED"] } } }),

      // ── Activities hari ini untuk automation performance ──────────────
      p.activity.findMany({
        where: { created_at: { gte: todayWIB } },
        select: { type: true },
      }),

      // ── Resolved tickets untuk avg resolution time ────────────────────
      p.ticket.findMany({
        where: {
          status_pengusulan: { in: ["DONE", "RESOLVED"] },
          resolved_at: { not: null },
        },
        select: { created_at: true, resolved_at: true },
        take: 50,
        orderBy: { resolved_at: "desc" },
      }),

      // ── Cek AI service dari aktivitas AI dalam 1 jam terakhir ─────────
      p.activity.findFirst({
        where: {
          type: { in: ["AI_CLASSIFIED", "CHATBOT_RESPONSE", "AI_ERROR"] },
          created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        orderBy: { created_at: "desc" },
      }),

      // ── LIVE HTTP ping ke backend container ───────────────────────────
      // Jika container sis-backend mati → fetch abort → ok: false → OFFLINE
      httpPing(`${BACKEND_URL}/health`, 4000),

      // ── LIVE HTTP ping ke N8N container ───────────────────────────────
      // N8N health endpoint: GET /healthz (returns 200 jika running)
      httpPing(`${N8N_URL}/healthz`, 4000),

      // ── DB response time ──────────────────────────────────────────────
      (async () => {
        const s = Date.now();
        await p.ticket.count();
        return Date.now() - s;
      })(),
    ]);

    // ── Automation Performance ────────────────────────────────────────────
    const successTypes = new Set([
      "TICKET_CREATED", "STATUS_UPDATED", "ASSIGNED",
      "DISCORD_THREAD_CREATED", "EMAIL_SENT", "REPORT_GENERATED", "AI_CLASSIFIED",
    ]);
    const failedTypes = new Set([
      "WEBHOOK_FAILED", "AI_ERROR", "EMAIL_FAILED", "DISCORD_ERROR", "N8N_ERROR",
    ]);

    const successCount = activitiesToday.filter((a: { type: string }) =>
      successTypes.has(a.type)
    ).length;
    const failedCount = activitiesToday.filter((a: { type: string }) =>
      failedTypes.has(a.type)
    ).length;

    const totalAutomation = successCount + failedCount;
    const automationSuccessRate = totalAutomation > 0
      ? Math.round((successCount / totalAutomation) * 100)
      : 100;

    // ── Avg resolution time ───────────────────────────────────────────────
    let avgResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum: number, t: any) => {
        const diff =
          new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
        return sum + diff / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours =
        Math.round((totalHours / resolvedTickets.length) * 10) / 10;
    }

    // ── Status Sistem — berdasarkan LIVE HTTP ping ─────────────────────────
    //
    // Discord Bot status:
    //   Backend container HIDUP dan /health return ok → ONLINE
    //   Backend container MATI atau timeout           → OFFLINE
    //   Backend hidup tapi uptime < 60 detik          → STARTING
    const backendUptime: number =
      backendPing.ok && backendPing.body?.uptime
        ? Number(backendPing.body.uptime)
        : 0;

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

    // N8N Workflow status:
    //   N8N container HIDUP dan /healthz return 200 → RUNNING
    //   N8N container MATI atau timeout             → OFFLINE
    let n8nStatus: string;
    let n8nDetail: string;

    if (!n8nPing.ok) {
      n8nStatus = "OFFLINE";
      n8nDetail = `N8N container tidak merespons (timeout ${n8nPing.ms}ms)`;
    } else {
      n8nStatus = "RUNNING";
      n8nDetail = `Workflow engine aktif — merespons dalam ${n8nPing.ms}ms`;
    }

    // Database status: ukur dari response time Prisma
    const dbMs = dbPingResult as number;
    let dbStatus: string;
    let dbDetail: string;

    if (dbMs < 200) {
      dbStatus = "HEALTHY";
      dbDetail = `PostgreSQL — response time: ${dbMs}ms`;
    } else if (dbMs < 1000) {
      dbStatus = "DEGRADED";
      dbDetail = `PostgreSQL — response lambat: ${dbMs}ms`;
    } else {
      dbStatus = "DEGRADED";
      dbDetail = `PostgreSQL — sangat lambat: ${dbMs}ms`;
    }

    // AI Service (Groq):
    //   Ada aktivitas AI dalam 1 jam terakhir → ACTIVE
    //   Tidak ada aktivitas AI → IDLE (bukan OFFLINE — Groq tidak bisa di-ping langsung)
    let aiStatus: string;
    let aiDetail: string;

    if (recentAiActivity) {
      const lastAiTime = new Date(recentAiActivity.created_at);
      const minsAgo = Math.round((Date.now() - lastAiTime.getTime()) / 60000);
      aiStatus = "ACTIVE";
      aiDetail = `Aktif — klasifikasi terakhir ${minsAgo} menit yang lalu`;
    } else {
      aiStatus = "IDLE";
      aiDetail = "Tidak ada aktivitas AI dalam 1 jam terakhir";
    }

    return NextResponse.json({
      stats: {
        total,
        todayTotal,
        openCount,
        pendingCount,
        doneCount,
        incidentCount,
        rejectCount,
      },
      automation: {
        successRate: automationSuccessRate,
        failed: failedCount,
        avgResolutionHours,
        totalToday: totalAutomation,
      },
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