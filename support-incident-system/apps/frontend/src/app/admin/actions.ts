"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminCredentials, generateAdminToken, verifyAdminToken } from "@/lib/auth";
import { updateTicketStatus, reassignTicket } from "@/features/ticket";
import { apiUpdateTicketData, apiUpdateFormFields } from "@/lib/api";
import type { TicketStatus } from "@/types";

// ── Login ──────────────────────────────────────────────────────────────────────
export async function loginAdminAction(username: string, password: string) {
  const valid = await verifyAdminCredentials(username, password);
  if (!valid) {
    return { error: "Username atau password salah. Silakan coba lagi." };
  }
  const token = generateAdminToken(username);
  const cookieStore = await cookies();
  cookieStore.set("admin_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365 * 10,
    path: "/",
  });
  return { success: true };
}

// ── Logout ─────────────────────────────────────────────────────────────────────
export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_token");
  redirect("/admin/login");
}

// ── Verify session ─────────────────────────────────────────────────────────────
export async function getAdminSessionAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

// ── Sync Discord — FIRE AND FORGET ────────────────────────────────────────────
// TIDAK di-await — frontend langsung return sukses ke user setelah DB update.
// Discord sync berjalan di background, tidak memblokir response ke browser.
// Timeout 8 detik agar tidak menggantung di background terlalu lama.
function syncToDiscordAsync(
  ticketId: number,
  action: string,
  data: Record<string, unknown>
): void {
  const backendUrl =
    process.env.BACKEND_SELF_URL ||
    process.env.BACKEND_URL ||
    "http://backend:3000";
  const apiKey = process.env.N8N_API_KEY || "automation_ticketing01_incident02";

  // AbortController untuk timeout — Discord API kadang lambat
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 8000);

  fetch(`${backendUrl}/api/tickets/${ticketId}/sync-discord`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":    apiKey,
    },
    body:   JSON.stringify({ action, ...data }),
    signal: controller.signal,
  })
    .then(() => clearTimeout(timeoutId))
    .catch((err) => {
      clearTimeout(timeoutId);
      // Log di server, tidak sampai ke user
      console.warn(`[ADMIN] Discord sync background failed (ticket #${ticketId}):`, err.message);
    });
}

// ── Update status ticket (+ sync Discord) ─────────────────────────────────────
// FIX: Terima APPROVED (mapped dari IN_PROGRESS di portal) dan semua status valid
export async function adminUpdateStatusAction(
  ticketId: number,
  status: TicketStatus | "APPROVED" | "REJECTED",
  note?: string
) {
  const session = await getAdminSessionAction();
  if (!session) return { error: "Unauthorized" };

  try {
    // 1. Update DB — cepat, hanya 1 query Prisma
    await updateTicketStatus(ticketId, status as TicketStatus, note);

    // 2. Discord sync di background — TIDAK blocking response ke browser
    syncToDiscordAsync(ticketId, "status_update", { status, note });

    // 3. Return langsung ke user — tidak tunggu Discord
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

// ── Reassign ticket (+ sync Discord) ──────────────────────────────────────────
export async function adminReassignAction(ticketId: number, assignees: string[]) {
  const session = await getAdminSessionAction();
  if (!session) return { error: "Unauthorized" };

  try {
    // 1. Update DB
    await reassignTicket(ticketId, assignees);

    // 2. Discord sync di background
    syncToDiscordAsync(ticketId, "reassign", { assignees });

    // 3. Return langsung
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

// ── Edit Data Ticket (reporter, dst) + sync Discord ───────────────────────────
export async function adminUpdateTicketDataAction(
  ticketId: number,
  data: { requester?: string; resolved_at?: string | null }
) {
  const session = await getAdminSessionAction();
  if (!session) return { error: "Unauthorized" };

  try {
    // 1. Update via backend API (no direct DB access)
    await apiUpdateTicketData(ticketId, data);

    // 2. Discord sync di background
    syncToDiscordAsync(ticketId, "ticket_data_update", data as Record<string, unknown>);

    // 3. Return langsung
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

// ── Edit Data Formulir (form_fields) + sync Discord ───────────────────────────
export async function adminUpdateFormFieldsAction(
  ticketId: number,
  formFields: Record<string, string>
) {
  const session = await getAdminSessionAction();
  if (!session) return { error: "Unauthorized" };

  try {
    // 1. Update via backend API (no direct DB access)
    await apiUpdateFormFields(ticketId, formFields);

    // 2. Discord sync di background
    syncToDiscordAsync(ticketId, "form_fields_update", { form_fields: formFields });

    // 3. Return langsung
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}

// ── Manual Update Summary / Root Cause / Timeline (Backup n8n) ────────────────
export async function adminUpdateSummaryDataAction(
  ticketId: number,
  data: {
    summary_ticket?: string;
    root_cause?: string;
    timeline?: string;
    ticketType?: string;
  }
) {
  const session = await getAdminSessionAction();
  if (!session) return { error: "Unauthorized" };

  const backendUrl =
    process.env.BACKEND_SELF_URL ||
    process.env.BACKEND_URL ||
    "http://backend:3000";
  const apiKey = process.env.N8N_API_KEY || "automation_ticketing01_incident02";

  try {
    // 1. Update summary/rootCause via POST /api/ticket/summary (existing endpoint)
    if (data.summary_ticket !== undefined || data.root_cause !== undefined) {
      const summaryBody: Record<string, unknown> = {
        ticketId,
        generatedBy: "admin_manual",
      };
      if (data.summary_ticket !== undefined) summaryBody.summaryText = data.summary_ticket;
      if (data.root_cause     !== undefined) summaryBody.rootCause   = data.root_cause;

      const res = await fetch(`${backendUrl}/api/ticket/summary`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body:    JSON.stringify(summaryBody),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Gagal update summary");
      }
    }

    // 2. Update timeline via POST /api/ticket/timeline/append (existing endpoint)
    if (data.timeline !== undefined && data.timeline.trim()) {
      const timelineBody = {
        ticketId,
        entry: data.timeline,
        type:  data.ticketType || "TICKETING",
      };
      const res = await fetch(`${backendUrl}/api/ticket/timeline/append`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body:    JSON.stringify(timelineBody),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Gagal update timeline");
      }
    }

    // 3. Discord sync di background (pinned message update)
    syncToDiscordAsync(ticketId, "summary_update", {
      summary_ticket: data.summary_ticket,
      root_cause:     data.root_cause,
      timeline:       data.timeline,
    });

    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}