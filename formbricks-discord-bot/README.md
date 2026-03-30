# 🛡️ Support & Incident Management System

> Discord Bot + Express API (Backend) · Next.js Portal User & Admin (Frontend)
> Production-ready system untuk manajemen **Ticketing Support** dan **Incident Report** berbasis Discord + Web Portal + AI Automation.
---
## 📌 Overview & Deskripsi Sistem

Sistem ini menghubungkan **Discord Bot**, **Web Portal** (User + Admin), **N8N Automation**, dan **AI (Groq)** dalam satu alur manajemen tiket yang terintegrasi penuh.

### Alur Utama

```
User submit form Formbricks
        │
        ▼
Backend (webhook) → Buat ticket di DB → Buat Discord thread → Pin info message
        │
        ▼
Petugas IT update via Discord command (!status, !assign, !evidence)
        │
        ▼
N8N Workflow → AI Groq generate summary + root cause → Simpan ke DB → Sync Discord
        │
        ▼
User & Admin lihat hasil via Web Portal (real-time dari DB)
```
### Komponen Sistem

| Komponen | Teknologi | Port | Fungsi |
|----------|-----------|------|--------|
| **Backend** | Node.js + Express + Discord.js | `3000` | Discord Bot, REST API, Webhook receiver |
| **Frontend** | Next.js 14 + Tailwind CSS | `3001` | Portal User & Admin |
| **Database** | PostgreSQL 15 | `5432` | Penyimpanan semua data tiket |
| **N8N** | N8N Workflow Engine | `5678` | Otomasi AI classification, email, timeline |
| **Ngrok** | Ngrok tunnel | `4040` | Public tunnel Formbricks → Backend (LAN) |

---

## ⚙️ Prerequisites & Requirements

