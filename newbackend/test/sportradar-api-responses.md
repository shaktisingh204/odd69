# Sportradar API — Endpoint Responses

Reference file capturing real response samples from the Sportradar integration
used by `newbackend/src/sports/sportradar.service.ts`.

## Connection

| Field | Value |
| --- | --- |
| Primary host | `http://62.72.41.209:8087` (env `SPORTRADAR_HOST_PRIMARY`) |
| Secondary host | `http://local.turnkeyxgaming.com:8087` (env `SPORTRADAR_HOST_SECONDARY`) |
| Base path | `/api/v1/sportsradar` |
| Auth header | `x-betnex-key: <SPORTRADAR_API_KEY>` |
| Timeout | 8000 ms |
| Strategy | `Promise.any` across both hosts (fastest wins), 222 ms Redis read-through |

All calls funnel through the private helper `apiGet()` at
`newbackend/src/sports/sportradar.service.ts:463`.

---

## 1. `GET /allsports`

- **Caller:** `fetchAllSportsFromApi()` — sportradar.service.ts:513
- **Params:** _(none)_
- **Used for:** Seeding `betfair_sports` collection every ~3 min.

### Sample response
```json
// paste response here
```

---

## 2. `GET /events-catalogue`

- **Caller:** `fetchEventsPage(sportId, pageNo)` — sportradar.service.ts:624
- **Params:**
  - `sportId` — e.g. `sr:sport:21`
  - `pageNo` — 1-indexed, page size 100
- **Used for:** Full events sync (upcoming + live merged), background loop every ~1 min.

### Sample response
```json
// paste response here
```

---

## 3. `GET /inplay-events`

- **Caller:** `fetchInplayEventsPage(sportId, pageNo)` — sportradar.service.ts:681
- **Params:**
  - `sportId`
  - `pageNo`
- **Used for:** Live scores + `status: IN_PLAY`, 30 s refresh, Redis TTL 2 s.

### Sample response
```json
// paste response here
```

---

## 4. `GET /upcoming-events`

- **Caller:** `fetchUpcomingEventsPage(sportId, pageNo)` — sportradar.service.ts:795
- **Params:**
  - `sportId`
  - `pageNo`
- **Used for:** `status: UPCOMING` events, Redis TTL ~180 s.

### Sample response
```json
// paste response here
```

---

## 5. `GET /list-market`

- **Caller:** `fetchListMarket(sportId, eventId)` — sportradar.service.ts:1377
- **Params:**
  - `sportId`
  - `eventId` — e.g. `sr:match:67698056`
- **Used for:** Full market detail for a single event (matchOdds, bookmakers, fancy, premium). Powers live odds polling loop.

### Sample response
```json
// paste response here
```

> ⚠️ **Naming note** — `list-market` is called in two distinct modes:
> - Live odds polling loop (`liveOddsTick`) — every 222 ms per live event.
> - On-demand from match page via `getListMarket()` (sportradar.service.ts:1535).

---

## 6. `GET /market-result`

- **Caller:** `getMarketResult(sportId, eventId)` — sportradar.service.ts:1438
- **Params:**
  - `sportId`
  - `eventId`
- **Used for:** Settlement — reads `runners[].result` (`'won' | 'lost' | ''`) and `marketStatus` (`OPEN | SETTLED | SUSPENDED`). Matched against bets via `srMarketFullId` + `srRunnerId`.

### Sample response
```json
// paste response here
```

---

# Research — Current Implementation

Source: `newbackend/src/sports/sportradar.service.ts` (1591 lines).
Note: the `x-betnex-key` header and the `/api/v1/sportsradar` path on the two
hosts indicate this is a **Betnex / TurnkeyXGaming proxy in front of
Sportradar**, not Sportradar's native `api.sportradar.com` endpoints. All six
endpoints return a top-level `{ success, message, status, errorDescription, … }`
envelope.

## Architecture map

```
                        ┌─────────────────────────────────┐
                        │  SportradarService.onModuleInit │
                        └────────────┬────────────────────┘
                                     │
         ┌───────────────────────────┼────────────────────────────┐
         │                           │                            │
         ▼                           ▼                            ▼
  seedSportsFromApi          syncAllSportsEvents          startLiveOddsLoop
  (every 200 s)              + syncAllInplayEvents        (every 222 ms)
                             + syncAllUpcomingEvents            │
                             (every 222 ms, parallel)           │
                             service.ts:254                liveOddsTick:
                                    │                      reads inplay:all,
                                    ▼                      fires list-market
                            throttledParallel()           per live event, diff-
                           (rps=150, 222 ms pacing)       broadcasts via Events
                                                          Gateway / SportsGateway
```

### Redis key inventory

| Key | TTL | Producer | Consumer |
| --- | --- | --- | --- |
| `sportradar:sports` | 180 s | `getSportsFromCache` | sports list API |
| `sportradar:events:{sportId}` | 180 s | `syncEventsForSport` | `getEventsBySport`, `getAllEventsGrouped` |
| `sportradar:event:{eventId}` | 2 s (live) / 180 s (upcoming) | `syncEventsForSport`, `syncAllInplayEvents`, `getListMarket` | `getEventById` |
| `sportradar:odds:{eventId}` | same | `syncEventsForSport`, `syncAllInplayEvents` | `getOddsByEventId` |
| `sportradar:inplay:{sportId}` | 2 s | `syncAllInplayEvents` | `getInplayEventsBySport` |
| `sportradar:inplay:all` | 2 s | `syncAllInplayEvents` | `liveOddsTick`, lobby |
| `sportradar:upcoming:{sportId}` | 180 s | `syncAllUpcomingEvents` | `getUpcomingEventsBySport` |
| `sportradar:upcoming:all` | 180 s | `syncAllUpcomingEvents` | lobby |
| `sportradar:market:{eventId}` | 2 s | `liveOddsTick`, `getListMarket` | `getListMarket` |
| `sportradar:market-result:{eventId}` | 180 s | `getMarketResult` | `getMarketResult`, `getRawMarketResult` |
| `sr:cache:{path}:{qs}` | 222 **ms** | `apiGet` | `apiGet` |

## Rate-budget reality check

Claimed (sportradar.service.ts:140–150): 300 req/s self-limit, 100/s live,
50/s background, 150/s spare. Observed from the code:

