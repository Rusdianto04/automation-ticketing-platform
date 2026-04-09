#!/bin/bash
# =============================================================================
# start.sh — Support & Incident System (Monorepo)
# Auto-inject HOST_IP, N8N_WEBHOOK_BASE, NEXTAUTH_URL ke Docker containers
#
# Cara pakai:
#   chmod +x start.sh       <- jalankan sekali saja
#   ./start.sh              <- start/rebuild semua service + ngrok (DEFAULT)
#   ./start.sh rebuild      <- force rebuild tanpa cache
#   ./start.sh stop         <- stop semua container
#   ./start.sh restart      <- restart backend saja (tanpa rebuild)
#   ./start.sh restart-all  <- restart semua container
#   ./start.sh logs         <- tail semua logs
#   ./start.sh logs backend <- tail logs backend saja
#   ./start.sh logs ngrok   <- tail logs ngrok saja
#   ./start.sh status       <- cek status semua container
#   ./start.sh ngrok-url    <- tampilkan URL publik ngrok
#   ./start.sh debug        <- test webhook debug endpoint
#
# FIX v4 (ngrok fix):
#   - Ngrok SELALU ikut docker compose up -d (tidak pakai --profile)
#   - Authtoken ngrok ada di ngrok.yml langsung (tidak lewat env var)
#   - Hapus profiles dari docker-compose.yml
#   - Tambah command ngrok-url untuk lihat URL publik
#   - NEXTAUTH_URL auto-inject dari HOST_IP
#   - Tidak ada backtick dalam echo string (fix "unexpected EOF" error)
# =============================================================================

set -e

# ── Deteksi IP server (skip loopback & Docker bridge 172.x) ─────────────────
detect_host_ip() {
  local IP=""

  if command -v ip >/dev/null 2>&1; then
    IP=$(ip -4 addr show scope global \
      | grep -v "docker\|br-\|veth\|virbr" \
      | grep "inet " \
      | grep -v "172\." \
      | awk '{print $2}' \
      | cut -d/ -f1 \
      | grep -E "^(192\.168\.|10\.)" \
      | head -1)
    [ -n "$IP" ] && echo "$IP" && return
  fi

  if command -v hostname >/dev/null 2>&1; then
    IP=$(hostname -I 2>/dev/null \
      | tr ' ' '\n' \
      | grep -v "172\." \
      | grep -E "^(192\.168\.|10\.)" \
      | head -1)
    [ -n "$IP" ] && echo "$IP" && return
  fi

  echo ""
}

print_banner() {
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║   Support & Incident System                              ║"
  echo "║   Backend :3000 | Frontend :3001 | N8N :5678             ║"
  echo "║   Ngrok   :4040                                          ║"
  echo "╚══════════════════════════════════════════════════════════╝"
}

COMMAND="${1:-up}"

