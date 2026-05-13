# Support & Incident System

Sistem manajemen **support ticket** dan **insiden IT** berbasis monorepo production-grade.

## Quick Start

### Production
```bash
cp .env.example .env && nano .env
./infra/scripts/init-volumes.sh   # pertama kali
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend
```

### Development Local (pakai volume lama formbricks-discord-bot)
```bash
# Edit docker-compose.dev.yml section volumes: agar external: true
# name: formbricks-discord-bot_postgres_data
docker compose -f docker-compose.dev.yml up -d --build
```

## Services
| Service   | Port  | Keterangan                     |
|-----------|-------|--------------------------------|
| backend   | 3000  | Express API + Discord Bot      |
| frontend  | 3001  | Next.js Portal (User + Admin)  |
| n8n       | 5678  | N8N Workflow Engine            |
| nginx     | 80    | Reverse Proxy                  |
| postgres  | 5433  | PostgreSQL (internal: 5432)    |

## Arsitektur

Feature-based monorepo, Layered Architecture, Repository Pattern, Clean DTO.

**Backend data flow:**
```
Route → Controller → Service → Repository → Prisma → PostgreSQL
```

**Frontend data flow (no direct DB):**
```
Frontend (Next.js) → lib/api.ts → Backend API → Repository → Prisma → PostgreSQL
```

## Repository Pattern
| Repository | Modul | Isi |
|-----------|-------|-----|
| ticket.repository.js | ticket | CRUD tiket, search, count |
| recommendation.repository.js | ticket | Keyword match + FTS |
| activity.repository.js | activity | Activity log |
| submission.repository.js | webhook | Webhook tracking |
| chatbot.repository.js | chatbot | Interaksi + Knowledge Base |
| report.repository.js | report | Laporan + Admin stats |

## Migrasi Data dari versi lama
```bash
docker run --rm -v formbricks-discord-bot_postgres_data:/src -v sis_postgres_data:/dst alpine sh -c "cp -av /src/. /dst/"
docker run --rm -v formbricks-discord-bot_n8n_data:/src -v sis_n8n_data:/dst alpine sh -c "cp -av /src/. /dst/"
docker run --rm -v formbricks-discord-bot_reports_data:/src -v sis_reports_data:/dst alpine sh -c "cp -av /src/. /dst/"
```

## CI/CD Secrets
```
VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_PORT, VPS_PROJECT_DIR
```