- `MAX_LIVE_CALLS_PER_TICK = 150` at a 222 ms tick → **up to ~675 live calls/s**.
- Background loop at sportradar.service.ts:254 fires **three syncs every 222 ms**
  (`syncAllSportsEvents + syncAllInplayEvents + syncAllUpcomingEvents`),
  re-entrancy guarded only for `syncAllSportsEvents` via `isSyncingEvents`.
  `syncAllInplayEvents` and `syncAllUpcomingEvents` have **no guard** and can
  stampede if the previous invocation hasn't completed.
- `throttledParallel(rps)` sleeps 222 ms between batches of `rps` items, so
  its effective rate is `rps / 0.222 ≈ 4.5 × rps`, not `rps/s`. With default
  `rps = 150`, the actual throughput ceiling is ~675 req/s per batch window.

**Gap:** stated budget and actual emission rate are inconsistent. We need to
either (a) re-measure the true rate the Betnex proxy accepts and pin the
constants, or (b) fix `throttledParallel` to honour a genuine per-second
budget.

## Identified gaps and bugs

### Correctness / behaviour

1. **`apiGet` cache TTL comments are wrong.**
   sportradar.service.ts:497–499: comment says "500ms TTL", code writes
   `'PX', 222`. Docblock at L461 says "2s Redis cache". Actual TTL is
   **222 ms**. Misleads debugging.

2. **`getRawMarketResult` is *not* cache-bypassing.**
   sportradar.service.ts:1484 — docstring says *"direct API call, no cache.
   Use this in the settlement worker to always get fresh data."* But the
   implementation calls `getMarketResult()`, which reads a **180 s Redis
   cache** (L1440, `MARKET_RESULT_TTL = SPORTS_CACHE_TTL_SECONDS = 180`).
   **Impact:** settlement worker can settle bets against stale results for
   up to 3 minutes. High-risk bug.
   Fix: add an options flag and pass `bypassCache: true` through to `apiGet`.

3. **`syncAllInplayEvents` / `syncAllUpcomingEvents` have no re-entrancy guard.**
   `isSyncingEvents` protects only `syncAllSportsEvents`. The 222 ms loop
   will overlap inplay/upcoming syncs when upstream is slow, multiplying
   outstanding HTTP calls under stress.

4. **`liveOddsTick` chunking is dead code.**
   sportradar.service.ts:297 splits live events into chunks of
   `MAX_LIVE_CALLS_PER_TICK` (150), then breaks out of the outer loop the
   moment `callsThisTick >= 150` — which is after the first chunk. Either
   drop the chunking, or recompute the cap per chunk to genuinely pace
   calls across the tick.

5. **`SORT_ORDER` is a hard allowlist (16 sports).**
   sportradar.service.ts:113 — `syncAllInplayEvents`, `syncAllUpcomingEvents`,
   `getEventsCount`, `liveOddsTick`, `getEventById`, `getAllEventsGrouped`
   all iterate `Object.keys(SORT_ORDER)`. Any sport not on this list never
   appears in caches even if `/allsports` returns it as ACTIVE and
   `seedSportsFromApi` inserts it into Mongo.
   Fix: drive loops from `betfair_sports` collection; use `SORT_ORDER`
   only for sort rank.

6. **Inplay Redis TTL = 2 s, background sync interval = 222 ms.**
   If inplay sync fails for 2 s (one network blip, one Betnex 5xx burst)
   `sportradar:inplay:all` evicts and `liveOddsTick` goes dark until the
   next successful sync. Consider TTL ≥ 5× sync interval.

7. **`premiumTopic` / WebSocket stream ignored.**
   The API response carries `premiumTopic`, `premiumBaseUrl`,
   `premiumProvider` per event (schema at L86–89) — these advertise a push
   channel for premium odds. The implementation polls `list-market` every
   222 ms instead. Likely significant bandwidth / latency win available by
   subscribing to the provided WS topic.

8. **Promise.any error details lost.**
   When both hosts fail, the `AggregateError` bubbles up but the per-host
   status/body is never logged. Debugging upstream outages requires
   per-host error logging.

9. **No retry / no circuit breaker.**
   `apiGet` has a single 8 s timeout per host and no retry. Transient 5xx
   on both hosts immediately fails the caller with no back-off.

### Security

10. **Hardcoded API key fallback.**
    sportradar.service.ts:163 —
    `process.env.SPORTRADAR_API_KEY || '67f1a9c2d4e8b1a3c9f05673'`.
    This literal secret is committed to the repo. Remove the fallback, fail
    fast if the env var is missing, and rotate the key at Betnex.

11. **Hardcoded host fallbacks over plain HTTP.**
    sportradar.service.ts:157–160 — `http://62.72.41.209:8087` and
    `http://local.turnkeyxgaming.com:8087`. Plain HTTP over the public
    internet: the `x-betnex-key` header traverses the wire in cleartext.

### Observability

12. **No metrics.** No per-host success / latency counters. We can't tell
    which host is winning `Promise.any` races or when one host silently
    degrades.
13. **Many `try { } catch (_) {}` / `catch { /* ignore */ }` blocks** swallow
    errors — 20+ in this file, concentrated in Redis fallbacks. At least a
    `debug` log line would save hours next outage.
14. **No structured error codes from upstream.** When `body.success === false`
    the wrapper's `message` / `errorDescription` is stringified but distinct
    error classes (auth fail, rate limit, no-data) aren't mapped.

### DX / maintainability

15. **Comment drift.** Several docblocks describe older behaviour:
    - L461 "2s Redis cache" — wrong (222 ms)
    - L498 "500ms TTL" — wrong (222 ms)
    - L1484 "no cache" — wrong (hits 180 s cache)
    - L1412 "5s TTL" — wrong (`MARKET_RESULT_TTL = 180`)

16. **Magic numbers everywhere.** `PAGE_SIZE`, TTLs, tick intervals, budgets
    — all hand-tuned literals. Pull into a single `SportradarConfig` object
    or env vars so tuning doesn't require a code edit.

17. **Mixed model naming.** Sportradar data is written into `betfair_sports`,
    `betfair_events`, `betfair_markets` collections. Historical, but
    confusing for anyone grepping for "sportradar".

## Open questions (to answer with the real responses you paste above)

- Does `/list-market` return a distinct `premiumMarkets[]` shape vs the
  `matchOdds[]` inside `/events-catalogue`? Are market IDs the same?
- `/market-result` — are `runnerId` values stable against the `runnerId`
  values returned by `/list-market`, so settlement can key on
  `(marketId, runnerId)` directly?
- Does `/inplay-events` ever return events that `/events-catalogue` doesn't?
  If yes, we must union them — currently `syncEventsForSport` alone
  populates `sportradar:event:{eventId}` for the match-detail page.
