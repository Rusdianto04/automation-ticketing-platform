#!/bin/bash
# =============================================================================
# init-volumes.sh — Create Docker volumes for support-incident-system
# Run ONCE on fresh Linux VPS before first deploy
# =============================================================================

set -e

echo "Creating Docker volumes for support-incident-system..."

docker volume create sis_postgres_data
docker volume create sis_n8n_data
docker volume create sis_reports_data

echo ""
echo "Volumes created:"
docker volume ls | grep sis_

echo ""
echo "============================================================"
echo "To migrate data from old formbricks-discord-bot volumes:"
echo "============================================================"
echo "docker run --rm -v formbricks-discord-bot_postgres_data:/src -v sis_postgres_data:/dst alpine sh -c 'cp -av /src/. /dst/'"
echo "docker run --rm -v formbricks-discord-bot_n8n_data:/src -v sis_n8n_data:/dst alpine sh -c 'cp -av /src/. /dst/'"
echo "docker run --rm -v formbricks-discord-bot_reports_data:/src -v sis_reports_data:/dst alpine sh -c 'cp -av /src/. /dst/'"
