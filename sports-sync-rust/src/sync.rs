//! All sync loops. Each one is a `pub async fn run_*` that loops forever
//! on an interval, with simple span+error logging. Errors don't abort the
//! loop — they get logged and we try again on the next tick.
//!
//! Shapes of the cached payloads mirror what the NestJS service wrote so the
//! existing `sportradar-proxy` controller keeps working unchanged.

use anyhow::Result;
use futures::stream::{self, StreamExt};
use parking_lot::Mutex;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crate::config::Config;
use crate::constants::{known_sport_ids, PAGE_SIZE, SORT_ORDER};
use crate::mongo_writer::MongoWriter;
use crate::redis_writer::RedisWriter;
use crate::sportradar::{AllSportsResponse, EventsResponse, SportradarClient};

const SPORTS_REDIS_KEY: &str = "sportradar:sports";

/// Shared state across all sync loops.
pub struct SyncState {
    pub cfg: Arc<Config>,
    pub client: Arc<SportradarClient>,
    pub redis: Arc<RedisWriter>,
    pub mongo: Arc<MongoWriter>,
    pub events_sync_running: AtomicBool,
    pub live_snapshot: Mutex<HashMap<String, u64>>,
}

impl SyncState {
    pub fn new(
        cfg: Arc<Config>,
        client: Arc<SportradarClient>,
        redis: Arc<RedisWriter>,
        mongo: Arc<MongoWriter>,
    ) -> Arc<Self> {
        Arc::new(Self {
            cfg,
            client,
            redis,
            mongo,
            events_sync_running: AtomicBool::new(false),
            live_snapshot: Mutex::new(HashMap::new()),
        })
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Sports catalogue — /allsports
// ═══════════════════════════════════════════════════════════════════════════

pub async fn run_sports(state: Arc<SyncState>) {
    let mut interval = tokio::time::interval(state.cfg.sports_sync_interval);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        if let Err(e) = sync_sports_once(&state).await {
            tracing::warn!("sports sync failed: {e}");
        }
    }
}

async fn sync_sports_once(state: &SyncState) -> Result<()> {
    let raw: Value = state.client.api_get("allsports", &[], false).await?;
    let parsed: AllSportsResponse = serde_json::from_value(raw)?;
    if !parsed.success {
        return Err(anyhow::anyhow!("allsports !success: {}", parsed.message));
    }

    let active: Vec<_> = parsed
        .sports
        .into_iter()
        .filter(|s| s.status == "ACTIVE")
        .collect();

    // Mongo upsert (sportId, name, sortOrder).
    let tuples: Vec<(String, String)> = active
        .iter()
        .map(|s| (s.sport_id.clone(), s.sport_name.clone()))
        .collect();
    let _ = state
        .mongo
        .upsert_sports(&tuples, |sid, idx| {
            *SORT_ORDER.get(sid).unwrap_or(&((50 + idx) as u32))
        })
        .await
        .map_err(|e| tracing::warn!("upsert_sports: {e}"));

    // Redis cache shape matches `getSportsFromCache()` in the TS service.
    let mapped: Vec<Value> = active
        .iter()
        .enumerate()
        .map(|(idx, s)| {
            let sort_order = *SORT_ORDER.get(s.sport_id.as_str()).unwrap_or(&((50 + idx) as u32));
            json!({
                "sport_id":   s.sport_id,
                "sport_name": s.sport_name,
                "isVisible":  true,
                "tab":        true,
                "isdefault":  s.sport_id == crate::constants::CRICKET_SPORT_ID,
                "sortOrder":  sort_order,
            })
        })
        .collect();

    let body = serde_json::to_string(&mapped)?;
    state.redis.setex(SPORTS_REDIS_KEY, &body, state.cfg.sports_ttl).await?;

    tracing::info!(count = mapped.len(), "sports synced");
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Events catalogue (per sport, paginated) — /events-catalogue
// ═══════════════════════════════════════════════════════════════════════════

pub async fn run_events(state: Arc<SyncState>) {
    let mut interval = tokio::time::interval(state.cfg.events_sync_interval);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    loop {
        interval.tick().await;
        if state.events_sync_running.swap(true, Ordering::AcqRel) {
            tracing::debug!("events sync still running, skipping tick");
            continue;
        }
        let start = std::time::Instant::now();
        let result = sync_all_events_once(&state).await;
        state.events_sync_running.store(false, Ordering::Release);
        match result {
            Ok((events, markets)) => tracing::info!(
                events,
                markets,
                elapsed_ms = start.elapsed().as_millis() as u64,
                "events sync done"
            ),
            Err(e) => tracing::warn!("events sync failed: {e}"),
        }
    }
}

async fn sync_all_events_once(state: &SyncState) -> Result<(usize, usize)> {
    let sport_ids = known_sport_ids();
    let mut total_events = 0usize;
    let mut total_markets = 0usize;

    // Fetch per-sport in parallel but cap at bg_rps to stay polite.
    let bg_rps = state.cfg.bg_rps as usize;
    let concurrency = bg_rps.clamp(4, 32);

    let owned_ids: Vec<String> = sport_ids.iter().map(|s| s.to_string()).collect();
    let futs = stream::iter(owned_ids.into_iter().map(|sport_id| {
        let state = state;
        async move {
            match sync_events_for_sport(state, &sport_id).await {
                Ok((e, m)) => (sport_id, e, m, None),
                Err(err) => (sport_id, 0, 0, Some(err.to_string())),
            }
        }
    }))
    .buffer_unordered(concurrency);

    let mut futs = std::pin::pin!(futs);
    while let Some((sport_id, ev, mk, err)) = futs.next().await {
        total_events += ev;
        total_markets += mk;
        if let Some(e) = err {
            tracing::debug!("events sync {sport_id} failed: {e}");
        }
    }
    Ok((total_events, total_markets))
}

/// Fetch every page of `/events-catalogue?sportId=…`, then upsert to Mongo
/// and write Redis keys. Returns (events, markets) counts.
async fn sync_events_for_sport(state: &SyncState, sport_id: &str) -> Result<(usize, usize)> {
    let events = fetch_all_pages(state, "events-catalogue", sport_id).await?;
    if events.is_empty() {
        return Ok((0, 0));
    }

    // Overlay admin-curated images so cached events match user expectations.
    overlay_admin_images(state, &events).await;

    // Redis writes.
    write_per_sport_events_cache(state, sport_id, &events).await?;

    // Mongo upserts.
    let ev_count = state.mongo.upsert_events(&events).await.unwrap_or(0);
    let mk_count = state.mongo.upsert_markets(&events).await.unwrap_or(0);

    Ok((ev_count.max(events.len()), mk_count))
}

async fn write_per_sport_events_cache(
    state: &SyncState,
    sport_id: &str,
    events: &[Value],
) -> Result<()> {
    let cfg = &state.cfg;

    // 1. Sport-level cache.
    let key = format!("sportradar:events:{sport_id}");
    let body = serde_json::to_string(events)?;
    state.redis.setex(&key, &body, cfg.events_ttl).await?;

    // 2. Per-event keys (event + odds) — TTL depends on liveness.
    let mut bulk: Vec<(String, String, u64)> = Vec::with_capacity(events.len() * 2);
    for ev in events {
        let Some(event_id) = ev.get("eventId").and_then(|v| v.as_str()) else {
            continue;
        };
        let is_live = matches!(ev.get("status").and_then(|v| v.as_str()), Some("LIVE"))
            || matches!(ev.get("eventStatus").and_then(|v| v.as_str()), Some("LIVE"))
            || matches!(ev.get("catId").and_then(|v| v.as_str()), Some("LIVE"));
        let ttl = if is_live { cfg.inplay_ttl } else { cfg.upcoming_ttl };

        let ev_str = ev.to_string();
        bulk.push((format!("sportradar:event:{event_id}"), ev_str, ttl));

        let odds = ev.get("markets").cloned().unwrap_or(Value::Object(Default::default()));
        bulk.push((
            format!("sportradar:odds:{event_id}"),
            odds.to_string(),
            ttl,
        ));
    }
    state.redis.bulk_setex(&bulk).await?;
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Inplay / Upcoming  ─  fast loops, no Mongo writes
// ═══════════════════════════════════════════════════════════════════════════

pub async fn run_inplay(state: Arc<SyncState>) {
    let mut interval = tokio::time::interval(state.cfg.inplay_sync_interval);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        if let Err(e) = sync_inplay_once(&state).await {
            tracing::warn!("inplay sync failed: {e}");
        }
    }
}

pub async fn run_upcoming(state: Arc<SyncState>) {
    let mut interval = tokio::time::interval(state.cfg.upcoming_sync_interval);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        if let Err(e) = sync_upcoming_once(&state).await {
            tracing::warn!("upcoming sync failed: {e}");
        }
    }
}

async fn sync_inplay_once(state: &SyncState) -> Result<()> {
    fan_out_kind(state, "inplay-events", "inplay", state.cfg.inplay_ttl).await
}

async fn sync_upcoming_once(state: &SyncState) -> Result<()> {
    fan_out_kind(state, "upcoming-events", "upcoming", state.cfg.upcoming_ttl).await
}

/// Shared implementation for inplay + upcoming.
/// `endpoint` is the upstream path (`inplay-events` or `upcoming-events`),
/// `key_suffix` is the Redis key fragment (`inplay` or `upcoming`).
async fn fan_out_kind(
    state: &SyncState,
    endpoint: &str,
    key_suffix: &str,
    ttl: u64,
) -> Result<()> {
    let sport_ids = known_sport_ids();
    let bg = state.cfg.bg_rps.max(4) as usize;
    let concurrency = bg.clamp(4, 32);

    let owned_ids: Vec<String> = sport_ids.iter().map(|s| s.to_string()).collect();
    let endpoint_owned = endpoint.to_string();
    let futs = stream::iter(owned_ids.into_iter().map(|sid| {
        let state = state;
        let endpoint = endpoint_owned.clone();
        async move {
            let evs = fetch_all_pages(state, &endpoint, &sid)
                .await
                .unwrap_or_default();
            (sid, evs)
        }
    }))
    .buffer_unordered(concurrency)
    .collect::<Vec<_>>()
    .await;

    // Flatten + overlay admin images for the entire batch.
    let mut by_sport: HashMap<String, Vec<Value>> = HashMap::new();
    let mut all: Vec<Value> = Vec::new();
    for (sid, evs) in futs {
        for ev in evs {
            all.push(ev.clone());
            by_sport.entry(sid.clone()).or_default().push(ev);
        }
    }
    overlay_admin_images_owned(state, &mut all).await;
    overlay_in_groups(&mut by_sport, &all);

    // Build the Redis pipeline.
    let mut bulk: Vec<(String, String, u64)> = Vec::with_capacity(sport_ids.len() + 1);

    for sid in &sport_ids {
        let evs = by_sport.remove(*sid).unwrap_or_default();
        let key = format!("sportradar:{key_suffix}:{sid}");
        bulk.push((key, serde_json::to_string(&evs)?, ttl));
    }
    // Combined `:all` key.
    bulk.push((
        format!("sportradar:{key_suffix}:all"),
        serde_json::to_string(&all)?,
        ttl,
    ));

    // For inplay: also overwrite per-event/odds keys so the score-bearing
    // payload becomes the new source of truth.
    if key_suffix == "inplay" {
        for ev in &all {
            let Some(eid) = ev.get("eventId").and_then(|v| v.as_str()) else { continue };
            bulk.push((
                format!("sportradar:event:{eid}"),
                ev.to_string(),
                state.cfg.inplay_ttl,
            ));
            let markets = ev.get("markets").cloned().unwrap_or_default();
            bulk.push((
                format!("sportradar:odds:{eid}"),
                markets.to_string(),
                state.cfg.inplay_ttl,
            ));
        }
    }

    state.redis.bulk_setex(&bulk).await?;
    tracing::debug!(kind = key_suffix, count = all.len(), "fan_out done");
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Live odds loop — /list-market every LIVE_ODDS_TICK_MS
// ═══════════════════════════════════════════════════════════════════════════

pub async fn run_live_odds(state: Arc<SyncState>) {
    let mut interval = tokio::time::interval(state.cfg.live_odds_tick);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
        if let Err(e) = live_odds_tick(&state).await {
            tracing::debug!("live_odds_tick err: {e}");
        }
    }
}

async fn live_odds_tick(state: &SyncState) -> Result<()> {
    // Source of truth for "what's currently live" is the inplay sync's
    // combined key. If it's empty, nothing to poll.
    let Some(raw) = state.redis.get_primary("sportradar:inplay:all").await? else {
        return Ok(());
    };
    let live_events: Vec<Value> = serde_json::from_str(&raw).unwrap_or_default();
    if live_events.is_empty() {
        return Ok(());
    }

    let cap = state.cfg.max_live_calls_per_tick;
    let take_n = live_events.len().min(cap);

    let cfg = state.cfg.clone();
    let inplay_ttl = cfg.inplay_ttl;

    let futs = stream::iter(live_events.into_iter().take(take_n).map(|ev| {
        let state = state;
        async move {
            let event_id = ev.get("eventId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let sport_id = ev.get("sportId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if event_id.is_empty() || sport_id.is_empty() {
                return;
            }
            if let Err(e) = poll_one_event(state, &sport_id, &event_id, inplay_ttl).await {
                tracing::trace!(eid = %event_id, err = %e, "poll_one_event");
            }
        }
    }))
    .buffer_unordered(cap.max(4));

    futs.collect::<Vec<()>>().await;
    Ok(())
}

async fn poll_one_event(
    state: &SyncState,
    sport_id: &str,
    event_id: &str,
    inplay_ttl: u64,
) -> Result<()> {
    let resp = state
        .client
        .api_get(
            "list-market",
            &[("sportId", sport_id), ("eventId", event_id)],
            true, // bypass per-request cache — we want fresh ticks
        )
        .await?;

    let success = resp.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
    let Some(event_obj) = resp.get("event") else {
        return Ok(());
    };
    if !success {
        return Ok(());
    }

    // Cheap fingerprint over markets + score so we skip writes when nothing
    // moved. The TS service stringifies + compares; we hash for memory.
    let fingerprint = fingerprint_event(event_obj);
    {
        let mut snap = state.live_snapshot.lock();
        if snap.get(event_id) == Some(&fingerprint) {
            return Ok(());
        }
        snap.insert(event_id.to_string(), fingerprint);
    }

    // Preserve admin-curated images that were merged into the existing cache
    // entry, so the live-market overwrite doesn't strip them.
    let existing = state
        .redis
        .get_primary(&format!("sportradar:event:{event_id}"))
        .await
        .ok()
        .flatten()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok());

    let mut enriched = event_obj.clone();
    if let Some(prev) = &existing {
        for key in ["thumbnail", "team1Image", "team2Image"] {
            if let Some(prev_val) = prev.get(key) {
                let prev_str = prev_val.as_str().unwrap_or("");
                if !prev_str.is_empty() {
                    enriched[key] = prev_val.clone();
                }
            }
        }
    }

    let market_key = format!("sportradar:market:{event_id}");
    let event_key = format!("sportradar:event:{event_id}");
    let odds_key = format!("sportradar:odds:{event_id}");

    let bulk = vec![
        (market_key, resp.to_string(), inplay_ttl),
        (event_key, enriched.to_string(), inplay_ttl),
        (
            odds_key,
            enriched
                .get("markets")
                .cloned()
                .unwrap_or_default()
                .to_string(),
            inplay_ttl,
        ),
    ];
    state.redis.bulk_setex(&bulk).await?;

    // Notify socket subscribers that this event changed. Payload is just the
    // ids — subscribers read the canonical body from Redis. Best-effort; a
    // missed publish only delays one frame at the client.
    let notify =
        serde_json::json!({ "eventId": event_id, "sportId": sport_id }).to_string();
    if let Err(e) = state.redis.publish(LIVE_UPDATE_CHANNEL, &notify).await {
        tracing::trace!(eid = %event_id, err = %e, "publish live-update failed");
    }
    Ok(())
}

/// Redis pub/sub channel name. Mirrored in
/// `newbackend/src/sports/sportradar-pubsub.service.ts`.
pub const LIVE_UPDATE_CHANNEL: &str = "sportradar:live-update";

fn fingerprint_event(event: &Value) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    // Fields the front-end actually re-renders on. Mirrors `buildLiveEventHash`
    // in the TS service, hashed instead of stringified.
    for key in [
        "status",
        "eventStatus",
        "catId",
        "homeScore",
        "awayScore",
        "winnerBlocked",
        "premiumEnabled",
    ] {
        event.get(key).map(|v| v.to_string()).unwrap_or_default().hash(&mut hasher);
    }
    if let Some(markets) = event.get("markets") {
        // Stringify the markets blob — small enough at our cardinality and
        // captures back/lay price changes deeply.
        markets.to_string().hash(&mut hasher);
    }
    hasher.finish()
}