- What is the real pagination size? Code assumes `PAGE_SIZE = 100` as "API
  default" — needs confirmation.
- What HTTP status codes does the upstream return for rate-limit vs
  auth-fail vs not-found? Currently all non-2xx collapse into a generic
  error.

## Fix plan (priority order, once responses are confirmed)

1. **P0 — Settlement freshness.** Make `getRawMarketResult` actually bypass
   cache.
2. **P0 — Secret hygiene.** Remove hardcoded API key, require env var,
   rotate credential.
3. **P1 — Re-entrancy.** Add guards to `syncAllInplayEvents` and
   `syncAllUpcomingEvents`, or move to a single orchestrator loop.
4. **P1 — Dynamic sport list.** Drive loops from `betfair_sports` instead
   of the `SORT_ORDER` constant.
5. **P1 — TTL vs interval mismatch.** Raise inplay TTL to ≥ 5× sync interval.
6. **P2 — Premium WS.** Prototype subscribing to `premiumTopic` and compare
   latency / cost against 222 ms polling.
7. **P2 — Retry + observability.** Thin axios interceptor for retry,
   per-host latency metrics, `AggregateError` unwrapping.
8. **P2 — Doc / comment pass.** Fix all drifted TTL comments.
9. **P3 — Config object.** Pull magic numbers into a typed config.

---

# Cross-folder Audit — `newbackend/` + `newadmin/` + `newwebsite/`

This section captures everything the three folders actually do with
Sportradar data. It's meant to be the single reference for the fix-plan
work — **read this before touching any SR-adjacent file.**

## TL;DR — the single most important finding

**There are TWO completely separate Sportradar integrations in this repo, and
they don't know about each other:**

| Integration | Host | Auth | Where |
| --- | --- | --- | --- |
| **A — Betnex proxy** (primary live odds + inplay + catalog) | `http://62.72.41.209:8087` / `http://local.turnkeyxgaming.com:8087` | `x-betnex-key` header, env `SPORTRADAR_API_KEY`, hardcoded fallback `67f1a9c2d4e8b1a3c9f05673` | `newbackend/src/sports/sportradar.service.ts:157-164` |
| **B — RapidAPI** (admin-panel settlement only) | `https://sportradar-api.p.rapidapi.com` | `X-RapidAPI-Key` header, env `SPORTS_API_KEY`, hardcoded fallback `6a9d10424b039000ab1caa11` | `newadmin/src/actions/internal-sportradar-settlement.ts:67-75`, `newadmin/src/actions/internal-match-odds-settlement.ts:75-85` |

The **website** shows live odds from integration A (through the backend).
The **admin** settles bets from integration B (direct from admin server
actions, skipping the backend entirely). Both mutate the *same* `bets` /
`users` / `transactions` tables. Any shape drift between the two providers
will silently corrupt settlement.

**Add to the P0 fix list:** decide which integration is canonical and
route the other through it, or at minimum assert that the two providers
return compatible `marketId` / `runnerId` / `result` shapes.

---

## newbackend — full file inventory

### HTTP routes (all mounted in `newbackend/src/sports/sports.controller.ts`)

| Route | Method | Auth | Handler | Purpose |
| --- | --- | --- | --- | --- |
| `/sports/sportradar/sports` | GET | public | sports.controller.ts:510 | Cached sports list |
| `/sports/sportradar/events` | GET | public | sports.controller.ts:520 | Events for one sport |
| `/sports/sportradar/events/all` | GET | public | sports.controller.ts:533 | All sports events grouped |
| `/sports/sportradar/event` | GET | public | sports.controller.ts:546 | Full raw event from Redis |
| `/sports/sportradar/odds` | GET | public | sports.controller.ts:561 | Markets blob for one event |
| `/sports/sportradar/events-count` | GET | public | sports.controller.ts:576 | Per-sport counts (upcoming + inplay) |
| `/sports/sportradar/inplay` | GET | public | sports.controller.ts:588 | All inplay events (all sports) |
| `/sports/sportradar/inplay/:sportId` | GET | public | sports.controller.ts:599 | Inplay events for one sport |
| `/sports/sportradar/sync-inplay` | POST | X-Admin-Token | sports.controller.ts:610 | Manual inplay sync |
| `/sports/sportradar/upcoming` | GET | public | sports.controller.ts:624 | Paginated upcoming events |
| `/sports/sportradar/sync-upcoming` | POST | X-Admin-Token | sports.controller.ts:660 | Manual upcoming sync |
| `/sports/sportradar/raw-events` | GET | X-Admin-Token | sports.controller.ts:672 | Raw single page (debug) |
| `/sports/sportradar/raw` | GET | X-Admin-Token | sports.controller.ts:685 | Raw allsports (debug) |
| `/sports/sportradar/seed` | POST | X-Admin-Token | sports.controller.ts:695 | Re-seed betfair_sports |
| `/sports/sportradar/sync-events` | POST | X-Admin-Token | sports.controller.ts:706 | Full events sync (fire-and-forget) |
| `/sports/sportradar/sync-events/:sportId` | POST | X-Admin-Token | sports.controller.ts:718 | Sync one sport (awaited) |
| `/sports/sportradar/market` | GET | public | sports.controller.ts:730 | `list-market` proxy (30 s TTL) |
| `/sports/sportradar/market-result` | GET | X-Admin-Token | sports.controller.ts:753 | `market-result` proxy (settlement) |
| `/bets/admin/settle-by-sportradar-result` | POST | X-Admin-Token | bets.controller.ts:126 | Trigger `BetsService.settleByMarketResult` |
| `/bets/:id/cashout-offer` | GET | JWT | bets.controller.ts:152 | SR cashout price |
| `/bets/:id/cashout` | POST | JWT | bets.controller.ts:164 | Execute SR cashout |
| `/api/odds/sports` | GET | public | external-sports/odds-api.controller.ts:39 | Legacy Odds-API alias → proxies SR |
| `/api/odds/events/:sport` | GET | public | odds-api.controller.ts:51 | Legacy alias → proxies SR |
| `/api/odds/quota` | GET | public | odds-api.controller.ts:63 | Disabled stub |
| `/api/odds/force-sync` | GET | public | odds-api.controller.ts:75 | Triggers `syncEventsForSport` |
| `/api/odds-sports`, `/api/odds-events` | GET | public | odds-api.controller.ts:94,114 | Further legacy aliases |

### Socket.IO events

`SportsGateway` — namespace `/sports` — `newbackend/src/sports/sports.gateway.ts`

