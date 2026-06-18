# sports-sync-rust

Standalone Rust daemon that polls the Sportradar upstream API and populates
the same Redis + MongoDB stores the NestJS backend reads from. Replaces the
in-process sync loops in `newbackend/src/sports/sportradar.service.ts` —
the proxy controller at `newbackend/src/sportradar-proxy/` is **not**
replaced and continues to serve reads over HTTP.

## What it owns

Five concurrent loops:

| Loop      | Default interval | Writes                                                              |
|-----------|------------------|---------------------------------------------------------------------|
| sports    | 180s             | `sportradar:sports`; upserts `betfair_sports`                       |
| events    | 90s              | `sportradar:events:{sportId}` + per-event keys; upserts `betfair_events` and `betfair_markets` |
| upcoming  | 30s              | `sportradar:upcoming:{sportId}` + `:all`                            |
| inplay    | 5s               | `sportradar:inplay:{sportId}` + `:all` + per-event score updates    |
| live-odds | 222ms            | `sportradar:market:{eventId}` + per-event enriched cache            |

All writes are mirrored to a proxy Redis when `PROXY_REDIS_HOST`/`PROXY_REDIS_URL`
is set (matching the NestJS dual-Redis behaviour).

On every change the live-odds loop also publishes a tiny
`{eventId, sportId}` notification on the Redis pub/sub channel
**`sportradar:live-update`**. The NestJS `SportradarPubsubService`
(in `newbackend/src/sports/sportradar-pubsub.service.ts`) subscribes to that
channel, re-reads the canonical body from Redis, and emits the same
Socket.IO payloads the in-process syncer used to send — so the front-end
contract stays unchanged when the kill switch flips.

## Required env

```
SPORTRADAR_HOST_PRIMARY=http://62.72.41.209:8087
SPORTRADAR_HOST_SECONDARY=http://local.turnkeyxgaming.com:8087
SPORTRADAR_API_KEY=...

# Primary Redis (sportradar:* + sr:cache:* writes)
REDIS_URL=redis://:password@127.0.0.1:6379/0
# or component form:
# REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB

# Optional dedicated proxy Redis. When set (and different from primary),
# every sportradar:* write is fanned out here too.
PROXY_REDIS_URL=redis://:password@host:6379/0

# MongoDB — same DB the NestJS backend uses.
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB=adxwin
```

Optional tuning:

```
SPORTRADAR_RPS_PER_HOST=300         # per-host rate ceiling
SPORTRADAR_BG_RPS=150               # background concurrency cap
SPORTRADAR_MAX_LIVE_CALLS_PER_TICK=130
SPORTRADAR_REQ_CACHE_TTL_MS=222
SPORTS_SYNC_INTERVAL_SECS=180
EVENTS_SYNC_INTERVAL_SECS=90
INPLAY_SYNC_INTERVAL_SECS=5
UPCOMING_SYNC_INTERVAL_SECS=30
LIVE_ODDS_TICK_MS=222
SPORTRADAR_SPORTS_TTL=600           # Redis TTLs ≥ 3× sync interval to absorb hiccups
SPORTRADAR_EVENTS_TTL=600
SPORTRADAR_UPCOMING_TTL=300
SPORTRADAR_INPLAY_TTL=60
RUST_LOG=info,sports_sync_rust=info
```

## Build + run

```bash
cd sports-sync-rust
cargo build --release
./target/release/sports-sync-rust
# or under PM2:
pm2 start ecosystem.config.js
```

## Cutover

1. Deploy the binary on the writer VPS and start it under PM2.
2. Wait one full sync cycle (~3 min) and verify reads through
   `/api/sportradar-proxy/sports`, `/inplay`, `/upcoming` etc. return data.
3. Set `SPORTRADAR_SYNC_DISABLED=true` in the NestJS environment and reload
   `newbackend`. NestJS keeps serving reads but stops polling upstream.
4. To roll back, unset `SPORTRADAR_SYNC_DISABLED` and reload — NestJS resumes
   polling immediately.
