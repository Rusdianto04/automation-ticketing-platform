#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — Auto-inject IP server ke container sebelum docker compose up
#
# Cara pakai:
#   chmod +x start.sh    ← jalankan sekali saja
#   ./start.sh           ← setiap kali mau start/restart bot
#   ./start.sh restart   ← restart container saja (tanpa rebuild)
#   ./start.sh stop      ← stop semua container
#
# Script ini otomatis mendeteksi IP LAN server yang aktif (bukan Docker/loopback)
# dan menginjeknya ke container sebagai HOST_IP environment variable.
# Tidak perlu edit .env saat ganti LAN ↔ WiFi.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# ── Deteksi IP server (skip loopback, Docker bridge 172.x.x.x) ───────────────
detect_host_ip() {
  # Cara 1: ip addr (paling akurat, skip Docker interfaces)
  if command -v ip &>/dev/null; then
    local IP
    IP=$(ip -4 addr show scope global \
      | grep -v "docker\|br-\|veth\|virbr" \
      | grep "inet " \
      | grep -v "172\." \
      | awk '{print $2}' \
      | cut -d/ -f1 \
      | grep -E "^(192\.168\.|10\.)" \
      | head -1)
    if [ -n "$IP" ]; then
      echo "$IP"
      return
    fi
  fi

  # Cara 2: hostname -I (fallback)
  if command -v hostname &>/dev/null; then
    local IP
    IP=$(hostname -I 2>/dev/null \
      | tr ' ' '\n' \
      | grep -v "172\." \
      | grep -E "^(192\.168\.|10\.)" \
      | head -1)
    if [ -n "$IP" ]; then
      echo "$IP"
      return
    fi
  fi

  # Cara 3: ifconfig (fallback lama)
  if command -v ifconfig &>/dev/null; then
    local IP
    IP=$(ifconfig 2>/dev/null \
      | grep "inet " \
      | grep -v "127\.\|172\." \
      | grep -E "(192\.168\.|10\.)" \
      | awk '{print $2}' \
      | head -1)
    if [ -n "$IP" ]; then
      echo "$IP"
      return
    fi
  fi

  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

COMMAND="${1:-up}"

case "$COMMAND" in
  stop)
    echo "🛑 Stopping all containers..."
    docker compose down
    echo "✅ Done."
    exit 0
    ;;

  restart)
    echo "🔄 Restarting bot container..."
    HOST_IP=$(detect_host_ip)
    if [ -n "$HOST_IP" ]; then
      echo "🌐 Host IP detected: $HOST_IP"
      HOST_IP="$HOST_IP" docker compose restart formbricks-discord-bot
    else
      echo "⚠️  Could not detect host IP, using auto-detect in container"
      docker compose restart formbricks-discord-bot
    fi
    echo "✅ Restarted. Verify: curl http://localhost:3000/api/network/info"
    exit 0
    ;;

  up|*)
    HOST_IP=$(detect_host_ip)

    echo "╔══════════════════════════════════════════════════╗"
    echo "║  Formbricks Discord Bot — Starting Up            ║"
    echo "╚══════════════════════════════════════════════════╝"

    if [ -n "$HOST_IP" ]; then
      echo "🌐 Host IP    : $HOST_IP"
      echo "🔗 Portal URL : http://$HOST_IP:3000"
    else
      echo "⚠️  Host IP    : tidak terdeteksi → bot akan auto-detect di dalam container"
    fi
    echo ""

    # Export HOST_IP ke environment docker compose
    export HOST_IP="$HOST_IP"

    # Start semua container
    docker compose up -d --build

    echo ""
    echo "✅ All containers started."
    echo ""

    # Tunggu bot ready lalu verifikasi IP
    echo "⏳ Waiting for bot to be ready..."
    sleep 8
    echo ""

    if curl -s http://localhost:3000/api/network/info > /tmp/net_info.json 2>/dev/null; then
      CURRENT_URL=$(cat /tmp/net_info.json | grep -o '"currentUrl":"[^"]*"' | cut -d'"' -f4)
      echo "🔍 Network info:"
      cat /tmp/net_info.json
      echo ""
      echo "✅ Portal URL aktif: $CURRENT_URL"
    else
      echo "ℹ️  Bot belum ready, cek dengan: curl http://localhost:3000/api/network/info"
    fi
    ;;
esac
