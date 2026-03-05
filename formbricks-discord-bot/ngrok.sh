#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ngrok.sh
# Script Ngrok — Jalankan tunnel manual (untuk development / testing)
#
# PENGGUNAAN PRODUCTION:
#   Gunakan service `ngrok` di docker-compose.yml (sudah dikonfigurasi).
#
# PENGGUNAAN DEVELOPMENT (tanpa Docker):
#   chmod +x ngrok.sh
#   ./ngrok.sh
#
# Pastikan:
#   - ngrok sudah terinstall: https://ngrok.com/download
#   - authtoken sudah diset: ngrok authtoken <YOUR_TOKEN>
# ─────────────────────────────────────────────────────────────────────────────

set -e

PORT="${PORT:-3000}"

echo "🌐 Starting Ngrok tunnel → localhost:${PORT}"
echo "📡 Formbricks Webhook URL akan tersedia di Ngrok dashboard: http://localhost:4040"
echo ""

ngrok http "${PORT}"
