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
- [Deploy — Production](#-deploy--production)
- [Deploy — Development](#-deploy--development)
- [Deploy Service Terpisah (Multi-Server)](#-deploy-service-terpisah-multi-server)
- [Konfigurasi Formbricks](#-konfigurasi-formbricks)
- [Konfigurasi Discord Bot](#-konfigurasi-discord-bot)
- [Konfigurasi N8N — Lengkap](#-konfigurasi-n8n--lengkap)
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
- **Static Web Form** — form langsung di portal users (multi-step)
- **Discord Bot** — notifikasi real-time, update status, assignment petugas
- **N8N** — workflow automation event-driven (AI classification, summary, chatbot)
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
│   [Formbricks Form Online]    [Static Web Form di Portal]       │
│           │                           │                         │
│           └──────────┬────────────────┘                         │
│                      │ POST /webhook/formbricks                 │
│                      │ POST /api/tickets/create                 │
└──────────────────────┼──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    NGINX (:80) — Reverse Proxy                  │
│   /api/*  /webhook/*  /reports/*  /uploads/* → Backend :3000   │
│   /*                                         → Frontend :3001  │
└──────────────────────┬──────────────────────────────────────────┘
          ┌────────────┴────────────┐
          ▼                         ▼
┌─────────────────┐      ┌──────────────────────┐
│  BACKEND :3000  │      │   FRONTEND :3001     │
│  Express.js     │      │   Next.js Portal     │
│  + Discord Bot  │      │                      │
│                 │      │  /dashboard  (user)  │
│  /api/ticket    │◄────►│  /tickets/:id        │
│  /api/admin     │      │  /admin      (admin) │
│  /webhook/      │      │  /api/       (proxy) │
│  /health        │      └──────────────────────┘
└────────┬────────┘
         │ event-driven
         ▼
┌────────────────────────────────────────────────┐
│             N8N :5678 — Workflow Engine        │
│                                                │
│  WF1: Ticket Intelligence                      │
│       (AI classification + summary)            │
│  WF2: Chatbot Assistant                        │
│       (AI Q&A via Discord)                     │
│  WF3: Incident Handler + Smart Intake          │
└────────────────┬───────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  PostgreSQL    │
         │  :5432         │
         │  - app DB      │
         │  - n8n_db      │
         └────────────────┘

┌────────────────────────────────────────────────┐
│  NGROK :4040 — Public Tunnel                   │
│  Formbricks (cloud) → ngrok → backend :3000    │
└────────────────────────────────────────────────┘
```

---

## ✨ Fitur Utama

### Input Tiket
- **Formbricks Form** — form online (Support & Incident), integrasi via webhook
- **Static Web Form** — form 3-langkah langsung di portal user

### Manajemen Tiket
- **Portal User** — cek status tiket via ID, lihat detail, timeline progress, AI summary & root cause
- **Portal Admin** — list semua tiket, filter status/tipe, update status, reassign petugas
- **Status Flow Support** — `OPEN → PENDING → IN_PROGRESS → DONE / REJECT`
- **Status Flow Incident** — `OPEN → INVESTIGASI → MITIGASI → RESOLVED`

### Discord Integration
- Thread otomatis dibuat per tiket di channel yang dikonfigurasi
- Pesan info tiket terformat lengkap dengan semua field data
- Command `!status`, `!assign`, `!evidence` untuk update tiket dari Discord
- AI Chatbot via @mention di dalam thread

### AI & Automation (N8N + Groq)
- **Auto-classification** — tipe incident, prioritas, area suspect
- **Auto-summary** — ringkasan percakapan Discord + root cause tiket
- **Smart Recommendation** — saran solusi berdasarkan tiket serupa
- **Chatbot AI** — jawab pertanyaan tentang tiket aktif via Discord

### Reporting
- Generate laporan incident otomatis (format HTML)
- Export data tiket Support & Incident ke CSV
- Dashboard admin dengan statistik real-time

---

## 📁 Struktur Folder

```
support-incident-system/
│
├── apps/
│   ├── backend/                         # Express.js API + Discord Bot
│   │   ├── .env                         # ← Konfigurasi backend (WAJIB diisi)
│   │   ├── .env.example                 # Template backend .env
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── infra/docker/
│   │   │   └── docker-entrypoint.sh     # Entrypoint container (migration + start)
│   │   ├── n8n-workflows/               # Exported N8N workflow JSON (3 workflows)
│   │   ├── prisma/
│   │   │   ├── schema.prisma            # Database schema (6 tabel)
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── app.js                   # Express app setup
│   │       ├── server.js                # Entry point (Discord + HTTP)
│   │       ├── config/index.js          # Semua konfigurasi dari env
│   │       ├── common/                  # Helpers, logger, middleware
│   │       ├── infrastructure/          # Prisma client, Discord, Email, N8N
│   │       └── modules/
│   │           ├── ticket/              # Ticket CRUD, service, mapper
│   │           ├── webhook/             # Formbricks webhook handler
│   │           ├── chatbot/             # AI chatbot service
│   │           ├── report/              # Incident report generator
│   │           ├── activity/            # Audit log
│   │           └── health/              # Health check endpoint
│   │
│   └── frontend/                        # Next.js Portal
│       ├── .env                         # ← Konfigurasi frontend (WAJIB diisi)
│       ├── .env.example                 # Template frontend .env
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── app/
│           │   ├── dashboard/           # Portal User — list tiket aktif
│           │   ├── tickets/[id]/        # Detail tiket (Support & Incident)
│           │   ├── admin/               # Portal Admin (login, manage, reports)
│           │   └── api/                 # Next.js API Routes (proxy ke backend)
│           ├── features/                # Domain logic (ticket, admin, report)
│           ├── lib/                     # API client, auth, tickets helper
│           ├── types/                   # TypeScript types
│           └── components/              # Shared UI components
│
├── docker/                              # Semua konfigurasi infrastruktur Docker
│   ├── db/
│   │   └── init.sql                     # Inisialisasi DB n8n (auto-run oleh PostgreSQL)
│   ├── nginx/
│   │   └── nginx.conf                   # Nginx reverse proxy config
│   └── ngrok.yml                        # Ngrok tunnel config
│
├── docs/
│   └── diagrams/                        # ERD, flowchart, sequence diagrams (.mmd)
│
├── .github/
│   └── workflows/
│       ├── ci.yml                       # CI: lint, build, docker build
│       └── cd.yml                       # CD: deploy ke VPS via SSH
│
├── .env                                 # ← Variabel Docker Compose (WAJIB diisi)
├── .env.example                         # Template root .env
├── docker-compose.prod.yml              # Production stack
├── docker-compose.dev.yml               # Development stack
├── package.json                         # Root workspace (pnpm)
└── pnpm-workspace.yaml
```

> **Catatan `docker/db/init.sql`:**
> File ini dieksekusi **otomatis oleh PostgreSQL** saat container pertama kali diinisialisasi (volume kosong/baru). Tugasnya membuat database `n8n_db` terpisah agar N8N tidak bercampur dengan database aplikasi utama. Ini adalah konfigurasi deklaratif, bukan script manual — PostgreSQL yang menjalankannya sendiri.

---

## 📦 Prasyarat

| Komponen | Versi Minimum | Keterangan |
|----------|---------------|------------|
| Docker | 24+ | Wajib |
| Docker Compose | v2+ (plugin) | Gunakan `docker compose` (tanpa tanda `-`) |
| Git | Bebas | Untuk clone & CD pipeline |

**Tidak perlu install** Node.js, PostgreSQL, atau npm secara manual di server — semua berjalan di dalam Docker container.

---

## ⚙️ Konfigurasi Environment

Project ini menggunakan **3 file `.env` terpisah** — masing-masing punya scope yang jelas:

| File | Scope | Digunakan oleh |
|------|-------|----------------|
| `.env` (root) | Docker Compose level | `docker-compose.prod.yml` — DB credentials, port, N8N login |
| `apps/backend/.env` | Backend service | Container `sis-backend` — Discord, SMTP, Groq, Formbricks |
| `apps/frontend/.env` | Frontend service | Container `sis-frontend` — Auth, JWT, URL portal |

### Salin semua template sekaligus:

```bash
cp .env.example                  .env
cp apps/backend/.env.example     apps/backend/.env
cp apps/frontend/.env.example    apps/frontend/.env
```

### `.env` (root) — Variabel Docker Compose

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `DB_NAME` | ✓ | Nama database PostgreSQL |
| `DB_USER` | ✓ | Username PostgreSQL |
| `DB_PASSWORD` | ✓ | Password PostgreSQL — **ganti di production!** |
| `N8N_USER` | ✓ | Username login dashboard N8N |
| `N8N_PASS` | ✓ | Password login dashboard N8N — **ganti di production!** |
| `N8N_API_KEY` | ✓ | API key shared backend ↔ N8N (harus sama di semua `.env`) |
| `GROQ_API_KEY` | ✓ | API key Groq AI — dipakai langsung oleh N8N service |
| `HOST_IP` | ✓ | IP server LAN (contoh: `192.168.1.100`) — untuk N8N webhook URL |
| `PORT` | — | Port backend, default `3000` |
| `FRONTEND_PORT` | — | Port frontend, default `3001` |

### `apps/backend/.env` — Variabel Backend

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `DATABASE_URL` | ✓ | Connection string PostgreSQL (`@postgres:5432/...`) |
| `DISCORD_BOT_TOKEN` | ✓ | Token bot Discord |
| `DISCORD_CHANNEL_ID` | ✓ | ID channel untuk thread tiket |
| `DISCORD_GUILD_ID` | ✓ | ID server Discord |
| `N8N_API_KEY` | ✓ | Harus sama dengan root `.env` |
| `GROQ_API_KEY` | ✓ | API key Groq AI |
| `SMTP_USER` / `SMTP_PASS` | — | Gmail + App Password untuk notifikasi email |
| `FORM_ID_TICKETING` | — | ID survey Formbricks (Ticketing Form) |
| `FORM_ID_INCIDENT` | — | ID survey Formbricks (Incident Form) |
| `FORMBRICKS_TICKETING_FIELD_MAP` | — | Mapping questionId → label (Ticketing) |
| `FORMBRICKS_INCIDENT_FIELD_MAP` | — | Mapping questionId → label (Incident) |
| `PORTAL_URL` | — | Kosongkan = auto-detect IP server |
| `NGROK_AUTHTOKEN` | — | Token ngrok (jika pakai Formbricks cloud) |

### `apps/frontend/.env` — Variabel Frontend

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `DATABASE_URL` | ✓ | Connection string PostgreSQL (sama dengan backend) |
| `JWT_SECRET` | ✓ | Secret key session admin — **generate unik di production!** |
| `NEXTAUTH_URL` | ✓ | URL portal frontend yang bisa diakses browser (`http://192.168.x.x:3001`) |
| `ADMIN_USERNAME` | ✓ | Username login admin portal |
| `ADMIN_PASSWORD` | ✓ | Password admin (plaintext — akan di-hash otomatis) |
| `ADMIN_PASSWORD_HASH` | — | Bcrypt hash password (lebih aman, prioritas jika diisi) |
| `N8N_API_KEY` | ✓ | Harus sama dengan root `.env` |
| `ORG_NAME` | — | Nama organisasi yang tampil di portal |

> **Cara generate JWT_SECRET:**
> ```bash
> openssl rand -hex 32
> ```

> **Cara generate ADMIN_PASSWORD_HASH (lebih aman untuk production):**
> ```bash
> docker exec sis-backend node -e "require('bcryptjs').hash('PasswordBaru',12).then(console.log)"
> # Salin output ($2b$12$...) ke ADMIN_PASSWORD_HASH, kosongkan ADMIN_PASSWORD
> ```

---

## 🏭 Deploy — Production

### Langkah 1 — Clone & Persiapan

```bash
git clone <repository-url>
cd support-incident-system
```

### Langkah 2 — Isi semua .env

```bash
cp .env.example              .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Edit root .env — minimal: DB_PASSWORD, HOST_IP, N8N_PASS, GROQ_API_KEY
nano .env

# Edit backend .env — minimal: Discord tokens, SMTP, Groq, Formbricks IDs
nano apps/backend/.env

# Edit frontend .env — minimal: JWT_SECRET, NEXTAUTH_URL, ADMIN_PASSWORD
nano apps/frontend/.env
```

> **Penting:** `NEXTAUTH_URL` di `apps/frontend/.env` harus menggunakan IP server, bukan `localhost`.
> Contoh: `NEXTAUTH_URL=http://192.168.1.100:3001`

### Langkah 3 — Isi ngrok authtoken

```bash
nano docker/ngrok.yml
# Ganti: authtoken: "your_ngrok_authtoken_here"
# Dengan authtoken dari: https://dashboard.ngrok.com/get-started/your-authtoken
```

### Langkah 4 — Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Docker Compose akan otomatis membuat semua named volume yang diperlukan. Tidak ada script tambahan.

### Langkah 5 — Verifikasi

```bash
# Cek semua container running
docker compose -f docker-compose.prod.yml ps

# Cek log backend (lihat migration + startup)
docker compose -f docker-compose.prod.yml logs -f backend

# Cek health
curl http://localhost:3000/health
curl http://localhost:3001/api/health
```

### URL Production

| Service | URL |
|---------|-----|
| Portal User | `http://SERVER_IP/dashboard` atau `http://SERVER_IP:3001/dashboard` |
| Portal Admin | `http://SERVER_IP/admin` atau `http://SERVER_IP:3001/admin` |
| Backend API | `http://SERVER_IP:3000` |
| N8N Dashboard | `http://SERVER_IP:5678` |
| Ngrok Inspector | `http://SERVER_IP:4040` |

### Docker Volumes (Production)

Semua data persisten disimpan dalam Docker named volumes — **tidak ada bind mount ke folder host**:

| Volume | Isi |
|--------|-----|
| `sis_postgres_data` | Data PostgreSQL (semua tabel + n8n_db) |
| `sis_n8n_data` | Data N8N (workflows, credentials, settings) |
| `sis_uploads_data` | File upload attachment tiket |
| `sis_reports_data` | File laporan HTML yang digenerate |
| `sis_backend_logs` | Log aplikasi backend |
| `sis_frontend_logs` | Log aplikasi frontend |

---

## 🔧 Deploy — Development

Development menggunakan `docker-compose.dev.yml` dengan volume source code untuk hot-reload backend.

```bash
# Pastikan apps/backend/.env dan apps/frontend/.env sudah terisi

docker compose -f docker-compose.dev.yml up -d --build

# Cek status
docker compose -f docker-compose.dev.yml ps

# Lihat log
docker compose -f docker-compose.dev.yml logs -f backend
```

### URL Development

| Service | URL |
|---------|-----|
| Portal User | `http://localhost:3001/dashboard` |
| Portal Admin | `http://localhost:3001/admin` |
| Backend API | `http://localhost:3000` |
| N8N Dashboard | `http://localhost:5678` |
| Ngrok Inspector | `http://localhost:4040` |
| PostgreSQL | `localhost:5433` |

---

## 🖧 Deploy Service Terpisah (Multi-Server)

Setiap service dalam project ini dirancang agar dapat berjalan di server yang berbeda. Caranya dengan mengubah internal URL Docker (service name) menjadi IP/host nyata.

### Skenario: Backend, Frontend, PostgreSQL, N8N di server berbeda

**Server A — PostgreSQL + N8N:**
```bash
# .env root (Server A)
HOST_IP=192.168.1.10   # IP Server A
DB_PASSWORD=password_aman

# apps/backend/.env (tidak dipakai di Server A, tapi untuk referensi)
# N8N di Server A menggunakan PostgreSQL di Server A juga
```

**Server B — Backend:**
```bash
# apps/backend/.env (Server B)
DATABASE_URL=postgresql://user:pass@192.168.1.10:5432/formbricks_tickets?schema=public
DB_HOST=192.168.1.10
N8N_WEBHOOK_URL=http://192.168.1.10:5678/webhook/discord-activity
N8N_CHATBOT_WEBHOOK=http://192.168.1.10:5678/webhook/chatbot-qa
N8N_INCIDENT_WEBHOOK=http://192.168.1.10:5678/webhook/incident-event
```

**Server C — Frontend:**
```bash
# apps/frontend/.env (Server C)
DATABASE_URL=postgresql://user:pass@192.168.1.10:5432/formbricks_tickets?schema=public
NEXTAUTH_URL=http://192.168.1.30:3001

# docker-compose.prod.yml — environment frontend (Server C)
# BACKEND_URL=http://192.168.1.20:3000
# BACKEND_SELF_URL=http://192.168.1.20:3000
```

> **Catatan:** Saat deploy terpisah, jalankan hanya service yang relevan di tiap server:
> ```bash
> # Jalankan hanya backend
> docker compose -f docker-compose.prod.yml up -d --build backend
>
> # Jalankan hanya frontend
> docker compose -f docker-compose.prod.yml up -d --build frontend
> ```

---

## 🟦 Konfigurasi Formbricks

Formbricks adalah platform form online yang digunakan sebagai sumber input tiket dari luar.

### Setup Form

1. Daftar di [formbricks.com](https://formbricks.com) (self-host atau cloud)
2. Buat dua survey:
   - **Ticketing Support Form** — untuk tiket support
   - **Incident Report Form** — untuk laporan incident
3. Catat **Survey ID** dari URL: `.../surveys/SURVEY_ID/...`
4. Isi di `apps/backend/.env`:
   ```env
   FORM_ID_TICKETING=survey_id_ticketing_anda
   FORM_ID_INCIDENT=survey_id_incident_anda
   ```

### Setup Webhook di Formbricks

Setelah Ngrok aktif dan URL publik tersedia:

1. Buka Formbricks Dashboard → **Settings → Integrations → Webhooks**
2. Klik **Add Webhook**
3. URL: `https://xxxx.ngrok-free.app/webhook/formbricks`
4. Event: **Response Finished**
5. Pilih survey yang sesuai (Ticketing atau Incident)

### Konfigurasi Field Mapping

Formbricks mengirim response dengan **field ID acak** sebagai key. Mapping diperlukan agar sistem bisa membaca data dengan benar.

**Cara mendapatkan Question ID:**
1. Login Formbricks → buka survey → Edit
2. Klik setiap question → salin ID dari field properties
3. Atau cek log backend setelah test submission: `docker logs sis-backend | grep "ID→Label"`

**Isi di `apps/backend/.env`:**
```env
# Format: "questionId:Label,questionId2:Label2,..."
# Label WAJIB tepat: Reporter Information, Division, No Telepon, Email, dll.
FORMBRICKS_TICKETING_FIELD_MAP=furan0qd:Reporter Information,wxro33g8:Division,...
FORMBRICKS_INCIDENT_FIELD_MAP=bsq3gnst:Priority Incident,dw20cazn:Date & Time Incident,...
```

---

## 🤖 Konfigurasi Discord Bot

### Membuat Bot

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. **New Application** → beri nama (contoh: `IT Support Bot`)
3. Menu **Bot** → **Reset Token** → salin token
4. Aktifkan **Message Content Intent** di bagian Privileged Gateway Intents
5. Isi `DISCORD_BOT_TOKEN` di `apps/backend/.env`

### Permissions yang Diperlukan

| Permission | Keterangan |
|------------|------------|
| Read Messages / View Channels | Membaca pesan di channel |
| Send Messages | Mengirim pesan |
| Create Public Threads | Membuat thread per tiket |
| Send Messages in Threads | Kirim pesan di dalam thread |
| Manage Messages | Pin pesan info tiket |
| Embed Links | Menampilkan embed message |
| Attach Files | Upload file evidence |
| Mention Everyone | Tag user saat assign |

### Invite Bot ke Server

1. Menu **OAuth2 → URL Generator**
2. Scope: `bot`
3. Permissions: centang semua yang diperlukan di atas (atau **Administrator** untuk internal)
4. Salin URL → buka di browser → pilih server → Authorize

### Ambil IDs

Aktifkan **Developer Mode** di Discord:
- User Settings → Advanced → Developer Mode ✓

```
Channel ID : klik kanan channel → Copy Channel ID → isi DISCORD_CHANNEL_ID
Guild ID   : klik kanan nama server → Copy Server ID → isi DISCORD_GUILD_ID
```

---

## 🔄 Konfigurasi N8N — Lengkap

N8N adalah workflow automation engine yang menerima event dari backend dan menjalankan AI processing.

### Step 1 — Akses Dashboard

Buka: `http://SERVER_IP:5678`

Login dengan `N8N_USER` dan `N8N_PASS` dari `.env` root.

---

### Step 2 — Buat Credentials

Sebelum import workflow, buat semua credential terlebih dahulu di:
**Settings → Credentials → Add Credential**

#### Credential 1: Groq API

1. Search: **Groq**
2. Pilih: **Groq**
3. Isi:
   - **API Key**: nilai dari `GROQ_API_KEY` di `.env`
4. Beri nama: `Groq API`
5. Klik **Save**

#### Credential 2: Discord Bot API

1. Search: **Discord Bot**
2. Pilih: **Discord Bot API**
3. Isi:
   - **Bot Token**: nilai dari `DISCORD_BOT_TOKEN` di `apps/backend/.env`
4. Beri nama: `Discord Bot`
5. Klik **Save**

> Credential Discord Bot digunakan oleh Workflow 1 untuk membaca pesan dari thread Discord (node `Get Messages (Monitor)` dan `Get Messages (Closing)`).

---

### Step 3 — Import Workflow

1. Menu **Workflows** → klik tombol **+** → **Import from File**
2. Import **satu per satu** ketiga file dari `apps/backend/n8n-workflows/`:

| File | Nama Workflow |
|------|---------------|
| `Workflow 1_ Automation Ticket Intelligence...json` | Ticket Intelligence |
| `Workflow 2_ Automation Chatbot Assistane...json` | Chatbot Assistant |
| `Workflow 3: Incident Handler + Smart Intake...json` | Incident Handler |

---

### Step 4 — Konfigurasi Tiap Workflow

#### Workflow 1 — Ticket Intelligence

Workflow ini menerima event dari backend saat ada aktivitas Discord (pesan baru / tiket closing), lalu menjalankan AI untuk generate summary dan root cause.

**Node yang perlu dikonfigurasi:**

| Node | Yang Dikonfigurasi |
|------|--------------------|
| `Get Messages (Monitor)` | Pilih credential **Discord Bot** |
| `Get Messages (Closing)` | Pilih credential **Discord Bot** |
| `Groq Model` | Pilih credential **Groq API** |
| `API: Append Timeline` | Header `X-API-Key` sudah terisi `automation_ticketing01_incident02` — **sesuaikan jika N8N_API_KEY berbeda** |
| `API: Save Summary & Root Cause` | Header `X-API-Key` sudah terisi — **sesuaikan jika N8N_API_KEY berbeda** |

**URL Backend di node HTTP Request:**
- Semua sudah menggunakan `http://backend:3000` (internal Docker)
- Jika backend di server terpisah, ubah ke `http://IP_SERVER_BACKEND:3000`

#### Workflow 2 — Chatbot Assistant

Workflow ini menerima pertanyaan dari Discord via webhook, mengambil konteks tiket, lalu menjawab dengan AI.

**Node yang perlu dikonfigurasi:**

| Node | Yang Dikonfigurasi |
|------|--------------------|
| `Groq Model` | Pilih credential **Groq API** |
| `Fetch Context (API)` | URL `http://backend:3000` — ubah jika backend di server lain |
| `Fetch Active Incidents` | URL `http://backend:3000` — ubah jika backend di server lain |
| `Log Interaction (API)` | URL `http://backend:3000` — ubah jika backend di server lain |

#### Workflow 3 — Incident Handler

Workflow ini menerima event incident dari backend dan menangani routing status serta broadcast Discord.

**Node yang perlu dikonfigurasi:**

| Node | Yang Dikonfigurasi |
|------|--------------------|
| `API: Update Status` | URL `http://backend:3000` — ubah jika backend di server lain |
| `API: Manual Broadcast` | URL `http://backend:3000` — ubah jika backend di server lain |
| `Fetch Ticket Detail` | URL `http://backend:3000` — ubah jika backend di server lain |

---

### Step 5 — Konfigurasi Webhook URL N8N

Agar backend bisa mengirim event ke N8N, pastikan WEBHOOK_URL N8N dapat diakses:

1. Di N8N: **Settings → n8n settings → Webhook URL**
2. Pastikan nilainya adalah: `http://SERVER_IP:5678`
3. Ini sudah dikonfigurasi otomatis via `HOST_IP` di `.env` root

Verifikasi webhook URL tiap workflow:
- Buka workflow → node **Webhook** → salin **Production URL**
- Harus berupa: `http://SERVER_IP:5678/webhook/...`

---

### Step 6 — Aktifkan Semua Workflow

Untuk setiap workflow:
1. Buka workflow
2. Klik toggle **Inactive** di pojok kanan atas → ubah menjadi **Active**
3. Konfirmasi bahwa status berubah menjadi **Active** (hijau)

> **Penting:** Workflow harus dalam mode **Active** (bukan mode Edit/Test) agar dapat menerima webhook dari production backend.

---

### Referensi Endpoint N8N dari Backend

Backend mengirim event ke N8N via HTTP POST ke endpoint berikut (dikonfigurasi di `apps/backend/.env`):

| Variabel | Endpoint | Trigger |
|----------|----------|---------|
| `N8N_WEBHOOK_URL` | `/webhook/discord-activity` | Ada aktivitas Discord di thread tiket |
| `N8N_CHATBOT_WEBHOOK` | `/webhook/chatbot-qa` | User mention bot di Discord |
| `N8N_INCIDENT_WEBHOOK` | `/webhook/incident-event` | Event perubahan status incident |

Header yang dikirim backend ke N8N:
```
X-API-Key: <nilai N8N_API_KEY>
Content-Type: application/json
```

---

## 🌐 Ngrok — Tunnel Publik

Ngrok diperlukan agar Formbricks (cloud) bisa mengirim webhook ke server di LAN perusahaan.

### Setup Authtoken

1. Daftar di [ngrok.com](https://ngrok.com) (gratis)
2. Buka: [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Salin authtoken → edit `docker/ngrok.yml`:

```yaml
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
# Via log container
docker logs sis-ngrok 2>&1 | grep -i "url\|started"

# Via API ngrok
curl http://localhost:4040/api/tunnels | python3 -m json.tool | grep public_url

# Via browser Inspector UI
http://SERVER_IP:4040
```

### Set di Formbricks

URL yang perlu diset di Formbricks:
```
https://xxxx.ngrok-free.app/webhook/formbricks
```

> **Catatan:** URL ngrok berubah setiap restart (akun gratis). Untuk URL tetap, upgrade ke ngrok Pro atau gunakan custom domain.

---

## 🔁 CI/CD GitHub Actions

### CI Pipeline (`.github/workflows/ci.yml`)

Berjalan otomatis saat push ke `main` atau `develop`:
1. **Backend** — Lint, Prisma generate
2. **Frontend** — Install, Prisma generate, Build Next.js
3. **Docker** — Build image backend & frontend

### CD Pipeline (`.github/workflows/cd.yml`)

Berjalan saat push ke `main` → deploy otomatis ke VPS via SSH.

### Setup GitHub Secrets

Tambahkan di **Repository Settings → Secrets and variables → Actions**:

| Secret | Contoh Nilai | Keterangan |
|--------|--------------|------------|
| `VPS_HOST` | `192.168.1.100` | IP atau domain server |
| `VPS_USER` | `ubuntu` | Username SSH |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH...` | Isi seluruh private key (`~/.ssh/id_rsa`) |
| `VPS_PORT` | `22` | Port SSH |
| `VPS_PROJECT_DIR` | `/opt/support-incident-system` | Path project di server |

### Setup Server untuk CD (Sekali)

```bash
# Di server, clone project
git clone <repository-url> /opt/support-incident-system
cd /opt/support-incident-system

# Isi semua .env
cp .env.example .env && nano .env
cp apps/backend/.env.example apps/backend/.env && nano apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env && nano apps/frontend/.env

# Isi ngrok authtoken
nano docker/ngrok.yml

# Deploy pertama kali
docker compose -f docker-compose.prod.yml up -d --build
```

Setelah itu, setiap push ke `main` akan trigger CD pipeline yang menjalankan `git pull` + `docker compose up --build` otomatis.

---

## 🖥️ Portal User & Admin

### Portal User (`/dashboard`)

- Lihat daftar incident aktif yang dipublikasikan
- Cari tiket berdasarkan ID atau judul
- Filter berdasarkan status
- Buat tiket Support baru via form 3-langkah
- Lihat detail tiket: info lengkap, AI summary, root cause, timeline progress

### Portal Admin (`/admin`)

Login diperlukan. Credentials dari `apps/frontend/.env`:
- Username: nilai `ADMIN_USERNAME` (default: `admin`)
- Password: nilai `ADMIN_PASSWORD`

**Fitur Admin:**
- Dashboard statistik (total tiket, open, closed, in-progress)
- List semua tiket dengan filter & search (Support & Incident)
- Detail tiket: data formulir, status, assignee, timeline aktivitas
- Update status tiket manual
- Reassign petugas
- Generate laporan incident HTML
- Export data ke CSV (Support & Incident)
- Lihat automation logs (N8N activity)

---

## 💬 Discord Bot Commands

Semua command digunakan **di dalam thread tiket**:

| Command | Keterangan |
|---------|------------|
| `!status [STATUS]` | Update status tiket. Valid: `OPEN`, `PENDING`, `IN_PROGRESS`, `INVESTIGASI`, `MITIGASI`, `DONE`, `RESOLVED`, `REJECT` |
| `!assign [nama1, nama2]` | Assign petugas ke tiket |
| `!evidence` | Lampirkan file sebagai evidence (kirim bersamaan dengan file attachment) |
| `!clear-history` | Reset history percakapan AI chatbot di thread ini |
| `!chatbot-help` | Tampilkan panduan penggunaan AI chatbot |
| `!chatbot-stats` | Lihat statistik penggunaan chatbot |
| `@NamaBot [pertanyaan]` | Tanya AI chatbot tentang tiket ini |

**Contoh penggunaan:**
```
!status INVESTIGASI
!assign Budi Santoso, Tim Jaringan
!status RESOLVED
```

---

## 🛠 Perintah Berguna

### Manajemen Container

```bash
# Lihat status semua service
docker compose -f docker-compose.prod.yml ps

# Lihat log realtime (semua service)
docker compose -f docker-compose.prod.yml logs -f

# Lihat log service tertentu
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f n8n

# Stop semua service
docker compose -f docker-compose.prod.yml down

# Rebuild dan restart service tertentu
docker compose -f docker-compose.prod.yml up -d --build backend
```

### Database

```bash
# Backup database
docker exec sis-postgres pg_dump -U formbricks_user formbricks_tickets > backup_$(date +%Y%m%d).sql

# Restore database
cat backup_20260101.sql | docker exec -i sis-postgres psql -U formbricks_user -d formbricks_tickets

# Akses psql langsung
docker exec -it sis-postgres psql -U formbricks_user -d formbricks_tickets

# Jalankan Prisma migrate manual
docker exec sis-backend npx prisma migrate deploy
```

### Admin Password

```bash
# Generate bcrypt hash password baru
docker exec sis-backend node -e "require('bcryptjs').hash('PasswordBaru123', 12).then(console.log)"
# Salin output → isi ADMIN_PASSWORD_HASH di apps/frontend/.env
# Kosongkan ADMIN_PASSWORD
# Restart: docker compose -f docker-compose.prod.yml restart frontend
```

### Docker Volumes

```bash
# Lihat semua volume
docker volume ls | grep sis_

# Inspect volume (lihat path, size)
docker volume inspect sis_uploads_data

# Hapus semua volume (HATI-HATI: semua data hilang!)
docker compose -f docker-compose.prod.yml down -v
```

---

## 🔧 Troubleshooting

### Backend gagal start — "Missing required environment variables"

```bash
docker logs sis-backend | head -30
# Pastikan apps/backend/.env sudah berisi DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DATABASE_URL
```

### Prisma migration error

```bash
# Jalankan migrate manual
docker exec sis-backend npx prisma migrate deploy

# Jika masih error, cek koneksi DB
docker exec sis-backend node -e "
const {Client} = require('pg');
const c = new Client({connectionString: process.env.DATABASE_URL});
c.connect().then(()=>console.log('OK')).catch(e=>console.error(e.message));
"
```

### Discord bot tidak online

```bash
docker logs sis-backend | grep -i discord
# Pastikan DISCORD_BOT_TOKEN valid dan Message Content Intent aktif di Developer Portal
# Token baru: Discord Developer Portal → Bot → Reset Token
```

### N8N tidak menerima event dari backend

```bash
# 1. Cek workflow aktif di N8N dashboard — toggle harus hijau
# 2. Cek WEBHOOK_URL di N8N settings = http://SERVER_IP:5678
# 3. Verifikasi N8N_API_KEY sama di .env root dan apps/backend/.env
# 4. Test manual:
curl -X POST http://localhost:5678/webhook/discord-activity \
  -H "Content-Type: application/json" \
  -H "X-API-Key: automation_ticketing01_incident02" \
  -d '{"test": true}'
```

### Formbricks webhook tidak masuk

```bash
# 1. Cek ngrok running dan URL publik
docker logs sis-ngrok 2>&1 | grep -i "url\|addr"

# 2. Buka ngrok inspector
# http://SERVER_IP:4040

# 3. Test manual
curl -X POST https://xxxx.ngrok-free.app/webhook/formbricks \
  -H "Content-Type: application/json" \
  -d '{"event":"test","data":{"surveyId":"test"}}'

# 4. Cek log backend
docker logs sis-backend | grep -i webhook
```

### Frontend tidak bisa login admin

```bash
# Cek NEXTAUTH_URL di apps/frontend/.env — harus IP server, bukan localhost
# Contoh: NEXTAUTH_URL=http://192.168.1.100:3001
# Restart frontend setelah ubah .env:
docker compose -f docker-compose.prod.yml up -d --build frontend
```

### Upload file gagal

```bash
# Cek volume uploads
docker volume inspect sis_uploads_data

# Cek permission di container
docker exec sis-backend ls -la /app/public/uploads/
```

---

## 📊 Database Schema

| Tabel | Keterangan |
|-------|------------|
| `tickets` | Data tiket support & incident (semua field form) |
| `submissions` | Raw payload dari form submission (Formbricks & static) |
| `activities` | Audit log per tiket (setiap perubahan status, assign, dll) |
| `knowledge_base` | Runbook & artikel KB untuk referensi AI recommendation |
| `chatbot_interactions` | Log interaksi AI chatbot per thread Discord |
| `incident_reports` | Metadata laporan incident yang digenerate |

---

<p align="center">
  Copyright © 2026 Oleh Tim IT @SEAMOLEC
</p>