case "$COMMAND" in

  # ── stop ────────────────────────────────────────────────────────────────────
  stop)
    print_banner
    echo "Stopping all containers..."
    docker compose down
    echo "All containers stopped."
    exit 0
    ;;

  # ── restart backend ──────────────────────────────────────────────────────────
  restart)
    print_banner
    HOST_IP=$(detect_host_ip)
    echo "Restarting backend container..."
    [ -n "$HOST_IP" ] && echo "Host IP: $HOST_IP"
    HOST_IP="$HOST_IP" docker compose restart backend
    echo "Backend restarted."
    echo "Cek: curl http://localhost:3000/health"
    exit 0
    ;;

  # ── restart all ──────────────────────────────────────────────────────────────
  restart-all)
    print_banner
    echo "Restarting all containers..."
    docker compose restart
    echo "All containers restarted."
    exit 0
    ;;

  # ── logs ─────────────────────────────────────────────────────────────────────
  logs)
    SERVICE="${2:-}"
    if [ -n "$SERVICE" ]; then
      docker compose logs -f "$SERVICE"
    else
      docker compose logs -f
    fi
    exit 0
    ;;

  # ── status ───────────────────────────────────────────────────────────────────
  status)
    print_banner
    docker compose ps
    exit 0
    ;;

  # ── rebuild (force, no cache) ─────────────────────────────────────────────────
  rebuild)
    print_banner
    HOST_IP=$(detect_host_ip)
    export HOST_IP="${HOST_IP}"
    echo "Force rebuild all containers (no cache)..."
    docker compose build --no-cache backend frontend
    docker compose up -d
    echo ""
    echo "Rebuild done. Semua container termasuk ngrok sudah up."
    exit 0
    ;;

  # ── ngrok-url ────────────────────────────────────────────────────────────────
  ngrok-url)
    echo "Mengambil URL publik ngrok..."
    echo ""

    # Coba via ngrok API (paling reliable)
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
      | grep -o '"public_url":"https://[^"]*"' \
      | head -1 \
      | cut -d'"' -f4)

    if [ -n "$NGROK_URL" ]; then
      echo "Ngrok URL    : $NGROK_URL"
      echo "Webhook URL  : $NGROK_URL/webhook/formbricks"
      echo ""
      echo "Set di Formbricks:"
      echo "  Settings -> Integrations -> Webhooks -> Add Webhook"
      echo "  URL: $NGROK_URL/webhook/formbricks"
    else
      echo "Ngrok belum ready atau tidak jalan."
      echo ""
      echo "Cek status   : docker ps | grep ngrok"
      echo "Cek logs     : ./start.sh logs ngrok"
      echo "Inspector UI : http://localhost:4040"
    fi
    exit 0
    ;;

  # ── debug: test webhook parsing tanpa DB ─────────────────────────────────────
  debug)
    echo "Testing webhook /debug endpoint..."
    echo "Mengirim payload Formbricks v2 format (ticketing)..."
    echo ""
    curl -s -X POST http://localhost:3000/webhook/debug \
      -H "Content-Type: application/json" \
      -d "{\"surveyId\":\"zcp7cbqqrtavbyd6wwkmk2vx\",\"furan0qd44wk06zh1x7eol86\":{\"value\":\"Test User\",\"type\":\"text\"},\"q4jlog6h436dwbdqdxoxnhy0\":{\"value\":\"test@email.com\",\"type\":\"email\"},\"funs3653dc10m0ohm7regqm6\":{\"value\":\"Laptop tidak bisa menyala\",\"type\":\"text\"}}"
    echo ""
    echo ""
    echo "Jika filledCount > 0 -> parsing OK"
    echo "Jika filledCount = 0 -> cek FORM_ID_TICKETING di .env"
    exit 0
    ;;

  # ── up (default) ──────────────────────────────────────────────────────────────
  up|*)
    HOST_IP=$(detect_host_ip)
    print_banner
    echo ""

    if [ -n "$HOST_IP" ]; then
      echo "Host IP          : $HOST_IP"
      echo "Backend URL      : http://$HOST_IP:3000"
      echo "Portal URL       : http://$HOST_IP:3001"
      echo "N8N Webhook Base : http://$HOST_IP:5678"
      echo "Ngrok Inspector  : http://$HOST_IP:4040"
    else
      echo "WARN: Host IP tidak terdeteksi, pakai auto-detect di dalam container"
    fi
    echo ""

    # Export HOST_IP ke docker compose
    export HOST_IP="${HOST_IP}"

    # ── N8N_WEBHOOK_BASE ──────────────────────────────────────────────────────
    CURRENT_N8N=$(grep -E "^N8N_WEBHOOK_BASE=" .env 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
    if [ -z "${CURRENT_N8N}" ] && [ -n "$HOST_IP" ]; then
      export N8N_WEBHOOK_BASE="http://$HOST_IP:5678"
      echo "N8N_WEBHOOK_BASE : auto-set -> http://$HOST_IP:5678"
    elif [ -n "${CURRENT_N8N}" ]; then
      export N8N_WEBHOOK_BASE="${CURRENT_N8N}"
      echo "N8N_WEBHOOK_BASE : dari .env -> $CURRENT_N8N"
    fi

    # ── NEXTAUTH_URL ──────────────────────────────────────────────────────────
    CURRENT_NEXTAUTH=$(grep -E "^NEXTAUTH_URL=" .env 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
    if [ -n "$HOST_IP" ]; then
      if [ -z "${CURRENT_NEXTAUTH}" ] || echo "${CURRENT_NEXTAUTH}" | grep -q "localhost"; then
        export NEXTAUTH_URL="http://$HOST_IP:3001"
        echo "NEXTAUTH_URL     : auto-set -> http://$HOST_IP:3001"
        echo "  (override localhost agar bisa diakses dari LAN)"
      else
        export NEXTAUTH_URL="${CURRENT_NEXTAUTH}"
        echo "NEXTAUTH_URL     : dari .env -> $CURRENT_NEXTAUTH"
      fi
    else
      FALLBACK="${CURRENT_NEXTAUTH:-http://localhost:3001}"
      export NEXTAUTH_URL="${FALLBACK}"
      echo "NEXTAUTH_URL     : $FALLBACK"
    fi

    echo ""

    # Build & start SEMUA service (termasuk ngrok — tidak perlu --profile)
    docker compose up -d --build

    echo ""
    echo "All containers started (postgres, backend, frontend, n8n, ngrok)."
    echo ""
    echo "Waiting for services to be ready (25s)..."
    sleep 25
    echo ""

    # Verifikasi backend
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
      echo "Backend  : http://localhost:3000 -> READY"
    else
      echo "Backend  : masih starting, cek: ./start.sh logs backend"
    fi

    # Verifikasi frontend
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
      echo "Frontend : http://localhost:3001 -> READY"
    else
      echo "Frontend : masih starting (~2 menit), cek: ./start.sh logs frontend"
    fi

    # Verifikasi ngrok + ambil URL publik
    echo ""
    echo "Menunggu ngrok tunnel siap (5s)..."
    sleep 5

    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
      | grep -o '"public_url":"https://[^"]*"' \
      | head -1 \
      | cut -d'"' -f4)

    if [ -n "$NGROK_URL" ]; then
      echo "Ngrok    : $NGROK_URL -> READY"
      echo ""
      echo "Ngrok Webhook URL: $NGROK_URL/webhook/formbricks"
      echo "  -> Set URL ini di Formbricks:"
      echo "     Settings -> Integrations -> Webhooks -> Add Webhook"
    else
      echo "Ngrok    : masih starting, cek: ./start.sh ngrok-url"
      echo "  atau cek logs: ./start.sh logs ngrok"
    fi
    # Fix permissions untuk uploads folder
    echo "Setting upload folder permissions..."
    chmod -R 755 ./uploads
    chown -R  1001:1001 ./uploads

    echo ""
    echo "================================================================"
    echo "Akses Portal    : http://${HOST_IP:-localhost}:3001/dashboard"
    echo "Admin Portal    : http://${HOST_IP:-localhost}:3001/admin"
    echo "N8N Dashboard   : http://${HOST_IP:-localhost}:5678"
    echo "N8N Webhook     : ${N8N_WEBHOOK_BASE:-http://n8n:5678}"
    echo "NEXTAUTH_URL    : ${NEXTAUTH_URL}"
    echo "Health Backend  : http://${HOST_IP:-localhost}:3000/health"
    echo "Health Frontend : http://${HOST_IP:-localhost}:3001/api/health"
    echo "Ngrok Inspector : http://${HOST_IP:-localhost}:4040"
    echo "================================================================"
    echo ""
    echo "Lihat semua logs  : ./start.sh logs"
    echo "Monitor backend   : ./start.sh logs backend"
    echo "Monitor ngrok     : ./start.sh logs ngrok"
    echo "Cek URL ngrok     : ./start.sh ngrok-url"
    echo "Test webhook      : ./start.sh debug"
    echo "Cek status        : ./start.sh status"
    ;;

esac
