// app/api/admin/activities/route.ts
// API endpoint: ambil activities dari DB sebagai log realtime
// Dipanggil oleh AutomationLogClient

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Map type activity dari DB ke level log yang ditampilkan
const TYPE_TO_LEVEL: Record<string, "INFO" | "SUCCESS" | "ERROR" | "WARN"> = {
  // SUCCESS
  TICKET_CREATED:           "SUCCESS",
  STATUS_UPDATED:           "SUCCESS",
  ASSIGNED:                 "SUCCESS",
  DISCORD_THREAD_CREATED:   "SUCCESS",
  EMAIL_SENT:               "SUCCESS",
  REPORT_GENERATED:         "SUCCESS",
  AI_CLASSIFIED:            "SUCCESS",
  N8N_COMPLETED:            "SUCCESS",
  COMMENT_ADDED:            "SUCCESS",
  TIMELINE_UPDATED:         "SUCCESS",
  RESOLVED:                 "SUCCESS",
  // INFO
  VIEWED:                   "INFO",
  N8N_TRIGGERED:            "INFO",
  CHATBOT_RESPONSE:         "INFO",
  HEARTBEAT:                "INFO",
  // ERROR
  WEBHOOK_FAILED:           "ERROR",
  AI_ERROR:                 "ERROR",
  EMAIL_FAILED:             "ERROR",
  DISCORD_ERROR:            "ERROR",
  N8N_ERROR:                "ERROR",
  // WARN
  ESCALATED:                "WARN",
  OVERDUE:                  "WARN",
  RETRY:                    "WARN",
};

// Map type activity ke component label
const TYPE_TO_COMPONENT: Record<string, string> = {
  TICKET_CREATED:           "DISCORD_BOT",
  DISCORD_THREAD_CREATED:   "DISCORD_BOT",
  DISCORD_ERROR:            "DISCORD_BOT",
  HEARTBEAT:                "DISCORD_BOT",
  EMAIL_SENT:               "EMAIL",
  EMAIL_FAILED:             "EMAIL",
  AI_CLASSIFIED:            "AI_SERVICE",
  AI_ERROR:                 "AI_SERVICE",
  CHATBOT_RESPONSE:         "AI_SERVICE",
  N8N_TRIGGERED:            "N8N_WORKFLOW",
  N8N_COMPLETED:            "N8N_WORKFLOW",
  N8N_ERROR:                "N8N_WORKFLOW",
  WEBHOOK_FAILED:           "N8N_WORKFLOW",
  REPORT_GENERATED:         "N8N_WORKFLOW",
  STATUS_UPDATED:           "N8N_WORKFLOW",
  ASSIGNED:                 "N8N_WORKFLOW",
};

export async function GET(req: NextRequest) {
  try {
    const p = prisma as any;
    const url = new URL(req.url);

    const limitParam = url.searchParams.get("limit");
    const levelParam = url.searchParams.get("level");   // INFO|SUCCESS|ERROR|WARN
    const compParam  = url.searchParams.get("component"); // DISCORD_BOT|N8N_WORKFLOW|etc
    const sinceParam = url.searchParams.get("since");   // ISO timestamp untuk polling

    const limit = Math.min(parseInt(limitParam || "100"), 200);

    // Query activities dari DB
    const where: any = {};
    if (sinceParam) {
      where.created_at = { gt: new Date(sinceParam) };
    }

    // Filter berdasarkan component (mapping balik dari component ke type list)
    if (compParam) {
      const typesForComp = Object.entries(TYPE_TO_COMPONENT)
        .filter(([, comp]) => comp === compParam)
        .map(([type]) => type);
      if (typesForComp.length > 0) {
        where.type = { in: typesForComp };
      }
    }

    // Filter berdasarkan level (mapping balik dari level ke type list)
    if (levelParam) {
      const typesForLevel = Object.entries(TYPE_TO_LEVEL)
        .filter(([, lvl]) => lvl === levelParam)
        .map(([type]) => type);
      if (typesForLevel.length > 0) {
        // Gabungkan dengan filter component jika ada
        if (where.type?.in) {
          where.type.in = where.type.in.filter((t: string) => typesForLevel.includes(t));
        } else {
          where.type = { in: typesForLevel };
        }
      }
    }

    const activities = await p.activity.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      include: {
        ticket: {
          select: { id: true, type: true },
        },
      },
    });

    const logs = activities.map((a: any) => {
      const level     = TYPE_TO_LEVEL[a.type]     || "INFO";
      const component = TYPE_TO_COMPONENT[a.type] || "DATABASE";
      return {
        id:         String(a.id),
        timestamp:  a.created_at instanceof Date
          ? a.created_at.toISOString()
          : a.created_at,
        level,
        component,
        type:       a.type,
        message:    a.description || `${a.type} — Ticket #${a.ticket_id}`,
        ticket_id:  a.ticket_id || null,
      };
    });

    // Hitung stats dari semua activities (tanpa filter level/comp)
    const allActivities = await p.activity.findMany({
      select: { type: true },
      orderBy: { created_at: "desc" },
      take: 500,
    });

    const statsMap = { total: allActivities.length, success: 0, errors: 0, warns: 0 };
    allActivities.forEach((a: { type: string }) => {
      const lvl = TYPE_TO_LEVEL[a.type] || "INFO";
      if (lvl === "SUCCESS") statsMap.success++;
      else if (lvl === "ERROR") statsMap.errors++;
      else if (lvl === "WARN") statsMap.warns++;
    });

    return NextResponse.json({ logs, stats: statsMap });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}