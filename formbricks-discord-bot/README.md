# 🛡️ Support & Incident Management System

> **Monorepo** — Discord Bot + Express API (Backend) & Next.js Portal User + Admin (Frontend)
> Production-ready system untuk manajemen **Ticketing Support** dan **Incident Report**

---

## 📁 Struktur Monorepo

```
support-incident-system/              ← ROOT MONOREPO
│
├── 📄 package.json                   ← npm workspaces root
├── 📄 docker-compose.yml             ← Orkestrasi semua service
├── 📄 .env.example                   ← Template env untuk seluruh sistem
├── 📄 .gitignore
├── 📄 start.sh                       ← Script startup dengan auto-detect IP
├── 📄 README.md
│
├── 🔧 backend/                       ← Discord Bot + Express API (port 3000)
│   ├── Dockerfile                    ← Multi-stage Alpine build
│   ├── docker-entrypoint.sh          ← DB health check + Prisma migrate
│   ├── package.json
│   ├── index.js                      ← Entry point
│   ├── .env.example                  ← Template env backend (dev lokal)
│   ├── .gitignore
│   ├── .dockerignore
│   ├── prisma/
│   │   ├── schema.prisma             ← Database schema (source of truth)
│   │   └── migrations/
│   │       └── 0001_init/
│   │           └── migration.sql     ← Initial migration (idempotent)
│   ├── src/
│   │   ├── config/index.js           ← Centralized config
│   │   ├── database/                 ← Prisma client & views
│   │   ├── handlers/                 ← Discord event handlers
│   │   ├── middleware/               ← Auth, rate limit
│   │   ├── models/                   ← Data access layer (Prisma)
│   │   ├── routes/                   ← Express routes
│   │   │   ├── web.route.js          ← health + redirect ke frontend
│   │   │   ├── webhook.route.js      ← Formbricks webhook
│   │   │   ├── ticket.route.js       ← Ticket CRUD API
│   │   │   ├── chatbot.route.js      ← AI chatbot API
│   │   │   ├── knowledge.route.js    ← Knowledge base API
│   │   │   └── report.route.js       ← Incident report API
│   │   ├── services/
│   │   │   ├── n8n.service.js        ← Trigger N8N workflows (NEW)
│   │   │   ├── discord.service.js
│   │   │   ├── email.service.js
│   │   │   ├── report.service.js
│   │   │   └── classifier.service.js
│   │   └── utils/                    ← Helpers (network, ticket, date)
│   ├── n8n-workflows/                ← N8N automation workflow JSON
│   └── public/reports/               ← Generated HTML incident reports (volume)
│
├── 🌐 frontend/                      ← Next.js Portal (port 3001)
│   ├── Dockerfile                    ← Multi-stage standalone build
│   ├── package.json
│   ├── next.config.js                ← output: standalone (Docker)
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── middleware.ts                 ← JWT route protection /admin/*
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma             ← Copy dari backend (read-only portal)
│   │   └── migrations/               ← Copy dari backend
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  ← Redirect → /dashboard
│   │   ├── globals.css
│   │   ├── dashboard/                ← User portal (semua ticket)
│   │   │   ├── page.tsx
│   │   │   └── DashboardClient.tsx
│   │   ├── tickets/[id]/             ← Detail ticket
│   │   │   ├── page.tsx              ← Router: Support atau Incident
│   │   │   ├── SharedComponents.tsx
│   │   │   ├── TicketDetailSupport.tsx
│   │   │   └── TicketDetailIncident.tsx
│   │   └── admin/                    ← Admin Control Panel (JWT protected)
│   │       ├── layout.tsx
│   │       ├── page.tsx              ← Admin dashboard
│   │       ├── admin.css
│   │       ├── actions.ts            ← Server Actions (login, update, assign)
│   │       ├── AdminDashboardClient.tsx
│   │       ├── login/                ← Login admin
│   │       ├── tickets/              ← Ticket monitoring & management
│   │       ├── automation/           ← Live automation log
│   │       ├── system/               ← System control & health
│   │       └── reports/              ← Analytics & KPI charts
│   ├── components/admin/
│   │   └── AdminSidebar.tsx
│   ├── lib/
│   │   ├── prisma.ts                 ← Prisma client singleton
│   │   ├── auth.ts                   ← JWT sign/verify + bcrypt
│   │   └── tickets.ts                ← DAL: getAllTickets, getTicketById, dll.
│   └── types/index.ts                ← TypeScript interfaces
│
└── 📋 logs/                          ← Runtime logs (auto-created)
    ├── backend/
    └── frontend/
```

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PRODUCTION SYSTEM                                │
│                                                                      │
│  Discord          Formbricks          Browser (LAN)                  │
│  Bot/Users        Webhook Form        User & Admin                   │
└────┬─────────────────┬─────────────────────┬────────────────────────┘
     │                 │                     │
     ▼                 ▼                     ▼
