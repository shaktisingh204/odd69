# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Monorepo for the ADXWin gaming platform (brands: `zeero.bet`, `kuberexchange.com`). The four primary sub-projects each have their own `package.json` / build and should be treated as independent apps:

| Path | Stack | Role | Port |
|---|---|---|---|
| `newbackend/` | NestJS 11 + Prisma + Mongoose | REST API + Socket.IO gateway | 9828 |
| `newwebsite/` | Next.js 16 (App Router), React 19, Tailwind v4 | Player site | 3000 |
| `newadmin/` | Next.js 16, React 19, Tailwind v4 | Admin panel | 3010 |
| `sports-sync-rust/` | Rust (tokio) | Sportradar sync daemon: writes catalogue + events + live odds to Redis + MongoDB the NestJS backend reads from | — |

Additional: `anyleson-pay-php/` (hosted externally) is the Razorpay UPI bridge for `payment0`. `mobileapp/` is a React Native client. Top-level shell scripts (`deploy_web.sh`, `deploy_db.sh`, `remove_api*.sh`) are operational helpers. `scripts/`, `newbackend/scripts/`, and `newbackend/src/scripts/` contain one-off data-repair / backfill utilities — read them before re-running, several are destructive.

## Common Commands

### Backend (`newbackend/`)
```bash
npm run start:dev       # nest start --watch  (dev on port 9828)
npm run build           # tsc → dist/
npm run start:prod      # node dist/main
npm run lint            # eslint --fix
npm run test            # jest (unit, *.spec.ts under src/)
npm run test:e2e        # jest with test/jest-e2e.json
npm run test -- path/to/file.spec.ts   # single test file
npm run migrate         # prisma migrate deploy
npm run db:push         # prisma db push (dev only)
npx prisma studio       # GUI for the Postgres schema
npx prisma generate     # regen @prisma/client after schema.prisma edits
```
Repair/backfill scripts are exposed as npm scripts (`backfill:*`, `repair:*`). The `:force` variants take `--apply --allow-negative` — they mutate production data, never run unless explicitly asked.

### Website & Admin
```bash
cd newwebsite && npm run dev         # port 3000
cd newadmin   && npm run dev         # Next default (use `npm start` for 3010)
npm run build && npm start           # production build in either
npm run lint
```

### Rust sports sync
```bash
cd sports-sync-rust && cargo build --release
./target/release/sports-sync-rust
```

## Architecture Notes (things that require reading multiple files)

### Dual-database split
PostgreSQL (via **Prisma**, schema in `newbackend/prisma/schema.prisma`) is the source of truth for **users, wallets, transactions, casino ledger, bonuses, agent hierarchy, KYC, referrals, audit logs, system config**. MongoDB (via **Mongoose**, models under `newbackend/src/**/entities|schemas`) holds **sports events / odds, placed sports bets, casino game catalogue, chat, announcements, promos, bonus templates**. Many features touch both — e.g. a sports bet writes the bet doc to Mongo but debits the Postgres wallet and writes a Postgres transaction in the same request. When modifying bet/settlement/bonus flows, trace both DBs.

A **ClickHouse** client (`@clickhouse/client`) backs `AnalyticsModule` for event/bet analytics queries — not used for OLTP.

**Redis** (ioredis) handles session/rate-limit caching, odds caching, and pub/sub that fans Socket.IO broadcasts across backend instances.

### Bootstrap & global conventions (`newbackend/src/main.ts`, `app.module.ts`)
- Global API prefix `/api` is set in `main.ts`. All controller paths in code are written **without** `/api`.
- Global `ValidationPipe({ whitelist: true, transform: true })` — DTOs silently drop unknown fields; rely on `class-validator` decorators.
- CORS origin list is hard-coded in `main.ts`; add new domains there, not via env.
- Static uploads are served by `ServeStaticModule` from `newbackend/uploads/` at `/api/uploads/*`.
- Security headers (`X-Frame-Options: DENY`, etc.) are set globally; endpoints that must be iframe-embeddable (e.g. sports `/stream-proxy`, `/embed`) override them per-handler.
- Auth uses JWT + Passport with a **global `JwtAuthGuard`**; public endpoints must be marked `@Public()`. Admin-only endpoints use a separate admin middleware (see `newadmin` + backend admin guard).

### Real-time (`events.gateway.ts`)
Single Socket.IO gateway on the same HTTP port (9828, default namespace). It broadcasts live odds, market status, chat, and bet confirmations. Odds updates originate from the Rust syncer writing to Mongo; backend reads and fans out via Redis pub/sub.

