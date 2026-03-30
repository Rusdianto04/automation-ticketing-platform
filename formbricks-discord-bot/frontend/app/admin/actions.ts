"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminCredentials, generateAdminToken, verifyAdminToken } from "@/lib/auth";
import { updateTicketStatus, reassignTicket } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
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
    const p          = prisma as any;
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (data.requester !== undefined) {
      // SELECT hanya kolom yang dibutuhkan — lebih efisien
      const ticket = await p.ticket.findUnique({
        where:  { id: ticketId },
        select: { form_fields: true },
      });
      if (ticket) {
        let ff = ticket.form_fields;
        if (typeof ff === "string") { try { ff = JSON.parse(ff); } catch { ff = {}; } }
        ff["Reporter Information"] = data.requester;
        ff["Name"]                 = data.requester;
        updateData.form_fields     = ff;
      }
    }

    // 1. Update DB
    await p.ticket.update({ where: { id: ticketId }, data: updateData });

    // 2. Discord sync di background
    syncToDiscordAsync(ticketId, "ticket_data_update", data);

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
    const p = prisma as any;

    // 1. Update DB
    await p.ticket.update({
      where: { id: ticketId },
      data:  { form_fields: formFields, updated_at: new Date() },
    });

    // 2. Discord sync di background
    syncToDiscordAsync(ticketId, "form_fields_update", { form_fields: formFields });

    // 3. Return langsung
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}