┌───────────────┐ ┌──────────┐   ┌──────────────────────┐
│   BACKEND     │ │  N8N     │   │     FRONTEND          │
│   :3000       │ │  :5678   │   │     :3001             │
│               │ │          │   │                       │
│ Discord Bot   │ │ Workflow  │   │ /dashboard            │
│ Express API   │ │ AI Groq  │   │ /tickets/:id          │
│ Webhook recv  │ │ Email    │   │ /admin (JWT)          │
│ HTML Reports  │ │ N8N auto │   │                       │
└───────┬───────┘ └────┬─────┘   └──────────┬────────────┘
        │              │                    │
        └──────────────┴────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   PostgreSQL :5432     │
          │   (internal network)   │
          └────────────────────────┘
```

---

## 🚀 Setup Production (Docker — Direkomendasikan)

### Step 1 — Persiapan

```bash
cd support-incident-system/
chmod +x start.sh
```

### Step 2 — Konfigurasi `.env`

```bash
cp .env.example .env
nano .env
```

**Variabel wajib diisi:**

| Variable | Keterangan |
|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DISCORD_BOT_TOKEN` | Token Discord Bot |
| `DISCORD_CHANNEL_ID` | ID channel Discord |
| `DISCORD_GUILD_ID` | ID server Discord |
| `GROQ_API_KEY` | API key Groq untuk AI |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt password admin |
| `JWT_SECRET` | Secret key JWT (panjang & unik!) |
| `SMTP_USER` / `SMTP_PASS` | Kredensial email |

### Step 3 — Generate admin password hash

```bash
node -e "require('bcryptjs').hash('PasswordAnda', 12).then(console.log)"
# Paste hasilnya ke ADMIN_PASSWORD_HASH di .env
```

### Step 4 — Create Docker volumes (pertama kali saja)

```bash
docker volume create sis_postgres_data
docker volume create sis_n8n_data
docker volume create sis_reports_data
```

### Step 5 — Start semua service

```bash
# Cara paling mudah (auto-detect IP):
./start.sh

# Atau manual:
docker compose up -d --build
```

### Step 6 — Verifikasi

```bash
./start.sh status           # lihat status container
docker compose logs backend  # log backend
docker compose logs frontend # log frontend
```

| Service | URL | Keterangan |
|---------|-----|------------|
| **User Portal** | `http://SERVER_IP:3001/dashboard` | Akses publik internal |
| **Admin Portal** | `http://SERVER_IP:3001/admin` | Login required |
| **Backend API** | `http://SERVER_IP:3000/health` | Health check |
| **N8N** | `http://SERVER_IP:5678` | Workflow engine |

---

## 💻 Setup Development (Lokal)

### Prerequisites
- Node.js >= 18 & npm >= 9
- PostgreSQL running locally
- Discord Bot Token

### Install & Run

```bash
# Install semua workspace (backend + frontend)
npm install

# Setup env
cp .env.example .env   # edit sesuai lokal
cd backend && cp .env.example .env && cd ..

# Generate Prisma client
npm run generate

# Jalankan backend + frontend sekaligus
npm run dev
```

> **Port dev:** Backend :3000, Frontend :3001 (Next.js)
> Jika bentrok, ubah `PORT=3001` backend → `PORT=3002` di `.env` backend dev

