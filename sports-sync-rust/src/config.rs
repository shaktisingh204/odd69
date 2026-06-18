use std::env;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Config {
    pub api_hosts: Vec<String>,
    pub api_path: String,
    pub api_key: String,

    pub redis_url: String,
    pub proxy_redis_url: Option<String>,

    pub mongo_uri: String,
    pub mongo_db: String,

    // Sync cadences. Defaults are sane — overridable per env.
    pub sports_sync_interval: Duration,
    pub events_sync_interval: Duration,
    pub inplay_sync_interval: Duration,
    pub upcoming_sync_interval: Duration,
    pub live_odds_tick: Duration,

    // Rate budget. 300/s/host × 2 = 600/s total.
    // Background sync stays at 150/s to leave headroom for live-odds.
    pub rps_per_host: u32,
    pub bg_rps: u32,
    pub max_live_calls_per_tick: usize,

    // Per-request response cache TTL in milliseconds (sr:cache:* key).
    pub request_cache_ttl_ms: u64,

    // Per-key TTLs (seconds).
    pub sports_ttl: u64,
    pub events_ttl: u64,
    pub upcoming_ttl: u64,
    pub inplay_ttl: u64,

    // HTTP request timeout.
    pub http_timeout: Duration,
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

fn env_u32(key: &str, default: u32) -> u32 {
    env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

fn env_usize(key: &str, default: usize) -> usize {
    env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

fn strip_trailing_slash(s: &str) -> String {
    s.trim_end_matches('/').to_string()
}

fn redis_url_from_parts(prefix: &str) -> Option<String> {
    let host = env::var(format!("{prefix}REDIS_HOST")).ok()?;
    let port = env::var(format!("{prefix}REDIS_PORT"))
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(6379);
    let password = env::var(format!("{prefix}REDIS_PASSWORD")).ok();
    let db = env::var(format!("{prefix}REDIS_DB"))
        .ok()
        .and_then(|v| v.parse::<u8>().ok())
        .unwrap_or(0);
    let auth = match password {
        Some(p) if !p.is_empty() => format!(":{p}@"),
        _ => String::new(),
    };
    Some(format!("redis://{auth}{host}:{port}/{db}"))
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        // Primary Redis. Fall back to a localhost default to keep dev simple.
        let redis_url = env::var("REDIS_URL")
            .ok()
            .or_else(|| redis_url_from_parts(""))
            .unwrap_or_else(|| "redis://127.0.0.1:6379/0".to_string());

        // Proxy Redis (optional — mirror of every sportradar:* write).
        let proxy_redis_url = env::var("PROXY_REDIS_URL")
            .ok()
            .or_else(|| redis_url_from_parts("PROXY_"))
            .filter(|u| u != &redis_url);

        let api_hosts = vec![
            strip_trailing_slash(&env_or(
                "SPORTRADAR_HOST_PRIMARY",
                "http://62.72.41.209:8087",
            )),
            strip_trailing_slash(&env_or(
                "SPORTRADAR_HOST_SECONDARY",
                "http://local.turnkeyxgaming.com:8087",
            )),
        ];

        Ok(Self {
            api_hosts,
            api_path: env_or("SPORTRADAR_API_PATH", "/api/v1/sportsradar"),
            api_key: env_or("SPORTRADAR_API_KEY", "67f1a9c2d4e8b1a3c9f05673"),

            redis_url,
            proxy_redis_url,

            mongo_uri: env::var("MONGO_URI").or_else(|_| env::var("MONGODB_URI")).unwrap_or_else(|_| {
                "mongodb://127.0.0.1:27017".to_string()
            }),
            mongo_db: env_or("MONGO_DB", "test"),

            sports_sync_interval: Duration::from_secs(env_u64("SPORTS_SYNC_INTERVAL_SECS", 180)),
            events_sync_interval: Duration::from_secs(env_u64("EVENTS_SYNC_INTERVAL_SECS", 90)),
            inplay_sync_interval: Duration::from_secs(env_u64("INPLAY_SYNC_INTERVAL_SECS", 5)),
            upcoming_sync_interval: Duration::from_secs(env_u64("UPCOMING_SYNC_INTERVAL_SECS", 30)),
            live_odds_tick: Duration::from_millis(env_u64("LIVE_ODDS_TICK_MS", 222)),

            rps_per_host: env_u32("SPORTRADAR_RPS_PER_HOST", 300),
            bg_rps: env_u32("SPORTRADAR_BG_RPS", 150),
            max_live_calls_per_tick: env_usize("SPORTRADAR_MAX_LIVE_CALLS_PER_TICK", 130),

            request_cache_ttl_ms: env_u64("SPORTRADAR_REQ_CACHE_TTL_MS", 222),

            // TTLs deliberately set ≥ 3× sync interval to absorb sync hiccups
            // without flickering sports/events out of /sportradar/* listings.
            sports_ttl: env_u64("SPORTRADAR_SPORTS_TTL", 600),
            events_ttl: env_u64("SPORTRADAR_EVENTS_TTL", 600),
            upcoming_ttl: env_u64("SPORTRADAR_UPCOMING_TTL", 300),
            inplay_ttl: env_u64("SPORTRADAR_INPLAY_TTL", 60),

            http_timeout: Duration::from_secs(env_u64("SPORTRADAR_HTTP_TIMEOUT_SECS", 8)),
        })
    }
}