| Event | Direction | Location | Notes |
| --- | --- | --- | --- |
| `join-sports-lobby` | in | sports.gateway.ts:47 | Joins room `sports:lobby` |
| `leave-sports-lobby` | in | sports.gateway.ts:53 | |
| `join-match` | in | sports.gateway.ts:59 | Seeds from `odds:{matchId}` AND `sportradar:market:{matchId}` |
| `match-heartbeat` | in | sports.gateway.ts:172 | Viewer keep-alive, writes `viewers:{matchId}` sorted set |
| `leave-match` | in | sports.gateway.ts:178 | Writes `last_viewed:{matchId}` |
| `sports-match-data` | out | `emitMatchData()` sports.gateway.ts:199 | Per-match broadcast |
| `sports-lobby-data` | out | `emitLobbyData()` sports.gateway.ts:195 | Lobby grid broadcast |

`EventsGateway` — global namespace — `newbackend/src/events.gateway.ts`

| Event | Direction | Notes |
| --- | --- | --- |
| `join-match` | in | events.gateway.ts:85 — seeds both Diamond `odds:{matchId}` and `sportradar:market:{matchId}` |
| `socket-data` | out | events.gateway.ts:423-425 — fired by `emitSportradarOdds()` (sportradar.service.ts:368) with `messageType: 'sportradar_odds'` |

**Dup warning:** both gateways serve the same `join-match` seed flow with
near-identical code. Candidate for extraction.

### MongoDB collections (legacy `betfair_*` names, Sportradar data)

| Collection | Schema | Writer | Reader | Key indexes |
| --- | --- | --- | --- | --- |
| `betfair_sports` | `schemas/betfair-sport.schema.ts` | `seedSportsFromApi` sportradar.service.ts:551 | controller, admin | `{ sportId: 1, unique: true }` |
| `betfair_events` | `schemas/betfair-event.schema.ts` | `syncEventsForSport` sportradar.service.ts:1101 | `getEventById`, admin | `eventId` |
| `betfair_markets` | `schemas/betfair-market.schema.ts` | `syncEventsForSport` sportradar.service.ts:1119 (chunked 500) | market queries | `{ marketId: 1, unique: true }`, `{ eventId, status }`, `{ sportId, inplay, status }`, `{ competitionId }` |
| `betfair_fancy`, `betfair_bookmaker` | schemas in sports folder | SR sync (not hot-path) | — | — |
| `bets` | `bets/schemas/bet.schema.ts` | `BetsService.placeSportradarBet` | `settleByMarketResult`, admin | `{ userId, status }` |

`bets` schema SR fields (`bets/schemas/bet.schema.ts:112-158`):
`provider`, `srEventId`, `srSportId`, `srMarketFullId`, `srRunnerId`,
`srRunnerName`, `srMarketName`, `srMarketStatus`.

`PlaceBetDto` SR fields (`bets/dto/place-bet.dto.ts:84-125`):
`srSportId`, `srMarketFullId`, `srRunnerId`, `srRunnerName`, `srMarketName`.

### Bet placement path

1. `POST /bets` → `BetsController` → `BetsService.placeBet(userId, betData)` (bets.service.ts:260).
2. bets.service.ts:270-272 — if `eventId.toLowerCase().startsWith('sr:')`,
   delegates to `placeSportradarBet()`.
3. `placeSportradarBet` validates stake + odds, writes to `bets` with
   `provider='sportradar'` and all `sr*` fields.
4. Wallet debit + `BET_PLACED` transaction.

### Bet settlement path (backend)

1. Cron: `BetsService.autoSettleSportradar()` runs every 10 min
   (bets.service.ts:95-164). Finds pending `sr:match:*` bets with complete
   `srEventId` + `srMarketFullId` + `srRunnerId`, groups by event, calls
   `settleByMarketResult` sequentially with 1 s stagger.
2. Manual: `POST /bets/admin/settle-by-sportradar-result` →
   `BetsService.settleByMarketResult(eventId, adminId, marketId?)`
   (bets.service.ts:3130-3253).
3. Fetches `SportradarService.getRawMarketResult(sportId, eventId)` which
   calls `getMarketResult` which reads the **3 min cache** (bug —
   documented in gaps section above).
4. For each SETTLED market, finds `runners.find(r => r.result === 'won')`,
   queries PENDING bets, filters via normalized comparators:
   - `getComparableBetEventId` bets.service.ts:182
   - `getComparableBetMarketId` bets.service.ts:174
   - `getComparableBetSelectionId` bets.service.ts:166
5. Matching bets → `settlePendingBetsByWinner` → sets `WON`/`LOST`, credits
   wallet (bonus/primary split), emits wallet refresh.
6. **Void/push:** `result === ''` leaves bet unsettled. **No explicit void
   flow** — confirmed gap.
7. **TODO** at `sports.service.ts:2771`: *"User Balance Settlements
   (Credits/Debits for the matched portion) would go here."* Incomplete
   balance-matching logic.

### Background loops recap (for fix plan)

| Job | Interval | Guard | File:line |
| --- | --- | --- | --- |
| Sports seed | 200 s | none | sportradar.service.ts:249 |
| Events + inplay + upcoming sync (parallel) | 222 ms | only `isSyncingEvents` on events | sportradar.service.ts:254 |
| Live odds tick (polls `list-market` per live event) | 222 ms | per-tick call counter | sportradar.service.ts:273 |
| Bet auto-settle | 600 s | none | bets.service.ts:95 |
| Diamond post-queue retry (non-SR) | 30 s | `@Cron` | bets/diamond-post-queue.service.ts:23 |
| Hourly sports sync | 1 h | `@Cron('0 * * * *')` | sports.service.ts:636 |

### Tests

**None.** No `.spec.ts` under `sports/` or covering `SportradarService`,
`settleByMarketResult`, `placeSportradarBet`, or socket emission. Only
`bets.service.spec.ts` exists and it does nothing beyond instantiating the
class. This is a large gap given how much money flows through these paths.

### External-sports folder (legacy Odds-API compat)

- `newbackend/src/external-sports/odds-api.controller.ts` — legacy routes
  that now proxy to `SportradarService`.
- `newbackend/src/external-sports/odds-api-sync.service.ts` — fetches
  the-odds-api.com **once at startup**, caches in Redis under `oddsapi:*`,
  never polls again. Effectively dead data.
- `external-sports.module.ts` imports `SportsModule` to get
  `SportradarService`.
- Can be deleted once no clients hit `/api/odds*`.

### Module wiring