### Wajib (Semua Environment)
- **Docker** >= 24.x & **Docker Compose** >= 2.x
- **Git**
- **Discord Bot Token** — [Discord Developer Portal](https://discord.com/developers/applications)
- **Groq API Key** — [console.groq.com](https://console.groq.com) (gratis)
- **Ngrok Authtoken** — [dashboard.ngrok.com](https://dashboard.ngrok.com) (jika server di LAN)

### Development Lokal (Opsional)
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** running lokal

### Discord Bot — Intents yang Harus Diaktifkan
Di [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Privileged Gateway Intents:
- ✅ **Server Members Intent**
- ✅ **Message Content Intent**

---

## 3. Struktur Direktori Project
```
formbricks-discord-bot/               ← ROOT MONOREPO
│
├── 📄 .env                           ← Environment variables utama (WAJIB diisi)
├── 📄 .env.example                   ← Template .env — copy ke .env sebelum mulai
├── 📄 .gitignore                     ← Exclude node_modules, .env, logs
├── 📄 docker-compose.yml             ← Orkestrasi 5 service (postgres, backend, frontend, n8n, ngrok)
├── 📄 package.json                   ← npm workspaces root (scripts global)
├── 📄 start.sh                       ← Script startup otomatis (auto-detect IP, inject env)
├── 📄 ngrok.yml                      ← Konfigurasi Ngrok tunnel
├── 📄 ngrok.sh                       ← Script helper ngrok
├── 📄 README.md                      ← Dokumentasi ini
│
├── 🔧 backend/                       ← Discord Bot + Express API (port 3000)
│   ├── README.md                     ← Dokumentasi khusus backend
│   ├── Dockerfile                    ← Multi-stage Alpine build (Node 18)
│   ├── docker-entrypoint.sh          ← DB health check + Prisma migrate + seed
│   ├── index.js                      ← Entry point (Discord client + Express server)
│   ├── package.json                  ← Dependencies backend
│   ├── .env.example                  ← Template env untuk dev lokal backend
│   ├── .gitignore
│   ├── .dockerignore
│   ├── prisma/
│   │   ├── schema.prisma             ← Source of truth database schema
│   │   └── migrations/0001_init/
│   │       └── migration.sql         ← Initial migration (idempotent)
│   ├── src/
│   │   ├── config/
│   │   │   └── index.js              ← Centralized config dari env vars
│   │   ├── database/
│   │   │   ├── client.js             ← Prisma client singleton
│   │   │   └── views.js              ← DB view helpers
│   │   ├── handlers/                 ← Discord event handlers
│   │   │   ├── chatbot.handler.js    ← AI chatbot (mention/DM → Groq → balas)
│   │   │   ├── command.handler.js    ← !assign, !status, !evidence commands
│   │   │   └── thread.handler.js     ← Monitor aktivitas thread → trigger N8N
│   │   ├── middleware/
│   │   │   ├── auth.js               ← API key validation (x-api-key header)
│   │   │   └── rateLimit.js          ← Rate limiter per IP
│   │   ├── models/                   ← Data access layer (Prisma wrapper)
│   │   │   ├── ticket.model.js       ← CRUD ticket
│   │   │   ├── activity.model.js     ← Log aktivitas per ticket
│   │   │   └── submission.model.js   ← Raw Formbricks submission
│   │   ├── routes/                   ← Express REST API routes
│   │   │   ├── web.route.js          ← GET /health + redirect ke frontend
│   │   │   ├── webhook.route.js      ← POST /webhook/formbricks (dari Formbricks)
│   │   │   ├── ticket.route.js       ← /api/ticket/* (CRUD + sync-discord)
│   │   │   ├── chatbot.route.js      ← /api/chatbot/* (context, stats)
│   │   │   ├── knowledge.route.js    ← /api/knowledge/* (runbook)
│   │   │   └── report.route.js       ← /api/report/* (generate HTML report)
│   │   ├── services/
│   │   │   ├── discord.service.js    ← Build & update pinned message Discord
│   │   │   ├── email.service.js      ← Nodemailer SMTP — kirim konfirmasi
│   │   │   ├── n8n.service.js        ← Trigger N8N workflow via HTTP webhook
│   │   │   ├── report.service.js     ← Generate HTML incident report
│   │   │   └── classifier.service.js ← Klasifikasi ticket (Support/Incident)
│   │   └── utils/
│   │       ├── ticket.js             ← normalizeTicket, formatAssignee, dll.
│   │       ├── discord.js            ← splitDiscordMessage, editMessageSafe
│   │       ├── network.js            ← Auto-detect LAN IP server
│   │       └── date.js               ← formatDate, formatDateTime
│   ├── n8n-workflows/                ← Export JSON workflow N8N
│   │   ├── Workflow 1_ Automation Ticket Intelligence...json
│   │   └── Workflow 2_ Automation Chatbot Assistance...json
│   └── public/reports/               ← Generated HTML incident reports (persistent volume)
│
├── 🌐 frontend/                      ← Next.js Portal User + Admin (port 3001)
│   ├── README.md                     ← Dokumentasi khusus frontend
│   ├── Dockerfile                    ← Multi-stage standalone build (Node 20)
│   ├── package.json                  ← Dependencies frontend
│   ├── next.config.js                ← output: standalone + build options
│   ├── tailwind.config.js            ← Tailwind CSS config
│   ├── tsconfig.json                 ← TypeScript config
│   ├── middleware.ts                 ← JWT route protection /admin/*
│   ├── .env.example                  ← Template env untuk dev lokal frontend
│   ├── .gitignore
│   ├── prisma/
│   │   ├── schema.prisma             ← Copy dari backend (read-only via Prisma)
│   │   └── migrations/               ← Copy dari backend migrations
│   ├── app/                          ← Next.js App Router
│   │   ├── layout.tsx                ← Root layout
│   │   ├── page.tsx                  ← Redirect → /dashboard
│   │   ├── globals.css
│   │   ├── api/                      ← Next.js API Routes (internal)
│   │   │   ├── health/route.ts       ← GET /api/health (Docker healthcheck)
│   │   │   └── admin/
│   │   │       ├── stats/route.ts    ← Realtime stats + system health check
│   │   │       ├── activities/route.ts ← Activities log dari DB
│   │   │       ├── recent-tickets/route.ts ← 10 ticket terbaru
│   │   │       ├── report-view/[id]/route.ts ← Proxy laporan HTML (dynamic IP)
│   │   │       └── export/
│   │   │           ├── support/route.ts   ← Download Excel Ticketing Support
│   │   │           └── incident/route.ts  ← Download Excel Incident
│   │   ├── dashboard/                ← Portal User — daftar semua ticket
│   │   │   ├── page.tsx
│   │   │   └── DashboardClient.tsx
│   │   ├── tickets/[id]/             ← Detail ticket user
│   │   │   ├── page.tsx              ← Router: Support vs Incident
│   │   │   ├── SharedComponents.tsx  ← StatusBadge, TimelineSection, dll.
│   │   │   ├── TicketDetailSupport.tsx
│   │   │   └── TicketDetailIncident.tsx
│   │   └── admin/                    ← Admin Control Panel (JWT protected)
│   │       ├── layout.tsx
│   │       ├── page.tsx              ← Admin Dashboard
│   │       ├── admin.css             ← Admin-specific styles
│   │       ├── actions.ts            ← Server Actions: login, updateStatus, reassign
│   │       ├── AdminDashboardClient.tsx ← Dashboard realtime
│   │       ├── login/                ← Halaman login admin
│   │       ├── tickets/              ← Ticket Monitoring & Kelola Ticket
│   │       │   ├── AdminTicketsClient.tsx
│   │       │   └── [id]/AdminTicketDetailClient.tsx
│   │       ├── automation/           ← Live Automation Log
│   │       │   └── AutomationLogClient.tsx
│   │       └── reports/              ← Download Excel Reports
│   │           └── ReportsClient.tsx
│   ├── components/admin/
│   │   └── AdminSidebar.tsx          ← Sidebar navigasi admin
│   ├── lib/
│   │   ├── prisma.ts                 ← Prisma client singleton (frontend)
│   │   ├── auth.ts                   ← JWT sign/verify + bcrypt
│   │   └── tickets.ts                ← DAL: getAllTickets, getTicketById, formatDate
│   └── types/index.ts                ← TypeScript interfaces global
│
└── 📋 logs/                          ← Runtime logs (auto-created saat start)
    ├── backend/
    └── frontend/
```
---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRODUCTION SYSTEM                         │
│                                                                  │
│   Discord          Formbricks           Browser (LAN)            │
│   Bot/Users        Webhook Form         User & Admin             │
└──────┬──────────────────┬───────────────────────┬───────────────┘
       │                  │                       │
       ▼                  ▼                       ▼
┌─────────────┐    ┌────────────┐    ┌────────────────────────┐
│  BACKEND    │◄───│    N8N     │    │       FRONTEND          │
│  :3000      │    │  :5678     │    │       :3001             │
│             │    │            │    │                         │
│ Discord Bot │    │ AI Groq    │    │ /dashboard              │
│ Express API │    │ Workflow   │    │ /tickets/:id            │
│ Webhook     │    │ Email SMTP │    │ /admin (JWT protected)  │
│ HTML Report │    │ N8N auto   │    │                         │
└──────┬──────┘    └─────┬──────┘    └────────────┬────────────┘
       │                 │                        │
       └─────────────────┴────────────────────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │   PostgreSQL :5432    │
             │   (internal network)  │
             └───────────────────────┘
                         ▲
              ┌──────────┘
              │
    ┌─────────────────┐
    │  NGROK :4040    │
    │  (LAN tunnel)   │
    │  Formbricks →   │
    │  Backend        │
    └─────────────────┘
```

---

## 🚀 Instalasi & Setup Pertama Kali

### Langkah 1 — Clone & Masuk ke Direktori
```bash
git clone <url-repository> <File Project>
cd <File Project>
```

### Langkah 2 — Buat Docker Volumes (Hanya Pertama Kali)
```bash
docker volume create formbricks-discord-bot_postgres_data
docker volume create formbricks-discord-bot_n8n_data
docker volume create formbricks-discord-bot_reports_data
```

### Langkah 3 — Konfigurasi Environment
```bash
cp .env.example .env
nano .env
```

**Variabel wajib diisi di `.env`:**

| Variabel | Keterangan | Contoh |
|----------|------------|--------|
| `DISCORD_BOT_TOKEN` | Token bot dari Discord Developer Portal | `MTQ...Zs` |
| `DISCORD_CHANNEL_ID` | ID channel Discord tempat thread tiket dibuat | `1447404...` |
| `DISCORD_GUILD_ID` | ID server (guild) Discord | `1447417...` |
| `GROQ_API_KEY` | API key Groq untuk AI classification | `gsk_...` |
| `ADMIN_PASSWORD` | Password login portal admin | `Admin@IT2026` |
| `JWT_SECRET` | Secret key JWT (ubah di production!) | string acak panjang |
| `SMTP_USER` | Email Gmail untuk notifikasi | `it@gmail.com` |
| `SMTP_PASS` | Gmail App Password (bukan password akun) | 16 karakter |
| `NGROK_AUTHTOKEN` | Token ngrok untuk tunnel publik | `2abc...` |
| `N8N_WEBHOOK_BASE` | URL N8N yang bisa diakses dari luar Docker | `http://192.168.x.x:5678` |

> **Tips:** Untuk `ADMIN_PASSWORD` mudah — cukup isi `ADMIN_PASSWORD=passwordAnda` dan kosongkan `ADMIN_PASSWORD_HASH=`. Sistem akan otomatis menangani enkripsi.

### Langkah 4 — Konfigurasi Ngrok
Edit file `ngrok.yml` di root:

```yaml
authtoken: YOUR_NGROK_AUTHTOKEN_HERE   # ganti dengan token ngrok Anda
version: "2"
tunnels:
  bot:
    proto: http
    addr: backend:3000
```

### Langkah 5 — Jalankan Semua Service
```bash
chmod +x start.sh
./start.sh
```
> `start.sh` secara otomatis mendeteksi IP server dan meng-inject ke container.

### Langkah 6 — Verifikasi Semua Service Berjalan
```bash
./start.sh status
```

Output yang diharapkan: semua container status `Up (healthy)`.
| Service | URL | Keterangan |
|---------|-----|------------|
| **User Portal** | `http://SERVER_IP:3001/dashboard` | Akses publik internal LAN |
| **Admin Portal** | `http://SERVER_IP:3001/admin` | Login dengan kredensial `.env` |
| **Backend API** | `http://SERVER_IP:3000/health` | Health check endpoint |
| **N8N** | `http://SERVER_IP:5678` | Workflow engine dashboard |
| **Ngrok Dashboard** | `http://SERVER_IP:4040` | Pantau tunnel publik |

### Langkah 7 — Setup N8N Workflow
1. Buka `http://SERVER_IP:5678`, login dengan `N8N_USER` / `N8N_PASS` dari `.env`
2. Import workflow: **Settings → Import from File**
3. Import kedua file dari `backend/n8n-workflows/`:
   - `Workflow 1_ Automation Ticket Intelligence...json`
   - `Workflow 2_ Automation Chatbot Assistance...json`
4. Aktifkan kedua workflow (toggle ON)

### Langkah 8 — Setup Formbricks Webhook
1. Ambil URL publik ngrok: `docker logs sis-ngrok 2>&1 | grep -i url`
2. Di Formbricks: **Settings → Integrations → Webhooks → Add Webhook**
3. URL: `https://xxxx.ngrok-free.app/webhook/formbricks`

---

## 🛠️ Commands Berguna

```bash
# ── Manajemen Service ──────────────────────────────────────
./start.sh              # Start semua service (DIREKOMENDASIKAN)
./start.sh restart      # Restart semua tanpa rebuild
./start.sh stop         # Stop semua service
./start.sh status       # Lihat status semua container

# ── Logs ───────────────────────────────────────────────────
./start.sh logs          # Semua log
./start.sh logs backend  # Log backend saja
./start.sh logs frontend # Log frontend saja

# ── Rebuild (setelah update kode) ──────────────────────────
docker compose up -d --build backend   # Rebuild backend saja
docker compose up -d --build frontend  # Rebuild frontend saja
docker compose build --no-cache && docker compose up -d  # Full rebuild

# ── Database ───────────────────────────────────────────────
npm run prisma:studio    # Buka Prisma Studio (GUI database)

# ── npm Scripts ────────────────────────────────────────────
npm run dev              # Dev mode (backend + frontend paralel)
npm run dev:backend      # Dev mode backend saja
npm run dev:frontend     # Dev mode frontend saja
```

---
## 🔄 Update & Redeploy

```bash
git pull origin main
./start.sh   # Rebuild otomatis jika ada perubahan
```

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Container tidak start | `docker compose logs backend` untuk detail error |
| Admin login gagal | Cek `ADMIN_PASSWORD` di `.env`, pastikan tidak ada spasi |
| Discord bot offline | Cek `DISCORD_BOT_TOKEN` valid, dan intents di Developer Portal aktif |
| Formbricks webhook tidak masuk | Cek ngrok berjalan: `docker logs sis-ngrok` |
| N8N tidak trigger | Pastikan workflow aktif (toggle ON) dan `N8N_WEBHOOK_URL` benar |
| AI summary tidak muncul | Cek `GROQ_API_KEY` valid di `.env` |
| Report tidak bisa dibuka | Cek `HOST_IP` di `.env` dan volume `reports_data` ada |
| Frontend build error | `cd frontend && npx prisma generate` |
| Volume tidak ada | `docker volume create formbricks-discord-bot_postgres_data` |