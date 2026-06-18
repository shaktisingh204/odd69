//! Dual-Redis writer: mirrors every `sportradar:*` write to the proxy Redis,
//! but keeps reads (and the `sr:cache:*` request cache) on the primary only.
//!
//! Same fan-out shape as `wrapWithSportradarMirror()` in the TS service, but
//! built as an explicit struct rather than a JS Proxy.

use anyhow::{Context, Result};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use std::sync::Arc;

use crate::config::Config;

const MIRROR_PREFIX: &str = "sportradar:";

#[derive(Clone)]
pub struct RedisWriter {
    primary: ConnectionManager,
    /// `Some` only when PROXY_REDIS_* differs from the primary.
    mirror: Option<ConnectionManager>,
}

impl RedisWriter {
    pub async fn connect(cfg: &Config) -> Result<Arc<Self>> {
        let primary_client = redis::Client::open(cfg.redis_url.as_str())
            .with_context(|| format!("primary redis open {}", cfg.redis_url))?;
        let primary = ConnectionManager::new(primary_client)
            .await
            .context("primary redis connect")?;

        let mirror = if let Some(url) = &cfg.proxy_redis_url {
            let c = redis::Client::open(url.as_str())
                .with_context(|| format!("proxy redis open {}", url))?;
            Some(
                ConnectionManager::new(c)
                    .await
                    .context("proxy redis connect")?,
            )
        } else {
            None
        };

        if mirror.is_some() {
            tracing::info!("Proxy redis mirror enabled at {:?}", cfg.proxy_redis_url);
        } else {
            tracing::info!("Proxy redis mirror disabled (no PROXY_REDIS_URL/HOST)");
        }

        Ok(Arc::new(Self { primary, mirror }))
    }

    /// Read from the primary only — mirrors are write-only.
    pub async fn get_primary(&self, key: &str) -> Result<Option<String>> {
        let mut c = self.primary.clone();
        let val: Option<String> = c.get(key).await?;
        Ok(val)
    }

    #[allow(dead_code)]
    pub async fn mget_primary(&self, keys: &[String]) -> Result<Vec<Option<String>>> {
        if keys.is_empty() {
            return Ok(Vec::new());
        }
        let mut c = self.primary.clone();
        // redis-rs returns Vec<Option<String>> when all values may be missing.
        let vals: Vec<Option<String>> = c.mget(keys).await?;
        Ok(vals)
    }

    /// SET with EX (seconds). Mirrors to proxy if key is `sportradar:*`.
    pub async fn setex(&self, key: &str, value: &str, ttl_secs: u64) -> Result<()> {
        let mut c = self.primary.clone();
        let _: () = c.set_ex(key, value, ttl_secs).await?;

        if let Some(m) = &self.mirror {
            if key.starts_with(MIRROR_PREFIX) {
                let mut mc = m.clone();
                // Fire-and-forget on the mirror so a slow proxy doesn't slow
                // down the primary write path.
                let key = key.to_string();
                let value = value.to_string();
                tokio::spawn(async move {
                    let _: Result<(), _> = mc.set_ex::<_, _, ()>(&key, value, ttl_secs).await;
                });
            }
        }
        Ok(())
    }

    /// SET with PX (milliseconds). Used for the per-request `sr:cache:*` keys
    /// — never mirrored (they're internal).
    pub async fn setex_pmillis(&self, key: &str, value: &str, ttl_ms: u64) -> Result<()> {
        let mut c = self.primary.clone();
        let _: () = redis::cmd("SET")
            .arg(key)
            .arg(value)
            .arg("PX")
            .arg(ttl_ms)
            .query_async(&mut c)
            .await?;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn del(&self, key: &str) -> Result<()> {
        let mut c = self.primary.clone();
        let _: () = c.del(key).await?;
        if let Some(m) = &self.mirror {
            if key.starts_with(MIRROR_PREFIX) {
                let mut mc = m.clone();
                let key = key.to_string();
                tokio::spawn(async move {
                    let _: Result<(), _> = mc.del::<_, ()>(&key).await;
                });
            }
        }
        Ok(())
    }

    /// Bulk SETEX. Writes to primary in a pipeline, and to the mirror in a
    /// separate pipeline (only mirrored-prefix keys). Logs but doesn't fail
    /// on mirror errors.
    pub async fn bulk_setex(&self, entries: &[(String, String, u64)]) -> Result<()> {
        if entries.is_empty() {
            return Ok(());
        }
        let mut c = self.primary.clone();
        let mut pipe = redis::pipe();
        for (k, v, ttl) in entries {
            pipe.cmd("SET").arg(k).arg(v).arg("EX").arg(*ttl).ignore();
        }
        let _: () = pipe.query_async(&mut c).await.context("primary bulk setex")?;

        if let Some(m) = &self.mirror {
            let mirror_entries: Vec<_> = entries
                .iter()
                .filter(|(k, _, _)| k.starts_with(MIRROR_PREFIX))
                .cloned()
                .collect();
            if !mirror_entries.is_empty() {
                let mut mc = m.clone();
                tokio::spawn(async move {
                    let mut pipe = redis::pipe();
                    for (k, v, ttl) in &mirror_entries {
                        pipe.cmd("SET").arg(k).arg(v).arg("EX").arg(*ttl).ignore();
                    }
                    if let Err(e) = pipe.query_async::<_, ()>(&mut mc).await {
                        tracing::warn!("mirror bulk_setex failed: {e}");
                    }
                });
            }
        }
        Ok(())
    }

    pub async fn ping(&self) -> Result<()> {
        let mut c = self.primary.clone();
        redis::cmd("PING").query_async::<_, String>(&mut c).await?;
        Ok(())
    }

    /// Publish a small JSON notification to `channel` on the primary Redis.
    /// Subscribers (NestJS `SportradarPubsubService`) look the canonical body
    /// up in Redis themselves — we only ship identifiers in pub/sub so the
    /// message stays cheap to fan out across instances.
    pub async fn publish(&self, channel: &str, payload: &str) -> Result<()> {
        let mut c = self.primary.clone();
        let _: i64 = c.publish(channel, payload).await?;
        Ok(())
    }
}
