use once_cell::sync::Lazy;
use std::collections::HashMap;

/// Well-known sport sort order. Matches `SORT_ORDER` in `sportradar.service.ts`.
/// Sports not listed get a sortOrder of `50 + position-in-API-response`.
pub static SORT_ORDER: Lazy<HashMap<&'static str, u32>> = Lazy::new(|| {
    [
        ("sr:sport:21", 1),  // Cricket
        ("sr:sport:1", 2),   // Soccer
        ("sr:sport:5", 3),   // Tennis
        ("sr:sport:2", 4),   // Basketball
        ("sr:sport:12", 5),  // Rugby
        ("sr:sport:4", 6),   // Ice Hockey
        ("sr:sport:3", 7),   // Baseball
        ("sr:sport:16", 8),  // American Football
        ("sr:sport:138", 9), // Kabaddi
        ("sr:sport:31", 10), // Badminton
        ("sr:sport:20", 11), // Table Tennis
        ("sr:sport:23", 12), // Volleyball
        ("sr:sport:29", 13), // Futsal
        ("sr:sport:19", 14), // Snooker
        ("sr:sport:22", 15), // Darts
        ("sr:sport:117", 16),// MMA
    ]
    .into_iter()
    .collect()
});

/// Stable list of sport IDs we sync — same as SORT_ORDER keys sorted by value.
/// Returned as `&'static [&'static str]` so callers can iterate cheaply.
pub fn known_sport_ids() -> Vec<&'static str> {
    let mut entries: Vec<(&&str, &u32)> = SORT_ORDER.iter().collect();
    entries.sort_by_key(|&(_, v)| *v);
    entries.into_iter().map(|(k, _)| *k).collect()
}

pub const PAGE_SIZE: usize = 100;
pub const CRICKET_SPORT_ID: &str = "sr:sport:21";

/// Mongo collection names. Kept identical to the NestJS schemas.
pub const COLL_SPORTS: &str = "betfair_sports";
pub const COLL_EVENTS: &str = "betfair_events";
pub const COLL_MARKETS: &str = "betfair_markets";