`SportsModule` (`sports/sports.module.ts`) provides and exports
`SportradarService`, `SportsGateway`, `SportsService`. `BetsService`
(bets.service.ts:85) injects `SportradarService` directly. `SportsGateway`
uses `forwardRef` to `SportsService` (circular dependency).

### Scripts

- `newbackend/src/scripts/revert-sportradar-settlements.ts` — one-off
  reversal of `ADMIN_REFUND_REVERSAL` transactions, settlement-adjacent
  only.

---

## newadmin — full file inventory

### Admin pages touching SR

| Route | File | Purpose |
| --- | --- | --- |
| `/dashboard/sports` | `newadmin/src/app/dashboard/sports/page.tsx` | Sports + competition visibility toggles |
| `/dashboard/sports/events` | `.../sports/events/page.tsx` | Event table, Top/Home toggles |
| `/dashboard/sports/leagues` | `.../sports/leagues/page.tsx` | Drag-reorder leagues, seed from backend |
| `/dashboard/sports/api-setup` | `.../sports/api-setup/page.tsx` | TURNKEY vs SPORTSRADAR provider toggle → `SystemConfig.SPORTS_API_TYPE` |
| `/dashboard/sports/promo-teams` | `.../sports/promo-teams/page.tsx` | Match-level promotion config |
| `/dashboard/sports/settlement` | `.../sports/settlement/page.tsx` | Liability grid + SR auto-settle |
| `/dashboard/sports/super-void` | `.../sports/super-void/page.tsx` + `SuperVoidEventClient.tsx` | Void every bet on an event (highest-risk admin action) |
| `/dashboard/sports/risk` | `.../sports/risk/page.tsx` | Liability table, polls every 5 s via `setInterval(fetchExposure, 5000)` |
| `/dashboard/settlement` | `.../settlement/page.tsx` | Global pending/settled bets |

### Server actions touching SR (the high-risk surface)

**`newadmin/src/actions/internal-sportradar-settlement.ts`**
- `internalSportradarSettlement(eventId, adminId, targetMarketId?)` — line 66
  - Fetches `https://sportradar-api.p.rapidapi.com/market-result?sportId=sr:sport:21&eventId={eventId}` (line 68).
  - Hardcoded `sportId=sr:sport:21` — wrong for non-cricket events.
  - Hardcoded RapidAPI key fallback at line 67: `'6a9d10424b039000ab1caa11'`.
  - Reads `Bet.find({ status: 'PENDING', eventId|matchId|srEventId, marketId|srMarketFullId })` lines 118-135.
  - Prisma transaction (lines 156-206): `User.update` increments `balance`/`cryptoBalance`/`sportsBonus`, decrements `exposure`; `Transaction.create` with `source: 'SPORTS_SETTLEMENT'`.
  - Mongo `bet.save()` with `status`, `settledReason`, `settledAt`.
- Helpers lines 9-64: `roundCurrency`, `normalizeText`, `getBetBonusStakeAmount`, `buildPayoutAllocations`, `mapWalletFieldToPaymentMethod`, `getWalletFieldLabel`.

**`newadmin/src/actions/internal-match-odds-settlement.ts`**
- `settleEventMatchOddsInternal(eventId, winningSelectionId, winningSelectionName?, adminId)` — line 290
  - Optional SR validation via `resolveSportradarWinningSelection` (line 68) — hits the same RapidAPI URL (line 76) with the same hardcoded key (line 75).
  - Falls back to reading `markets` collection directly when SR API fails (lines 219-260).
  - `isMatchOddsBet()` at line 20 — hand-maintained exclusion list of fancy gtypes.
  - Same Prisma+Mongo write pattern as above (lines 343-395), source `'ADMIN_MATCH_ODDS_SETTLEMENT'`.

**`newadmin/src/actions/settlement.ts`**
- `manualSettleBet(betId, outcome, adminNote?)` — line 419. No SR call; admin forces bet status directly. Prisma wallet mutation, source `'MANUAL_SETTLEMENT'`. **No idempotency guard — can re-settle already-settled bets.**
- `settleEventMatchOdds(eventId, ...)` — line 508. Thin wrapper over `settleEventMatchOddsInternal`.
- `settleBetsByMarket(marketId, winningSelectionId, eventId?)` — line 792. Iterates pending bets, calls `manualSettleBet` per bet.
- `settleByMarketResult(eventId, marketId?)` — line 839. Delegates to `internalSportradarSettlement`. Revalidates `/dashboard/sports/settlement` and `/dashboard/settlement`.
- `superVoidEvent(eventId, reason)` — line 516. **HIGHEST-RISK FUNCTION.**
  - Mongo `Bet.collection.find({ $or:[{eventId},{matchId}] })` — includes ALL statuses (line 549).
  - For each bet: reversal allocations (`getCashoutReversalAllocations` line 178, `getWinReversalAllocations` line 240) + refund allocation (`buildVoidRefundAllocations` line 134).
  - Prisma transaction per bet (lines 630-687): `BET_VOID_DEBIT` reversals + `BET_REFUND` entries, all sourced `'BET_EVENT_SUPER_VOID'`.
  - Mongo bulk `updateOne` per bet (lines 689-709): sets `status='VOID'`, resets `stake`, `potentialWin`, `partialCashoutValue`, unsets `cashoutValue`, `cashedOutAt`, `lastPartialCashoutAt`.
  - **Per-bet Prisma transactions, not one big transaction** — partial failure leaves state inconsistent.
- Read helpers (no mutation): `getPendingBets` (378), `getSettledBets` (757), `getSettlementStats` (736).

**`newadmin/src/actions/sports.ts`** (all Mongo reads/writes on `betfair_*`, no SR API calls)
Functions: `getSports` (23), `toggleSportVisibility` (37), `updateSportTabStatus` (49), `setSportDefault` (61), `bulkUpdateSportOrder` (78), `getAllBetfairEvents` (107), `getBetfairEventsBySport` (138), `toggleBetfairEventVisibility` (155), `getCompetitionsBySport` (174), `getAllCompetitions` (203), `toggleCompetitionEvents` (231), `getTopEvents` (246), `togglePopularEvent` (259), `getHomeEvents` (282), `toggleHomeEvent` (292), `getSportLeagues` (316), `updateLeagueImage` (330), `updateLeagueVisibility` (345), `updateLeagueOrder` (363), `seedLeaguesFromBackend` (385) — **aggregates `BetfairEvent` → upserts `SportLeague`**, `getBetLimits`/`updateBetLimits` (436/447, Prisma `SystemConfig.BET_LIMITS`), `getMarketLiability` (465), `getHighRiskBets` (534), `getHighRiskUsers` (551), `getPromoTeamEvents` (576), `updateSportLimits` (631), `getSportPageSections` (660), `bulkUpdateSectionOrder` (678), `toggleSectionVisibility` (697), `getSportsPageLayout` (709).

