//! MongoDB writer: bulk upserts for betfair_sports / betfair_events /
//! betfair_markets. Read paths look up admin-pinned fields (thumbnail,
//! team1Image, team2Image) so the sync loops can preserve them when
//! caching raw events.

use anyhow::{Context, Result};
use bson::{doc, Document};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use mongodb::{Client, Database};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

use crate::config::Config;
use crate::constants::{COLL_EVENTS, COLL_MARKETS, COLL_SPORTS, CRICKET_SPORT_ID};

#[derive(Clone)]
pub struct MongoWriter {
    pub db: Database,
}

impl MongoWriter {
    pub async fn connect(cfg: &Config) -> Result<Arc<Self>> {
        let client = Client::with_uri_str(&cfg.mongo_uri)
            .await
            .with_context(|| format!("connect mongo {}", cfg.mongo_uri))?;
        let db = client.database(&cfg.mongo_db);
        // Cheap connectivity probe.
        db.run_command(doc! { "ping": 1 }, None)
            .await
            .context("mongo ping")?;
        tracing::info!("Mongo connected to db `{}`", cfg.mongo_db);
        Ok(Arc::new(Self { db }))
    }

    /// Returns a map of `eventId → (thumbnail, team1Image, team2Image)` for
    /// the requested event ids. Used to overlay admin-curated images on the
    /// raw API events before caching.
    pub async fn admin_image_overlay(
        &self,
        event_ids: &[String],
    ) -> HashMap<String, (String, String, String)> {
        if event_ids.is_empty() {
            return HashMap::new();
        }
        let coll = self.db.collection::<Document>(COLL_EVENTS);
        let filter = doc! { "eventId": { "$in": event_ids } };
        let projection = doc! {
            "eventId": 1,
            "thumbnail": 1,
            "team1Image": 1,
            "team2Image": 1,
            "_id": 0,
        };
        let mut out = HashMap::with_capacity(event_ids.len());
        let cursor = coll
            .find(
                filter,
                mongodb::options::FindOptions::builder()
                    .projection(projection)
                    .build(),
            )
            .await;
        let mut cursor = match cursor {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("admin_image_overlay find failed: {e}");
                return out;
            }
        };
        use futures::stream::StreamExt;
        while let Some(doc) = cursor.next().await {
            let Ok(d) = doc else { continue };
            let eid = d.get_str("eventId").unwrap_or("").to_string();
            if eid.is_empty() {
                continue;
            }
            out.insert(
                eid,
                (
                    d.get_str("thumbnail").unwrap_or("").to_string(),
                    d.get_str("team1Image").unwrap_or("").to_string(),
                    d.get_str("team2Image").unwrap_or("").to_string(),
                ),
            );
        }
        out
    }

    /// Upserts the active sports catalogue. `sports` items must have the
    /// shape `{sport_id, sport_name}`. `sort_order_for` returns the canonical
    /// sortOrder for a given sport_id, or a fallback based on position.
    pub async fn upsert_sports(
        &self,
        sports: &[(String, String)], // (sport_id, sport_name)
        sort_order_for: impl Fn(&str, usize) -> u32,
    ) -> Result<usize> {
        let coll = self.db.collection::<Document>(COLL_SPORTS);
        let mut count = 0usize;
        for (i, (sport_id, sport_name)) in sports.iter().enumerate() {
            let filter = doc! { "sportId": sport_id };
            let update = doc! {
                "$set": {
                    "name": sport_name,
                    "sortOrder": sort_order_for(sport_id, i) as i32,
                    "isActive": true,
                    "isTab": true,
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                },
                "$setOnInsert": {
                    "sportId": sport_id,
                    "isDefault": sport_id == CRICKET_SPORT_ID,
                    "createdAt": bson::DateTime::from_chrono(Utc::now()),
                },
            };
            coll.update_one(filter, update, UpdateOptions::builder().upsert(true).build())
                .await
                .with_context(|| format!("upsert sport {sport_id}"))?;
            count += 1;
        }
        Ok(count)
    }

    /// Bulk-upsert a list of events derived from a raw Sportradar API payload.
    /// Skips events with no eventId. Mirrors `mapEvent()` in the TS service.
    pub async fn upsert_events(&self, raw_events: &[Value]) -> Result<usize> {
        if raw_events.is_empty() {
            return Ok(0);
        }
        let coll = self.db.collection::<Document>(COLL_EVENTS);
        let mut count = 0usize;
        // Mongo Rust driver doesn't expose bulkWrite cleanly across versions;
        // chunked update_one with upsert is good enough at our cardinality
        // (~few hundred events per sport).
        for ev in raw_events {
            let Some(event_id) = ev.get("eventId").and_then(|v| v.as_str()) else {
                continue;
            };
            let filter = doc! { "eventId": event_id };
            let now = bson::DateTime::from_chrono(Utc::now());
            let mapped = map_event_to_doc(ev);
            let update = doc! {
                "$set": &mapped,
                "$setOnInsert": { "createdAt": &now },
                "$currentDate": { "updatedAt": true },
            };
            if let Err(e) = coll
                .update_one(filter, update, UpdateOptions::builder().upsert(true).build())
                .await
            {
                tracing::warn!("upsert_event {event_id} failed: {e}");
                continue;
            }
            count += 1;
        }
        Ok(count)
    }

    /// Bulk-upsert markets derived from a raw event's `markets.matchOdds`
    /// array. Composite marketId is `{eventId}:{marketId}` to dedup across
    /// events. Mirrors `mapMarkets()` in the TS service.
    pub async fn upsert_markets(&self, raw_events: &[Value]) -> Result<usize> {
        if raw_events.is_empty() {
            return Ok(0);
        }
        let coll = self.db.collection::<Document>(COLL_MARKETS);
        let mut total = 0usize;
        for ev in raw_events {
            let event_id = match ev.get("eventId").and_then(|v| v.as_str()) {
                Some(s) => s,
                None => continue,
            };
            let Some(match_odds) = ev
                .get("markets")
                .and_then(|m| m.get("matchOdds"))
                .and_then(|v| v.as_array())
            else {
                continue;
            };
            for m in match_odds {
                let Some(doc) = map_market_to_doc(ev, event_id, m) else { continue };
                let mid = doc.get_str("marketId").unwrap_or("").to_string();
                if mid.is_empty() {
                    continue;
                }
                let filter = doc! { "marketId": &mid };
                let update = doc! {
                    "$set": &doc,
                    "$currentDate": { "updatedAt": true },
                };
                if let Err(e) = coll
                    .update_one(filter, update, UpdateOptions::builder().upsert(true).build())
                    .await
                {
                    tracing::warn!("upsert_market {mid} failed: {e}");
                    continue;
                }
                total += 1;
            }
        }
        Ok(total)
    }
}

