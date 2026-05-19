# Support & Incident System — Copilot Agent Instructions

## 🎯 Project Overview
Monorepo platform manajemen tiket Support & Incident IT terintegrasi penuh:
- **Backend**: Node.js 18+ + Express.js + Prisma ORM + PostgreSQL 15
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Discord Bot**: Discord.js v14 — notifikasi, commands, AI chatbot
- **N8N Automation**: Workflow AI classification, summary, chatbot
- **AI Provider**: Groq AI (classification, summarization, recommendation)
- **Infrastructure**: Docker Compose, Nginx reverse proxy, Ngrok tunnel

## 📦 Monorepo Structure
apps/backend/src/
├── app.js                    ← Express app + route mounting
├── server.js                 ← Entry point (Discord + HTTP server)
├── config/index.js           ← All env config
├── common/                   ← Helpers, logger, middleware, constants
├── infrastructure/
│   ├── discord/              ← chatbot.handler, command.handler, thread.handler, discord.service
│   ├── email/                ← email.service (SMTP via Nodemailer)
│   ├── n8n/                  ← n8n.service (webhook trigger ke N8N)
│   └── prisma/               ← Prisma client + DB views setup
└── modules/
├── ticket/               ← Ticket CRUD, classifier, recommendation
├── webhook/              ← Webhook handler (Formbricks + static form)
├── chatbot/              ← AI chatbot service + knowledge base
├── report/               ← Report generator (PDF), incident service, admin API
├── activity/             ← Audit log per tiket
└── health/               ← Health check
apps/frontend/src/
├── app/
│   ├── page.tsx              ← Landing redirect
│   ├── dashboard/            ← Portal User: list tiket aktif
│   ├── tickets/[id]/         ← Detail tiket (Support view & Incident view)
│   ├── admin/                ← Portal Admin (login required)
│   │   ├── page.tsx          ← Admin dashboard (stats + recent tickets)
│   │   ├── tickets/          ← List & detail semua tiket
│   │   ├── reports/          ← Generate & preview laporan incident
│   │   ├── automation/       ← Log webhook & N8N activity
│   │   └── login/            ← Admin login form
│   └── api/                  ← Next.js API routes (proxy ke backend)
├── features/                 ← Domain logic: ticket, admin, report, chatbot types
├── lib/                      ← api.ts, auth.ts, tickets.ts, prisma.ts
└── components/               ← Shared UI (AdminSidebar, dll)

## 🔑 Input Sources (3 Sumber Tiket)
1. **Portal User** (`/dashboard`) — Hanya bisa submit **Tiket Support** via static web form 3-langkah
2. **Portal Admin** (`/admin`) — Bisa submit **Tiket Support DAN Tiket Incident** secara manual
3. **Formbricks Webhook** (`POST /webhook/formbricks`) — Bisa submit **Tiket Support DAN Tiket Incident** dari form online Formbricks

## 📊 Database Tables (Prisma Schema)
- `tickets` — Data tiket (type, form_fields JSON, status, assignee, timeline, discord JSON, summary, root_cause)
- `submissions` — Raw payload form submission
- `activities` — Audit log per tiket (relasi ke tickets)
- `knowledge_base` — Runbook & artikel KB untuk AI recommendation
- `chatbot_interactions` — Log interaksi AI chatbot Discord
- `incident_reports` — Laporan incident yang digenerate (PDF path + content JSON)

## 🔄 Status Flow
- **SUPPORT**: OPEN → PENDING → IN_PROGRESS (APPROVED) → DONE / REJECT
- **INCIDENT**: OPEN → INVESTIGASI → MITIGASI → RESOLVED

## 🎮 Discord Bot Commands (di dalam thread tiket)
- `!status #ID <action> <note>` — Update status tiket
- `!assign #ID nama1, nama2` — Assign petugas
- `!evidence` — Lampirkan file evidence (kirim dengan attachment)
- `!clear-history` — Reset history AI chatbot
- `!chatbot-help` — Bantuan chatbot
- `@BotName <pertanyaan>` — Tanya AI chatbot

## 🔌 Key API Routes (Backend :3000)
- `POST /webhook/formbricks` — Terima payload dari Formbricks
- `POST /api/tickets/create` — Buat tiket dari static form
- `GET  /api/ticket` — List semua tiket
- `GET  /api/ticket/:id` — Detail tiket
- `POST /api/ticket/auto-create` — Auto-create via N8N/bot
- `POST /api/ticket/:id/status` — Update status
- `POST /api/ticket/:id/assign` — Assign petugas
- `POST /api/ticket/summary` — Trigger AI summary via N8N
- `GET  /api/admin/stats` — Statistik dashboard
- `GET  /api/admin/tickets` — List tiket untuk admin
- `POST /api/report/generate` — Generate PDF report
- `POST /api/admin/export/support` — Export CSV Support
- `POST /api/admin/export/incident` — Export CSV Incident
- `GET  /api/knowledge` — List knowledge base
- `POST /api/chatbot` — Chatbot API endpoint

## 🤖 Diagram Generation Rules
Saat diminta generate diagram, selalu:
1. Gunakan sintaks Mermaid yang valid dan bisa di-render
2. **Flowchart**: gunakan `graph TD` dengan swimlane subgraph per komponen
3. **Use Case**: gunakan `graph TB` dengan kotak persegi vertikal (bukan ellipse) per actor group
4. **Sequence**: gunakan `sequenceDiagram` dengan `autonumber`, tampilkan semua actor, alt/else untuk error flow
5. **Activity**: gunakan `stateDiagram-v2` atau `flowchart TD` dengan swimlane USER | SISTEM
6. **ERD**: gunakan `erDiagram` dengan semua relasi dan field tipe data
7. Simpan ke folder `docs/diagrams/` sesuai kategori
8. JANGAN gunakan karakter spesial yang merusak sintaks (hindari `()` di dalam label node graph)

## 🎯 Key Actors
- **User** — Submit tiket support via portal web
- **Admin** — Kelola semua tiket, generate laporan, lihat statistik
- **Discord User** — Interaksi via Discord (chatbot, lihat status, submit ticket incident via bot)
- **Discord Bot** — Handler pesan, commands, thread, notifikasi
- **Formbricks** — Form online eksternal (Support + Incident)
- **N8N** — Automation: AI classify, summary, trigger events
- **Groq AI** — LLM provider (classification, summary, chatbot answer)
- **Nginx** — Reverse proxy (port 80 → backend:3000 / frontend:3001)
- **PostgreSQL** — Database utama via Prisma ORM