**`newadmin/src/actions/settings.ts`**
- `getSportsApiType()` line 166 — reads `SystemConfig.SPORTS_API_TYPE` (default `'TURNKEY'`).
- `updateSportsApiType(apiType)` line 179 — upserts it.

**`newadmin/src/actions/sports-promotions.ts`**
- `getSportsPromotions`, `createSportsPromotion`, `updateSportsPromotion`, `deleteSportsPromotion`, `toggleSportsPromotionStatus`, `setSportsPromotionTrigger`, `getEarlySixBetList`, `refundEarlySixPromotion`. Operates on `MatchCashbackPromotion` collection.
- Contains its own copy of `isMatchOddsBet()` (lines 105-140).

### Admin Mongo models (`newadmin/src/models/MongoModels.ts`)

- `Bet` interface lines 2-94 — same SR fields as backend schema plus admin-extras.
- `BetfairSport` lines 1359-1402, `BetfairEvent` lines 1404-1471, `BetfairMarket` lines 1474-1506, `SportLeague` lines 1508-1530.
- `TopEvent` / `HomeEvent` lines 435-508.
- `SportPageSection` lines 570-596.
- `MatchCashbackPromotion` lines 1215-1250.
- `PromoTeam` lines 1111-1128.

Admin uses **Mongoose for `bets` + `betfair_*`** and **Prisma for `User` /
`Transaction` / `SystemConfig`** → no cross-DB transactions, eventual
consistency risk on every settlement.

### Critical admin observations

1. **Hardcoded RapidAPI key fallback** in TWO files (`internal-sportradar-settlement.ts:67`, `internal-match-odds-settlement.ts:75`): `'6a9d10424b039000ab1caa11'`.
2. **Hardcoded sportId `sr:sport:21`** in the RapidAPI URL — cricket-only. Non-cricket settlements will hit the wrong sport bucket upstream.
3. **Admin bypasses backend entirely** for settlement — admin reads SR from RapidAPI, writes Prisma + Mongo directly. Backend's `BetsService.settleByMarketResult` does the same work against the Betnex proxy. If both run, **double-crediting is possible**.
4. **Triple-duplicated helpers** across the three settlement files: `roundCurrency`, `normalizeText`, `buildPayoutAllocations`, `getBetBonusStakeAmount`, `getWalletFieldLabel`, `mapWalletFieldToPaymentMethod`.
5. **No idempotency** anywhere — every action can run twice.
6. **No event lock** — two admins settling simultaneously will race.
7. **Per-bet Prisma transactions** in `superVoidEvent` — not atomic across the loop.
8. **JWT decoding failure in `superVoidEvent`** leaves `adminId = null` but still commits — audit trail broken.
9. **Risk dashboard polls every 5 s** (`sports/risk/page.tsx:27`) — runs expensive `Bet.aggregate` constantly.
10. **Deprecated REST service still present**: `newadmin/src/services/sports.service.ts:1-7` carries a `@deprecated` JSDoc but is not deleted.
11. **Hardcoded Cloudflare Images token** in `newadmin/src/app/api/upload-cf/route.ts:3-4` (not SR, but same "fallback secrets in source" pattern).
12. **JWT secret fallback** `'secret'` in `newadmin/src/actions/auth.ts:10`.
13. **The admin `api-setup` page has a provider toggle (TURNKEY vs SPORTSRADAR) that nothing actually reads** — verify whether backend honours `SystemConfig.SPORTS_API_TYPE` or whether it's dead config.

---

## newwebsite — full file inventory

### Routes under `src/app/sports/**`

| Route | File | Type | Data source |
| --- | --- | --- | --- |
| `/sports/match/[matchId]` | `src/app/sports/match/[matchId]/page.tsx` | SSR wrapper + CSR detail | `sportsApi.getMatchDetails(matchId)` → `GET /sports/db/match/{matchId}` (services/sports.ts:138) |
| `/sports/league/[sportKey]` | `src/app/sports/league/[sportKey]/page.tsx` | SSR + CSR | `GET /sports/sportradar/upcoming?sportId=...&pageNo=...` and `GET /sports/sportradar/inplay` |

### Key components

- **`src/components/sports/SRMatchDetailPage.tsx`** — full match UI. Reads `event_id`, `event_name`, `sport_id`, `home_team`, `away_team`, `score1`/`score2`, `sr_markets.{matchOdds,bookmakers,fancyMarkets,premiumMarkets}`. Maintains `liveMarkets: Map<marketId, { runners: Map<runnerId, {backOdds,layOdds,backSize,laySize}>, suspended }>` and patches it from socket events. Builds bet via `handleBet()` (lines 489-513) with full SR linkage (`srSportId`, `srMarketFullId`, `srRunnerId`, `srRunnerName`, `srMarketName`).
- **`src/components/sports/SRMatchCard.tsx`** — lobby card; reads best back price from `sr_markets.matchOdds[0].runners[*].backPrices[0].price`. Falls back to legacy `match_odds` array.
- **`src/components/sports/SportsMainContent.tsx`** — authoritative lobby. `SPORT_META` mapping (lines 92-113) covers all 16 SR sports (`sr:sport:1..138`). Uses `fetchSportsLobbyInitialData()` from `src/lib/sportsLobbyData.ts:192` + socket. Polling: `INPLAY_POLL_MS = 5000`, `UPCOMING_POLL_MS = 30000` (only when socket disconnected).
- **`src/components/sports/SportsRadarMainContent.tsx`** — alternate lobby experiment. Polls `sportsbookApi.getEvents()` every 10 s. Has a `SPORT_FILTERS` array with **two bugs**:
  - `sr:sport:20` is listed twice, once as Baseball and once as Soccer (lines 32, 35).
  - `sr:sport:1` is labelled "American Football" here but "Soccer" in `SportsMainContent.tsx`. These mappings contradict each other.

### Fetchers (`src/services/sports.ts`, `src/lib/sportsLobbyData.ts`, `src/lib/sportsRealtimeOdds.ts`)

