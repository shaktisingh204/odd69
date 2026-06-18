//! sports-sync-rust — Sportradar sync daemon.
//!
//! Polls Sportradar's two upstream hosts (round-robin, rate-limited), writes
//! catalogue + events + odds into Redis (mirrored to a proxy Redis if
//! configured) and MongoDB. NestJS reads the same Redis + Mongo via its
//! existing `sportradar-proxy` controller.
//!
//! Five concurrent loops:
//!   • sports   — every SPORTS_SYNC_INTERVAL_SECS  (default 180s)
//!   • events   — every EVENTS_SYNC_INTERVAL_SECS  (default  90s, full catalogue)
//!   • inplay   — every INPLAY_SYNC_INTERVAL_SECS  (default   5s, fast scores)
//!   • upcoming — every UPCOMING_SYNC_INTERVAL_SECS(default  30s)
//!   • live-odds— every LIVE_ODDS_TICK_MS          (default 222ms, per-event list-market)

mod config;
mod constants;
mod mongo_writer;
mod redis_writer;
mod sportradar;
mod sync;

use anyhow::{Context, Result};
use std::sync::Arc;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<()> {
    // Best-effort .env — production deploys set vars via PM2/systemd.
    let _ = dotenvy::dotenv();

    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,sports_sync_rust=info")),
        )
        .with_target(false)
        .init();

    let cfg = Arc::new(config::Config::from_env().context("load config")?);
    tracing::info!(
        primary = %cfg.api_hosts.get(0).map(String::as_str).unwrap_or(""),
        secondary = %cfg.api_hosts.get(1).map(String::as_str).unwrap_or(""),
        "Sportradar hosts"
    );

    let redis = redis_writer::RedisWriter::connect(&cfg)
        .await
        .context("connect redis")?;
    redis.ping().await.context("redis ping")?;

    let mongo = mongo_writer::MongoWriter::connect(&cfg)
        .await
        .context("connect mongo")?;

    let client = Arc::new(
        sportradar::SportradarClient::new(cfg.clone(), redis.clone()).context("sportradar client")?,
    );
    let state = sync::SyncState::new(cfg.clone(), client, redis, mongo);

    // Kick off all five loops. They run forever; if any panics the supervisor
    // (PM2) restarts the whole binary.
    let h_sports = tokio::spawn(sync::run_sports(state.clone()));
    let h_events = tokio::spawn(sync::run_events(state.clone()));
    let h_inplay = tokio::spawn(sync::run_inplay(state.clone()));
    let h_upcoming = tokio::spawn(sync::run_upcoming(state.clone()));
    let h_live = tokio::spawn(sync::run_live_odds(state.clone()));

    tracing::info!(
        sports_ttl   = cfg.sports_ttl,
        events_ttl   = cfg.events_ttl,
        upcoming_ttl = cfg.upcoming_ttl,
        inplay_ttl   = cfg.inplay_ttl,
        live_tick_ms = cfg.live_odds_tick.as_millis() as u64,
        "All sync loops started"
    );

    // Graceful shutdown on SIGINT/SIGTERM. tokio gives us a JoinSet
    // implicitly via the spawned tasks — we await the first to exit (which
    // should never happen) or a signal.
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            tracing::info!("ctrl-c received, shutting down");
        }
        r = h_sports   => tracing::warn!("sports loop exited: {:?}", r),
        r = h_events   => tracing::warn!("events loop exited: {:?}", r),
        r = h_inplay   => tracing::warn!("inplay loop exited: {:?}", r),
        r = h_upcoming => tracing::warn!("upcoming loop exited: {:?}", r),
        r = h_live     => tracing::warn!("live-odds loop exited: {:?}", r),
    }
    Ok(())
}
