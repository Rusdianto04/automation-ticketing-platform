# 🔧 Backend — Discord Bot + Express API

> Bagian backend dari Support & Incident Management System.
> Menjalankan **Discord Bot** dan **REST API** sekaligus dalam satu proses Node.js.

---

## 📌 Overview

Backend adalah inti sistem. Ia melakukan:
- Menerima submission tiket dari **Formbricks webhook**
- Mengelola **Discord Bot** — membuat thread, pin pesan info, handle command
- Menyediakan **REST API** untuk frontend portal dan N8N automation
- Menghasilkan **HTML Incident Report** yang dapat diakses via browser

---

## ⚙️ Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** >= 14 (atau via Docker)
- **Discord Bot Token** dengan intents: `Server Members` + `Message Content`
- **Groq API Key** (gratis di [console.groq.com](https://console.groq.com))

---

## 📁 Struktur Direktori

```
backend/
│
├── 📄 index.js                     ← Entry point: inisialisasi Express + Discord client
├── 📄 package.json                 ← Dependencies backend
├── 📄 Dockerfile                   ← Multi-stage Alpine build untuk production
├── 📄 docker-entrypoint.sh         ← DB health check + Prisma migrate sebelum start
├── 📄 .env                         ← Environment lokal (tidak di-commit ke Git)
├── 📄 .env.example                 ← Template env — COPY INI untuk mulai
├── 📄 .gitignore
├── 📄 .dockerignore
│
├── prisma/
│   ├── schema.prisma               ← Source of truth schema database
│   └── migrations/
│       └── 0001_init/
│           └── migration.sql       ← Initial migration (idempotent)
│
├── src/
│   │
│   ├── config/
│   │   └── index.js                ← Centralized config (env vars, validasi, defaults)
│   │                                 Wajib ada: DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, DATABASE_URL
│   │
│   ├── database/
│   │   ├── client.js               ← Prisma client singleton
│   │   └── views.js                ← SQL views setup (dijalankan saat startup)
│   │
│   ├── handlers/                   ← Discord event handlers
│   │   ├── chatbot.handler.js      ← AI chatbot via DM / mention bot
│   │   ├── command.handler.js      ← !status, !assign, !evidence commands
│   │   └── thread.handler.js       ← Monitor aktivitas thread (MONITORING/CLOSING mode)
│   │
│   ├── middleware/
│   │   ├── auth.js                 ← validateApiKey — cek x-api-key header
│   │   └── rateLimit.js            ← Rate limiter per IP
│   │
│   ├── models/                     ← Data Access Layer (Prisma wrapper)
│   │   ├── ticket.model.js         ← CRUD tiket: findById, create, update, findSimilar
│   │   ├── activity.model.js       ← CRUD activity log
│   │   └── submission.model.js     ← Simpan raw Formbricks submission
│   │
│   ├── routes/                     ← Express routes (semua butuh x-api-key kecuali /health)
│   │   ├── web.route.js            ← GET /health, GET / (redirect ke frontend)
│   │   ├── webhook.route.js        ← POST /webhook/formbricks — terima form submission
│   │   ├── ticket.route.js         ← CRUD tiket + sync Discord + N8N trigger
│   │   ├── chatbot.route.js        ← API endpoint untuk N8N chatbot workflow
│   │   ├── knowledge.route.js      ← Knowledge base (referensi AI)
│   │   └── report.route.js         ← Generate + serve HTML incident report
│   │
│   ├── services/                   ← Business logic
│   │   ├── discord.service.js      ← Build & update Discord messages, thread management
│   │   ├── n8n.service.js          ← Trigger N8N workflow via HTTP
│   │   ├── email.service.js        ← Kirim notifikasi email via SMTP
│   │   ├── report.service.js       ← Generate HTML incident report
│   │   └── classifier.service.js   ← Klasifikasi tiket dengan Groq AI
│   │
│   └── utils/
│       ├── ticket.js               ← Helper: normalizeTicket, formatAssignee, getTicketMode
│       ├── discord.js              ← Helper: editMessageSafe, splitDiscordMessage
│       ├── date.js                 ← Helper: formatDateTime, formatResolvedStatus
│       └── network.js              ← Auto-detect IP server dari /proc/net/fib_trie
│
├── n8n-workflows/                  ← Workflow JSON untuk di-import ke N8N
│   ├── Workflow 1_ Automation Ticket Intelligence...json   ← AI classifier + summary
│   └── Workflow 2_ Automation Chatbot Assistance...json    ← Chatbot Q&A
│
└── public/
    └── reports/                    ← HTML incident reports (Docker volume: reports_data)
                                      Dapat diakses via: http://SERVER_IP:3000/reports/<file>
```

---

## 🗄️ Database Schema

**Source of truth:** `prisma/schema.prisma`

### Tabel `tickets`

| Field | Tipe | Diisi oleh | Keterangan |
|-------|------|------------|------------|
| `id` | INT | Auto | Primary key |
| `type` | TEXT | Webhook | `TICKETING` atau `INCIDENT` |
| `form_id` | TEXT | Webhook | ID form Formbricks |
| `form_fields` | JSONB | Webhook | Semua field form (Issue, Reporter, dll) |
| `status_pengusulan` | TEXT | Bot/Portal | `OPEN`, `PENDING`, `APPROVED`, `REJECTED`, `DONE`, `INVESTIGASI`, `MITIGASI`, `RESOLVED` |
| `status_note` | TEXT | Bot/Portal | Catatan perubahan status |
| `assignee` | JSONB | Bot/Portal | Array petugas yang ditugaskan |
| `timeline_tindak_lanjut` | TEXT | N8N | Timeline progress Support (append-only) |
| `timeline_action_taken` | TEXT | N8N | Timeline action Incident (append-only) |
| `evidence_attachment` | JSONB | Bot | Array URL evidence |
| `summary_ticket` | TEXT | N8N + AI | AI-generated summary / handling |
| `root_cause` | TEXT | N8N + AI | AI-generated root cause analysis |
| `search_keywords` | TEXT[] | Auto | Keywords untuk similarity search |
| `discord` | JSONB | Bot | Discord metadata: threadId, messageId, dll |
| `resolved_at` | TIMESTAMP | Bot/Portal | Waktu tiket diselesaikan |
| `created_at` | TIMESTAMP | Auto | Waktu tiket dibuat |
| `updated_at` | TIMESTAMP | Auto | Waktu terakhir diperbarui |

### Tabel `activities`

Log semua aktivitas tiket (status update, assign, comment, AI action).

| Field | Keterangan |
|-------|------------|
| `ticket_id` | Foreign key ke tickets |
| `type` | Jenis aktivitas: `status_update`, `assigned`, `ai_summary_created`, dll |
| `description` | Deskripsi detail aktivitas |
| `created_at` | Timestamp |

---

## 🌐 API Routes

Semua route (kecuali `/health`) butuh header: `x-api-key: <N8N_API_KEY>`

### Health & Web
| Method | Path | Keterangan |
|--------|------|------------|
| `GET` | `/health` | Health check — tidak butuh API key |
| `GET` | `/` | Redirect ke frontend portal |

### Webhook (Formbricks)
| Method | Path | Keterangan |
|--------|------|------------|
| `POST` | `/webhook/formbricks` | Terima submission form, buat tiket + Discord thread |

### Ticket API
| Method | Path | Keterangan |
|--------|------|------------|
| `GET` | `/api/tickets` | List semua tiket (filter: status, type, search) |
| `GET` | `/api/tickets/stats` | Statistik tiket untuk dashboard |
| `GET` | `/api/ticket/:id` | Detail satu tiket |
| `POST` | `/api/ticket/create` | Buat tiket baru dari portal |
| `POST` | `/api/ticket/auto-create` | Buat tiket via chatbot AI |
| `PUT` | `/api/ticket/:id/status` | Update status tiket |
| `PUT` | `/api/ticket/:id/assign` | Assign petugas ke tiket |
| `POST` | `/api/ticket/:id/comment` | Tambah komentar dari portal |
| `POST` | `/api/ticket/:id/sync-discord` | Sync Discord (fire-and-forget, return 202) |
| `POST` | `/api/ticket/summary` | Simpan AI summary + root cause |
| `POST` | `/api/ticket/timeline/append` | Append timeline entry (atomic) |
| `POST` | `/api/ticket/repair-discord` | Force repair pinned Discord message |
| `POST` | `/api/ticket/find-similar` | Cari tiket serupa (keyword-based) |

### Chatbot & Knowledge
| Method | Path | Keterangan |
|--------|------|------------|
| `POST` | `/api/chatbot/ask` | Chatbot Q&A untuk N8N |
| `GET` | `/api/chatbot/stats` | Statistik chatbot |
| `GET` | `/api/knowledge` | List knowledge base |
| `POST` | `/api/knowledge` | Tambah entri knowledge |

### Report
| Method | Path | Keterangan |
|--------|------|------------|
| `POST` | `/api/report/generate` | Generate HTML incident report |
| `GET` | `/reports/:filename` | Serve HTML report file |

---

## 🤖 Discord Commands

Semua command diketik di channel Discord yang sama dengan thread tiket:

```
!status #<id> <action> [keterangan]
  Ticketing: pending | approve | reject | done
  Incident:  investigasi | mitigasi | resolved
  Contoh: !status #5 approve Sedang dikerjakan tim jaringan

!assign #<id> @petugas1 @petugas2 ...
  Contoh: !assign #5 @Budi @Siti

!evidence #<id> <message_link>
  Contoh: !evidence #5 https://discord.com/channels/.../...
```

---

## 🔧 Setup Development Lokal

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env   # isi semua variabel yang diperlukan

# Generate Prisma client
npm run generate

# Jalankan database lokal dulu (PostgreSQL harus running)
# Lalu migrate schema:
npm run migrate:dev

# Start backend
npm run dev
# Server berjalan di http://localhost:3000
```

---

## 🐳 Build Docker Manual

```bash
# Dari root monorepo:
docker compose up -d --build backend

# Atau rebuild tanpa cache:
docker compose build --no-cache backend
docker compose up -d backend

# Lihat logs:
docker compose logs -f backend
```

---

## ❓ Troubleshooting Backend

| Masalah | Solusi |
|---------|--------|
| `Missing required environment variables` | Cek `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`, `DATABASE_URL` di `.env` |
| `Bot tidak bisa join channel` | Aktifkan `Message Content Intent` di Discord Developer Portal |
| `Prisma migration failed` | `docker exec sis-backend npx prisma migrate deploy` |
| `Discord rate limit` | Normal — Discord.js auto-retry, tunggu beberapa detik |
| `N8N webhook timeout` | Cek `N8N_WEBHOOK_URL` dan N8N container running |
| `SMTP auth failed` | Gunakan Gmail App Password, bukan password akun biasa |
| `Groq API error` | Cek `GROQ_API_KEY` valid dan kuota tidak habis |