// ──────────────────────────────────────────────────────────────────────────
//  JSON-Value → BSON mapping
// ──────────────────────────────────────────────────────────────────────────

fn map_event_to_doc(ev: &Value) -> Document {
    let event_id = ev.get("eventId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let sport_id = ev.get("sportId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let competition_id = ev
        .get("competitionId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let competition_name = ev
        .get("competitionName")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let country = ev.get("country").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let event_name = ev.get("eventName").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let (home, away) = split_event_name(&event_name);

    let open_date_ms = ev.get("openDate").and_then(|v| v.as_i64()).unwrap_or(0);
    let market_start_time = if open_date_ms > 0 {
        chrono::DateTime::<Utc>::from_timestamp_millis(open_date_ms)
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_default()
    } else {
        String::new()
    };

    let status_str = ev.get("status").and_then(|v| v.as_str()).unwrap_or("");
    let cat_id = ev.get("catId").and_then(|v| v.as_str()).unwrap_or("");
    let inplay = status_str == "LIVE" || cat_id == "LIVE";
    let status_mapped = if status_str == "CLOSED" { "CLOSED" } else { "OPEN" };

    doc! {
        "eventId": event_id.clone(),
        "sportId": sport_id,
        "competitionId": competition_id,
        "competitionName": competition_name,
        "countryCode": country,
        "eventName": event_name,
        "homeTeam": home,
        "awayTeam": away,
        "marketStartTime": market_start_time,
        "inplay": inplay,
        "status": status_mapped,
        "isVisible": true,
        "primaryMarketId": format!("{event_id}:1"),
        "primaryMarketType": "MATCH_ODDS",
    }
}

fn split_event_name(name: &str) -> (String, String) {
    if let Some((a, b)) = name.split_once(" vs. ") {
        return (a.trim().to_string(), b.trim().to_string());
    }
    if let Some((a, b)) = name.split_once(" vs ") {
        return (a.trim().to_string(), b.trim().to_string());
    }
    (name.to_string(), String::new())
}

fn map_market_to_doc(ev: &Value, event_id: &str, m: &Value) -> Option<Document> {
    let market_id_raw = m.get("marketId").and_then(|v| v.as_str())?;
    let composite_id = format!("{event_id}:{market_id_raw}");
    let sport_id = ev.get("sportId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let competition_id = ev
        .get("competitionId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let market_name = m.get("marketName").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let market_type = m.get("marketType").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let m_status_raw = m.get("status").and_then(|v| v.as_str()).unwrap_or("");
    let status = if m_status_raw == "Active" { "OPEN" } else { "SUSPENDED" };

    let open_ms = ev.get("openDate").and_then(|v| v.as_i64()).unwrap_or(0);
    let market_start_time = if open_ms > 0 {
        chrono::DateTime::<Utc>::from_timestamp_millis(open_ms)
            .map(|dt| dt.to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
            .unwrap_or_default()
    } else {
        String::new()
    };

    let inplay = matches!(
        ev.get("status").and_then(|v| v.as_str()).unwrap_or(""),
        "LIVE"
    ) || matches!(ev.get("catId").and_then(|v| v.as_str()).unwrap_or(""), "LIVE");

    let runners_arr = m.get("runners").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let mut runners: Vec<Document> = Vec::with_capacity(runners_arr.len());
    let mut active_count = 0i32;
    for r in &runners_arr {
        let runner_id = r
            .get("runnerId")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        let runner_name = r.get("runnerName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let r_status_raw = r.get("status").and_then(|v| v.as_str()).unwrap_or("");
        let r_status = if r_status_raw == "Active" {
            active_count += 1;
            "ACTIVE"
        } else {
            "SUSPENDED"
        };
        let last_back_price = r
            .get("backPrices")
            .and_then(|v| v.as_array())
            .and_then(|arr| arr.first())
            .and_then(|p| p.get("price"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let backs = json_prices_to_bson(r.get("backPrices"));
        let lays = json_prices_to_bson(r.get("layPrices"));

        runners.push(doc! {
            "selectionId": runner_id,
            "runnerName": runner_name,
            "handicap": 0i32,
            "status": r_status,
            "lastPriceTraded": last_back_price,
            "totalMatched": 0i32,
            "availableToBack": backs,
            "availableToLay": lays,
        });
    }

    Some(doc! {
        "marketId": composite_id,
        "eventId": event_id,
        "sportId": sport_id,
        "competitionId": competition_id,
        "marketName": market_name,
        "marketType": market_type,
        "bettingType": "ODDS",
        "marketStartTime": market_start_time,
        "status": status,
        "inplay": inplay,
        "stopBet": false,
        "numberOfRunners": runners.len() as i32,
        "numberOfActiveRunners": active_count,
        "runners": runners,
        "isVisible": true,
        "oddsUpdatedAt": bson::DateTime::from_chrono(Utc::now()),
    })
}

fn json_prices_to_bson(v: Option<&Value>) -> Vec<Document> {
    let Some(arr) = v.and_then(|x| x.as_array()) else {
        return Vec::new();
    };
    arr.iter()
        .filter_map(|p| {
            let price = p.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let size = p.get("size").and_then(|v| v.as_f64()).unwrap_or(0.0);
            Some(doc! { "price": price, "size": size })
        })
        .collect()
}