### Sports data pipeline
`sports-sync-rust` polls **Sportradar** (two upstream hosts, round-robin, rate-limited) and writes the catalogue + events + live odds into the **shared Redis + MongoDB** the NestJS backend reads from. Five concurrent loops: sports catalogue, full events catalogue, upcoming, inplay, and live-odds (`/list-market` every ~222 ms). Redis writes are mirrored to a dedicated proxy Redis when `PROXY_REDIS_HOST`/`PROXY_REDIS_URL` is set, so `sportradar-proxy` reads stay isolated from primary application traffic. NestJS reads from these same keys via `newbackend/src/sports/sportradar.service.ts` and serves them through `newbackend/src/sportradar-proxy/`. On every live-odds change the Rust daemon publishes `{eventId, sportId}` on the Redis pub/sub channel `sportradar:live-update`; `SportradarPubsubService` (in `newbackend/src/sports/sportradar-pubsub.service.ts`) subscribes to it and re-emits the existing `sports-match-data`/`sports-lobby-data`/`socket-data` Socket.IO payloads, so the front-end contract is unchanged. The legacy in-process NestJS sync is still present but gated behind `SPORTRADAR_SYNC_DISABLED=true` — set this in prod so only one writer polls upstream. `EventLock` (Postgres) lets admins hide specific markets for specific users — always consult it when returning odds or accepting bets.

### Bet settlement (`newbackend/src/settlement/`)
`settlement.service.ts` matches results to open bets using fuzzy + strict team matching and settles fancy bets via run-line logic. Profit / loss cascades up the **MANAGER → MASTER → AGENT → USER** hierarchy using the `partnershipSettings` JSON on `User`. Any change here affects both the Postgres wallet ledger and the Mongo bet documents — keep them consistent.

### Wallets & bonuses
`User` holds `balance` (fiat), `cryptoBalance`, a separate bonus wallet, and `activeWallet` (`fiat` | `crypto`). Bonus templates live in Mongo; per-user wagering progress lives in Postgres `UserBonus` (`ACTIVE|COMPLETED|FORFEITED|EXPIRED`). `wageringRequired = bonusAmount × wageringMultiplier`; bonus balance converts to main wallet only when fulfilled. Bonus scopes: **Casino, Sports, Crypto, INR**. Multiple `repair:*` / `backfill:*` scripts exist because wallet ledgers have been reconstructed historically — prefer fixing the root cause over re-running them.

### Payment modules
There are many payment modules (`payment`, `payment0`…`payment6`, `nowpayments`, `manual-deposit`) because new gateways are added alongside old ones rather than replacing them. `payment0` specifically is the **Zeero Pay** flow via the external PHP bridge in `anyleson-pay-php/`; its callback is HMAC-SHA256 signed with `PAYMENT0_WEBHOOK_SECRET`, which must match `config.php` on anyleson.com. NOWPayments handles crypto and credits `cryptoBalance`. When wiring a new gateway, copy the structure of an existing `paymentN` module and reuse the webhook-signature helper.

### Casino integration
Provider-based routing on the frontend (`/casino/game/[provider]/[gameCode]`). Providers call backend wallet callbacks (`/api/casino/debit|credit|refund`) which write `CasinoTransaction` rows in Postgres. The game catalogue is seeded from `WCO - Games List(Games List).csv` via `prisma/seed-casino.ts` and `prisma/seed-mongo-casino.ts`.

### Admin panel specifics
`newadmin` uses Next.js middleware with `jose` for edge-side JWT verification and can talk to Postgres directly through `@prisma/client` for server actions — it does not always go through the NestJS API. When changing admin auth or DB access, check both the middleware and any server action routes.

## Env Files
Each sub-project has its own `.env` (not `.env.example` in all cases). Key vars: `DATABASE_URL`, `MONGO_URI`, `REDIS_HOST/PORT`, `JWT_SECRET`, `PAYMENT0_WEBHOOK_SECRET`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `DIAMOND_API_URL`, `DIAMOND_API_TOKEN`, `PORT`. Frontends use `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`.

## Deployment
PM2 runs four processes on the production VPS in this order: `rust-sync` → `newbackend` (`dist/main.js`) → `newadmin` → `newwebsite`. Nginx fronts everything and routes `/api` to 9828, root to 3000, and the admin subdomain to 3010. `deploy_web.sh <IP>` builds `newwebsite` locally, rsyncs `.next`/`public`/config to the server, and `pm2 reload`s. `deploy_db.sh <IP>` restores `backup.dump` with `pg_restore --clean --if-exists` against `adxwin_db` (user `zoru`) — destructive, confirm before running.
