# 🎰 ADXWin — Full-Stack Online Gaming Platform

> **Brands:** `zeero.bet` · `kuberexchange.com`
>
> A production-grade, multi-brand online betting & casino platform built as a monorepo. Includes a NestJS API backend, two Next.js frontends (user-facing website + admin panel), a Rust real-time sports data syncer, and a PHP payment bridge.

---

## 📁 Repository Structure

```
adxwin/
├── newbackend/          ← NestJS REST + WebSocket API  (port 9828)
├── newwebsite/          ← Next.js user-facing website  (port 3000)
├── newadmin/            ← Next.js admin panel           (port 3010)
├── sports-sync-rust/    ← Rust live-odds sync engine
├── anyleson-pay-php/    ← PHP UPI/Razorpay payment bridge
├── deploy_web.sh        ← Frontend deploy script
├── deploy_db.sh         ← PostgreSQL backup restore script
├── diamond_integration.sh
├── remove_api.sh / remove_api_pt2.sh / remove_api_pt3.sh
├── backup.dump          ← PostgreSQL dump (pg_restore format)
├── start server.txt     ← PM2 server start reference
└── WCO - Games List.csv ← Casino game catalogue seed
```

---

## 🧩 Sub-Projects Overview

| Directory | Stack | Role | Default Port |
|-----------|-------|------|-------------|
| `newbackend` | NestJS 11, TypeScript, Prisma, Mongoose | REST API + WebSocket server | **9828** |
| `newwebsite` | Next.js 16, React 19, Tailwind v4 | Player-facing website | **3000** |
| `newadmin` | Next.js 16, React 19, Tailwind v4 | Admin & operations dashboard | **3010** |
| `sports-sync-rust` | Rust | Real-time Diamond API sports sync | — |
| `anyleson-pay-php` | PHP | Razorpay/UPI payment bridge on anyleson.com | — |

---

## 🗄️ Databases & Infrastructure

### PostgreSQL (Primary Relational DB)
- **Version:** 15 (Docker image `postgres:15-alpine`)
- **Container name:** `100xwins_postgres`
- **Port:** `5432`
- **ORM:** Prisma v5.22.0
- **Schema file:** `newbackend/prisma/schema.prisma`

Key models:
| Model | Purpose |
|-------|---------|
| `User` | Players and all admin roles. Holds fiat balance, crypto balance, bonus wallet, wagering tracking, KYC status, referral code, and agent hierarchy |
| `Transaction` | Deposit / Withdrawal records with status (PENDING, APPROVED, REJECTED) |
| `CasinoTransaction` | Casino wager debit/credit/refund per round |
| `PaymentMethod` | Configurable UPI / Bank / Crypto payment methods |
| `SystemConfig` | Key-value store for runtime configuration |
| `HomeCategory` | CMS for homepage category cards |
| `ReferralReward` | Referral reward rule definitions |
| `ReferralHistory` | Per-user referral earning log |
| `SupportTicket / SupportMessage` | Live chat & helpdesk ticketing |
| `AuditLog` | Admin action audit trail |
| `VipApplication` | VIP tier application and approval workflow |
| `UserBonus` | Per-user bonus wagering tracking (status: ACTIVE / COMPLETED / FORFEITED / EXPIRED) |
| `EventLock` | Per-event odds / fancy bet locking for specific user IDs |
| `KycDocument` | Uploaded KYC image references |

**User roles hierarchy (top → bottom):**
```
TECH_MASTER → SUPER_ADMIN → MANAGER → MASTER → AGENT → USER
```

### MongoDB (Bets & Sports Data)
- **ODM:** Mongoose 9.x
- **Use cases:** Sports bets, Casino game catalogue, live match & odds data, announcements, promo cards, chat messages
- **Connection:** `MONGO_URI` env variable

### Redis
- **Version:** 7 (Docker image `redis:7-alpine`)
- **Container name:** `100xwins_redis`
- **Port:** `6379`
- **Use cases:** Session caching, rate limiting, pub/sub for real-time WebSocket broadcasts, odds caching

### ClickHouse (Analytics)
- Package: `@clickhouse/client`
- Used by the `AnalyticsModule` for high-performance event/bet analytics queries

---

## ⚙️ Environment Variables

