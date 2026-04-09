# 🌐 Frontend — Next.js Portal User & Admin

> Bagian frontend dari Support & Incident Management System.
> Menyediakan **Portal User** (lihat status tiket) dan **Admin Panel** (kelola tiket, monitoring, analytics).

---

## 📌 Overview

Frontend adalah web portal berbasis **Next.js 14** dengan **App Router** dan **Tailwind CSS**.
Terhubung langsung ke database PostgreSQL via **Prisma** (read/write untuk portal admin, read-only untuk portal user).

### Dua Mode Akses

| Mode | URL | Siapa | Fungsi |
|------|-----|-------|--------|
| **Portal User** | `/dashboard`, `/tickets/:id` | Semua user LAN | Lihat status tiket, detail, progress |
| **Admin Panel** | `/admin/*` | Admin IT (login JWT) | Kelola tiket, ubah status, reassign, analytics |

---

## ⚙️ Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** running (shared dengan backend)

---

## 3. Struktur Project Direktori
```
frontend/
├── Dockerfile                    ← Multi-stage standalone build (Node 20 Alpine)
├── next.config.js                ← output: standalone + ignoreBuildErrors: true
├── tailwind.config.js            ← Tailwind CSS (utility-first styling)
├── tsconfig.json                 ← TypeScript strict config
├── middleware.ts                 ← JWT guard untuk semua route /admin/*
├── package.json                  ← Dependencies + scripts
├── .env.example                  ← Template environment variables
├── prisma/
│   ├── schema.prisma             ← Copy dari backend/prisma/schema.prisma (READ-ONLY)
│   └── migrations/               ← Copy dari backend/prisma/migrations/
├── app/                          ← Next.js App Router (semua halaman & API)
│   ├── layout.tsx                ← Root HTML layout
│   ├── page.tsx                  ← Root → redirect ke /dashboard
│   ├── globals.css               ← Global styles (Tailwind directives)
│   ├── api/                      ← Next.js API Routes (server-side)
│   │   ├── health/
│   │   │   └── route.ts          ← GET /api/health — Docker HEALTHCHECK endpoint
│   │   └── admin/
│   │       ├── stats/
│   │       │   └── route.ts      ← GET /api/admin/stats — realtime system stats
│   │       ├── activities/
│   │       │   └── route.ts      ← GET /api/admin/activities — log aktivitas dari DB
│   │       ├── recent-tickets/
│   │       │   └── route.ts      ← GET /api/admin/recent-tickets — 10 ticket terbaru
│   │       ├── report-view/[id]/
│   │       │   └── route.ts      ← GET /api/admin/report-view/:id — proxy HTML report (dynamic IP)
│   │       └── export/
│   │           ├── support/
│   │           │   └── route.ts  ← GET /api/admin/export/support — Download Excel Support
│   │           └── incident/
│   │               └── route.ts  ← GET /api/admin/export/incident — Download Excel Incident
│   ├── dashboard/                ← Portal User — daftar semua ticket
│   │   ├── page.tsx              ← Server Component: query DB, kirim ke client
│   │   └── DashboardClient.tsx   ← Client Component: filter, search, tabel ticket
│   ├── tickets/[id]/             ← Portal User — detail satu ticket
│   │   ├── page.tsx              ← Router: ticket.type → Support atau Incident
│   │   ├── SharedComponents.tsx  ← StatusBadge, TypeBadge, TimelineSection, AssigneeList
│   │   ├── TicketDetailSupport.tsx   ← Tampilan detail ticket Support
│   │   └── TicketDetailIncident.tsx  ← Tampilan detail ticket Incident
│   └── admin/                    ← Admin Control Panel (JWT protected via middleware.ts)
│       ├── layout.tsx            ← Admin layout wrapper
│       ├── page.tsx              ← Admin Dashboard Server Component
│       ├── admin.css             ← Styles khusus admin (sidebar, admin-main, status-dot)
│       ├── actions.ts            ← Server Actions: login, updateStatus, reassign, editFields
│       ├── AdminDashboardClient.tsx  ← Dashboard realtime (stats, system health, ticket terbaru)
│       ├── login/
│       │   ├── page.tsx
│       │   └── AdminLoginClient.tsx
│       ├── tickets/              ← Ticket Monitoring (list + detail)
│       │   ├── page.tsx
│       │   ├── AdminTicketsClient.tsx    ← List semua ticket + filter + search
│       │   └── [id]/
│       │       ├── page.tsx
│       │       └── AdminTicketDetailClient.tsx  ← Kelola ticket: edit, status, assign
│       ├── automation/           ← Live Automation Log
│       │   ├── page.tsx
│       │   └── AutomationLogClient.tsx   ← Terminal-style live log dari DB activities
│       └── reports/              ← Reports & Analytics
│           ├── page.tsx
│           └── ReportsClient.tsx         ← Download Excel per bulan (Support & Incident)
├── components/
│   └── admin/
│       └── AdminSidebar.tsx      ← Sidebar navigasi admin (Dashboard, Tickets, Log, Reports)
├── lib/
│   ├── prisma.ts                 ← Prisma client singleton (mencegah multiple instances di dev)
│   ├── auth.ts                   ← JWT sign/verify + bcrypt password check
│   └── tickets.ts                ← Data Access Layer: getAllTickets, getTicketById, formatDate
└── types/
    └── index.ts                  ← TypeScript interfaces: Ticket, Activity, TicketStatus, dll.
```
---

