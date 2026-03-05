/**
 * src/utils/network.js
 * LAN IP & Public URL Detection
 *
 * Urutan prioritas deteksi IP:
 *   1. PORTAL_URL (.env)    — override manual, paling reliable jika diisi
 *   2. HOST_IP (.env)       — IP host diisi manual atau di-inject oleh docker-compose
 *   3. /proc/net/fib_trie   — baca IP interface fisik host dari dalam container
 *                             (lebih akurat dari gateway, langsung baca IP bukan gw)
 *   4. /proc/net/route      — baca gateway Docker sebagai fallback
 *   5. os.networkInterfaces — scan IP container (kurang akurat, last resort)
 *   6. localhost            — fallback terakhir
 *
 * Cara kerja saat ganti LAN ↔ WiFi:
 *   OPSI A (Otomatis penuh — direkomendasikan):
 *     → Edit docker-compose.yml: HOST_IP=${HOST_IP:-} → auto-inject dari host shell
 *     → Jalankan: export HOST_IP=$(hostname -I | awk '{print $1}') && docker compose up -d
 *     → Atau gunakan script start.sh yang sudah disediakan
 *
 *   OPSI B (Semi-otomatis — restart container saja):
 *     → Kosongkan HOST_IP= dan PORTAL_URL= di .env
 *     → Bot akan auto-detect via /proc/net/fib_trie saat restart
 *     → Jalankan: docker compose restart formbricks-discord-bot
 *
 *   OPSI C (Manual — paling stable untuk IP statis):
 *     → Isi PORTAL_URL=http://192.168.1.100:3000 di .env
 *     → Hanya perlu diubah jika IP benar-benar berganti subnet
 */

"use strict";

const os     = require("os");
const fs     = require("fs");
const config = require("../config");

let _cachedUrl = null;

// ─── Strategy 1: Baca IP dari /proc/net/fib_trie ─────────────────────────────
//
// /proc/net/fib_trie berisi semua IP yang terdaftar di routing table kernel,
// termasuk IP interface fisik host yang di-mount ke container via Docker.
// Ini lebih akurat dari membaca gateway karena langsung baca IP-nya, bukan gateway-nya.
//
// Format baris yang relevan:
//   LOCAL <IP>  ← IP lokal yang terdaftar di interface
//
// Filter:
//   - Skip 127.x.x.x (loopback)
//   - Skip 172.x.x.x (Docker bridge internal — 172.17.0.0/16, 172.18.0.0/16, dst)
//   - Skip 0.0.0.0
//   - Prefer 192.168.x.x → 10.x.x.x

function getHostIpFromFibTrie() {
  try {
    const path = "/proc/net/fib_trie";
    if (!fs.existsSync(path)) return null;

    const content = fs.readFileSync(path, "utf8");
    const lines   = content.split("\n");

    const candidates = [];
    for (let i = 0; i < lines.length; i++) {
      // Cari baris "LOCAL <IP>" — ini adalah IP yang terdaftar di interface
      const localMatch = lines[i].match(/LOCAL\s+(\d+\.\d+\.\d+\.\d+)/);
      if (!localMatch) continue;

      const ip = localMatch[1];

      // Skip loopback, Docker bridge, dan IP tidak valid
      if (ip.startsWith("127."))   continue;
      if (ip.startsWith("172."))   continue;  // Docker bridge range
      if (ip === "0.0.0.0")        continue;
      if (ip === "255.255.255.255") continue;

      // Skip broadcast address (x.x.x.0 dan x.x.x.255)
      const lastOctet = parseInt(ip.split(".")[3]);
      if (lastOctet === 0 || lastOctet === 255) continue;

      if (isPrivateIp(ip)) {
        candidates.push(ip);
      }
    }

    // Deduplicate
    const unique = [...new Set(candidates)];

    // Prioritas: 192.168.x.x → 10.x.x.x → yang lain
    const result = (
      unique.find((a) => a.startsWith("192.168.")) ||
      unique.find((a) => a.startsWith("10."))      ||
      unique[0]                                    ||
      null
    );

    if (result) {
      console.log(`🌐 [NETWORK] Host IP detected via fib_trie: ${result}${unique.length > 1 ? ` (candidates: ${unique.join(", ")})` : ""}`);
    }

    return result;
  } catch (err) {
    console.warn(`[NETWORK] Cannot read /proc/net/fib_trie: ${err.message}`);
    return null;
  }
}

// ─── Strategy 2: Docker Gateway via /proc/net/route ──────────────────────────
//
// Baca default gateway dari routing table.
// Gateway Docker = IP host di jaringan aktif.
// Kurang akurat dari fib_trie (ini gateway, bukan IP server itu sendiri),
// tapi masih berguna sebagai fallback karena biasanya 1 angka terakhir berbeda.