---

## 🔐 Admin Portal

**URL:** `http://SERVER_IP:3001/admin` (atau klik tombol "Admin Panel" di dashboard)

**Login:** Username dari `ADMIN_USERNAME` env, password dari `ADMIN_PASSWORD_HASH` env

| Menu | Fungsi |
|------|--------|
| **Dashboard Monitoring** | Stats real-time, automation rate, status sistem |
| **Ticket Monitoring** | Filter, search, lihat semua ticket |
| **Kelola Ticket** | Ubah status, reassign petugas, view log |
| **Automation Log** | Live log Bot/N8N/AI/DB (terminal style) |
| **System Control** | Restart/test komponen sistem |
| **Reports & Analytics** | Chart 7 hari, KPI, distribusi ticket |

---

## 📋 User Portal — Detail Ticket

### Ticketing Support (`/tickets/:id`)

| Section | Sumber Data |
|---------|-------------|
| Data Formulir | `form_fields` JSONB dari DB |
| **Ringkasan Ticket (AI Summary)** | **`summary_ticket` TEXT dari DB** ← diisi AI classifier |
| Root Cause | `root_cause` TEXT dari DB |
| Timeline Progress | `timeline_tindak_lanjut` TEXT dari DB |
| Informasi Ticket | `id`, `status_pengusulan`, type |
| Assignee / Petugas | `assignee` JSONB dari DB |

### Incident Report (`/tickets/:id`)

| Section | Sumber Data |
|---------|-------------|
| Data Formulir | Semua field `form_fields` JSONB |
| **Ringkasan Incident (AI Summary)** | **`summary_ticket` TEXT dari DB** ← diisi AI classifier |
| Root Cause Analysis | `root_cause` TEXT dari DB |
| Action Taken / Timeline | `timeline_action_taken` TEXT dari DB |
| Assignee / Petugas | `assignee` JSONB dari DB |
| Laporan Incident | Link HTML report dari `discord.reportUrl` |

---

## 🗄️ Database Schema (Tabel Penting)

**Source of truth:** `backend/prisma/schema.prisma`

**Field kunci di tabel `tickets`:**

| Field | Tipe | Diisi oleh |
|-------|------|-----------|
| `summary_ticket` | TEXT | AI classifier (N8N + Groq) — otomatis |
| `root_cause` | TEXT | Petugas IT — manual via Discord command |
| `timeline_tindak_lanjut` | TEXT | N8N automation — otomatis |
| `timeline_action_taken` | TEXT | N8N automation — otomatis |
| `discord` | JSONB | Bot saat buat thread (termasuk `reportUrl`) |

---

## 🛠️ Commands Berguna

```bash
# Start semua service
./start.sh

# Restart backend saja (tanpa rebuild)
./start.sh restart

# Lihat logs
./start.sh logs
./start.sh logs backend
./start.sh logs frontend

# Stop semua
./start.sh stop

# Status container
./start.sh status

# Prisma Studio (GUI database)
npm run prisma:studio

# Start dengan Ngrok
docker compose --profile ngrok up -d
```

---

## ❓ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Container tidak bisa mulai | `docker compose logs backend` untuk detail error |
| `DATABASE_URL` error | Pastikan DB volume: `docker volume ls` |
| Admin login gagal | Cek `ADMIN_PASSWORD_HASH` dan `JWT_SECRET` di `.env` |
| `summary_ticket` kosong | Cek N8N workflow AI classification berjalan |
| Report tidak bisa dibuka | Cek `HOST_IP` di `.env` dan volume `reports_data` |
| Frontend build error | `cd frontend && npx prisma generate` dulu |
| Bot Discord offline | Cek `DISCORD_BOT_TOKEN` valid dan intents Discord aktif |

---

## 🔄 Update & Redeploy

```bash
# Pull update
git pull origin main

# Rebuild & restart semua
./start.sh

# Atau rebuild service tertentu saja
docker compose up -d --build backend
docker compose up -d --build frontend
```
