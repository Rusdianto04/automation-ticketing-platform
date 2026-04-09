// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get("admin_token")?.value;

    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Validasi token: cukup cek struktur JWT dan role ADMIN
    // Tidak ada cek exp karena token tidak punya expiry — hanya logout manual yang hapus sesi
    try {
      const parts = token.split(".");
      if (parts.length !== 3) throw new Error("Invalid token format");

      const payload = JSON.parse(atob(parts[1]));

      if (!payload.role || payload.role !== "ADMIN") {
        throw new Error("Not admin role");
      }

      // exp tidak dicek — token berlaku selamanya sampai logout
    } catch {
      // Token invalid atau rusak → redirect ke login
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};