### `newbackend/.env` (required)
```env
# PostgreSQL
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/adxwin_db

# MongoDB
MONGO_URI=mongodb://localhost:27017/adxwin

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_super_secret_jwt_key

# Payment Gateways
PAYMENT0_WEBHOOK_SECRET=7f2d9a1c8e4b3f6a0d5c2e9f7a1b8c3d   # Must match anyleson-pay-php config.php
NOWPAYMENTS_API_KEY=your_nowpayments_key
NOWPAYMENTS_IPN_SECRET=your_ipn_secret

# Diamond Sports API
DIAMOND_API_URL=https://diamondexch.com/api
DIAMOND_API_TOKEN=your_diamond_token

# General
PORT=9828
```

### `newwebsite/.env`
```env
NEXT_PUBLIC_API_URL=https://zeero.bet/api
NEXT_PUBLIC_WS_URL=wss://zeero.bet
```

### `newadmin/.env`
```env
NEXT_PUBLIC_API_URL=https://zeero.bet/api
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 20+
- Rust (latest stable) — for `sports-sync-rust`
- Docker & Docker Compose
- PM2 (`npm install -g pm2`)

### 1. Start Infrastructure (Docker)
```bash
cd newbackend
docker compose up -d
```
This spins up **PostgreSQL**, **Redis**, and **RabbitMQ**.

### 2. Backend Setup
```bash
cd newbackend
npm install
cp .env.example .env   # Fill in your env values
npx prisma migrate deploy
npx prisma db seed     # Optional: seed casino games
npm run start:dev      # Starts on port 9828
```

**Useful backend scripts:**
```bash
npm run build           # Build TypeScript → dist/
npm run lint            # ESLint fix
npm run test            # Jest unit tests
npm run test:e2e        # End-to-end tests
npx prisma studio       # GUI for the PostgreSQL DB
```

### 3. Frontend (User Website) Setup
```bash
cd newwebsite
npm install
cp .env.example .env.local
npm run dev             # Starts on port 3000
```

### 4. Admin Panel Setup
```bash
cd newadmin
npm install
cp .env.example .env.local
npm run dev             # Starts on port 3010 (default Next.js port)
```

### 5. Rust Sports Sync Engine
```bash
cd sports-sync-rust
cargo build --release
./target/release/sports-sync-rust   # Runs continuously, syncing live odds
```

---

## 🌐 API Overview

All REST endpoints are prefixed with `/api`.

**Base URL (production):** `https://zeero.bet/api`

### CORS Allowed Origins
```
http://localhost:3000
http://localhost:3010
http://localhost:9827
https://zeero.bet
https://admin.zeero.bet
https://www.kuberexchange.com
https://admin.kuberexchange.com
```

### Core Endpoint Groups

| Module | Prefix | Description |
|--------|--------|-------------|
| Auth | `/api/auth` | Register, login, JWT refresh |
| Users | `/api/users` | Profile, KYC, balance, referral |
| Sports | `/api/sports` | Events, markets, odds, home/popular filtering |
| Bets | `/api/bets` | Place bets, open bets, history (MongoDB) |
| Casino | `/api/casino` | Game catalogue, launch URLs, wager/result callbacks |
| Transactions | `/api/transactions` | Deposit/withdrawal CRUD |
| Payment (UPI Razorpay) | `/api/payment0` | Zeero Pay UPI gateway |
| Payment (Manual) | `/api/payment` | Manual bank transfer deposit |
| Payment2 | `/api/payment2` | Secondary payment gateway |
| NOWPayments | `/api/nowpayments` | Crypto deposit via NOWPayments |
| Bonus | `/api/bonus` | Bonus templates, claim, wagering progress |
| Promotions | `/api/promotions` | Promo banners and content |
| Promo Cards | `/api/promo-card` | Homepage promo cards with game links |
| Referral | `/api/referral` | Referral code lookup, rewards |
| Agents | `/api/agents` | Agent/master hierarchy management |
| Settlement | `/api/settlement` | Bet settlement trigger & result matching |
| Finance | `/api/finance` | Revenue & P&L reporting |
| Analytics | `/api/analytics` | ClickHouse-powered event analytics |
| CRM | `/api/crm` | User engagement / CRM tools |
| Risk | `/api/risk` | Risk management flags |
| VIP | `/api/vip` | VIP application & tier management |
| Dashboard | `/api/dashboard` | Admin dashboard stats |
| Support | `/api/support` | Helpdesk tickets & live chat |
| Chat | `/api/chat` | In-app chat messages |
| Announcements | `/api/announcements` | Site-wide announcements |
| Upload | `/api/upload` | Image/file upload (serves from `/uploads/`) |
| Home Categories | `/api/home-category` | Homepage category CMS |
| Contact Settings | `/api/contact-settings` | Configurable contact info |
| Health | `/api/health` | Health check endpoint |