- `sportsApi.getMatchDetails(matchId)` line 138 — `GET /sports/db/match/{matchId}`.
- `sportsApi.checkOdds(bets)` line 204 — `POST /sports/check-odds`. Fails open on error.
- `sportsbookApi.getSports` (246), `getEventsCount` (254), `getEvents(sportId?)` (262), `getLiveEvents` (273), `getUpcomingEvents` (284), `getMarket(eventId)` (295).
- `src/lib/sportsLobbyData.ts` — `getEventLiveState` (99), `isEventLive` (113), `isEventInPlay` (118), `fetchInplayEvents` (122), `fetchAllPagesForSport` (132), `fetchEventsCount` (168), `fetchActiveSports` (182), `fetchSportsLobbyInitialData` (192). **`fetchAllPagesForSport` parallelizes via `Promise.allSettled` with no concurrency cap** — can stampede backend on cold cache.
- `src/lib/sportsRealtimeOdds.ts` — `ODDS_MESSAGE_TYPES` (32-38) lists `sportradar_odds`, `odds`, `match_odds`, `bookmaker_odds`, `bm_odds`. `buildRunnerUpdateMap` (65), `buildRunnerUpdateMapFromSection` (126), `applySocketPayloadToEvent`, `getSocketPayloadEventIds`.

### Socket.IO consumers

- **`src/context/SocketContext.tsx`** — main app socket. Transports `['polling', 'websocket']`, infinite reconnect, re-joins match rooms and user room on reconnect (line 236-245). Emits `join-match`, `leave-match`, `match-heartbeat` (every 10 s), `subscribeToUserRoom`.
- **`src/context/SportsSocketContext.tsx`** — `/sports` namespace. Emits `join-sports-lobby`, `leave-sports-lobby`, `join-match`, `leave-match`.
- **`src/context/BetContext.tsx`** — `handleSocketData(data)` lines 243-414. Listens to `socket-data`. Accepted message types: `match_odds`, `odds`, `sportradar_odds`, `bookmaker_odds`, `bm_odds`. Performs **strict event-id validation** (line 350-354) to prevent cross-event contamination — this was added to keep SR updates from polluting Diamond bet slips. On market suspension (`ms === 4`) drops the selection from the slip with a toast. On odds change recomputes `potentialWin` via `calculatePotentialWin`. Dispatches `sports:odds-updated` custom event.
- Same listener in `SRMatchDetailPage.tsx:413-486` — separate parsing for the detail page.

### Bet placement from website

- `handleBet` in `SRMatchDetailPage.tsx:489-513` constructs the slip entry with `provider: 'sportradar'`, `srSportId`, `srMarketFullId`, `srRunnerId`, `srRunnerName`, `srMarketName`, `marketType`, `betType: 'back'`.
- `BetContext.submitPlacedBets()` line 534-555 POSTs the full SR-linked payload to `POST /bets` via `betsApi.placeBet` (`src/services/bets.ts:69-72`).
- `BetContext.placeBet` line 569-584 validates odds server-side via `sportsApi.checkOdds` first; if odds changed the slip is patched and the user re-confirms.
- One-click flow: `placeSingleBet` line 586-615 uses a `pendingOneClickKeys` set keyed by `${eventId}::${marketId}::${selectionId}` to prevent duplicate submissions.

### Pricing rules (`src/utils/sportsBetPricing.ts`)

- `isDecimalPriceMarket` (52-64): Match Odds, Bookmaker, Toss, Fancy1, etc.
- `isLineBasedFancyMarket` (66-89): Session, Khado, Meter, Lambi, fancy variants.
- `getBetPayoutMultiplier` (91-112).
- `calculatePotentialWin(stake, odds, rate, betType, marketType, marketName, selectionName)` (114-165):
  - Decimal markets: `stake × odds` both for back and lay (lay is simplified — confirm with backend).
  - Line-based fancy markets: BACK returns `stake × (1 + size/100)`, LAY returns `stake × (1 + 100/size)`. Defaults to `size=100` if `rate<1`.

### Bet history

`src/app/profile/bet-history/page.tsx` — CSR with filters (`PENDING|WON|LOST|VOID|CASHED_OUT`). Display names fall back in order: `srMarketName → marketName → srMarketFullId → marketId` (line 42-46). Cashout UI polls `betsApi.getCashoutOffer(betId)` every 8 s per bet (line 100). Phases: `LOADING → IDLE → CONFIRMING → PRICE_CHANGED → EXECUTING → SUCCESS`. Re-confirms if price moves >2%.

### Polling summary (website)

| Location | Endpoint | Interval | Condition |
| --- | --- | --- | --- |
| `SportsRadarMainContent` | `/sportsbook/events` | 10 s | always |
| `SportsMainContent` | `/sports/sportradar/inplay` | 5 s | socket disconnected |
| `SportsMainContent` | `/sports/sportradar/upcoming` per sport | 30 s | initial / fallback |
| `league/[sportKey]` | `/sports/sportradar/inplay` | 10 s | socket disconnected |
| match detail page | heartbeat `match-heartbeat` | 10 s | always while on page |
| bet history | `getCashoutOffer(betId)` | 8 s | per bet, only when cashout UI open |
| odds check | `POST /sports/check-odds` | on demand | before every bet placement |

No SWR, no TanStack Query — everything is plain `fetch` + `useEffect`.

### Types on the website

`src/lib/sportsLobbyData.ts` defines `SrRunner`, `SrMarket`, `SrEvent`,
`ActiveSportConfig`, `SportsLobbyInitialData`. These roughly mirror the
backend's `SportradarEvent` / `SportradarMatchOdds` / `SportradarRunner`
but with snake_case field aliases in a few places.

**Type drift found:**

- `Event` interface in `src/services/sports.ts:24-63` does **not** declare
  `sr_markets`, `sport_id`, `homeScore`, `awayScore`. Every access site
  casts `(match as any)`. At least 5 call sites.
- `BetSlipBet` type in `BetContext.tsx:14-34` declares `srSportId`,
  `srMarketFullId`, `srRunnerId`, etc. but the `Bet` type in
  `src/services/bets.ts:4-38` doesn't line up 1:1 — future refactors will
  have to pick one.
- `marketType` vs `matchType` inconsistency across components.

### Website-side env vars

From `newwebsite/.env.local`:
- `NEXT_PUBLIC_API_URL=https://odd69.com/api` — base for all `/sportsbook/*` and `/sports/sportradar/*`.
- `NEXT_PUBLIC_SOCKET_URL=https://odd69.com/api` — Socket.IO.
- `NEXT_PUBLIC_ADMIN_API_TOKEN=...` — **a full admin token literal is baked into the website's env file**. If this is shipped to the browser, anyone can forge admin-only API calls. **Treat as P0 security finding** and verify whether this token is actually used client-side or only in server actions.

