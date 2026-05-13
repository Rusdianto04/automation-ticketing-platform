<h1 align="center">Support & Incident System</h1>
<p align="center">
  Platform manajemen Ticket Support & Incident berbasis Automation AI — Discord Bot · N8N Automation · Next.js Portal · Formbricks
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js"/>
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma"/>
  <img src="https://img.shields.io/badge/N8N-Automation-EA4B71?logo=n8n"/>
  <img src="https://img.shields.io/badge/Discord.js-Bot-5865F2?logo=discord&logoColor=white"/>
</p>

---

## 📋 Daftar Isi

- [Gambaran Umum](#-gambaran-umum)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Fitur Utama](#-fitur-utama)
- [Struktur Folder](#-struktur-folder)
- [Prasyarat](#-prasyarat)
- [Konfigurasi Environment](#-konfigurasi-environment)
- [Cara Deploy — Development](#-cara-deploy--development)
- [Cara Deploy — Production](#-cara-deploy--production)
- [Script start.sh (Production)](#-script-startsh-production)
- [Konfigurasi Formbricks](#-konfigurasi-formbricks)
- [Konfigurasi Discord Bot](#-konfigurasi-discord-bot)
- [Konfigurasi N8N Workflow](#-konfigurasi-n8n-workflow)
- [Ngrok — Tunnel Publik](#-ngrok--tunnel-publik)
- [CI/CD GitHub Actions](#-cicd-github-actions)
- [Portal User & Admin](#-portal-user--admin)
- [Discord Bot Commands](#-discord-bot-commands)
- [Perintah Berguna](#-perintah-berguna)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Gambaran Umum

**Support & Incident System** adalah platform manajemen tiket support dan incident IT yang terintegrasi penuh dengan:

- **Formbricks** — sebagai sumber form online (Support & Incident)
- **Static Web Form** — form langsung di portal users
- **Discord Bot** — notifikasi real-time, update status, assignment petugas
- **N8N** — workflow automation (AI classification, summary, chatbot)
- **Groq AI** — classification, summarization, smart recommendation
- **Next.js Portal** — portal user dan admin berbasis web
- **Nginx** — reverse proxy untuk production

Setiap tiket yang masuk (dari Formbricks maupun Static Form) akan otomatis:
1. Tersimpan di database PostgreSQL
2. Membuat thread di Discord channel yang ditentukan
3. Mengirim email konfirmasi ke pemohon
4. Diproses oleh N8N workflow (AI classification + summary)
5. Tersedia di Portal User (cek status) dan Portal Admin (kelola tiket)

---

## 🏗 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUMBER INPUT                             │
│                                                                 │
│   [Formbricks Form Online]    [Static Web Form di Portal]       │
│           │                           │                         │
│           └──────────┬────────────────┘                         │
│                      │ POST /webhook/formbricks                 │
│                      │ POST /api/tickets/create                 │
└──────────────────────┼──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    BACKEND (Express.js :3000)                   │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Webhook    │  │  Ticket API  │  │   Discord Bot        │   │
│  │  Service   │  │  /api/ticket │  │   (discord.js v14)   │   │
│  │  (Formbricks│  │  /api/admin  │  │                      │   │
│  │   parser)  │  │  /api/report │  │  !status / !assign   │   │
│  └──────┬──────┘  └──────┬───────┘  │  !evidence / AI chat │   │
│         │                │          └──────────┬───────────┘   │
│         └────────┬────────┘                    │               │
│                  │                             │               │
│         ┌────────▼─────────┐      ┌────────────▼───────────┐   │
│         │   PostgreSQL     │      │   N8N Webhook          │   │
│         │   (Prisma ORM)   │      │   (Event-driven)       │   │
│         └──────────────────┘      └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    FRONTEND (Next.js :3001)                     │
│                                                                 │
│   /dashboard      — Portal User (cek status tiket)             │
│   /tickets/:id    — Detail tiket (Support & Incident)          │
│   /admin          — Portal Admin (kelola semua tiket)          │
│   /admin/tickets  — List & filter tiket                        │
│   /admin/reports  — Laporan incident                           │
└─────────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                  NGINX Reverse Proxy (:80)                      │
│   /           → Frontend  :3001                                │
│   /api/       → Backend   :3000                                │
│   /webhook/   → Backend   :3000                                │
│   /reports/   → Backend   :3000                                │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                  N8N Workflow Engine (:5678)                   │
│                                                                │
│  Workflow 1: Ticket Intelligence (AI classification + summary) │
│  Workflow 2: Chatbot Assistant (AI Q&A via Discord)            │
│  Workflow 3: Incident Handler + Smart Intake                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    NGROK Tunnel (:4040)                        │
│   Formbricks (cloud) → ngrok → backend :3000                  │
│   Inspector UI: http://SERVER_IP:4040                         │
└────────────────────────────────────────────────────────────────┘
```

---

## ✨ Fitur Utama

### Input Tiket
- **Formbricks Form** — form online yang bisa dibagikan via link (Support & Incident)
- **Static Web Form** — form 3-langkah langsung di portal (multi-step, auto-fill email)
- **Dual-mode parsing** — Formbricks v2 (field ID → label mapping) & static form (label langsung)

### Manajemen Tiket
- **Portal User** — cek status tiket via ID, lihat detail, timeline, summary AI
- **Portal Admin** — list semua tiket, filter status/tipe, update status, reassign petugas
- **Status Flow Support** — OPEN → PENDING → IN_PROGRESS → DONE / REJECT
- **Status Flow Incident** — OPEN → INVESTIGASI → MITIGASI → RESOLVED

### Discord Integration
- Thread otomatis dibuat per tiket di channel yang dikonfigurasi
- Pesan info tiket terformat rapi dengan semua field data
- Command `!status`, `!assign`, `!evidence` untuk update tiket dari Discord
- AI Chatbot via @mention

### AI & Automation (N8N + Groq)
- **Auto-classification** — tipe incident, prioritas, area suspect
- **Auto-summary** — Summary semua percakapan diskusi dan root cause ticket
- **Smart Recommendation** — saran solusi berdasarkan tiket serupa
- **Chatbot AI** — jawab pertanyaan user tentang tiket aktif via Discord

### Reporting
- Generate laporan incident otomatis dalam format HTML
- Export data tiket Support & Incident ke CSV
- Dashboard admin dengan statistik real-time

---

## 📁 Struktur Folder

```
support-incident-system/
│
├── apps/
│   ├── backend/                    # Express.js API + Discord Bot
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Database schema (5 tabel)
│   │   ├── src/
│   │   │   ├── app.js              # Express app setup
│   │   │   ├── server.js           # Entry point (Discord + HTTP)
│   │   │   ├── config/index.js     # Semua konfigurasi dari env
│   │   │   ├── common/             # Helpers, logger, middleware
│   │   │   ├── infrastructure/     # Prisma client, Discord, Email
│   │   │   └── modules/            # Feature-based modules
│   │   │       ├── ticket/         # Ticket CRUD, service, mapper
│   │   │       ├── webhook/        # Formbricks webhook handler
│   │   │       ├── chatbot/        # AI chatbot service
│   │   │       ├── report/         # Incident report generator
│   │   │       ├── activity/       # Audit log
│   │   │       └── health/         # Health check endpoint
│   │   ├── n8n-workflows/          # Exported N8N workflow JSON
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── frontend/                   # Next.js 16 Portal
│       ├── src/
│       │   ├── app/
│       │   │   ├── dashboard/      # Portal User — list tiket
│       │   │   ├── tickets/[id]/   # Detail tiket (Support & Incident)
│       │   │   ├── admin/          # Portal Admin
│       │   │   └── api/            # Next.js API Routes
│       │   ├── features/           # Domain logic (ticket, admin, report)
│       │   ├── lib/                # API client, auth, tickets helper
│       │   ├── types/              # TypeScript types
│       │   └── components/         # Shared UI components
│       ├── Dockerfile
│       └── package.json
│
├── infra/
│   ├── docker/
│   │   └── docker-entrypoint.sh   # Backend container entrypoint
│   ├── nginx/
│   │   └── nginx.conf             # Nginx reverse proxy config
│   └── scripts/
│       ├── start.sh               # Dev start script
│       ├── ngrok.yml              # Ngrok tunnel config (dev)
│       └── init-volumes.sh        # Inisialisasi Docker volumes
│
├── .github/
│   └── workflows/
│       ├── ci.yml                 # CI: lint, build, docker build
│       └── cd.yml                 # CD: deploy ke VPS via SSH
│
├── docker-compose.dev.yml         # Development stack
├── docker-compose.prod.yml        # Production stack (+ Nginx + Ngrok)
├── ngrok.yml                      # Ngrok config untuk production
├── .env.example                   # Template environment variables
├── .gitignore
└── package.json                   # Root workspace
```

---

## 📦 Prasyarat

| Komponen | Versi Minimum | Keterangan |
|----------|---------------|------------|
| Docker   | 24+           | Wajib |
| Docker Compose | v2+ (plugin) | `docker compose` (tanpa tanda `-`) |
| Node.js  | 18+ (backend) / 20+ (frontend) | Hanya untuk development lokal tanpa Docker |
| Git      | Bebas         | Untuk clone & CD pipeline |

**Tidak perlu install** Node.js, PostgreSQL, atau npm secara manual — semua berjalan di dalam Docker container.

---

## ⚙️ Konfigurasi Environment

Seluruh konfigurasi dikelola lewat **satu file `.env`** di root project.

```bash
# Salin template
cp .env.example .env

# Edit sesuai kebutuhan
nano .env
```

Lihat [`.env.example`](.env.example) untuk daftar lengkap variabel beserta penjelasan.

### Variabel Wajib

| Variabel | Keterangan |
|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string (sudah ada defaultnya, sesuaikan jika perlu) |
| `DISCORD_BOT_TOKEN` | Token bot Discord dari [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_CHANNEL_ID` | ID channel Discord untuk thread tiket |
| `DISCORD_GUILD_ID` | ID server Discord |
| `JWT_SECRET` | Secret key untuk session admin portal |
| `ADMIN_PASSWORD` | Password login admin portal |

### Variabel Opsional tapi Penting

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `GROQ_API_KEY` | — | API key Groq AI. Daftar gratis di [console.groq.com](https://console.groq.com). Tanpa ini, AI features tidak aktif |
| `SMTP_USER` / `SMTP_PASS` | — | Gmail + App Password untuk notifikasi email |
| `NGROK_AUTHTOKEN` | — | Diperlukan jika menggunakan Formbricks cloud + server LAN |
| `N8N_WEBHOOK_BASE` | Auto-detect | URL N8N yang bisa diakses browser (bukan internal Docker) |
| `NEXTAUTH_URL` | localhost:3001 | URL frontend yang benar untuk production (gunakan IP server) |

---

## 🚀 Cara Deploy — Development

Development menggunakan `docker-compose.dev.yml` dengan hot-reload backend.

```bash
# 1. Clone repository
git clone {support-incident-system}
cd automation-ticketing-platform/support-incident-system

# 2. Salin dan isi .env
cp .env.example .env
nano .env   # isi minimal: DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DISCORD_GUILD_ID

# 3. Start semua service
docker compose -f docker-compose.dev.yml up -d --build

# 4. Cek status
docker compose -f docker-compose.dev.yml ps

# 5. Lihat log
docker compose -f docker-compose.dev.yml logs -f backend
```

### URL Development

| Service | URL |
|---------|-----|
| Portal User | http://localhost:3001/dashboard |
| Portal Admin | http://localhost:3001/admin |
| Backend API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |
| N8N Dashboard | http://localhost:5678 |
| Ngrok Inspector | http://localhost:4040 |
| PostgreSQL | localhost:5433 |

> **Login Admin:**
> - Username: `admin` (atau sesuai `ADMIN_USERNAME` di `.env`)
> - Password: `Admin` (atau sesuai `ADMIN_PASSWORD` di `.env`)

---

## 🏭 Cara Deploy — Production

Production menggunakan `docker-compose.prod.yml` dengan Nginx + Ngrok.

### Opsi 1 — Menggunakan Script (Direkomendasikan)

```bash
# Beri permission script (sekali saja)
chmod +x infra/scripts/start-prod.sh

# Start production stack
./infra/scripts/start-prod.sh
```

### Opsi 2 — Manual Docker Compose

```bash
# Buat Docker volumes production (wajib — sekali saja)
docker volume create sis_postgres_data
docker volume create sis_n8n_data
docker volume create sis_reports_data

# Build & start
docker compose -f docker-compose.prod.yml up -d --build

# Cek status
docker compose -f docker-compose.prod.yml ps
```

### URL Production

| Service | URL (ganti dengan IP server Anda) |
|---------|-----------------------------------|
| Portal User | http://192.168.x.x/dashboard atau http://192.168.x.x:3001/dashboard |
| Portal Admin | http://192.168.x.x/admin |
| Backend API | http://192.168.x.x:3000 |
| Health Check | http://192.168.x.x/health |
| N8N Dashboard | http://192.168.x.x:5678 |
| Ngrok Inspector | http://192.168.x.x:4040 |

---

## 📜 Script `start-prod.sh` (Production)

Script ini menangani:
- Auto-detect IP server (skip loopback & Docker bridge 172.x)
- Auto-inject `HOST_IP`, `N8N_WEBHOOK_BASE`, `NEXTAUTH_URL`
- Cek `.env` dan Docker volumes sebelum start
- Health check semua service setelah start
- Backup database PostgreSQL
- Ngrok URL inspector

```
## 🟦 Konfigurasi Formbricks

Formbricks adalah platform form online yang digunakan sebagai sumber input tiket dari luar.

### Setup Form

1. Daftar di [formbricks.com](https://formbricks.com) (self-host atau cloud)
2. Buat dua survey:
   - **Ticketing Support Form** — untuk tiket support
   - **Incident Report Form** — untuk laporan incident
3. Catat **Survey ID** dari URL: `.../surveys/SURVEY_ID_INI/...`

### Konfigurasi Field Mapping

Formbricks v2 mengirim response dengan **field ID acak** sebagai key (bukan label). Sistem ini menggunakan dua mekanisme untuk mapping:

**Mekanisme 1 (Otomatis):** Sistem membaca `survey.questions` dari payload Formbricks untuk membangun mapping `fieldId → label` secara dinamis.

**Mekanisme 2 (Manual via ENV):** Untuk jaminan konsistensi, isi `FORMBRICKS_TICKETING_FIELD_MAP` dan `FORMBRICKS_INCIDENT_FIELD_MAP` di `.env`:

```env
# Format: "questionId:Label Name,questionId2:Label Name2"
# Dapatkan questionId dari Formbricks dashboard → Survey → Questions

# Contoh Ticketing Form:
FORMBRICKS_TICKETING_FIELD_MAP=furan0qd44wk06zh1x7eol86:Reporter Information,wxro33g8v747alp0f5h5rjiu:Division,ubv5h3uuh9lqwgw2rb1xcl0t:No Telepon,q4jlog6h436dwbdqdxoxnhy0:Email,pekxomijpxixcvhkyx1ax0kh:ID Device,q0exb43ez6zw9o5xti6isu4w:Ruangan,u7n6ai5rt0ro8iybkfmle7li:Lantai,ngwljbqzvr6mg1xq33v0zhk5:Tanggal & Waktu Pemohon,j5hge2t3a59uw9zuw0l4s63c:Type of Support Requested,funs3653dc10m0ohm7regqm6:Issue,da2u7brsaabl48ympasqqzik:Jumlah Barang

# Contoh Incident Form:
FORMBRICKS_INCIDENT_FIELD_MAP=bsq3gnstra5d40chamn1j7bg:Priority Incident,dw20caznxsng3uprsnxvt5nr:Date & Time Incident,f3r029x47v9su3w173fwn4ki:Severity Incident,j5hge2t3a59uw9zuw0l4s63c:Incident Information,lzwo9voycdeywln54rv68f2q:Indicated Issue,sbt48laul3xtcm3kwggf4tpi:Suspect Area
```

### Setup Webhook di Formbricks

Setelah Ngrok aktif:

1. Buka Formbricks Dashboard → **Settings → Integrations → Webhooks**
2. Klik **Add Webhook**
3. URL: `https://xxxx.ngrok-free.app/webhook/formbricks`
4. Event: **Response Finished**
5. Pilih survey yang sesuai

---

## 🤖 Konfigurasi Discord Bot

### Membuat Bot

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → beri nama (contoh: `ITBOT`)
3. Menu **Bot** → **Reset Token** → salin token
4. Isi `DISCORD_BOT_TOKEN` di `.env`

### Permissions yang Diperlukan

Bot memerlukan permissions berikut (atau cukup **Administrator** untuk development):

| Permission | Keterangan |
|------------|------------|
| Read Messages | Membaca pesan di channel |
| Send Messages | Mengirim pesan |
| Create Public Threads | Membuat thread per tiket |
| Send Messages in Threads | Kirim pesan di dalam thread |
| Manage Messages | Pin pesan info tiket |
| Embed Links | Menampilkan embed message |
| Attach Files | Upload file evidence |

### Invite Bot ke Server

1. Menu **OAuth2 → URL Generator**
2. Scope: `bot`
3. Permissions: centang semua yang diperlukan di atas
4. Salin URL → buka di browser → pilih server → Authorize

### Ambil IDs

Aktifkan **Developer Mode** di Discord:
- Settings → Advanced → Developer Mode ✓

- **Channel ID**: klik kanan channel → **Copy Channel ID** → isi `DISCORD_CHANNEL_ID`
- **Guild ID**: klik kanan nama server → **Copy Server ID** → isi `DISCORD_GUILD_ID`

---

## 🔄 Konfigurasi N8N Workflow

### Import Workflow

1. Buka N8N Dashboard: `http://SERVER_IP:5678`
2. Login dengan `N8N_USER` / `N8N_PASS` dari `.env`
3. Menu **Workflows** → **Import from File**
4. Import ketiga file dari `apps/backend/n8n-workflows/`:
   - `Workflow 1_ Automation Ticket Intelligence - Event Driven (Production).json`
   - `Workflow 2_ Automation Chatbot Assistane - Event Driven (Production).json`
   - `Workflow 3: Incident Handler + Smart Intake.json`

### Konfigurasi Credentials di N8N

Setelah import, buka setiap workflow dan konfigurasi:

| Credential | Nilai |
|------------|-------|
| Groq API Key | Isi dengan `GROQ_API_KEY` dari `.env` |
| Backend API URL | `http://backend:3000` |
| N8N API Key (header) | `automation_ticketing01_incident02` (atau sesuai `N8N_API_KEY`) |

### Aktifkan Workflow

Klik toggle **Active** pada setiap workflow setelah dikonfigurasi.

### Webhook N8N

Workflow dipicu oleh webhook dari backend. URL internal (sudah dikonfigurasi di `.env`):
- Discord activity: `http://n8n:5678/webhook/discord-activity`
- Chatbot Q&A: `http://n8n:5678/webhook/chatbot-qa`
- Incident event: `http://n8n:5678/webhook/incident-event`

---

## 🌐 Ngrok — Tunnel Publik

Ngrok diperlukan agar Formbricks (cloud) bisa mengirim webhook ke server yang ada di LAN perusahaan.

### Setup Token

1. Daftar di [ngrok.com](https://ngrok.com) (gratis)
2. Buka [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Salin authtoken → isi `NGROK_AUTHTOKEN` di `.env`
4. Juga update langsung di `ngrok.yml` (untuk production):

```yaml
# ngrok.yml
version: "3"
agent:
  authtoken: "TOKEN_ANDA_DI_SINI"

tunnels:
  bot:
    addr: backend:3000
    proto: http
    inspect: true
```

### Lihat URL Publik

```bash
# Via script
./infra/scripts/start-prod.sh ngrok-url

# Via log
docker logs sis-ngrok 2>&1 | grep -i url

# Via browser
http://SERVER_IP:4040
```

### Set di Formbricks

URL yang perlu diset di Formbricks:
```
https://xxxx.ngrok-free.app/webhook/formbricks
```

> **Catatan:** URL ngrok berubah setiap kali restart (akun gratis). Untuk URL tetap, upgrade ke ngrok Pro atau gunakan domain sendiri.

---

## 🔁 CI/CD GitHub Actions

### CI Pipeline (`.github/workflows/ci.yml`)

Berjalan otomatis saat push ke `main` atau `develop`:

1. **Backend** — Lint (node --check), Prisma generate
2. **Frontend** — Install, Prisma generate, Build Next.js
3. **Docker** — Build image backend & frontend (tanpa push)

### CD Pipeline (`.github/workflows/cd.yml`)

Berjalan saat push ke `main` → deploy otomatis ke VPS via SSH.

### Setup GitHub Secrets

Tambahkan secrets berikut di **Settings → Secrets → Actions**:

| Secret | Keterangan |
|--------|------------|
| `VPS_HOST` | IP atau domain server |
| `VPS_USER` | Username SSH (contoh: `ubuntu`) |
| `VPS_SSH_KEY` | Private key SSH (isi seluruh isi file `~/.ssh/id_rsa`) |
| `VPS_PORT` | Port SSH (default: `22`) |
| `VPS_PROJECT_DIR` | Path project di server (contoh: `/opt/support-incident-system`) |

### Setup Server untuk CD

```bash
# Di server, clone project
git clone {support-incident-system}
cd /opt/support-incident-system/support-incident-system

# Isi .env
cp .env.example .env && nano .env

# Buat volumes
docker volume create sis_postgres_data
docker volume create sis_n8n_data
docker volume create sis_reports_data
```

---

## 🖥️ Portal User & Admin

### Portal User (`/dashboard`)

- Lihat daftar incident aktif
- Cari tiket berdasarkan ID atau judul
- Filter berdasarkan status (Open, In Progress, Closed)
- Buat tiket Support baru via form 3-langkah
- Lihat detail tiket: info, summary AI, root cause, timeline progress

### Portal Admin (`/admin`)

Login diperlukan. Default credentials dari `.env`:
- Username: `admin`
- Password: `Admin`

Fitur Admin:
- Dashboard statistik (total tiket, open, closed)
- List semua tiket dengan filter & search
- Detail tiket: data formulir, status, assignee, timeline
- Update status tiket (OPEN → PENDING → IN_PROGRESS → DONE / REJECT)
- Reassign petugas
- Generate laporan incident
- Export data ke CSV
- Lihat automation logs

---

## 💬 Discord Bot Commands

Semua command digunakan **di dalam thread tiket**:

| Command | Keterangan |
|---------|------------|
| `!status [STATUS]` | Update status tiket. Status: `OPEN`, `PENDING`, `INVESTIGASI`, `MITIGASI`, `DONE`, `RESOLVED`, `REJECT` |
| `!assign [nama1, nama2]` | Assign petugas ke tiket |
| `!evidence` | Lampirkan file sebagai evidence (kirim bersamaan dengan file) |
| `!clear-history` | Reset history percakapan AI chatbot |
| `!chatbot-help` | Tampilkan panduan penggunaan AI chatbot |
| `!chatbot-stats` | Lihat statistik penggunaan chatbot |
| `@BotName [pertanyaan]` | Tanya AI chatbot tentang tiket ini |

**Contoh penggunaan:**
```
!status INVESTIGASI
!assign Budi, Siti, Tim Jaringan
!status DONE
```
---
## 🛠 Perintah Berguna
### Generate Admin Password Hash
```bash
docker exec sis-backend node -e "require('bcryptjs').hash('PasswordBaru123', 12).then(console.log)"
# Salin output ($2b$12$...) ke ADMIN_PASSWORD_HASH di .env
```
---

## 🔧 Troubleshooting
### Prisma migration error

```bash
# Jalankan migrate manual
docker exec sis-backend npx prisma migrate deploy

# Reset database (HATI-HATI: hapus semua data!)
docker exec sis-backend npx prisma migrate reset --force
```

### Discord bot tidak online

```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i discord
# Cek DISCORD_BOT_TOKEN di .env — pastikan tidak expired
# Token baru: Discord Developer Portal → Bot → Reset Token
```

### Formbricks webhook tidak masuk

```bash
# 1. Cek ngrok running
docker logs sis-ngrok 2>&1 | grep -i url

# 2. Cek ngrok inspector
# Buka: http://SERVER_IP:4040

# 3. Test manual
curl -X POST https://xxxx.ngrok-free.app/webhook/formbricks \
  -H "Content-Type: application/json" \
  -d '{"event":"test","data":{"surveyId":"test"}}'

# 4. Cek log backend
docker compose -f docker-compose.prod.yml logs backend | grep -i webhook
```

### N8N workflow tidak aktif setelah restart

```bash
# Buka N8N dashboard
# http://SERVER_IP:5678
# Cek setiap workflow — toggle Active jika mati
```
## 📊 Database Schema

| Tabel | Keterangan |
|-------|------------|
| `tickets` | Data tiket support & incident |
| `submissions` | Raw payload dari form submission |
| `activities` | Audit log per tiket |
| `knowledge_base` | Runbook & artikel KB untuk AI |
| `chatbot_interactions` | Log interaksi AI chatbot |
| `incident_reports` | Laporan incident yang digenerate |

---

<p align="center">
  Copyright © 2026 Oleh Tim Rusdianto
</p>
