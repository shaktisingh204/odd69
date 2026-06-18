// ─────────────────────────────────────────────────────────────────────────────
// OddsApiSyncService
// Fetches The Odds API ONCE on startup, writes data into Redis,
// and broadcasts to all connected Socket.IO clients immediately.
// No polling after startup — data is served from Redis until next restart.
//
// Redis key schema
//   oddsapi:sports              → SportInfo[]          TTL 4 h
//   oddsapi:events:{sportKey}   → OddsEvent[]          TTL 2 h
//   oddsapi:quota               → { used, remaining }  TTL 10 s
//
// Trigger
//   Sports list   → once on startup
//   Events/odds   → once on startup, all active sports in parallel
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { EventsGateway } from '../events.gateway';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
  last_update?: string;
  outcomes: OddsOutcome[];
}

export interface OddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsMarket[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

export interface SportInfo {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SPORTS_CACHE_KEY = 'oddsapi:sports';
const SPORTS_TTL_S = 4 * 3600; // 4 hours

const EVENTS_TTL_S = 2 * 3600; // 2 hours — startup-only sync, hold until next restart

// The sports we actively want to sync events for.
// Add/remove keys to adjust data freshness vs. API quota cost.
const ACTIVE_SPORT_KEYS = [
  'soccer_epl',
  'soccer_uefa_champs_league',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_germany_bundesliga',
  'cricket_ipl',
  'cricket_test_match',
  'cricket_odi',
  'basketball_nba',
  'basketball_euroleague',
  'americanfootball_nfl',
  'tennis_atp_french_open',
  'tennis_wta_french_open',
  'icehockey_nhl',
  'mma_mixed_martial_arts',
  'boxing_boxing',
  'baseball_mlb',
  'rugbyleague_nrl',
];

// Fallback list when no API key is set (prevents empty sports rail on UI)
const FALLBACK_SPORTS: SportInfo[] = [
  { key: 'soccer_epl', group: 'Soccer', title: 'EPL', description: 'English Premier League', active: true, has_outrights: false },
  { key: 'soccer_uefa_champs_league', group: 'Soccer', title: 'UEFA Champions League', description: 'Champions League', active: true, has_outrights: false },
  { key: 'cricket_ipl', group: 'Cricket', title: 'IPL', description: 'Indian Premier League', active: true, has_outrights: false },
  { key: 'cricket_test_match', group: 'Cricket', title: 'Test Matches', description: 'International Tests', active: true, has_outrights: false },
  { key: 'basketball_nba', group: 'Basketball', title: 'NBA', description: 'US Basketball', active: true, has_outrights: false },
  { key: 'americanfootball_nfl', group: 'American Football', title: 'NFL', description: 'US Football', active: true, has_outrights: false },
  { key: 'tennis_atp_french_open', group: 'Tennis', title: 'ATP French Open', description: "Men's Singles", active: true, has_outrights: false },
  { key: 'icehockey_nhl', group: 'Ice Hockey', title: 'NHL', description: 'US Ice Hockey', active: true, has_outrights: false },
  { key: 'mma_mixed_martial_arts', group: 'Mixed Martial Arts', title: 'MMA', description: 'Mixed Martial Arts', active: true, has_outrights: false },
  { key: 'baseball_mlb', group: 'Baseball', title: 'MLB', description: 'Major League Baseball', active: true, has_outrights: false },
  { key: 'boxing_boxing', group: 'Boxing', title: 'Boxing', description: 'Professional Boxing', active: true, has_outrights: false },
  { key: 'rugbyleague_nrl', group: 'Rugby League', title: 'NRL', description: 'Aussie Rugby League', active: true, has_outrights: false },
  { key: 'soccer_spain_la_liga', group: 'Soccer', title: 'La Liga', description: 'Spanish Soccer', active: true, has_outrights: false },
  { key: 'soccer_germany_bundesliga', group: 'Soccer', title: 'Bundesliga', description: 'German Soccer', active: true, has_outrights: false },
  { key: 'soccer_italy_serie_a', group: 'Soccer', title: 'Serie A', description: 'Italian Soccer', active: true, has_outrights: false },
];

// ─── Fallback events for when no API key is set ───────────────────────────────
const FALLBACK_EVENTS: Record<string, OddsEvent[]> = {
  soccer_epl: [
    {
      id: 'mock-epl-1', sport_key: 'soccer_epl', sport_title: 'EPL',
      commence_time: new Date(Date.now() + 2 * 3600000).toISOString(),
      home_team: 'Arsenal', away_team: 'Manchester City',
      bookmakers: [
        { key: 'betfair', title: 'Betfair', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 2.60 }, { name: 'Manchester City', price: 2.40 }, { name: 'Draw', price: 3.20 }] }] },
        { key: 'bet365', title: 'Bet365', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 2.55 }, { name: 'Manchester City', price: 2.50 }, { name: 'Draw', price: 3.10 }] }] },
        { key: 'williamhill', title: 'William Hill', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 2.62 }, { name: 'Manchester City', price: 2.35 }, { name: 'Draw', price: 3.25 }] }] },
      ],
    },
    {
      id: 'mock-epl-2', sport_key: 'soccer_epl', sport_title: 'EPL',
      commence_time: new Date(Date.now() + 4 * 3600000).toISOString(),
      home_team: 'Liverpool', away_team: 'Chelsea',
      bookmakers: [
        { key: 'betfair', title: 'Betfair', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Liverpool', price: 1.85 }, { name: 'Chelsea', price: 4.20 }, { name: 'Draw', price: 3.60 }] }] },
        { key: 'bet365', title: 'Bet365', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Liverpool', price: 1.83 }, { name: 'Chelsea', price: 4.30 }, { name: 'Draw', price: 3.50 }] }] },
      ],
    },
  ],
  cricket_ipl: [
    {
      id: 'mock-ipl-1', sport_key: 'cricket_ipl', sport_title: 'IPL',
      commence_time: new Date(Date.now() + 1 * 3600000).toISOString(),
      home_team: 'Mumbai Indians', away_team: 'Chennai Super Kings',
      bookmakers: [
        { key: 'betfair', title: 'Betfair', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Mumbai Indians', price: 1.90 }, { name: 'Chennai Super Kings', price: 1.90 }] }] },
        { key: 'bet365', title: 'Bet365', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Mumbai Indians', price: 1.88 }, { name: 'Chennai Super Kings', price: 1.95 }] }] },
      ],
    },
    {
      id: 'mock-ipl-2', sport_key: 'cricket_ipl', sport_title: 'IPL',
      commence_time: new Date(Date.now() + 25 * 3600000).toISOString(),
      home_team: 'Royal Challengers Bangalore', away_team: 'Delhi Capitals',
      bookmakers: [
        { key: 'betfair', title: 'Betfair', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Royal Challengers Bangalore', price: 1.75 }, { name: 'Delhi Capitals', price: 2.05 }] }] },
      ],
    },
  ],
  basketball_nba: [
    {
      id: 'mock-nba-1', sport_key: 'basketball_nba', sport_title: 'NBA',
      commence_time: new Date(Date.now() + 3 * 3600000).toISOString(),
      home_team: 'Los Angeles Lakers', away_team: 'Boston Celtics',
      bookmakers: [
        { key: 'fanduel', title: 'FanDuel', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Los Angeles Lakers', price: 2.20 }, { name: 'Boston Celtics', price: 1.65 }] }] },
        { key: 'draftkings', title: 'DraftKings', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Los Angeles Lakers', price: 2.18 }, { name: 'Boston Celtics', price: 1.67 }] }] },
        { key: 'betmgm', title: 'BetMGM', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Los Angeles Lakers', price: 2.25 }, { name: 'Boston Celtics', price: 1.62 }] }] },
      ],
    },
  ],
  americanfootball_nfl: [
    {
      id: 'mock-nfl-1', sport_key: 'americanfootball_nfl', sport_title: 'NFL',
      commence_time: new Date(Date.now() + 48 * 3600000).toISOString(),
      home_team: 'Kansas City Chiefs', away_team: 'San Francisco 49ers',
      bookmakers: [
        { key: 'fanduel', title: 'FanDuel', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Kansas City Chiefs', price: 1.72 }, { name: 'San Francisco 49ers', price: 2.10 }] }] },
        { key: 'draftkings', title: 'DraftKings', last_update: new Date().toISOString(), markets: [{ key: 'h2h', outcomes: [{ name: 'Kansas City Chiefs', price: 1.70 }, { name: 'San Francisco 49ers', price: 2.15 }] }] },
      ],
    },
  ],
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class OddsApiSyncService implements OnModuleInit {
  private readonly logger = new Logger(OddsApiSyncService.name);
  private readonly BASE_URL = 'https://api.the-odds-api.com';
  private readonly API_KEY: string;
  private readonly REGION = 'eu';
  private readonly MARKETS = 'h2h';

  // Track remaining quota from API headers
  private quotaRemaining: number | null = null;
  private quotaUsed: number | null = null;

  // Guard: prevent overlapping sync runs
  private isSyncing = false;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {
    this.API_KEY = this.configService.get<string>('THE_ODDS_API_KEY') ?? '';
    if (!this.API_KEY) {
      this.logger.warn(
        '[OddsApiSync] THE_ODDS_API_KEY is not set. Running in demo mode with fallback data.',
      );
    } else {
      this.logger.log(
        '[OddsApiSync] API key configured. Live sync enabled.',
      );
    }
  }

  // ── Disabled: Sportradar is now the primary data source ───────────────────
  // onModuleInit() previously called warmCache() to hit The Odds API on startup.
  // That is now replaced by SportradarService which syncs all sports & events
  // on startup with a periodic cron refresh every 3 minutes.
  onModuleInit() {
    this.logger.log('[OddsApiSync] Startup sync DISABLED — Sportradar is the active data source.');
  }

  // ─── Cache warm-up on startup ─────────────────────────────────────────────

  async warmCache() {
    const keyPreview = this.API_KEY ? `${this.API_KEY.slice(0, 8)}...` : 'NOT SET';
    this.logger.log(`[OddsApiSync] Warming cache on startup — key: ${keyPreview}`);
    await this.syncSportsList();
    await new Promise((r) => setTimeout(r, 1000));
    await this.syncEventsBatch();
    this.logger.log('[OddsApiSync] warmCache() complete.');
  }

  // ─── One-shot: Sports list — called once on startup ──────────────────────

  async syncSportsList() {
    if (!this.API_KEY) {
      // Write fallback data so Redis always has something
      await this.redisService.setPacket(SPORTS_CACHE_KEY, FALLBACK_SPORTS, SPORTS_TTL_S);
      this.logger.debug('[OddsApiSync] Demo mode: wrote fallback sports list to Redis');
      return;
    }

    try {
      const url = `${this.BASE_URL}/v4/sports/?apiKey=${this.API_KEY}&all=false`;
      this.logger.log('[OddsApiSync] Fetching sports list from Odds API...');

      const response = await firstValueFrom(
        this.httpService.get<SportInfo[]>(url, { timeout: 10000 }),
      );

      this.updateQuota(response.headers);

      const sports: SportInfo[] = response.data;
      await this.redisService.setPacket(SPORTS_CACHE_KEY, sports, SPORTS_TTL_S);

      this.logger.log(
        `[OddsApiSync] Sports list cached: ${sports.length} sports. Quota remaining: ${this.quotaRemaining}`,
      );
    } catch (err) {
      this.logger.error(`[OddsApiSync] syncSportsList failed: ${err.message}`);
      // Write fallback so Redis is never empty
      const existing = await this.redisService.getPacket<SportInfo[]>(SPORTS_CACHE_KEY);
      if (!existing) {
        await this.redisService.setPacket(SPORTS_CACHE_KEY, FALLBACK_SPORTS, SPORTS_TTL_S);
      }
    }
  }

  // ─── One-shot: Events — called once on startup ──────────────────────────
  // Sports are fetched sequentially with a 600 ms gap between requests to
  // stay within The Odds API's per-second frequency limit (HTTP 429 guard).
  // 18 sports × 600 ms ≈ ~11 s total warm-up time.

  async syncEventsBatch() {
    if (!this.API_KEY) {
      // Write rich fallback data for each sport (demo mode)
      for (const key of ACTIVE_SPORT_KEYS) {
        const events = FALLBACK_EVENTS[key] ?? this.genericFallback(key);
        await this.redisService.setPacket(`oddsapi:events:${key}`, events, EVENTS_TTL_S * 60);
      }
      this.logger.log('[OddsApiSync] Demo mode: fallback events written to Redis.');
      return;
    }

    if (this.isSyncing) {
      this.logger.warn('[OddsApiSync] Previous sync still running — skipping this call.');
      return;
    }

    this.isSyncing = true;
    this.logger.log(`[OddsApiSync] Starting sequential sync of ${ACTIVE_SPORT_KEYS.length} sports (600 ms gap)…`);
    try {
      for (const sportKey of ACTIVE_SPORT_KEYS) {
        await this.syncEventsForSport(sportKey);
        // 600 ms breathing room between requests — avoids HTTP 429
        await new Promise((r) => setTimeout(r, 600));
      }
    } finally {
      this.isSyncing = false;
    }
  }

  // ─── Sync one sport's events ──────────────────────────────────────────────

  async syncEventsForSport(sportKey: string): Promise<void> {
    if (!this.API_KEY) return;

    // Quota guard: stop if less than 10 requests remain
    if (this.quotaRemaining !== null && this.quotaRemaining < 10) {
      this.logger.warn(
        `[OddsApiSync] Quota nearly exhausted (${this.quotaRemaining} remaining). Skipping sync for ${sportKey}.`,
      );
      return;
    }

    try {
      const url = `${this.BASE_URL}/v4/sports/${encodeURIComponent(sportKey)}/odds/` +
        `?apiKey=${this.API_KEY}&regions=${this.REGION}&markets=${this.MARKETS}&oddsFormat=decimal&dateFormat=iso`;

      const response = await firstValueFrom(
        this.httpService.get<OddsEvent[]>(url, { timeout: 10000 }),
      );

      this.updateQuota(response.headers);

      const events: OddsEvent[] = response.data;
      const cacheKey = `oddsapi:events:${sportKey}`;
      await this.redisService.setPacket(cacheKey, events, EVENTS_TTL_S);

      // ─ Socket broadcast ─────────────────────────────────────
      // Push the fresh data to all clients in the odds-sports room.
      // This replaces polling — the frontend updates instantly.
      try {
        this.eventsGateway.emitOddsApiUpdate(
          sportKey,
          events,
          new Date().toISOString(),
        );
      } catch (emitErr) {
        // Non-critical — Redis already has the data
        this.logger.warn(`[OddsApiSync] socket emit failed for ${sportKey}: ${emitErr.message}`);
      }

      this.logger.log(
        `[OddsApiSync] ✓ ${sportKey}: ${events.length} events → Redis TTL=${EVENTS_TTL_S}s. Quota remaining: ${this.quotaRemaining ?? '?'}`,
      );
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status ?? 'N/A';
      const body   = err?.response?.data   ?? err?.message ?? String(err);
      this.logger.error(
        `[OddsApiSync] ✗ ${sportKey} FAILED — HTTP ${status}: ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
  }

  // ─── Read methods (used by the controller) ────────────────────────────────

  async getSports(): Promise<SportInfo[]> {
    const sports = await this.redisService.getPacket<SportInfo[]>(SPORTS_CACHE_KEY);
    if (!sports) {
      this.logger.warn('[OddsApiSync] Cache miss for sports — returning fallback');
      return FALLBACK_SPORTS;
    }
    return sports;
  }

  async getEvents(sportKey: string): Promise<OddsEvent[]> {
    const cacheKey = `oddsapi:events:${sportKey}`;
    const events = await this.redisService.getPacket<OddsEvent[]>(cacheKey);
    if (!events) {
      this.logger.warn(`[OddsApiSync] Cache miss for ${sportKey} — returning fallback`);
      return FALLBACK_EVENTS[sportKey] ?? this.genericFallback(sportKey);
    }
    return events;
  }

  async getQuota(): Promise<{ used: number | null; remaining: number | null }> {
    return {
      used: this.quotaUsed,
      remaining: this.quotaRemaining,
    };
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  private updateQuota(headers: Record<string, any>) {
    const remaining = headers['x-requests-remaining'];
    const used = headers['x-requests-used'];
    if (remaining !== undefined) this.quotaRemaining = Number(remaining);
    if (used !== undefined) this.quotaUsed = Number(used);

    // Persist quota to Redis so it's visible in the admin
    this.redisService.setPacket(
      'oddsapi:quota',
      { used: this.quotaUsed, remaining: this.quotaRemaining, ts: new Date().toISOString() },
      10,
    ).catch(() => {});
  }

  private genericFallback(sportKey: string): OddsEvent[] {
    const title = sportKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return [
      {
        id: `fallback-${sportKey}-1`,
        sport_key: sportKey,
        sport_title: title,
        commence_time: new Date(Date.now() + 2 * 3600000).toISOString(),
        home_team: 'Team Alpha',
        away_team: 'Team Beta',
        bookmakers: [
          {
            key: 'betfair',
            title: 'Betfair',
            last_update: new Date().toISOString(),
            markets: [{ key: 'h2h', outcomes: [{ name: 'Team Alpha', price: 2.10 }, { name: 'Team Beta', price: 1.80 }] }],
          },
        ],
      },
    ];
  }
}
