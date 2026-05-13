#!/bin/bash
# =============================================================================
# start-prod.sh — Support & Incident System (PRODUCTION)

# Jalankan dari root project:
#   chmod +x infra/scripts/start-prod.sh   ← sekali saja
# =============================================================================

set -e

# ── Pastikan selalu jalan dari root project ───────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# ── Konfigurasi ───────────────────────────────────────────────────────────────
COMPOSE_FILE="docker-compose.prod.yml"
DC="docker compose -f $COMPOSE_FILE"
ENV_FILE=".env"
LOG_DIR="./logs"
BACKUP_DIR="./backups"

# ── Warna output ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}[OK]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC}  $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# ── Deteksi IP host ───────────────────────────────────────────────────────────
detect_host_ip() {
  local IP=""
  if command -v ip >/dev/null 2>&1; then
    IP=$(ip -4 addr show scope global \
      | grep -v "docker\|br-\|veth\|virbr" \
      | grep "inet " \
      | grep -v "172\." \
      | awk '{print $2}' \
      | cut -d/ -f1 \
      | grep -E "^(192\.168\.|10\.|)" \
      | head -1)
    [ -n "$IP" ] && echo "$IP" && return
  fi
  if command -v hostname >/dev/null 2>&1; then
    IP=$(hostname -I 2>/dev/null \
      | tr ' ' '\n' \
      | grep -v "172\." \
      | head -1)
    [ -n "$IP" ] && echo "$IP" && return
  fi
  echo "localhost"
}

# ── Cek .env wajib ada ────────────────────────────────────────────────────────
check_env() {
  if [ ! -f "$ENV_FILE" ]; then
    err ".env tidak ditemukan di $PROJECT_ROOT"
    echo "  Buat dari contoh: cp .env.example .env && nano .env"
    exit 1
  fi
}

# ── Cek Docker volumes production wajib ada ───────────────────────────────────
check_volumes() {
  local MISSING=0
  for VOL in sis_postgres_data sis_n8n_data sis_reports_data; do
    if ! docker volume inspect "$VOL" > /dev/null 2>&1; then
      warn "Volume '$VOL' belum ada"
      MISSING=1
    fi
  done
  if [ "$MISSING" = "1" ]; then
    echo ""
    info "Membuat volumes yang belum ada..."
    docker volume create sis_postgres_data 2>/dev/null && ok "sis_postgres_data" || true
    docker volume create sis_n8n_data      2>/dev/null && ok "sis_n8n_data"      || true
    docker volume create sis_reports_data  2>/dev/null && ok "sis_reports_data"  || true
    echo ""
  fi
}

# ── Cek direktori yang diperlukan ─────────────────────────────────────────────
check_dirs() {
  mkdir -p "$LOG_DIR/backend" "$LOG_DIR/frontend" uploads "$BACKUP_DIR"
}

