// app/api/tickets/upload/route.ts
// Handle upload file attachment untuk form tiket
// File diteruskan ke backend dan disimpan di apps/backend/public/uploads/tickets/

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_SELF_URL ||
  process.env.BACKEND_URL ||
  "http://backend:3000";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipe file tidak didukung. Gunakan: JPG, PNG, GIF, WEBP" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 5MB" },
        { status: 400 }
      );
    }

    // Teruskan file ke backend untuk disimpan di backend/public/uploads/tickets/
    const backendForm = new FormData();
    backendForm.append("file", file);

    const backendRes = await fetch(`${BACKEND_URL}/api/ticket/upload`, {
      method: "POST",
      body: backendForm,
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.error || "Gagal upload file ke backend" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json({ url: data.url, name: file.name, size: file.size });
  } catch (err) {
    console.error("[API/tickets/upload] Error:", err);
    return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
  }
}