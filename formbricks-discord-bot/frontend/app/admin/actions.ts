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

// ── Sync ke Discord pinned message via backend API ─────────────────────────────
async function syncToDiscord(ticketId: number, action: string, data: Record<string, unknown>) {
  try {
    const backendUrl =
      process.env.BACKEND_SELF_URL ||
      process.env.BACKEND_URL ||
      "http://backend:3000";
    const apiKey = process.env.N8N_API_KEY || "automation_ticketing01_incident02";

    await fetch(`${backendUrl}/api/tickets/${ticketId}/sync-discord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ action, ...data }),
    });
  } catch {
    // Non-fatal — Discord sync gagal tidak menghentikan update DB
  }
}

// ── Update status ticket (+ sync Discord) ─────────────────────────────────────
// FIX: Terima semua status termasuk INVESTIGASI, MITIGASI, RESOLVED untuk Incident
export async function adminUpdateStatusAction(
  ticketId: number,
  status: TicketStatus,
  note?: string
) {
  const session = await getAdminSessionAction();
  if (!session) return { error: "Unauthorized" };

  try {
    await updateTicketStatus(ticketId, status, note);
    await syncToDiscord(ticketId, "status_update", { status, note });
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
    await reassignTicket(ticketId, assignees);
    await syncToDiscord(ticketId, "reassign", { assignees });
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
    const p = prisma as any;
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (data.requester !== undefined) {
      const ticket = await p.ticket.findUnique({ where: { id: ticketId } });
      if (ticket) {
        let ff = ticket.form_fields;
        if (typeof ff === "string") { try { ff = JSON.parse(ff); } catch { ff = {}; } }
        ff["Reporter Information"] = data.requester;
        ff["Name"] = data.requester;
        updateData.form_fields = ff;
      }
    }

    await p.ticket.update({ where: { id: ticketId }, data: updateData });
    await syncToDiscord(ticketId, "ticket_data_update", data);
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
    await p.ticket.update({
      where: { id: ticketId },
      data: {
        form_fields: formFields,
        updated_at: new Date(),
      },
    });
    await syncToDiscord(ticketId, "form_fields_update", { form_fields: formFields });
    return { success: true };
  } catch (err) {
    return { error: String(err) };
  }
}