## 🔐 Sistem Autentikasi Admin

### Flow Login

```
User input username + password di /admin/login
        │
        ▼
adminLoginAction() → verifyAdminCredentials()
        │            (cek ADMIN_USERNAME + ADMIN_PASSWORD / ADMIN_PASSWORD_HASH)
        ▼
Set cookie: admin_token (JWT, httpOnly, 10 tahun)
        │
        ▼
middleware.ts → verifikasi JWT di setiap request /admin/*
```

### Konfigurasi Password

**Cara 1 — Plaintext (mudah, cocok untuk internal):**
```env
ADMIN_PASSWORD=PasswordAnda
ADMIN_PASSWORD_HASH=
```

**Cara 2 — Bcrypt Hash (production):**
```bash
# Generate hash:
node -e "require('bcryptjs').hash('PasswordAnda', 12).then(console.log)"
```
```env
ADMIN_PASSWORD=
ADMIN_PASSWORD_HASH=$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🎨 Fitur Admin Panel

### Dashboard Monitoring
- Statistik real-time: total tiket, open, done, incident, pending
- Status sistem: Database, Backend API, N8N
- 10 tiket terbaru dengan status dan tipe

### Ticket Monitoring (`/admin/tickets`)
- Tabel semua tiket dengan filter status & tipe
- Search by judul, reporter, summary
- Klik tiket untuk buka halaman kelola

### Kelola Ticket (`/admin/tickets/:id`)
- **Ubah Status** — 4 tombol: In Progress / Pending / Done / Reject (Support) atau Open / Investigasi / Mitigasi / Resolved (Incident)
- **Reassign Petugas** — input nama petugas (comma-separated)
- **Edit Data Ticket** — ubah nama reporter
- **Edit Data Formulir** — ubah semua field form
- Semua perubahan otomatis sync ke Discord (fire-and-forget, tidak lag)

### Automation Log (`/admin/automation`)
- Terminal-style live log 30 entri terbaru
- Filter by komponen: Discord Bot, N8N, AI, Database, Email
- Color-coded: INFO (abu), SUCCESS (hijau), ERROR (merah), WARN (kuning)

### Reports & Analytics (`/admin/reports`)
- Chart 7 hari tiket masuk
- Distribusi status pie chart
- KPI: rata-rata resolusi, total tiket hari ini

---

## 🔧 Setup Development Lokal

```bash
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env   # isi DATABASE_URL, ADMIN_PASSWORD, JWT_SECRET

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
# Portal berjalan di http://localhost:3001
```

> **Catatan:** `DATABASE_URL` harus mengarah ke PostgreSQL yang sudah berisi data (biasanya dijalankan bersamaan dengan backend).

---

## 🐳 Build Docker Manual

```bash
# Dari root monorepo:
docker compose up -d --build frontend

# Rebuild tanpa cache:
docker compose build --no-cache frontend
docker compose up -d frontend

# Lihat logs:
docker compose logs -f frontend
```

---

## ❓ Troubleshooting Frontend

| Masalah | Solusi |
|---------|--------|
| Admin login gagal | Cek `ADMIN_PASSWORD` di `.env`, pastikan `ADMIN_USERNAME` benar |
| `PrismaClientInitializationError` | Cek `DATABASE_URL` di `.env` dan PostgreSQL running |
| Status tiket tidak update setelah ubah | Hard refresh browser (Ctrl+Shift+R), Next.js cache |
| Badge status menampilkan raw text | Update `SharedComponents.tsx` — tambah entry di `STATUS_LABELS` |
| Build gagal di Docker | Pastikan `prisma/schema.prisma` ada dan `npx prisma generate` berhasil |
| Admin panel tidak bisa diakses | Cek `JWT_SECRET` konsisten di `.env`, coba logout dan login ulang |