// ═══════════════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════════════

/// Fetch every page of a paginated `{endpoint}?sportId=X&pageNo=N` endpoint
/// and return the merged `sports` array.
async fn fetch_all_pages(
    state: &SyncState,
    endpoint: &str,
    sport_id: &str,
) -> Result<Vec<Value>> {
    let first_raw = state
        .client
        .api_get(endpoint, &[("sportId", sport_id), ("pageNo", "1")], false)
        .await?;
    let first: EventsResponse = match serde_json::from_value(first_raw) {
        Ok(v) => v,
        Err(_) => return Ok(Vec::new()),
    };
    if !first.success {
        return Ok(Vec::new());
    }

    let mut all = first.sports;
    let total = first.events_count.max(all.len());
    let pages = total.div_ceil(PAGE_SIZE);

    for page in 2..=pages {
        let page_str = page.to_string();
        let raw = state
            .client
            .api_get(
                endpoint,
                &[("sportId", sport_id), ("pageNo", page_str.as_str())],
                false,
            )
            .await;
        match raw {
            Ok(v) => {
                if let Ok(parsed) = serde_json::from_value::<EventsResponse>(v) {
                    if parsed.success {
                        all.extend(parsed.sports);
                    }
                }
            }
            Err(e) => {
                tracing::debug!(endpoint, sport_id, page, err = %e, "page fetch failed");
                break;
            }
        }
        // Tiny breather between pages so we don't spike per-host budgets.
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
    Ok(all)
}

/// Merge admin-curated `thumbnail`/`team1Image`/`team2Image` from Mongo onto
/// raw API events in-place (slice of `&Value` references — for read-only).
async fn overlay_admin_images(state: &SyncState, _events: &[Value]) {
    // No-op for slice form — kept as a stub so callers can swap in.
    // The owned-form `overlay_admin_images_owned` is what we actually use.
    let _ = state;
}

async fn overlay_admin_images_owned(state: &SyncState, events: &mut [Value]) {
    let ids: Vec<String> = events
        .iter()
        .filter_map(|e| e.get("eventId").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect();
    if ids.is_empty() {
        return;
    }
    let map = state.mongo.admin_image_overlay(&ids).await;
    for ev in events.iter_mut() {
        let Some(eid) = ev.get("eventId").and_then(|v| v.as_str()).map(|s| s.to_string()) else {
            continue;
        };
        let Some((thumb, t1, t2)) = map.get(&eid) else { continue };
        if !thumb.is_empty() {
            ev["thumbnail"] = json!(thumb);
        }
        if !t1.is_empty() {
            ev["team1Image"] = json!(t1);
        }
        if !t2.is_empty() {
            ev["team2Image"] = json!(t2);
        }
    }
}

/// Propagate overlay changes from a flat list back into the per-sport groups
/// by event id — cheap O(n) merge so per-sport caches see the same images.
fn overlay_in_groups(by_sport: &mut HashMap<String, Vec<Value>>, all: &[Value]) {
    let mut by_id: HashMap<&str, &Value> = HashMap::with_capacity(all.len());
    for ev in all {
        if let Some(eid) = ev.get("eventId").and_then(|v| v.as_str()) {
            by_id.insert(eid, ev);
        }
    }
    for (_sport, evs) in by_sport.iter_mut() {
        for ev in evs.iter_mut() {
            let Some(eid) = ev.get("eventId").and_then(|v| v.as_str()) else { continue };
            if let Some(src) = by_id.get(eid) {
                *ev = (*src).clone();
            }
        }
    }
}
