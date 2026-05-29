"use strict";

/**
 * src/modules/ticket/controllers/upload.controller.js
 *
 * Menerima multipart/form-data dari frontend portal,
 * menyimpan file ke backend/public/uploads/tickets/,
 * dan mengembalikan URL publik yang dapat diakses via backend.
 */

const path   = require("path");
const fs     = require("fs");
const busboy = require("busboy");

const UPLOAD_DIR    = path.join(process.cwd(), "public", "uploads", "tickets");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];

// Pastikan folder sudah ada saat module di-load
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/ticket/upload
 * Tidak memerlukan API key — dipanggil oleh frontend portal saat user upload attachment.
 */
async function uploadTicketAttachment(req, res) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return res.status(400).json({ error: "Content-Type harus multipart/form-data" });
  }

  let fileSaved   = false;
  let savedUrl    = null;
  let fileSize    = 0;
  let fileName    = null;
  let errorOccurred = null;

  try {
    const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });

    await new Promise((resolve, reject) => {
      bb.on("file", (fieldname, stream, info) => {
        const { filename, mimeType } = info;

        if (!ALLOWED_TYPES.includes(mimeType)) {
          stream.resume(); // buang stream
          errorOccurred = "Tipe file tidak didukung. Gunakan: JPG, PNG, GIF, WEBP";
          return resolve();
        }

        const ext      = path.extname(filename) || `.${mimeType.split("/")[1]}`;
        fileName       = `ticket_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        const filePath = path.join(UPLOAD_DIR, fileName);
        const writeStream = fs.createWriteStream(filePath);

        stream.on("data", (chunk) => { fileSize += chunk.length; });
        stream.on("limit", () => {
          writeStream.destroy();
          fs.unlink(filePath, () => {});
          errorOccurred = "Ukuran file maksimal 5MB";
          resolve();
        });

        stream.pipe(writeStream);

        writeStream.on("finish", () => {
          if (!errorOccurred) {
            fileSaved = true;
            savedUrl  = `/uploads/tickets/${fileName}`;
          }
          resolve();
        });

        writeStream.on("error", (err) => {
          reject(err);
        });
      });

      bb.on("error", (err) => reject(err));
      bb.on("finish", () => { if (!fileSaved && !errorOccurred) resolve(); });

      req.pipe(bb);
    });

    if (errorOccurred) {
      return res.status(400).json({ error: errorOccurred });
    }

    if (!fileSaved || !savedUrl) {
      return res.status(400).json({ error: "File tidak ditemukan dalam request" });
    }

    return res.status(200).json({ url: savedUrl, size: fileSize });

  } catch (err) {
    console.error("[upload.controller] Error:", err);
    return res.status(500).json({ error: "Gagal menyimpan file" });
  }
}

module.exports = { uploadTicketAttachment };