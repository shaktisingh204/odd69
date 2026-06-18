# Zeero.bet Backend API Reference

This document outlines all the public endpoints exposed by your `zeero.bet` backend (`SportsController`). By pointing your secondary website to these endpoints (e.g., `https://api.zeero.bet` or whatever your backend URL is), you can fully consume cached Diamond API data, Live TV, and Scores without hitting the provider twice or worrying about IP/Domain restrictions.

> [!NOTE]
> Ensure your secondary website is replacing `https://api.zeero.bet` with the actual production URL of your NestJS backend.

---

## 1. Core Sports Data

### Get All Sports
Retrieves the list of active/visible sports.
* **Method**: `GET`
* **Endpoint**: `/sports/list`

### Get Sidebar Data
Retrieves the structured sidebar hierarchy (Sports -> Competitions -> Matches).
* **Method**: `GET`
* **Endpoint**: `/sports/sidebar`

### Get Competitions
Retrieves competitions, optionally filtered by sport.
* **Method**: `GET`
* **Endpoint**: `/sports/competitions`
* **Query Params**: `sportId` (optional)

### Get Team Icons
Retrieves custom team icons uploaded/managed in the admin panel.
* **Method**: `GET`
* **Endpoint**: `/sports/team-icons`

---

## 2. Match Discovery

### Get All Events (Recommended for UI)
Combined live and upcoming events—halves frontend round trips.
* **Method**: `GET`
* **Endpoint**: `/sports/all-events`
* **Query Params**: `sportId` (optional)

### Get Live Events
* **Method**: `GET`
* **Endpoint**: `/sports/live`
* **Query Params**: `sportId` (optional)

### Get Upcoming Events
* **Method**: `GET`
* **Endpoint**: `/sports/upcoming`
* **Query Params**: `sportId` (optional)

### Get Top / Home Events
Retrieves curated events for the homepage.
* **Method**: `GET`
* **Endpoint**: `/sports/top-events`
* **Method**: `GET`
* **Endpoint**: `/sports/home-events`

### Get Tournament Events
Retrieves all events under a specific tournament.
* **Method**: `GET`
* **Endpoint**: `/sports/tournament/{id}/events`

---

## 3. Match Details & Odds

### Get Match Details
Retrieves detailed information, markets, and odds for a specific match.
* **Method**: `GET`
* **Endpoint**: `/sports/match-details/{sportId}/{matchId}`
* **Query Params**: `userId` (optional)

### Get Match Status
Retrieves live market status (e.g., In-play, Suspended) for polling.
* **Method**: `GET`
* **Endpoint**: `/sports/market-status/{matchId}`

### Check Odds Validation
Validates an array of bets before placement to ensure odds haven't changed.
* **Method**: `POST`
* **Endpoint**: `/sports/check-odds`
* **Body**: `{ "bets": [{ "marketId": "...", "selectionId": "...", "odds": 1.95 }] }`

---

## 4. Live TV and Scorecard (Proxy Enabled)

> [!IMPORTANT]
> To bypass CSP restrictions (`frame-ancestors`) from the upstream provider on your secondary website, you **MUST** use the `stream-proxy` endpoint for the `iframe src` when rendering TV and Score URLs.

### Get TV Stream URL
* **Method**: `GET`
* **Endpoint**: `/sports/tv-url/{sportId}/{matchId}`
* **Returns**: `{ "url": "..." }`

### Get Scorecard URL
* **Method**: `GET`
* **Endpoint**: `/sports/score-url/{sportId}/{matchId}`
* **Returns**: `{ "url": "..." }`

### Get Both Together
* **Method**: `GET`
* **Endpoint**: `/sports/scorecard-tv/{sportId}/{matchId}`
* **Returns**: `{ "tvUrl": "...", "scoreUrl": "..." }`

### 🛡️ The Bypass Stream Proxy
Strips upstream headers allowing you to embed the stream securely on your other domains.
* **Method**: `GET`
* **Endpoint**: `/sports/stream-proxy?url={ENCODED_STREAM_URL}`
* **Usage**: `<iframe src="https://api.zeero.bet/sports/stream-proxy?url=ENCODED_STREAM_URL" />`

---

## 5. Synchronization Commands

If your secondary website needs to force `zeero.bet` to sync data from the Diamond API manually.

### Sync All Data
* **Method**: `GET`
* **Endpoint**: `/sports/sync-data`

### Force Market Sync
* **Method**: `GET`
* **Endpoint**: `/sports/sync-market`

### Import Market Data (Session/sports)
* **Method**: `POST`
* **Endpoint**: `/sports/import-market/{matchId}`