### WebSocket (Socket.IO)
- **Namespace:** default (`/`)
- **Port:** same as HTTP (`9828`)
- **Events:** Live odds broadcasts, market status updates, chat messages, bet confirmations
- **Gateway:** `src/events.gateway.ts`

---

## 🎮 User-Facing Website (`newwebsite`)

**Framework:** Next.js 16 (App Router), React 19, Tailwind CSS v4

### Key Pages / Routes
| Route | Description |
|-------|-------------|
| `/` | Homepage — promos, recent wins ticker, quick sports |
| `/casino` | Casino lobby — game categories and grid |
| `/casino/game/[provider]/[gameCode]` | Individual casino game (full-page iframe) |
| `/live-dealers` | Live dealer casino section |
| `/sports` | Sports betting interface with live odds |
| `/promotions` | Promotions / offers page |
| `/referral` | Referral program page |
| `/vip` | VIP tier benefits & application |
| `/profile/*` | User profile, deposits, withdrawals, bet history, transactions, KYC, bonus |
| `/support` | Help center & live chat |
| `/fairness` | Provably fair information |
| `/legal/*` | Terms of service, privacy policy, responsible gambling |
| `/auth` | Login / Registration modal |

### Key Libraries
| Library | Purpose |
|---------|---------|
| `framer-motion` | Page & component animations |
| `swiper` | Carousel / slider components |
| `socket.io-client` | Real-time WebSocket connection to backend |
| `react-hot-toast` | Toast notifications |
| `react-qr-code` | Crypto QR code display in deposit modal |
| `lucide-react` | Icon library |
| `axios` | HTTP client for API calls |

---

## 🛠️ Admin Panel (`newadmin`)

**Framework:** Next.js 16 (App Router), React 19, Tailwind CSS v4

**Default route:** `/dashboard`

### Admin Sections
| Section | Description |
|---------|-------------|
| Dashboard | Real-time KPIs — revenue, active users, deposits, bets |
| Users | View, search, ban, edit balance, view bet history per user |
| Bets → Casino | Casino bet logs across all users |
| Bets → Sports | Sports bet logs, settlement status |
| Transactions | Deposit / withdrawal approval queue |
| Finance | P&L, gross gaming revenue reports |
| CRM | User segmentation & manual messaging |
| Agents | Agent and master hierarchy tree |
| Bonus | Create / edit bonus templates, view per-user wagering |
| Promotions | Create / edit promotional banners |
| Promo Cards | Homepage promo card CMS with game attachment |
| Announcements | Create site-wide announcements |
| VIP | Review VIP applications (approve / reject) |
| Support | Respond to player support tickets |
| Home Categories | Manage homepage category cards |
| Contact Settings | Edit contact details shown to users |
| System Config | Runtime config key-value store |
| Analytics | Charts (Recharts) for user activity |
| Risk | Flag / monitor high-risk accounts |

### Admin Key Libraries
| Library | Purpose |
|---------|---------|
| `recharts` | Admin dashboard charts |
| `socket.io-client` | Real-time admin updates |
| `jose` | JWT decode/verify in middleware |
| `@prisma/client` | Direct DB access for server actions |
| `bcryptjs` | Admin password hashing |

---

## 💳 Payment Gateways

### 1. Payment0 — Zeero Pay (UPI via Razorpay)
- **Bridge:** `anyleson-pay-php/` — PHP script hosted on `anyleson.com`
- **Flow:**
  1. User initiates deposit → backend creates order
  2. Frontend redirects to PHP bridge on anyleson.com
  3. User completes Razorpay UPI payment
  4. PHP bridge signs callback with HMAC-SHA256 using `webhook_secret`
  5. Callback POSTs to `https://zeero.bet/api/payment0/callback`
  6. Backend verifies signature → credits user balance