# ── Inject env variables ──────────────────────────────────────────────────────
inject_env() {
  HOST_IP=$(detect_host_ip)
  export HOST_IP="${HOST_IP}"

  # N8N_WEBHOOK_BASE
  CURRENT_N8N=$(grep -E "^N8N_WEBHOOK_BASE=" "$ENV_FILE" 2>/dev/null \
    | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
  if [ -z "${CURRENT_N8N}" ] && [ -n "$HOST_IP" ]; then
    export N8N_WEBHOOK_BASE="http://$HOST_IP:5678"
  elif [ -n "${CURRENT_N8N}" ]; then
    export N8N_WEBHOOK_BASE="${CURRENT_N8N}"
  fi

  # NEXTAUTH_URL
  CURRENT_NEXTAUTH=$(grep -E "^NEXTAUTH_URL=" "$ENV_FILE" 2>/dev/null \
    | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
  if [ -z "${CURRENT_NEXTAUTH}" ] || echo "${CURRENT_NEXTAUTH}" | grep -q "localhost"; then
    if [ -n "$HOST_IP" ] && [ "$HOST_IP" != "localhost" ]; then
      export NEXTAUTH_URL="http://$HOST_IP:3001"
    fi
  else
    export NEXTAUTH_URL="${CURRENT_NEXTAUTH}"
  fi
}

# ── Banner ────────────────────────────────────────────────────────────────────
print_banner() {
  HOST_IP=$(detect_host_ip)
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║   Support & Incident System — PRODUCTION                     ║"
  echo "║   Backend :3000 | Frontend :3001 | Nginx :80 | N8N :5678     ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "  Project Root : $PROJECT_ROOT"
  echo "  Compose File : $COMPOSE_FILE"
  echo "  Host IP      : $HOST_IP"
  echo ""
}

# ── Health check satu service ────────────────────────────────────────────────
check_service_health() {
  local NAME="$1"
  local URL="$2"
  local MAX_WAIT="${3:-60}"
  local WAITED=0
  local INTERVAL=5

  echo -n "  Checking $NAME"
  while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf "$URL" > /dev/null 2>&1; then
      echo -e " ${GREEN}HEALTHY${NC}"
      return 0
    fi
    echo -n "."
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
  done
  echo -e " ${RED}TIMEOUT${NC}"
  return 1
}

# ═════════════════════════════════════════════════════════════════════════════
COMMAND="${1:-up}"

case "$COMMAND" in

  # ── STOP ──────────────────────────────────────────────────────────────────
  stop)
    print_banner
    info "Stopping all production containers..."
    $DC down
    ok "All containers stopped."
    exit 0
    ;;

  # ── RESTART backend saja (cepat, tanpa rebuild) ───────────────────────────
  restart)
    print_banner
    inject_env
    info "Restarting backend container..."
    $DC restart backend
    ok "Backend restarted."
    echo "  Cek health: curl http://localhost:3000/health"
    exit 0
    ;;

  # ── RESTART semua ─────────────────────────────────────────────────────────
  restart-all)
    print_banner
    info "Restarting all containers..."
    $DC restart
    ok "All containers restarted."
    exit 0
    ;;

  # ── REBUILD — force no-cache ──────────────────────────────────────────────
  rebuild)
    print_banner
    check_env
    check_volumes
    check_dirs
    inject_env
    info "Force rebuilding backend + frontend (no cache)..."
    $DC build --no-cache backend frontend
    info "Starting all services..."
    $DC up -d
    ok "Rebuild complete."
    exit 0
    ;;

  # ── LOGS ──────────────────────────────────────────────────────────────────
  logs)
    SERVICE="${2:-}"
    if [ -n "$SERVICE" ]; then
      $DC logs -f "$SERVICE"
    else
      $DC logs -f
    fi
    exit 0
    ;;

  # ── STATUS container ──────────────────────────────────────────────────────
  status)
    print_banner
    $DC ps
    echo ""
    info "Resource usage:"
    docker stats --no-stream --format \
      "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
      2>/dev/null | grep -E "NAME|sis-" || true
    exit 0
    ;;

  # ── HEALTH — cek semua endpoint ───────────────────────────────────────────
  health)
    print_banner
    echo "  Checking all services..."
    echo ""
    check_service_health "Backend  (3000)" "http://localhost:3000/health"   30
    check_service_health "Frontend (3001)" "http://localhost:3001/api/health" 60
    check_service_health "N8N      (5678)" "http://localhost:5678/healthz"   30
    check_service_health "Nginx    (80)"   "http://localhost/health"          15

    echo ""
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
      | grep -o '"public_url":"https://[^"]*"' \
      | head -1 | cut -d'"' -f4)
    if [ -n "$NGROK_URL" ]; then
      ok "Ngrok     (4040) ACTIVE → $NGROK_URL"
    else
      warn "Ngrok     (4040) tidak aktif atau belum siap"
    fi
    exit 0
    ;;

  # ── NGROK-URL ─────────────────────────────────────────────────────────────
  ngrok-url)
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
      | grep -o '"public_url":"https://[^"]*"' \
      | head -1 | cut -d'"' -f4)
    if [ -n "$NGROK_URL" ]; then
      echo ""
      ok "Ngrok aktif:"
      echo ""
      echo "  Public URL   : $NGROK_URL"
      echo "  Webhook URL  : $NGROK_URL/webhook/formbricks"
      echo ""
      echo "  Set di Formbricks:"
      echo "    Settings → Integrations → Webhooks → $NGROK_URL/webhook/formbricks"
    else
      warn "Ngrok belum aktif. Cek: ./infra/scripts/start-prod.sh logs ngrok"
      echo "  Inspector UI : http://localhost:4040"
    fi
    exit 0
    ;;

  # ── BACKUP database ───────────────────────────────────────────────────────
  backup)
    print_banner
    DB_USER=$(grep -E "^DB_USER=" "$ENV_FILE" 2>/dev/null \
      | cut -d= -f2 | tr -d '"' | xargs)
    DB_NAME=$(grep -E "^DB_NAME=" "$ENV_FILE" 2>/dev/null \
      | cut -d= -f2 | tr -d '"' | xargs)
    DB_USER="${DB_USER:-formbricks_user}"
    DB_NAME="${DB_NAME:-formbricks_tickets}"

    BACKUP_FILE="$BACKUP_DIR/db_$(date +%Y%m%d_%H%M%S).sql"
    info "Backing up database '$DB_NAME' → $BACKUP_FILE"

    docker exec sis-postgres pg_dump \
      -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

    BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    ok "Backup selesai: $BACKUP_FILE ($BACKUP_SIZE)"
    echo ""
    echo "  Restore: cat $BACKUP_FILE | docker exec -i sis-postgres psql -U $DB_USER -d $DB_NAME"
    exit 0
    ;;

  # ── PRUNE — bersihkan docker cache ───────────────────────────────────────
  prune)
    print_banner
    warn "Membersihkan Docker images dan cache yang tidak terpakai..."
    docker image prune -f
    docker builder prune -f
    ok "Docker cleanup selesai."
    docker system df
    exit 0
    ;;

  # ── UP — default: start production stack ─────────────────────────────────
  up|*)
    print_banner
    check_env
    check_volumes
    check_dirs
    inject_env

    HOST_IP=$(detect_host_ip)

    echo "  ENV:"
    echo "    N8N_WEBHOOK_BASE : ${N8N_WEBHOOK_BASE:-tidak di-set}"
    echo "    NEXTAUTH_URL     : ${NEXTAUTH_URL:-tidak di-set}"
    echo ""

    # ── Build & start ──────────────────────────────────────────────────────
    info "Building dan menjalankan production stack..."
    $DC up -d --build --remove-orphans

    echo ""
    info "Menunggu services siap (30s)..."
    sleep 30
    echo ""

    # ── Health checks ──────────────────────────────────────────────────────
    echo "  Health Checks:"
    check_service_health "Backend  (3000)" "http://localhost:3000/health"   60 || true
    check_service_health "Frontend (3001)" "http://localhost:3001/api/health" 120 || true
    check_service_health "Nginx    (:80)"  "http://localhost/health"          20 || true

    # ── Ngrok URL ──────────────────────────────────────────────────────────
    echo ""
    info "Menunggu ngrok tunnel (5s)..."
    sleep 5

    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
      | grep -o '"public_url":"https://[^"]*"' \
      | head -1 | cut -d'"' -f4)

    if [ -n "$NGROK_URL" ]; then
      ok "Ngrok aktif → $NGROK_URL"
      echo "    Webhook: $NGROK_URL/webhook/formbricks"
    else
      warn "Ngrok belum aktif. Cek: ./infra/scripts/start-prod.sh ngrok-url"
    fi

    # ── Summary ────────────────────────────────────────────────────────────
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║   PRODUCTION — AKSES URL                                    ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    printf "║  %-20s : %-36s║\n" "User Portal"    "http://${HOST_IP}:3001/dashboard"
    printf "║  %-20s : %-36s║\n" "Admin Portal"   "http://${HOST_IP}:3001/admin"
    printf "║  %-20s : %-36s║\n" "Via Nginx (:80)" "http://${HOST_IP}/dashboard"
    printf "║  %-20s : %-36s║\n" "N8N Dashboard"  "http://${HOST_IP}:5678"
    printf "║  %-20s : %-36s║\n" "Backend Health" "http://${HOST_IP}:3000/health"
    printf "║  %-20s : %-36s║\n" "Ngrok Inspector" "http://${HOST_IP}:4040"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    ;;

esac