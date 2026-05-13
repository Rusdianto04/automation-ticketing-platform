// app/api/tickets/upload/route.ts
// Handle upload file attachment untuk form tiket

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Simpan ke public/uploads/tickets/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tickets");
    await mkdir(uploadDir, { recursive: true });

    const ext       = file.name.split(".").pop() || "jpg";
    const fileName  = `ticket_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath  = path.join(uploadDir, fileName);
    const publicUrl = `/uploads/tickets/${fileName}`;

    await writeFile(filePath, buffer);

    return NextResponse.json({ url: publicUrl, name: file.name, size: file.size });
  } catch (err) {
    console.error("[API/tickets/upload] Error:", err);
    return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
  }
}