- **Files:** `anyleson-pay-php/index.php`, `callback.php`, `config.php`

### 2. Payment — Manual Bank Transfer
- Admin approves manually uploaded transaction proofs
- Module: `src/payment/`

### 3. NOWPayments — Crypto Deposits
- Integration via [NOWPayments API](https://nowpayments.io)
- Funds crypto wallet (`cryptoBalance` field on User)
- IPN webhook verification
- Module: `src/nowpayments/`

### 4. Payment2 — Secondary Gateway
- Module: `src/payment2/` (configurable secondary payment processor)

---

## 🏏 Sports Betting Architecture

### Diamond API Integration
- Provider: Diamond Exchange (D247 / Sky Exchange / Betfair)
- Data fetched: Events list, in-play matches, match odds, bookmaker odds, fancy bets
- **Rust Sync Engine** (`sports-sync-rust`) polls Diamond API continuously and writes to MongoDB

### Bet Settlement
- Module: `src/settlement/settlement.service.ts`
- Matches settled bet results to open bets using fuzzy + strict team matching
- Fancy bets: Settled based on run lines (e.g., "Total Runs Over/Under")
- Cascading profit sharing through MASTER → AGENT → USER hierarchy via `partnershipSettings`
- Odds hiding: Admin can lock specific event markets per-user via `EventLock` table

### Sports Data Flow
```
Diamond API → [Rust Sync Engine] → MongoDB
                                        ↓
                          NestJS SportsModule reads events
                                        ↓
                    WebSocket (Socket.IO) broadcasts live odds
                                        ↓
                        newwebsite frontend renders live odds
```

---

## 🎰 Casino Architecture

- **Provider-based routing:** `/casino/game/[provider]/[gameCode]`
- Casino games stored in MongoDB (seeded from WCO Games List CSV)
- **Wallet callbacks:** Provider calls backend `/api/casino/debit`, `/api/casino/credit`, `/api/casino/refund`
- Transactions stored in PostgreSQL `CasinoTransaction` table
- Images served from `/api/uploads/` (static file serving via NestJS `ServeStaticModule`)

---

## 🤝 Referral System

- Each user gets a unique `referralCode` on registration
- Referral rewards defined in `ReferralReward` table (trigger types: SIGNUP, DEPOSIT_FIRST, DEPOSIT_RECURRING, BET_VOLUME)
- Reward types: FIXED amount or PERCENTAGE of triggered amount
- History tracked in `ReferralHistory` table

---

## 🎁 Bonus System

- Bonus templates stored in MongoDB (`BonusModule`)
- Four bonus scopes: **Casino**, **Sports**, **Crypto** (triggered by crypto deposit), **INR** (triggered by fiat deposit)
- User claims bonus via promo code at deposit time
- Per-user wagering tracked in PostgreSQL `UserBonus` table
- `wageringRequired = bonusAmount × wageringMultiplier`; credits main wallet once fulfilled
- Active wallet selection (`fiat` | `crypto`) persisted on `User.activeWallet`

---

## 🧑‍💼 Agent Hierarchy

The platform supports a **4-level hierarchy:**

```
MANAGER
  └── MASTER
        └── AGENT
              └── USER
```

- Each user can be assigned to an `agentId`, `masterId`, `managerId`
- `partnershipSettings` JSON field stores per-sport profit share percentages
- Settlement service cascades winnings/losses up the hierarchy

---

## 🚢 Deployment

### Server Requirements
- Ubuntu/Debian VPS
- Node.js 20+, Rust, PM2
- PostgreSQL 15, MongoDB, Redis (can be separate servers)
- Nginx (reverse proxy — routes `/api` to port 9828, `/` to port 3000, admin subdomain to 3010)

### PM2 Production Startup (in order)

```bash
# 1. Rust sync engine (live sports data)
cd /var/www/adxwin/sports-sync-rust
cargo build --release
pm2 start ./target/release/sports-sync-rust --name "rust-sync"

# 2. NestJS Backend
cd /var/www/adxwin/newbackend
npm install && npm run build
pm2 start dist/main.js --name "newbackend"

# 3. Admin Panel
cd /var/www/adxwin/newadmin
npm install && npm run build
pm2 start npm --name "newadmin" -- start

# 4. User Website
cd /var/www/adxwin/newwebsite
npm install && npm run build
pm2 start npm --name "newwebsite" -- start

# Save & enable auto-restart on reboot
pm2 save
pm2 startup
```

### Deploy Scripts

#### Deploy Frontend Only
```bash
./deploy_web.sh <SERVER_IP>
```
- Builds `newwebsite` locally, zips `.next` + `public` + config files
- SCPs to server via SSH key at `~/Downloads/zoru`
- Extracts and reloads PM2 `newwebsite` process

#### Restore PostgreSQL Database
```bash
./deploy_db.sh <SERVER_IP>
```
- Uploads `backup.dump` to server
- Runs `pg_restore --clean --if-exists` against the remote DB
- Credentials: user `zoru`, DB `adxwin_db`

#### Create Local DB Backup
```bash
PGPASSWORD='...' pg_dump -U zoru -d adxwin_db -F c -f backup.dump
```

---

## 🔒 Security

- **Authentication:** JWT (access token) via `@nestjs/jwt` + Passport
- **Global guard:** `JwtAuthGuard` applied to all routes by default; public routes decorated with `@Public()`
- **Password hashing:** bcrypt (rounds: 10+)
- **Input validation:** NestJS `ValidationPipe` with `whitelist: true` (strips unknown fields)
- **CORS:** Explicit allowlist of origins (no wildcard in production)
- **Payment webhook security:** HMAC-SHA256 signature verification using shared `webhook_secret`
- **Admin JWT:** `jose` library used in Next.js admin middleware for server-side edge auth

---

## 🗂️ Key Scripts & Utilities

| Script | Purpose |
|--------|---------|
| `newbackend/scripts/` | 46 utility scripts — seeding, migration helpers, data transforms |
| `newbackend/prisma/seed.ts` | Seed base system config and admin user |
| `newbackend/prisma/seed-casino.ts` | Seed casino games from CSV to PostgreSQL |
| `newbackend/prisma/seed-mongo-casino.ts` | Seed casino games to MongoDB |
| `newbackend/clean-images.js` | Remove orphaned uploaded images |
| `dynamic_scraper.js` | Score scraping utility |
| `scrape_score.js / .py` | Alternative score scrapers |
| `test_mongo_bookmaker.js` | Test MongoDB bookmaker data connection |
| `remove_api.sh` / `remove_api_pt2.sh` / `remove_api_pt3.sh` | Batch remove deprecated API routes |

---

## 🧪 Testing

```bash
# Unit tests
cd newbackend
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# End-to-end
npm run test:e2e
```

Test files follow the pattern `*.spec.ts` and live alongside source files in `src/`.

---

## 📦 Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Backend framework | NestJS 11 (TypeScript) |
| Frontend framework | Next.js 16 + React 19 |
| Styling | Tailwind CSS v4 |
| Relational DB | PostgreSQL 15 + Prisma ORM |
| Document DB | MongoDB + Mongoose |
| Cache / PubSub | Redis 7 + ioredis |
| Real-time | Socket.IO (WebSockets) |
| Scheduler | `@nestjs/schedule` (cron jobs) |
| Analytics DB | ClickHouse |
| Auth | JWT + Passport.js + bcrypt |
| Crypto payments | NOWPayments |
| UPI payments | Razorpay via PHP bridge |
| Sports data | Diamond API (D247/Sky Exchange) |
| Sync engine | Rust |
| Process manager | PM2 |
| Container (dev) | Docker Compose |
| HTTP client | Axios |
| Animations | Framer Motion |
| Charts | Recharts (admin) |
| Icons | Lucide React |

---

## 📞 Contact & Brands

| Brand | Domain |
|-------|--------|
| Zeero Bet | https://zeero.bet |
| Zeero Admin | https://admin.zeero.bet |
| Kuber Exchange | https://www.kuberexchange.com |
| Kuber Admin | https://admin.kuberexchange.com |

---

> **Note:** This is a private, proprietary codebase. All credentials in config files must be rotated before open-sourcing or sharing externally.
# odd69
