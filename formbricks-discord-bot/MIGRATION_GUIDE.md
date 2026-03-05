# 📦 Migration & Deployment Guide
## Formbricks Discord Bot v5 — Sequelize → Prisma

---

## ✅ Apa yang Berubah di v5?

| Aspek | Sebelum (v4 Sequelize) | Sekarang (v5 Prisma) |
|---|---|---|
| ORM | Sequelize v6 | Prisma v5 |
| Schema file | `models/Ticket.js` dll | `prisma/schema.prisma` |
| Migration | `sequelize.sync({ alter })` | `prisma migrate deploy` |
| DB schema | **Tidak berubah** ✅ | **Tidak berubah** ✅ |
| N8N raw SQL | **Tidak berubah** ✅ | **Tidak berubah** ✅ |
| index.js | Monolitik 3510 baris | Modular, clean, 150 baris |
| Structure | 1 file | src/ terpisah per concern |
| Ngrok | `ngrok.yml` ada di root | ✅ Tetap di root, documented |

---

## 🗂️ Struktur Folder

```
formbricks-discord-bot/
├── index.js                     ← Entry point (clean, 150 baris)
├── package.json
├── Dockerfile
├── docker-compose.yml           ← Includes ngrok service
├── ngrok.yml                    ← Ngrok tunnel config ✅
├── ngrok.sh                     ← Ngrok manual start script
├── .env.example
├── .dockerignore
│
├── prisma/
│   ├── schema.prisma            ← Single source of truth
│   └── migrations/
│       └── 0001_init/migration.sql
│
├── src/
│   ├── config/
│   │   └── index.js             ← Semua env vars, validated
│   ├── database/
│   │   ├── client.js            ← Prisma singleton
│   │   └── views.js             ← PostgreSQL views setup
│   ├── models/
│   │   ├── ticket.model.js      ← Prisma ticket queries
│   │   ├── submission.model.js
│   │   └── activity.model.js
│   ├── services/
│   │   ├── discord.service.js   ← Thread management, message builders
│   │   ├── email.service.js     ← SMTP email
│   │   ├── n8n.service.js       ← N8N webhook trigger
│   │   ├── classifier.service.js← AI ticket field classifier
│   │   └── report.service.js    ← HTML incident report generator
│   ├── handlers/
│   │   ├── chatbot.handler.js   ← Discord @mention / DM
│   │   ├── command.handler.js   ← !status !assign !evidence
│   │   └── thread.handler.js    ← Thread activity → N8N trigger
│   ├── routes/
│   │   ├── webhook.route.js     ← POST /webhook/formbricks
│   │   ├── ticket.route.js      ← /api/ticket/*
│   │   ├── chatbot.route.js     ← /api/chatbot/*
│   │   ├── knowledge.route.js   ← /api/knowledge/*
│   │   ├── report.route.js      ← /api/report/*
│   │   └── web.route.js         ← / /tickets/:id /health
│   ├── middleware/
│   │   ├── auth.js              ← X-API-Key validation
│   │   └── rateLimit.js         ← Per-user rate limiting
│   └── utils/
│       ├── date.js              ← WIB date formatting
│       ├── discord.js           ← Message split & overflow
│       ├── network.js           ← LAN IP detection
│       └── ticket.js            ← Ticket helpers
│
├── views/
│   ├── dashboard.ejs
│   └── ticket_detail.ejs
└── n8n-workflows/
```

---

## 🚀 Install Baru (Fresh)

```bash
# 1. Clone / copy folder
git clone ... formbricks-discord-bot
cd formbricks-discord-bot

# 2. Setup environment
cp .env.example .env
nano .env                       # Isi semua nilai

# 3. Edit ngrok.yml — ganti authtoken
nano ngrok.yml

# 4. Jalankan
docker-compose up -d --build

# 5. Cek logs
docker-compose logs -f formbricks-discord-bot
```

---

## ⬆️ Upgrade dari v4 (Sequelize) — Data Tetap Aman

```bash
# 1. BACKUP DULU (wajib)
docker exec formbricks-postgres pg_dump -U postgres ticketing_db > backup_$(date +%Y%m%d).sql

# 2. Pull code baru
git pull

# 3. Update .env — tambah DATABASE_URL
echo "DATABASE_URL=postgresql://postgres:password@postgres:5432/ticketing_db?schema=public" >> .env

# 4. Mark migration sebagai sudah applied (skip SQL — tabel sudah ada)
docker-compose run --rm formbricks-discord-bot \
  npx prisma migrate resolve --applied 0001_init

# 5. Build & start
docker-compose up -d --build

# 6. Verifikasi
docker-compose logs formbricks-discord-bot | grep -E "✅|❌"
```

---

## 🔧 Ngrok Setup (Formbricks Webhook)

Ngrok diperlukan agar Formbricks (internet) bisa mengirim submission ke server ini.

### 1. Dapatkan Authtoken
- Buka https://dashboard.ngrok.com
- Copy authtoken Anda

### 2. Edit ngrok.yml
```yaml
# ngrok.yml
version: "2"
authtoken: YOUR_TOKEN_HERE  # ← Ganti ini
tunnels:
  bot:
    proto: http
    addr: formbricks-discord-bot:3000
    inspect: true
region: ap
```

### 3. Set Formbricks Webhook URL
- Buka dashboard Ngrok: http://localhost:4040
- Copy URL publik (contoh: `https://abc123.ngrok-free.app`)
- Di Formbricks: Settings → Integrations → Webhook
- URL: `https://abc123.ngrok-free.app/webhook/formbricks`

---

## 🩺 Prisma Commands

```bash
# Generate Prisma Client (setelah ubah schema.prisma)
npx prisma generate

# Apply migrations (production)
npx prisma migrate deploy

# Buat migration baru (development)
npx prisma migrate dev --name nama_migration

# Buka GUI database browser
npx prisma studio

# Reset DB (HAPUS SEMUA DATA — development only!)
npx prisma migrate reset
```

---

## 🔗 Kompatibilitas N8N

N8N tetap query PostgreSQL langsung via raw SQL — **tidak ada perubahan**.
Semua workflow N8N yang sudah ada tetap berjalan normal.

N8N hanya boleh:
- ✅ Query DB langsung (raw SQL via PostgreSQL node)
- ✅ Call Bot API: `http://formbricks-discord-bot:3000/api/...`
- ❌ Tidak boleh query Prisma (Prisma hanya di bot container)

---

## 🐛 Troubleshooting

| Problem | Solusi |
|---|---|
| `P1001: Can't reach database` | Cek DATABASE_URL & postgres service running |
| `prisma generate` failed | Jalankan ulang `npm install --save-dev prisma && npx prisma generate` |
| Ngrok tunnel tidak muncul | Cek authtoken di ngrok.yml, restart ngrok container |
| Bot tidak respond | Cek DISCORD_BOT_TOKEN, cek `docker-compose logs -f formbricks-discord-bot` |
| Email tidak terkirim | Cek SMTP_USER, SMTP_PASS (gunakan App Password Gmail) |
| Report URL tidak bisa diakses | Set PORTAL_URL di .env ke IP LAN server |