### Direct upstream calls from the browser

**None found.** No references to `62.72.41.209`, `local.turnkeyxgaming.com`, `sportradar-api.p.rapidapi.com`, or the `x-betnex-key` / `X-RapidAPI-Key` headers anywhere in the website bundle. Good.

---

## Master gap register (cross-folder)

Numbering continues from the backend-only list above.

### Newly identified (cross-folder)

18. **Two Sportradar providers, two auth schemes.** Backend uses Betnex proxy with `x-betnex-key`; admin uses RapidAPI with `X-RapidAPI-Key`. Settle this.
19. **Hardcoded sport `sr:sport:21` in admin RapidAPI URL.** Non-cricket settlements hit the wrong bucket.
20. **Admin bypasses backend for settlement.** Duplicated settlement path, duplicated wallet allocation logic in three files, no idempotency between them. Double-credit risk if both run.
21. **`superVoidEvent` is not atomic.** Per-bet Prisma transactions inside a loop; Mongo writes separate from Prisma writes; no big wrapping transaction.
22. **`manualSettleBet` has no "already-settled" guard.** Admin can re-settle a `WON` bet as `LOST` and double-debit.
23. **`NEXT_PUBLIC_ADMIN_API_TOKEN` shipped to browser env.** Potential P0 depending on how it's used.
24. **`SportsRadarMainContent` SPORT_FILTERS has duplicate `sr:sport:20`** and contradicts `SportsMainContent` `SPORT_META` on `sr:sport:1`. Confirm correct mapping, delete the broken file if unused.
25. **`SystemConfig.SPORTS_API_TYPE` toggle may be dead config.** Backend `SportradarService` never reads it — verify.
26. **Risk dashboard polls `Bet.aggregate` every 5 s.** Expensive. Cache or push.
27. **`fetchAllPagesForSport` on website has no concurrency cap** — parallel page fetches can stampede backend on cold cache.
28. **Zero tests across all three folders** for SR code paths.
29. **Legacy Odds-API compat surface still wired** (`external-sports/*`, `src/services/sports.service.ts @deprecated`). Delete or finish migrating.
30. **Website `Event` type missing `sr_markets`/`sport_id`/scores** → `as any` casts everywhere.
31. **Mongoose ↔ Prisma split** (admin writes to both on every settlement). No cross-DB transaction → partial-failure inconsistency.
32. **`isMatchOddsBet` implemented 3 times** (admin) with hand-maintained fancy exclusion lists. Drift risk.
33. **`TODO` at `newbackend/src/sports/sports.service.ts:2771`** — "User Balance Settlements ... would go here." Incomplete.
34. **No event lock.** Two admins settling the same event concurrently will both succeed.
35. **Bet history display precedence is `srMarketName → marketName → srMarketFullId → marketId`** — if only the ID is populated users see a cryptic string. Backend should always populate the human-readable names at placement time.

## Updated fix plan (priority-ordered, all folders)

**P0 — settlement integrity + secret hygiene**

1. **Decide canonical SR provider.** Either route admin settlement through the backend's `POST /bets/admin/settle-by-sportradar-result`, or remove the backend path. Do not leave both.
2. **Fix `getRawMarketResult` cache bypass bug** (backend, gap #2).
3. **Rotate + remove hardcoded keys**:
   - `SPORTRADAR_API_KEY` fallback `'67f1a9c2...'` in `sportradar.service.ts:163`.
   - `SPORTS_API_KEY` fallback `'6a9d10424b...'` in `internal-sportradar-settlement.ts:67` and `internal-match-odds-settlement.ts:75`.
   - `CF_API_TOKEN` fallback in `newadmin/src/app/api/upload-cf/route.ts:3-4`.
   - `JWT_SECRET` fallback `'secret'` in `newadmin/src/actions/auth.ts:10`.
4. **Audit `NEXT_PUBLIC_ADMIN_API_TOKEN` exposure.** If it lands in the browser bundle, invalidate and replace with a server-only variable.
5. **Idempotency key on settlement actions** (`settleByMarketResult`, `manualSettleBet`, `settleEventMatchOdds`, `superVoidEvent`). Store + enforce.
6. **Already-settled guard in `manualSettleBet`**.
7. **Hardcoded sportId in admin RapidAPI URL** — look up from bet / `BetfairSport`.

**P1 — correctness / consistency**

8. **Re-entrancy guards** on `syncAllInplayEvents` / `syncAllUpcomingEvents` (backend, gap #3).
9. **Dynamic sport list** from `betfair_sports` instead of `SORT_ORDER` (backend, gap #5).
10. **Inplay TTL ≥ 5× sync interval** (backend, gap #6).
11. **Event lock for settlement** (Redis `SETNX` per `eventId`).
12. **Wrap `superVoidEvent` in a single outer transaction boundary**, or at minimum mark partial progress so it can resume.
13. **Extract shared settlement helpers** (`roundCurrency`, `normalizeText`, `buildPayoutAllocations`, `isMatchOddsBet`, `getBetBonusStakeAmount`) into a shared admin module.
14. **Populate `srMarketName` / `srRunnerName` at bet-placement time** so history display never falls back to raw IDs.

**P2 — features + observability**

15. **Premium WebSocket channel** via `premiumTopic` instead of 222 ms polling (backend, gap #7).
16. **Retry + circuit breaker + per-host metrics** on `apiGet` (backend, gap #9, #12).
17. **Unwrap `AggregateError`** in backend for better outage diagnostics (backend, gap #8).
18. **Cache `getMarketLiability`** or push-update it instead of 5 s polling in admin risk dashboard.
19. **Concurrency cap on `fetchAllPagesForSport`** in `newwebsite/src/lib/sportsLobbyData.ts`.
20. **Tests.** At minimum: happy-path settlement by `market-result`, voided bet reversal, place-bet with SR linkage, socket emission on price change.
21. **Delete `external-sports/*`** and the `@deprecated` admin `services/sports.service.ts` once no clients remain.
22. **Fix `SportsRadarMainContent` SPORT_FILTERS** and consolidate with `SportsMainContent.SPORT_META`. Verify whether `SportsRadarMainContent` is still mounted anywhere.

**P3 — hygiene**

23. **Doc/comment pass** on all drifted TTL comments (backend, gap #15).
24. **Config object** for magic numbers (backend, gap #16).
25. **Declare SR fields on the website `Event` type** and remove the `as any` casts (gap #30).
26. **Rename `betfair_*` collections to `sportradar_*`** or document the historical reason they still carry legacy names (backend, gap #17).

