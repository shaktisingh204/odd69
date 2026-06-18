//! Sportradar API response types + HTTP client with round-robin, rate-limit
//! and a per-request Redis read-through cache. Everything stays JSON-typed
//! (`serde_json::Value`) for the deep "event" payload so we don't lose any
//! upstream fields when we cache to Redis. Only fields we actually read in
//! Rust (sportId / eventId / status / sortOrder candidates) are typed.

use anyhow::{anyhow, Context, Result};
use governor::{
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter,
};
use nonzero_ext::nonzero;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

use crate::config::Config;
use crate::redis_writer::RedisWriter;

type Limiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock>;

#[derive(Debug, Deserialize, Clone)]
pub struct ApiSport {
    #[serde(rename = "sportName")]
    pub sport_name: String,
    #[serde(rename = "sportId")]
    pub sport_id: String,
    pub status: String,
    #[serde(default, rename = "partnerId")]
    pub _partner_id: String,
}

#[derive(Debug, Deserialize)]
pub struct AllSportsResponse {
    #[serde(default)]
    pub success: bool,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub sports: Vec<ApiSport>,
}

/// The events-catalogue / inplay-events / upcoming-events response wraps a
/// `sports` array but the items are FULL event objects, not sports. The TS
/// keeps the upstream field name — we do too.
#[derive(Debug, Deserialize)]
pub struct EventsResponse {
    #[serde(default)]
    pub success: bool,
    #[serde(default)]
    #[allow(dead_code)]
    pub message: String,
    #[serde(default)]
    pub sports: Vec<Value>,
    #[serde(default, rename = "eventsCount")]
    pub events_count: usize,
}

pub struct SportradarClient {
    pub cfg: Arc<Config>,
    http: Client,
    host_rr: AtomicUsize,
    redis: Arc<RedisWriter>,
    /// One limiter per host so each gets its full per-host budget.
    host_limiters: Vec<Arc<Limiter>>,
    /// Background-sync limiter (shared, all hosts).
    #[allow(dead_code)]
    bg_limiter: Arc<Limiter>,
    /// Coalesces concurrent identical requests through a single inflight call.
    inflight: Mutex<std::collections::HashMap<String, Arc<tokio::sync::Notify>>>,
}

impl SportradarClient {
    pub fn new(cfg: Arc<Config>, redis: Arc<RedisWriter>) -> Result<Self> {
        let http = Client::builder()
            .timeout(cfg.http_timeout)
            .pool_max_idle_per_host(64)
            .tcp_keepalive(Duration::from_secs(30))
            .user_agent("sports-sync-rust/0.2")
            .build()
            .context("build reqwest client")?;

        // governor needs nonzero quotas. Clamp to ≥1.
        let per_host = cfg.rps_per_host.max(1);
        let bg = cfg.bg_rps.max(1);
        let host_limiters = cfg
            .api_hosts
            .iter()
            .map(|_| {
                let quota = Quota::per_second(
                    std::num::NonZeroU32::new(per_host).unwrap_or(nonzero!(1u32)),
                )
                .allow_burst(std::num::NonZeroU32::new(per_host.max(50)).unwrap_or(nonzero!(50u32)));
                Arc::new(RateLimiter::direct(quota))
            })
            .collect();

        let bg_limiter = Arc::new(RateLimiter::direct(
            Quota::per_second(std::num::NonZeroU32::new(bg).unwrap_or(nonzero!(1u32)))
                .allow_burst(std::num::NonZeroU32::new(bg.max(50)).unwrap_or(nonzero!(50u32))),
        ));

        Ok(Self {
            cfg,
            http,
            host_rr: AtomicUsize::new(0),
            redis,
            host_limiters,
            bg_limiter,
            inflight: Mutex::new(Default::default()),
        })
    }

    #[allow(dead_code)]
    pub fn bg_limiter(&self) -> Arc<Limiter> {
        self.bg_limiter.clone()
    }

    /// Wait for a slot in the host limiter for `host_idx`. Yields to other
    /// tasks if the bucket is empty.
    async fn wait_host(&self, host_idx: usize) {
        if let Some(l) = self.host_limiters.get(host_idx) {
            l.until_ready().await;
        }
    }

    fn build_url(&self, host: &str, path: &str, qs: &str) -> String {
        if qs.is_empty() {
            format!("{}{}/{}", host, self.cfg.api_path, path)
        } else {
            format!("{}{}/{}?{}", host, self.cfg.api_path, path, qs)
        }
    }