function getDockerHostIp() {
  try {
    const routeFile = "/proc/net/route";
    if (!fs.existsSync(routeFile)) return null;

    const lines = fs.readFileSync(routeFile, "utf8").trim().split("\n");
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].trim().split(/\s+/);
      if (!cols[2] || !cols[7]) continue;

      const flags       = parseInt(cols[7], 16);
      const RTF_UP      = 0x0001;
      const RTF_GATEWAY = 0x0002;
      if ((flags & RTF_UP) === 0 || (flags & RTF_GATEWAY) === 0) continue;
      if (cols[2] === "00000000") continue;

      const hex = cols[2].padStart(8, "0");
      const ip  = [
        parseInt(hex.substring(6, 8), 16),
        parseInt(hex.substring(4, 6), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(0, 2), 16),
      ].join(".");

      if (isPrivateIp(ip)) {
        console.log(`🌐 [NETWORK] Docker gateway detected: ${ip}`);
        return ip;
      }
    }
  } catch (err) {
    console.warn(`[NETWORK] Cannot read /proc/net/route: ${err.message}`);
  }
  return null;
}

// ─── Strategy 3: Scan Container Network Interfaces ───────────────────────────

function detectLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [, nets] of Object.entries(interfaces)) {
    for (const net of nets) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (net.address.startsWith("172.")) continue;  // skip Docker bridge
      candidates.push(net.address);
    }
  }

  return (
    candidates.find((a) => a.startsWith("192.168.")) ||
    candidates.find((a) => a.startsWith("10."))      ||
    candidates[0]                                    ||
    null
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return false;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Ambil URL publik yang dapat diakses dari jaringan LAN.
 * Di-cache per-process (reset saat restart container atau panggil resetCache()).
 */
function getPublicUrl() {
  if (_cachedUrl) return _cachedUrl;

  // ── Prioritas 1: PORTAL_URL dari .env ────────────────────────────────────
  const portalUrl = (process.env.PORTAL_URL || config.portal?.url || "").trim();
  if (portalUrl && isValidUrl(portalUrl)) {
    _cachedUrl = portalUrl.replace(/\/$/, "");
    console.log(`🌐 [NETWORK] Report URL (PORTAL_URL env): ${_cachedUrl}`);
    return _cachedUrl;
  }

  // ── Prioritas 2: HOST_IP dari .env ───────────────────────────────────────
  // Bisa diisi manual di .env, atau di-inject otomatis via docker-compose.yml
  const hostIp = (process.env.HOST_IP || "").trim();
  if (hostIp && isPrivateIp(hostIp)) {
    _cachedUrl = `http://${hostIp}:${config.port || 3000}`;
    console.log(`🌐 [NETWORK] Report URL (HOST_IP env): ${_cachedUrl}`);
    return _cachedUrl;
  }

  // ── Prioritas 3: Baca IP dari /proc/net/fib_trie (IP server fisik) ───────
  const fibIp = getHostIpFromFibTrie();
  if (fibIp) {
    _cachedUrl = `http://${fibIp}:${config.port || 3000}`;
    console.log(`🌐 [NETWORK] Report URL (fib_trie host IP): ${_cachedUrl}`);
    return _cachedUrl;
  }

  // ── Prioritas 4: Docker gateway (fallback) ────────────────────────────────
  const gatewayIp = getDockerHostIp();
  if (gatewayIp) {
    _cachedUrl = `http://${gatewayIp}:${config.port || 3000}`;
    console.log(`🌐 [NETWORK] Report URL (Docker gateway): ${_cachedUrl}`);
    return _cachedUrl;
  }

  // ── Prioritas 5: Scan interface container ────────────────────────────────
  const lanIp = detectLanIp();
  if (lanIp) {
    _cachedUrl = `http://${lanIp}:${config.port || 3000}`;
    console.log(`🌐 [NETWORK] Report URL (LAN interface scan): ${_cachedUrl}`);
    return _cachedUrl;
  }

  // ── Prioritas 6: localhost (last resort) ─────────────────────────────────
  _cachedUrl = `http://localhost:${config.port || 3000}`;
  console.warn(`⚠️  [NETWORK] Report URL (fallback localhost — tidak bisa diakses dari luar): ${_cachedUrl}`);
  return _cachedUrl;
}

/**
 * Reset cache — panggil via GET /api/network/reset jika perlu refresh IP
 * tanpa restart container.
 */
function resetCache() {
  const old = _cachedUrl;
  _cachedUrl = null;
  const fresh = getPublicUrl();
  console.log(`🔄 [NETWORK] Cache reset: ${old} → ${fresh}`);
  return fresh;
}

module.exports = { detectLanIp, getPublicUrl, resetCache, getDockerHostIp, getHostIpFromFibTrie };