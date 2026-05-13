// lib/auth.ts
import jwt        from "jsonwebtoken";
import bcrypt     from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET          = process.env.JWT_SECRET           || "28d1ea9e34b789c1925646b54837f6444d66d39b98bfd62921b1e0b31b348416";
const ADMIN_USERNAME      = process.env.ADMIN_USERNAME       || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH  || "";
const ADMIN_PASSWORD      = process.env.ADMIN_PASSWORD       || "Admin@IT2026";

export interface AdminPayload {
  id:       number;
  username: string;
  role:     "ADMIN";
  iat?:     number;
}

export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const inputUser = username.trim();
  const inputPass = password.trim();

  console.log(`[AUTH] ====== Login Attempt ======`);
  console.log(`[AUTH] Input username  : "${inputUser}"`);
  console.log(`[AUTH] Expect username : "${ADMIN_USERNAME}"`);
  console.log(`[AUTH] ADMIN_PASSWORD_HASH : "${ADMIN_PASSWORD_HASH ? ADMIN_PASSWORD_HASH.substring(0, 10) + "..." : "(kosong)"}"`);
  console.log(`[AUTH] ADMIN_PASSWORD env  : "${ADMIN_PASSWORD ? "***diset***" : "(kosong)"}"`);

  if (inputUser.toLowerCase() !== ADMIN_USERNAME.toLowerCase()) {
    console.log(`[AUTH] GAGAL: username tidak cocok`);
    return false;
  }

  // Prioritas 1: bcrypt hash (hanya jika tidak kosong dan valid format)
  const cleanHash = ADMIN_PASSWORD_HASH.trim();
  if (cleanHash && cleanHash.startsWith("$2")) {
    try {
      const result = await bcrypt.compare(inputPass, cleanHash);
      console.log(`[AUTH] Bcrypt compare result : ${result}`);
      if (result) return true;
      console.log(`[AUTH] Bcrypt gagal, mencoba plaintext fallback...`);
    } catch (err) {
      console.error(`[AUTH] Bcrypt error:`, err);
    }
  }

  // Prioritas 2: plaintext dari ADMIN_PASSWORD env
  if (ADMIN_PASSWORD && ADMIN_PASSWORD.trim()) {
    const result = inputPass === ADMIN_PASSWORD.trim();
    console.log(`[AUTH] Plaintext compare result : ${result}`);
    return result;
  }

  // Prioritas 3: hardcode dev fallback
  const result = inputPass === "Admin@IT2026";
  console.log(`[AUTH] Fallback hardcode result : ${result}`);
  return result;
}

export function generateAdminToken(username: string): string {
  const payload: AdminPayload = { id: 1, username, role: "ADMIN" };
  return jwt.sign(payload, JWT_SECRET);
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as AdminPayload;
  } catch {
    return null;
  }
}

// FIX: await cookies() — wajib untuk Next.js 14.2.x+ di Server Actions
export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function requireAdminAuth(): Promise<AdminPayload> {
  const session = await getAdminSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}