    fn encode_qs(params: &[(&str, &str)]) -> String {
        // Tiny manual encoder — params come from internal callers (sportId/pageNo)
        // so we don't bother with full RFC3986 handling. Colons in sport IDs
        // (sr:sport:21) are URL-safe sub-delims, but we percent-encode them
        // to match the TS `URLSearchParams` behavior.
        params
            .iter()
            .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
            .collect::<Vec<_>>()
            .join("&")
    }

    /// GET an upstream endpoint with:
    ///   1. Redis read-through (sr:cache:{path}:{qs}, TTL = request_cache_ttl_ms)
    ///   2. Round-robin host pick, per-host rate limit
    ///   3. Failover to the other host on connect/5xx
    pub async fn api_get(
        &self,
        path: &str,
        params: &[(&str, &str)],
        bypass_cache: bool,
    ) -> Result<Value> {
        let qs = Self::encode_qs(params);
        let cache_key = format!("sr:cache:{path}:{qs}");

        if !bypass_cache && self.cfg.request_cache_ttl_ms > 0 {
            if let Some(hit) = self.redis.get_primary(&cache_key).await.ok().flatten() {
                if let Ok(v) = serde_json::from_str::<Value>(&hit) {
                    return Ok(v);
                }
            }
        }

        // Coalesce identical concurrent requests through a single inflight
        // call so 130 live-odds tasks all asking for the same sport's
        // event don't burn 130 upstream slots.
        let notify = {
            let mut map = self.inflight.lock().await;
            if let Some(n) = map.get(&cache_key) {
                let n = n.clone();
                drop(map);
                n.notified().await;
                // After the leader finishes, re-read the cache. If it's
                // there, return it; otherwise fall through and fetch.
                if !bypass_cache {
                    if let Some(hit) = self.redis.get_primary(&cache_key).await.ok().flatten() {
                        if let Ok(v) = serde_json::from_str::<Value>(&hit) {
                            return Ok(v);
                        }
                    }
                }
                None
            } else {
                let n = Arc::new(tokio::sync::Notify::new());
                map.insert(cache_key.clone(), n.clone());
                Some(n)
            }
        };

        let result = self.fetch_with_failover(path, &qs).await;

        if let Some(n) = notify {
            // Cache successes; do NOT cache errors (let the next caller retry).
            if let Ok(v) = &result {
                if !bypass_cache && self.cfg.request_cache_ttl_ms > 0 {
                    let _ = self
                        .redis
                        .setex_pmillis(&cache_key, &v.to_string(), self.cfg.request_cache_ttl_ms)
                        .await;
                }
            }
            // Wake any waiters and clear our slot.
            n.notify_waiters();
            let mut map = self.inflight.lock().await;
            map.remove(&cache_key);
        }

        result
    }

    async fn fetch_with_failover(&self, path: &str, qs: &str) -> Result<Value> {
        let host_count = self.cfg.api_hosts.len();
        if host_count == 0 {
            return Err(anyhow!("no API hosts configured"));
        }

        let start = self.host_rr.fetch_add(1, Ordering::Relaxed) % host_count;
        let mut last_err: Option<anyhow::Error> = None;

        for offset in 0..host_count {
            let idx = (start + offset) % host_count;
            let host = &self.cfg.api_hosts[idx];

            self.wait_host(idx).await;

            let url = self.build_url(host, path, qs);
            match self.do_request(&url).await {
                Ok(v) => return Ok(v),
                Err(e) => {
                    tracing::debug!(host = %host, path = %path, error = %e, "upstream attempt failed");
                    last_err = Some(e);
                }
            }
        }

        Err(last_err.unwrap_or_else(|| anyhow!("upstream {} failed", path)))
    }

    async fn do_request(&self, url: &str) -> Result<Value> {
        let res = self
            .http
            .get(url)
            .header("x-betnex-key", &self.cfg.api_key)
            .send()
            .await
            .with_context(|| format!("GET {url}"))?;

        let status = res.status();
        let bytes = res.bytes().await.with_context(|| "read response body")?;

        if !status.is_success() {
            return Err(anyhow!(
                "upstream {} returned {}",
                url,
                status.as_u16()
            ));
        }

        serde_json::from_slice::<Value>(&bytes).with_context(|| "parse response JSON")
    }
}

/// Minimal application/x-www-form-urlencoded percent encoder for `:`, `/`,
/// `?`, `&`, `=`, ` `. We don't need full RFC3986 — params are internal.
fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
