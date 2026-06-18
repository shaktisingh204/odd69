import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import Redis from 'ioredis';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { Cron } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SportsSocketService } from './sports.socket.service';
import { EventsGateway } from '../events.gateway';
import { WebhookPayloadDto } from './dto/webhook.dto';
import {
  MyZoshLoginResponse,
  MyZoshSportsResponse,
  MyZoshTournamentsResponse,
  MyZoshMatchesResponse,
  MyZoshExchangeMarketsResponse,
  MyZoshSessionMarketsResponse,
  MyZoshImportSessionResponse,
  MyZoshBetPlaceResponse,
  MyZoshSyncTokenResponse,
  DiamondSportsResponse,
  DiamondSport,
  DiamondMatchesResponse,
  DiamondMarketOddsResponse,
  DiamondSidebarResponse,
  DiamondMatchDetailsResponse,
  DiamondScorecardTvResponse,
  DiamondTopEventsResponse,
} from './sports.types';

import { UsersService } from '../users/users.service';

import { Sport, SportDocument } from './schemas/sport.schema';
import { Competition, CompetitionDocument } from './schemas/competition.schema';
import { Event, EventDocument } from './schemas/event.schema';
import { Market, MarketDocument } from './schemas/market.schema';
import { MarketOdd, MarketOddDocument } from './schemas/market-odd.schema';
import { Session, SessionDocument } from './schemas/session.schema';
import { Fancy, FancyDocument } from './schemas/fancy.schema';
import { Bet, BetDocument } from '../bets/schemas/bet.schema';
import {
  Order,
  OrderDocument,
  OrderType,
  OrderStatus,
} from './schemas/order.schema';
import { Trade, TradeDocument } from './schemas/trade.schema';
import { Navigation, NavigationDocument } from './schemas/navigation.schema';
import { TopEvent, TopEventDocument } from './schemas/top-event.schema';
import { HomeEvent, HomeEventDocument } from './schemas/home-event.schema';
import { TeamIcon, TeamIconDocument } from './schemas/team-icon.schema';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { BetfairEvent, BetfairEventDocument } from './schemas/betfair-event.schema';
import { BetfairMarket, BetfairMarketDocument } from './schemas/betfair-market.schema';
import { BetfairSport, BetfairSportDocument } from './schemas/betfair-sport.schema';
import { SportLeague, SportLeagueDocument } from './schemas/sport-league.schema';
import { SportradarService } from './sportradar.service';

@Injectable()
export class SportsService implements OnModuleInit {
  private readonly logger = new Logger(SportsService.name);
  private static readonly SPORTS_CACHE_TTL_SECONDS = 1;
  private readonly API_URL = '';
  private accessToken: string | null = null;

  private readonly AGENT_CODE = '';
  private readonly SECRET_KEY = '';

  // Rate Limiting & Queueing
  private lastRequestTime = 0;
  private readonly REQUEST_INTERVAL_MS = 2500; // 2.5s = ~24 calls/min
  private requestQueue: Promise<any> = Promise.resolve();

  // Import Deduplication & Cooldown
  private importLocks: Map<string, Promise<any>> = new Map();
  private importCooldowns: Set<string> = new Set();
  private readonly IMPORT_COOLDOWN_MS = 60000; // Don't retry import for same match for 1 min
  private isSyncing = false;

  // ─── Turnkey Exchange feed (port :8000) ────────────────────────────────────
  private readonly SPORTS_FEED_URLS: string[] = (
    process.env.SPORTS_FEED_URLS ||
    'http://primarydiamondfeeds.turnkeyxgaming.com:8000,http://secondary.turnkeyxgaming.com:8000'
  )
    .split(',')
    .map((u) => u.trim().replace(/\/$/, ''));

  private readonly SPORTS_API_KEY = process.env.SPORTS_API_KEY || '69a53430d4444c6f80352a42';

  // ─── Authoritative admin sports list (eid = Diamond API sport ID) ─────────
  // These are the sports enabled in the admin panel. Only these sports are
  // synced, displayed in the sidebar, and used in event queries.
  private readonly ADMIN_SPORTS = [
    {
      eid: 4,
      ename: 'Cricket',
      active: true,
      tab: true,
      isdefault: true,
      oid: 1,
    },
    {
      eid: 1,
      ename: 'Football',
      active: true,
      tab: true,
      isdefault: false,
      oid: 2,
    },
    {
      eid: 2,
      ename: 'Tennis',
      active: true,
      tab: true,
      isdefault: false,
      oid: 3,
    },
    {
      eid: 10,
      ename: 'Horse Racing',
      active: true,
      tab: true,
      isdefault: false,
      oid: 6,
    },
    {
      eid: 66,
      ename: 'Kabaddi',
      active: true,
      tab: true,
      isdefault: false,
      oid: 24,
    },
    {
      eid: 40,
      ename: 'Politics',
      active: true,
      tab: true,
      isdefault: false,
      oid: 20,
    },
    {
      eid: 8,
      ename: 'Table Tennis',
      active: false,
      tab: true,
      isdefault: false,
      oid: 7,
    },
    {
      eid: 15,
      ename: 'Basketball',
      active: true,
      tab: true,
      isdefault: false,
      oid: 8,
    },
    {
      eid: 6,
      ename: 'Boxing',
      active: true,
      tab: true,
      isdefault: false,
      oid: 9,
    },
    {
      eid: 18,
      ename: 'Volleyball',
      active: true,
      tab: true,
      isdefault: false,
      oid: 12,
    },
    {
      eid: 22,
      ename: 'Badminton',
      active: true,
      tab: true,
      isdefault: false,
      oid: 13,
    },
  ];

  // ─── Lazy Redis client (ioredis) ──────────────────────────────────────────
  private redisClient: Redis | null = null;
  private getRedis(): Redis {
    if (!this.redisClient) {
      const host = process.env.REDIS_HOST || '127.0.0.1';
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      const password = process.env.REDIS_PASSWORD || undefined;
      const db = parseInt(process.env.REDIS_DB || '0', 10);
      this.redisClient = new Redis({ host, port, password, db });
      this.redisClient.on('error', (e) =>
        this.logger.warn(`Redis error: ${e.message}`),
      );
    }
    return this.redisClient;
  }

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @InjectModel(Sport.name) private sportModel: Model<SportDocument>,
    @InjectModel(Competition.name)
    private competitionModel: Model<CompetitionDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(MarketOdd.name)
    private marketOddModel: Model<MarketOddDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Fancy.name) private fancyModel: Model<FancyDocument>,
    @InjectModel(Bet.name) private betModel: Model<BetDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Trade.name) private tradeModel: Model<TradeDocument>,
    @InjectModel(Navigation.name)
    private navigationModel: Model<NavigationDocument>,
    @InjectModel(TopEvent.name) private topEventModel: Model<TopEventDocument>,
    @InjectModel(HomeEvent.name)
    private homeEventModel: Model<HomeEventDocument>,
    @InjectModel(TeamIcon.name) private teamIconModel: Model<TeamIconDocument>,
    @Inject(forwardRef(() => SportsSocketService))
    private readonly sportsSocketService: SportsSocketService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly maintenanceService: MaintenanceService,
    @InjectModel(BetfairEvent.name)
    private betfairEventModel: Model<BetfairEventDocument>,
    @InjectModel(BetfairMarket.name)
    private betfairMarketModel: Model<BetfairMarketDocument>,
    @InjectModel(BetfairSport.name)
    private betfairSportModel: Model<BetfairSportDocument>,
    @InjectModel(SportLeague.name)
    private sportLeagueModel: Model<SportLeagueDocument>,
    @Inject(forwardRef(() => SportradarService))
    private readonly sportradarService: SportradarService,
  ) { }

  /** Return all team icons (cached up to 1s in Redis) */
  async getTeamIcons() {
    const CACHE_KEY = 'team_icons:all';
    try {
      const redis = this.getRedis();
      const cached = await redis.get(CACHE_KEY).catch(() => null);
      if (cached) return JSON.parse(cached);

      const icons = await this.teamIconModel.find().lean();
      const result = icons.map((i: any) => ({
        team_name: i.team_name,
        display_name: i.display_name,
        icon_url: i.icon_url,
        sport_id: i.sport_id || '',
      }));
      await redis
        .set(CACHE_KEY, JSON.stringify(result), 'EX', SportsService.SPORTS_CACHE_TTL_SECONDS)
        .catch(() => { });
      return result;
    } catch (e) {
      this.logger.warn(`getTeamIcons failed: ${e.message}`);
      return [];
    }
  }

  // ─── Raw Turnkey Passthrough (External API) ────────────────────────────────
  // These methods return the exact raw JSON that Turnkey Gaming API sends,
  // served from Redis cache (updated every 800ms for live, 2.5s for pending).
  // No DB lookups, no transformation — pure upstream data.

  /**
   * Raw sports list exactly as cached from Turnkey.
   * Redis key: sports:all  (24h TTL)
   */
  async getRawSports(): Promise<any> {
    try {
      const redis = this.getRedis();
      const cached = await redis.get('sports:all').catch(() => null);
      if (cached) return { source: 'redis', data: JSON.parse(cached) };
      return {
        source: 'empty',
        data: [],
        message: 'Sports cache not yet populated — try again in a few seconds',
      };
    } catch (e) {
      this.logger.warn(`getRawSports failed: ${e.message}`);
      return { source: 'error', data: [], error: e.message };
    }
  }

  /**
   * Raw events for a specific sport exactly as received from Turnkey.
   * Redis key: allevents:{sportId}  (1h TTL, refreshed every 60s)
   * sportId numbers: 4=Cricket, 1=Football, 2=Tennis, 10=Horse Racing, etc.
   */
  async getRawEvents(sportId: string | number): Promise<any> {
    try {
      const redis = this.getRedis();
      const key = `allevents:${sportId}`;
      const cached = await redis.get(key).catch(() => null);
      if (cached) {
        const data = JSON.parse(cached);
        return { source: 'redis', sport_id: sportId, count: data.length, data };
      }
      return {
        source: 'empty',
        sport_id: sportId,
        count: 0,
        data: [],
        message: 'No events cached yet for this sport',
      };
    } catch (e) {
      this.logger.warn(
        `getRawEvents failed for sport ${sportId}: ${e.message}`,
      );
      return { source: 'error', sport_id: sportId, data: [], error: e.message };
    }
  }

  /**
   * Raw events for ALL sports combined in one response.
   * Reads allevents:{10 sport IDs} from Redis in parallel.
   */
  async getRawAllEvents(): Promise<any> {
    const SPORT_IDS = [4, 1, 2, 10, 66, 40, 15, 6, 18, 22];
    try {
      const redis = this.getRedis();
      const pipeline = redis.pipeline();
      SPORT_IDS.forEach((id) => pipeline.get(`allevents:${id}`));
      const results = await pipeline.exec();

      const combined: Record<string, any[]> = {};
      let total = 0;
      results?.forEach((result, idx) => {
        const sportId = SPORT_IDS[idx];
        const raw = result?.[1] as string | null;
        if (raw) {
          const parsed = JSON.parse(raw);
          combined[sportId] = parsed;
          total += parsed.length;
        } else {
          combined[sportId] = [];
        }
      });

      return { source: 'redis', total_events: total, by_sport: combined };
    } catch (e) {
      this.logger.warn(`getRawAllEvents failed: ${e.message}`);
      return { source: 'error', data: {}, error: e.message };
    }
  }

  /**
   * Raw odds for a specific match (gmid) exactly as received from Turnkey.
   * Redis key: odds:{gmid}  (live cache should expire within 1s)
   * This is the fastest data available — real-time upstream odds.
   */
  async getRawOdds(gmid: string): Promise<any> {
    try {
      const redis = this.getRedis();
      const key = `odds:${gmid}`;
      const cached = await redis.get(key).catch(() => null);
      if (cached) {
        const data = JSON.parse(cached);
        return {
          source: 'redis',
          gmid,
          fetched_at: new Date().toISOString(),
          data,
        };
      }
      return {
        source: 'empty',
        gmid,
        data: [],
        message:
          'No odds cached for this match — it may not be live or may not exist',
      };
    } catch (e) {
      this.logger.warn(`getRawOdds failed for gmid ${gmid}: ${e.message}`);
      return { source: 'error', gmid, data: [], error: e.message };
    }
  }

  /**
   * Raw odds for multiple matches at once (batch).
   * Pass comma-separated gmids e.g. "31005885,31005886"
   * Returns map of gmid → raw markets array.
   */
  async getRawOddsBatch(gmids: string[]): Promise<any> {
    try {
      const redis = this.getRedis();
      const pipeline = redis.pipeline();
      gmids.forEach((gmid) => pipeline.get(`odds:${gmid}`));
      const results = await pipeline.exec();

      const oddsMap: Record<string, any> = {};
      results?.forEach((result, idx) => {
        const gmid = gmids[idx];
        const raw = result?.[1] as string | null;
        oddsMap[gmid] = raw ? JSON.parse(raw) : null;
      });

      return {
        source: 'redis',
        fetched_at: new Date().toISOString(),
        requested: gmids.length,
        found: Object.values(oddsMap).filter((v) => v !== null).length,
        odds: oddsMap,
      };
    } catch (e) {
      this.logger.warn(`getRawOddsBatch failed: ${e.message}`);
      return { source: 'error', odds: {}, error: e.message };
    }
  }

  /**
   * Generic Pass-through proxy to the actual Turnkey Gaming API.
   * Used as a fallback for /api/v1/* endpoints we don't actively cache
   * (like greyhounds, virtuals, results, or settlement webhooks).
   */
  async passthroughToTurnkey(
    path: string,
    query: any,
    method: string = 'GET',
    body: any = null,
  ): Promise<any> {
    try {
      // Reconstruct query string
      const q = new URLSearchParams(query).toString();
      // Note: Make sure path starts with /api/v1/
      const endpoint = `${path.startsWith('/') ? path : '/' + path}${q ? '?' + q : ''}`;

      this.logger.log(`[Passthrough] Proxying to Turnkey in parallel (${this.SPORTS_FEED_URLS.length} nodes): ${method} ${endpoint}`);

      // We send the request to all feeds simultaneously and take whichever responds first.
      const requests = this.SPORTS_FEED_URLS.map(async (baseUrl) => {
        const url = `${baseUrl}${endpoint}`;
        const reqConfig: any = {
          method: method.toUpperCase(),
          url,
          headers: { 'x-turnkeyxgaming-key': this.SPORTS_API_KEY },
          timeout: 5000,
        };

        if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
          reqConfig.data = body;
        }

        const response = await import('rxjs').then((m) =>
          m.firstValueFrom(this.httpService.request(reqConfig)),
        );

        return response.data;
      });

      // Promise.any resolves as soon as the FASTEST feed returns a successful HTTP response.
      return await Promise.any(requests);
    } catch (error) {
      const isAggError = error instanceof AggregateError;
      this.logger.warn(
        `[Passthrough] All Turnkey feeds failed for ${method} ${path}: ${isAggError ? 'All parallel requests failed' : error.message}`,
      );
      return {
        source: 'error',
        message: 'Failed to proxy request to Turnkey Gaming API',
      };
    }
  }

  private async respectRateLimit() {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;

    if (timeSinceLast < this.REQUEST_INTERVAL_MS) {
      const waitTime = this.REQUEST_INTERVAL_MS - timeSinceLast;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private async makeApiRequest<T>(
    url: string,
    payload: any,
  ): Promise<{ data: T; status: number }> {
    // logPayload logic...
    const logPayload = { ...payload };
    if (logPayload.access_token) logPayload.access_token = '***';

    // Enqueue the request
    const requestTask = this.requestQueue.then(async () => {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;

      if (timeSinceLast < this.REQUEST_INTERVAL_MS) {
        const waitTime = this.REQUEST_INTERVAL_MS - timeSinceLast;
        if (waitTime > 0) {
          this.logger.debug(
            `Rate limit: Waiting ${waitTime}ms before calling ${url}`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      this.logger.log(
        `API Request to ${url} Payload: ${JSON.stringify(logPayload)} `,
      );

      try {
        const response = await firstValueFrom(
          this.httpService.post<T>(url, payload),
        );
        this.lastRequestTime = Date.now();
        return { data: response.data, status: response.status };
      } catch (error) {
        this.lastRequestTime = Date.now(); // Count error as a request

        // Handle 401
        if (error.response && error.response.status === 401) {
          this.logger.warn(`API responded with 401. Refreshing token...`);
          this.accessToken = null;
          // IMPORTANT: We can't easily recurse cleanly inside the queue without complicating it.
          // But forcing a token refresh here will help *future* requests.
          // The current request fails.
        }
        throw error;
      }
    });

    // Advance the queue pointer, catching errors so the queue doesn't stall
    this.requestQueue = requestTask.catch(() => { });

    return requestTask;
  }

  onModuleInit() {
    // ── Auto live-status updater ─────────────────────────────────────────
    // Marks events as 'In Play' when open_date has passed (runs every 60s)
    const updateLiveStatuses = async () => {
      try {
        const now = new Date();
        const result = await this.eventModel.updateMany(
          {
            match_status: { $nin: ['In Play', 'Completed'] },
            open_date: { $lte: now.toISOString() },
          },
          { $set: { match_status: 'In Play' } },
        );
        if (result.modifiedCount > 0) {
          this.logger.log(
            `[LiveStatusJob] Marked ${result.modifiedCount} events as 'In Play'`,
          );
        }
      } catch (e) {
        this.logger.warn(`[LiveStatusJob] error: ${e.message}`);
      }
    };
    updateLiveStatuses();
    setInterval(updateLiveStatuses, 60_000);

    // Odds sync is now handled by TurnkeySyncService (TurnkeyXGaming feeds)
  }

  private async authenticate(): Promise<string | null> {
    if (this.accessToken) return this.accessToken;

    try {
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: 'myzosh_access_token' },
      });
      if (config?.value) {
        this.accessToken = config.value;
        return this.accessToken;
      }
    } catch (error) {
      this.logger.error(`Error fetching token from DB: ${error.message}`);
    }

    this.logger.warn(
      'No access token found in memory or DB. Attempting to refresh...',
    );
    await this.refreshToken();
    return this.accessToken;
  }

  // @Cron('20 10 * * *')
  async refreshToken() {
    this.logger.log('Starting token refresh...');
    try {
      const payload = {
        agent_code: this.AGENT_CODE,
        secret_key: this.SECRET_KEY,
      };
      const { data } = await firstValueFrom(
        this.httpService.post<MyZoshLoginResponse>(
          `${this.API_URL}/get_access_token`,
          payload,
        ),
      );

      if (data.status.code === 200 && data.data?.access_token) {
        this.accessToken = data.data.access_token;

        await this.prisma.systemConfig.upsert({
          where: { key: 'myzosh_access_token' },
          update: { value: this.accessToken },
          create: { key: 'myzosh_access_token', value: this.accessToken },
        });

        this.logger.log('Token refreshed and saved to DB successfully.');
      } else {
        this.logger.error(
          `Failed to refresh token. Status: ${data.status?.code}`,
        );
      }

      return data;
    } catch (error) {
      this.logger.error(`Error refreshing token: ${error.message}`);
      throw error;
    }
  }

  // --- Cron Jobs ---

  /**
   * Cleanup old completed matches that are NOT inplay and older than 1 day.
   * Runs every hour. Deletes the event and all related data (markets, odds, sessions, fancies).
   */
  @Cron('0 * * * *')
  async cleanupOldCompletedMatches() {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const cutoffIso = cutoff.toISOString();

      // Find events that are NOT inplay/live AND older than 1 day
      const staleEvents = await this.eventModel
        .find({
          match_status: { $nin: ['In Play', 'Live'] },
          open_date: { $lt: cutoffIso },
        })
        .select('event_id competition_id');

      if (staleEvents.length === 0) {
        this.logger.debug('[MatchCleanup] No stale matches to clean up.');
        return;
      }

      const eventIds = staleEvents.map((e) => e.event_id);
      const affectedCompetitionIds = [
        ...new Set(staleEvents.map((e) => e.competition_id)),
      ];

      this.logger.log(
        `[MatchCleanup] Found ${eventIds.length} stale matches to remove.`,
      );

      // Delete related data in parallel
      const [marketsRes, oddsRes, sessionsRes, fanciesRes] = await Promise.all([
        this.marketModel.deleteMany({ event_id: { $in: eventIds } }),
        this.marketOddModel.deleteMany({ event_id: { $in: eventIds } }),
        this.sessionModel.deleteMany({ event_id: { $in: eventIds } }),
        this.fancyModel.deleteMany({ event_id: { $in: eventIds } }),
      ]);

      // Delete the events themselves
      const eventsRes = await this.eventModel.deleteMany({
        event_id: { $in: eventIds },
      });

      this.logger.log(
        `[MatchCleanup] Deleted ${eventsRes.deletedCount} events, ` +
        `${marketsRes.deletedCount} markets, ${oddsRes.deletedCount} odds, ` +
        `${sessionsRes.deletedCount} sessions, ${fanciesRes.deletedCount} fancies.`,
      );

      // Update market_count on affected competitions
      for (const compId of affectedCompetitionIds) {
        const count = await this.eventModel.countDocuments({
          competition_id: compId,
        });
        await this.competitionModel.updateOne(
          { competition_id: compId },
          { $set: { market_count: count } },
        );
      }

      this.logger.log(
        `[MatchCleanup] Updated market_count for ${affectedCompetitionIds.length} competitions.`,
      );
    } catch (error) {
      this.logger.error(`[MatchCleanup] Error: ${error.message}`, error.stack);
    }
  }

  // --- Sync functions removed ---
  // All sports sync (sports list, matches, and odds) is handled exclusively
  // by the Rust service (sports-sync-rust). Do not add sync logic here.
  // The /sports/sync-data endpoint returns a redirect notice.
  async syncAll() {
    this.logger.log(
      '[syncAll] Sync is handled by sports-sync-rust. Skipping NestJS sync.',
    );
    return {
      message:
        'Sync is handled by the Rust service (sports-sync-rust). Restart it to trigger a sync.',
    };
  }

  // NOTE: Diamond API constants kept for match details / TV / score URL lookups only.
  // Odds sync is entirely handled by TurnkeySyncService.
  private readonly DIAMOND_API_URL =
    process.env.DIAMOND_API_URL ||
    'https://diamond-sports-api-d247-sky-exchange-betfair.p.rapidapi.com';
  private readonly DIAMOND_API_HOST =
    process.env.DIAMOND_API_HOST ||
    'diamond-sports-api-d247-sky-exchange-betfair.p.rapidapi.com';
  private readonly DIAMOND_API_KEY =
    process.env.DIAMOND_API_KEY ||
    'fdaa78ee08mshb866b2d82236d8cp18a100jsn764d59a3c2a1';

  public async getMatchStatus(matchId: string) {
    return { message: 'Match status tracking from API disabled' };
  }

  public async ensureMarketImported(matchId: string) {
    this.logger.log(`Market import disabled for ${matchId}`);
  }

  // Mapping helper
  private inferCountryFromName(name: string): string | null {
    const mapping: Record<string, string> = {
      'Premier League': 'GB-ENG',
      Championship: 'GB-ENG',
      LaLiga: 'ES',
      'La Liga': 'ES',
      'Serie A': 'IT',
      'Serie B': 'IT',
      Bundesliga: 'DE',
      'Ligue 1': 'FR',
      'Ligue 2': 'FR',
      Eredivisie: 'NL',
      'Primeira Liga': 'PT',
      UEFA: 'INT',
      'Champions League': 'INT',
      Europa: 'INT',
      International: 'INT',
      'World Cup': 'INT',
      IPL: 'IN',
      'Indian Premier League': 'IN',
      'Big Bash': 'AU',
      NBA: 'US',
      NFL: 'US',
      MLB: 'US',
      NHL: 'US',
    };
    for (const [key, code] of Object.entries(mapping)) {
      if (name.includes(key)) return code;
    }
    return null;
  }

  private async syncTournaments(
    token: string,
    sportId: string,
    sourceId?: string,
  ) {
    try {
      const response = await this.getTournamentsFromApi(
        token,
        sportId,
        sourceId,
      );

      if (response.status.code !== 200 || !response.data) return;

      for (const tour of response.data) {
        this.logger.log(
          `Syncing matches for tournament ${tour.tournament_id}, sport ${sportId}, source ${sourceId || 'default'}`,
        );

        // 1. Initial Upsert with inferred country
        let countryCode = this.inferCountryFromName(tour.tournament_name);

        // If API returns a category, use it (sometimes it's a country code)
        // Remove 'category' usage if it causes type error as seen before, sticking to name inference or default

        await this.competitionModel.updateOne(
          { competition_id: tour.tournament_id },
          {
            $set: {
              competition_name: tour.tournament_name,
              sport_id: sportId,
              market_count: tour.market_count || 0,
            },
            $setOnInsert: {
              country_code: countryCode || 'International', // only set default if new
            },
          },
          { upsert: true },
        );

        // If we inferred a country, force update it to ensure it's set
        if (countryCode) {
          await this.competitionModel.updateOne(
            { competition_id: tour.tournament_id },
            { $set: { country_code: countryCode } },
          );
        }

        await this.syncMatches(token, sportId, tour.tournament_id, sourceId);

        // Update Competition market_count with REAL DB count
        const realCompCount = await this.eventModel.countDocuments({
          competition_id: tour.tournament_id,
        });

        this.logger.log(
          `Tournament ${tour.tournament_id} updated with ${realCompCount} events.`,
        );

        await this.competitionModel.updateOne(
          { competition_id: tour.tournament_id },
          { $set: { market_count: realCompCount } },
        );
      }
    } catch (error) {
      this.logger.error(
        `Error syncing tournaments for sport ${sportId} source ${sourceId || 'default'}: ${error.message}`,
      );
    }
  }

  public async getTournamentsFromApi(
    token: string,
    sportId: string,
    sourceId?: string,
  ) {
    try {
      const payload: any = {
        access_token: token,
        sport_id: sportId,
      };
      if (sourceId) {
        payload.source_id = sourceId;
      }

      const { data } = await this.makeApiRequest<MyZoshTournamentsResponse>(
        `${this.API_URL}/get_tournaments`,
        payload,
      );

      if (data.status.code === 200 && data.data) {
        for (const tour of data.data) {
          await this.competitionModel.updateOne(
            { competition_id: tour.tournament_id.toString() },
            {
              $set: {
                competition_name: tour.tournament_name,
                market_count: tour.market_count || 0,
                sport_id: sportId,
              },
            },
            { upsert: true },
          );
        }
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching tournaments from API for sport ${sportId}: ${error.message}`,
      );
      throw error;
    }
  }

  private parseDate(dateStr: any): Date {
    if (!dateStr) return new Date();
    let date: Date;

    try {
      if (dateStr instanceof Date) {
        date = dateStr;
      } else if (typeof dateStr === 'string') {
        const msDateRegex = /\/Date\((\d+)\)\//;
        const match = msDateRegex.exec(dateStr);
        if (match) {
          const timestamp = parseInt(match[1], 10);
          date = new Date(timestamp);
        } else {
          date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            const isoStr = dateStr.replace(' ', 'T');
            date = new Date(isoStr);
          }
        }
      } else if (typeof dateStr === 'number') {
        date = new Date(dateStr);
      } else {
        this.logger.warn(
          `Unknown date format: ${JSON.stringify(dateStr)} type: ${typeof dateStr}`,
        );
        return new Date();
      }
    } catch (e) {
      return new Date();
    }

    return isNaN(date.getTime()) ? new Date() : date;
  }

  private async syncMatches(
    token: string,
    sportId: string,
    tournamentId: string,
    sourceId?: string,
  ) {
    try {
      const response = await this.getMatchesFromApi(
        token,
        sportId,
        tournamentId,
        sourceId,
      );

      this.logger.log(
        `Fetched matches for tournament ${tournamentId}. Status: ${response.status.code}, Count: ${response.data?.length || 0}`,
      );
      if (response.status.code !== 200 || !response.data) return;

      // Update Competition Country Code from Match Data
      const firstMatchWithCountry = response.data.find(
        (m) => m.match_country_code,
      );
      if (firstMatchWithCountry) {
        await this.competitionModel.updateOne(
          { competition_id: tournamentId },
          { $set: { country_code: firstMatchWithCountry.match_country_code } },
        );
      }

      for (const match of response.data) {
        try {
          const openDate = match.match_open_date || match.match_date;

          // Extract teams
          let homeTeam = null;
          let awayTeam = null;
          if (match.match_name && match.match_name.includes(' v ')) {
            const parts = match.match_name.split(' v ');
            if (parts.length >= 2) {
              homeTeam = parts[0].trim();
              awayTeam = parts[1].trim();
            }
          }

          // Check if match exists to avoid re-adding/updating if not needed (User Request)
          const existingHeader = await this.eventModel.findOne({
            event_id: match.match_id,
          });
          if (existingHeader) {
            // Optional: Check if status changed or just return
            // User said: "if there is same match exist don't re add"
            continue;
          }

          await this.eventModel.create({
            event_id: match.match_id,
            event_name: match.match_name,
            competition_id: tournamentId,
            open_date: openDate,
            timezone: 'UTC',
            match_status: 'Pending',
            home_team: homeTeam,
            away_team: awayTeam,
          });
        } catch (err) {
          this.logger.error(
            `Failed to process match ${match.match_id}: ${err.message}`,
            err.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error syncing matches for tournament ${tournamentId}: ${error.message}`,
      );
    }
  }

  public async getMatchesFromApi(
    token: string,
    sportId: string,
    tournamentId: string,
    sourceId?: string,
  ) {
    try {
      const payload: any = {
        access_token: token,
        sport_id: sportId,
        tournament_id: tournamentId,
      };
      if (sourceId) {
        payload.source_id = sourceId;
      }

      const { data } = await this.makeApiRequest<MyZoshMatchesResponse>(
        `${this.API_URL}/get_matches`,
        payload,
      );

      this.logger.log(
        `Fetched matches for tournament ${tournamentId}. Status: ${data.status.code}, Count: ${data.data?.length || 0}`,
      );

      if (data.status.code === 200 && data.data) {
        // Update country_code for the competition if available
        if (data.data.length > 0) {
          const firstMatch = data.data[0];
          if (firstMatch.match_country_code) {
            try {
              await this.competitionModel.updateOne(
                { competition_id: tournamentId },
                { $set: { country_code: firstMatch.match_country_code } },
              );
            } catch (e) {
              this.logger.warn(
                `Failed to update country_code for competition ${tournamentId}: ${e.message}`,
              );
            }
          }
        }

        for (const match of data.data) {
          try {
            const openDate = match.match_open_date || match.match_date;

            // Extract teams
            let homeTeam = null;
            let awayTeam = null;
            if (match.match_name && match.match_name.includes(' v ')) {
              const parts = match.match_name.split(' v ');
              if (parts.length >= 2) {
                homeTeam = parts[0].trim();
                awayTeam = parts[1].trim();
              }
            }

            await this.eventModel.updateOne(
              { event_id: match.match_id },
              {
                $set: {
                  event_name: match.match_name,
                  competition_id: tournamentId,
                  open_date: openDate,
                  timezone: 'UTC',
                  match_status: 'Pending',
                  home_team: homeTeam,
                  away_team: awayTeam,
                },
              },
              { upsert: true },
            );
          } catch (e) { }
        }
      }

      if (data.data) {
        data.data = data.data.map((m) => {
          const parsedDate = this.parseDate(m.match_open_date || m.match_date);
          return {
            ...m,
            match_date: parsedDate.toISOString(),
            match_open_date: parsedDate.toISOString(),
          };
        });
      }

      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching matches for tournament ${tournamentId}: ${error.message}`,
      );
      throw error;
    }
  }

  public async importMarkets() {
    this.logger.log('Starting market import for ALL matches in DB...');
    const accessToken = await this.authenticate();
    if (!accessToken) {
      this.logger.error('No access token available for importMarkets');
      return;
    }

    // Fetch all events from DB
    // Fetch Only Recent/Future Events to avoid processing 3000+ old matches
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString(); // Assuming open_date is stored as ISO string in DB logic

    const matches = await this.eventModel.find({
      open_date: { $gte: yesterdayIso },
    });

    this.logger.log(`Found ${matches.length} matches to check for markets.`);

    for (const match of matches) {
      try {
        // Determine sportId and tournamentId from relations
        // Need to fetch separately since no JOIN in find
        const competition = await this.competitionModel.findOne({
          competition_id: match.competition_id,
        });
        if (!competition) continue;

        const sport = await this.sportModel.findOne({
          sport_id: competition.sport_id,
        });

        let sportId = competition.sport_id;
        const tournamentId = match.competition_id;
        const matchId = match.event_id;
        const sportName = sport?.sport_name || '';
        const tournamentName = competition.competition_name || '';

        if (matchId) {
          await this.importExchangeMarkets(
            accessToken,
            sportId,
            tournamentId,
            matchId,
            false,
          );
          await this.importSessionMarkets(
            accessToken,
            sportId,
            tournamentId,
            matchId,
            false,
          );
        } else {
          this.logger.warn(
            `Skipping event with no match_id (internal id: ${match._id})`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.error(
          `Error processing match ${match.event_id} in importMarkets: ${error.message}`,
        );
      }
    }

    const activeCount = await this.marketModel.countDocuments({
      is_active: true,
    });
    this.logger.log(
      `Market import check completed. Total Active Markets in DB: ${activeCount}`,
    );
    return {
      message: 'Market import triggered for all matches',
      activeMarkets: activeCount,
    };
  }

  public async syncMarkets() {
    this.logger.log('Starting FULL market sync for ALL events...');
    const accessToken = await this.authenticate();
    if (!accessToken) return { status: 403, message: 'No access token' };

    const matches = await this.eventModel.find({});
    this.logger.log(`Found ${matches.length} matches for full sync.`);

    let processed = 0;
    for (const match of matches) {
      try {
        const competition = await this.competitionModel.findOne({
          competition_id: match.competition_id,
        });
        if (!competition) continue;

        const sportId = competition.sport_id;
        const tournamentId = match.competition_id;
        const matchId = match.event_id;

        if (matchId) {
          // Sync only (setActive = false).
          // This saves the market definition and "refreshes" it from source.
          // The "is_active" flag in DB will NOT be forced to true, effectively respecting
          // the source's "presence" as availability but not "activation" for trading until clicked.
          await this.importExchangeMarkets(
            accessToken,
            sportId,
            tournamentId,
            matchId,
            false,
          );
          await this.importSessionMarkets(
            accessToken,
            sportId,
            tournamentId,
            matchId,
            false,
          );
        }
        processed++;
        if (processed % 50 === 0)
          this.logger.log(`Synced markets for ${processed} matches...`);

        await new Promise((resolve) => setTimeout(resolve, 50)); // Throttling
      } catch (e) {
        this.logger.error(
          `Error syncing market for match ${match.event_id}: ${e.message}`,
        );
      }
    }
    return { message: `Full market sync completed for ${processed} matches` };
  }

  async clearSportsData() {
    this.logger.log('Wiping all Sports Collections...');
    await this.eventModel.deleteMany({});
    await this.sportModel.deleteMany({});
    await this.competitionModel.deleteMany({});
    await this.marketModel.deleteMany({});
    this.logger.log('Collections deleted successfully.');
    return { success: true, message: 'All sports data cleared from MongoDB.' };
  }

  public async importExchangeMarkets(
    token: string | undefined,
    sportId: string,
    tournamentId: string,
    matchId: string,
    setActive: boolean = true,
  ) {
    // Cooldown Check
    const lockKey = `exch_${matchId}`;
    if (this.importCooldowns.has(lockKey)) return;

    // Lock Check
    if (this.importLocks.has(lockKey)) return this.importLocks.get(lockKey);

    const task = (async () => {
      await this.respectRateLimit();
      try {
        if (!matchId) return { status: 400, message: 'matchId is required' };

        const accessToken = token || (await this.authenticate());
        if (!accessToken)
          return { status: 403, message: 'No access token available' };

        // Auto-lookup
        if (!sportId || !tournamentId) {
          const event = await this.eventModel.findOne({ event_id: matchId });
          if (event) {
            if (!tournamentId) tournamentId = event.competition_id;
            const competition = await this.competitionModel.findOne({
              competition_id: event.competition_id,
            });
            if (competition && !sportId) sportId = competition.sport_id;
          }
        }

        if (!sportId || !tournamentId)
          return {
            status: 400,
            message: 'Missing parameters and auto-lookup failed.',
          };

        const getExchPayload = {
          access_token: accessToken,
          sport_id: sportId,
          tournament_id: tournamentId,
          match_id: matchId,
        };

        const exchRes =
          await this.makeApiRequest<MyZoshExchangeMarketsResponse>(
            `${this.API_URL}/get_exch_markets`,
            getExchPayload,
          ).catch((e) => {
            throw e;
          });

        const marketIdsToImport: string[] = [];

        // Fetch existing valid markets to avoid re-import
        const existingMarkets = await this.marketModel
          .find({
            event_id: matchId,
            sys_market_id: { $exists: true, $ne: null },
          })
          .select('market_id');
        const existingMarketIds = new Set(
          existingMarkets.map((m) => m.market_id),
        );

        if (exchRes.data?.data) {
          for (const m of exchRes.data.data) {
            if (!existingMarketIds.has(m.market_id.toString())) {
              marketIdsToImport.push(m.market_id);
            }

            let r1 = null,
              r2 = null;
            if (m.runners && m.runners.length > 0)
              r1 = m.runners[0].runner_name;
            if (m.runners && m.runners.length > 1)
              r2 = m.runners[1].runner_name;

            let marketTimeRaw =
              (m.description && m.description.market_time) ||
              (m as any).marketStartTime ||
              (m as any).startTime ||
              (m as any).market_time;
            // Avoid overwriting with null if we already have it?
            // But here we are parsing new data.

            const desc = m.description || {};
            if (marketTimeRaw) desc.market_time = this.parseDate(marketTimeRaw);
            if (desc.suspend_time)
              desc.suspend_time = this.parseDate(desc.suspend_time);
            if (desc.settle_time)
              desc.settle_time = this.parseDate(desc.settle_time);

            await this.marketModel.updateOne(
              { market_id: m.market_id.toString() },
              {
                $set: {
                  market_name: m.market_name,
                  event_id: matchId,
                  runner1: r1,
                  runner2: r2,
                  is_market_data_delayed: m.is_market_data_delayed,
                  description: desc,
                  runners_data: m.runners || [],
                  raw_response: m,
                  ...(setActive ? { is_active: true } : {}),
                },
              },
              { upsert: true },
            );
          }
        }

        // Perform Import to get sys_market_id (Uncommented and Enabled)
        if (marketIdsToImport.length > 0) {
          const exchPayload: any = {
            access_token: accessToken,
            sport_id: sportId,
            tournament_id: tournamentId,
            match_id: matchId,
            market_ids: marketIdsToImport.join(','),
          };

          const importRes = await this.makeApiRequest<any>( // Type is loose here
            `${this.API_URL}/import_exch_markets`,
            exchPayload,
          ).catch((e) => {
            this.logger.error(`Import Exch API failed: ${e.message}`);
            return null;
          });

          if (importRes?.data?.data) {
            // Some APIs return list of imported markets with sys_market_id
            // Check structure. Assuming list of objects with market_id and sys_market_id
            const importedList = Array.isArray(importRes.data.data)
              ? importRes.data.data
              : [];
            for (const imported of importedList) {
              if (imported.market_id && imported.sys_market_id) {
                await this.marketModel.updateOne(
                  { market_id: imported.market_id.toString() },
                  { $set: { sys_market_id: imported.sys_market_id } },
                );
              }
            }
          }
        }

        return {
          message: `Found and processed ${marketIdsToImport.length} exchange markets`,
          data: exchRes.data,
        };
      } catch (error) {
        this.logger.error(
          `Error in importExchangeMarkets for match ${matchId}: ${error.message}`,
        );
        return null;
      }
    })();

    this.importLocks.set(lockKey, task);
    try {
      return await task;
    } finally {
      this.importLocks.delete(lockKey);
      this.importCooldowns.add(lockKey);
      setTimeout(
        () => this.importCooldowns.delete(lockKey),
        this.IMPORT_COOLDOWN_MS,
      );
    }
  }

  public async importSessionMarkets(
    token: string | undefined,
    sportId: string,
    tournamentId: string,
    matchId: string,
    setActive: boolean = true,
  ) {
    // Cooldown Check
    const lockKey = `session_${matchId}`;
    if (this.importCooldowns.has(lockKey)) return;

    // Lock Check
    if (this.importLocks.has(lockKey)) return this.importLocks.get(lockKey);

    const task = (async () => {
      await this.respectRateLimit();
      try {
        if (!matchId) return { status: 400, message: 'matchId is required' };

        const accessToken = token || (await this.authenticate());
        if (!accessToken)
          return { status: 403, message: 'No access token available' };

        if (!sportId || !tournamentId) {
          const event = await this.eventModel.findOne({ event_id: matchId });
          if (event) {
            if (!tournamentId) tournamentId = event.competition_id;
            const competition = await this.competitionModel.findOne({
              competition_id: event.competition_id,
            });
            if (competition && !sportId) sportId = competition.sport_id;
          }
        }

        if (!sportId || !tournamentId)
          return {
            status: 400,
            message: 'Missing parameters and auto-lookup failed.',
          };

        const getSessionPayload = {
          access_token: accessToken,
          sport_id: sportId,
          tournament_id: tournamentId,
          match_id: matchId,
        };
        const sessionRes =
          await this.makeApiRequest<MyZoshSessionMarketsResponse>(
            `${this.API_URL}/get_session_markets`,
            getSessionPayload,
          ).catch((e) => {
            throw e;
          });

        const marketIdsToImport: string[] = [];

        // Fetch existing valid markets to avoid re-import
        const existingMarkets = await this.marketModel
          .find({
            event_id: matchId,
            sys_market_id: { $exists: true, $ne: null },
          })
          .select('market_id');
        const existingMarketIds = new Set(
          existingMarkets.map((m) => m.market_id),
        );

        if (sessionRes.data?.data) {
          for (const m of sessionRes.data.data) {
            if (!existingMarketIds.has(m.market_id.toString())) {
              marketIdsToImport.push(m.market_id);
            }

            await this.marketModel.updateOne(
              { market_id: m.market_id.toString() },
              {
                $set: {
                  market_name: m.market_name,
                  event_id: matchId,
                  raw_response: m,
                  // Try to capture time if available
                  start_time: this.parseDate(
                    (m as any).market_time ||
                    (m as any).startTime ||
                    (m as any).marketStartTime,
                  ),
                  ...(setActive ? { is_active: true } : {}),
                },
              },
              { upsert: true },
            );
          }
        }

        // Perform Import to get sys_market_id
        if (marketIdsToImport.length > 0) {
          const sessionPayload: any = {
            access_token: accessToken,
            sport_id: sportId,
            tournament_id: tournamentId,
            match_id: matchId,
            market_ids: marketIdsToImport.join(','),
          };

          const importRes =
            await this.makeApiRequest<MyZoshImportSessionResponse>(
              `${this.API_URL}/import_session_markets`,
              sessionPayload,
            ).catch((e) => {
              this.logger.error(`Import Session API failed: ${e.message}`);
              return null;
            });

          if (importRes?.data?.data) {
            for (const imported of importRes.data.data) {
              if (imported.market_id) {
                await this.marketModel.updateOne(
                  { market_id: imported.market_id.toString() },
                  { $set: { sys_market_id: imported.sys_market_id } },
                );
              }
            }
            return {
              message: `Imported ${importRes.data.data.length} session markets`,
              data: importRes.data.data,
            };
          }
        }

        return {
          message: `Found ${marketIdsToImport.length} session markets`,
          data: sessionRes.data,
        };
      } catch (error) {
        this.logger.error(
          `Error in importSessionMarkets for match ${matchId}: ${error.message}`,
        );
        return null;
      }
    })();

    this.importLocks.set(lockKey, task);
    try {
      return await task;
    } finally {
      this.importLocks.delete(lockKey);
      this.importCooldowns.add(lockKey);
      setTimeout(
        () => this.importCooldowns.delete(lockKey),
        this.IMPORT_COOLDOWN_MS,
      );
    }
  }

  // --- Webhook Handlers ---

  async handleMarketStatusUpdate(payload: WebhookPayloadDto) {
    this.logger.log(
      `Received Market Status Update for sys_market_id: ${payload.sys_market_id}`,
    );
    try {
      // Find market by sys_market_id
      const market = await this.marketModel.findOne({
        sys_market_id: payload.sys_market_id,
      });
      if (!market) {
        this.logger.warn(
          `Market not found for sys_market_id: ${payload.sys_market_id}`,
        );
        // Try finding by source_market_id if provided and string match
        if (payload.source_market_id) {
          const marketBySource = await this.marketModel.findOne({
            market_id: payload.source_market_id,
          });
          if (marketBySource) {
            // Determine Status and Active State
            let isActive = false;
            let marketStatus = 0;

            if (payload.status !== undefined) {
              marketStatus = payload.status;
              isActive = marketStatus === 1 || marketStatus === 9;
            } else if (payload.source_market_status_id !== undefined) {
              marketStatus = payload.source_market_status_id;
              isActive = marketStatus === 1 || marketStatus === 9;
            } else if (payload.is_active !== undefined) {
              isActive = payload.is_active === 1;
              marketStatus = isActive ? 1 : 2;
            }

            // Update it
            await this.marketModel.updateOne(
              { _id: marketBySource._id },
              {
                $set: {
                  is_active: isActive,
                  marketStatus: marketStatus,
                },
              },
            );
            return {
              status: 'success',
              message: 'Market status updated via source_id',
            };
          }
        }
        return { status: 'failed', message: 'Market not found' };
      }

      // Determine Status and Active State
      let isActive = false;
      let marketStatus = 0;

      if (payload.status !== undefined) {
        marketStatus = payload.status;
        isActive = marketStatus === 1 || marketStatus === 9;
      } else if (payload.source_market_status_id !== undefined) {
        marketStatus = payload.source_market_status_id;
        // 1 -> ACTIVE, 9 -> BALL RUNNING ==> Active
        // 2 -> INACTIVE, 3 -> SUSPENDED, 4 -> CLOSED ==> Inactive
        isActive = marketStatus === 1 || marketStatus === 9;
      } else if (payload.is_active !== undefined) {
        // Fallback
        isActive = payload.is_active === 1;
        marketStatus = isActive ? 1 : 2;
      }

      // Update Status
      await this.marketModel.updateOne(
        { _id: market._id },
        {
          $set: {
            is_active: isActive,
            marketStatus: marketStatus,
          },
        },
      );

      return { status: 'success', message: 'Market status updated' };
    } catch (error) {
      this.logger.error(
        `Error handling market status update: ${error.message}`,
      );
      return { status: 'error', message: error.message };
    }
  }

  async handleBetResultUpdate(payload: WebhookPayloadDto) {
    this.logger.log(
      `Received Bet Result Update for sys_market_id: ${payload.sys_market_id}`,
    );
    const sportsMaintenanceEnabled =
      await this.maintenanceService.isScopeEnabled('sports');
    if (sportsMaintenanceEnabled) {
      this.logger.warn(
        'Ignoring bet result settlement webhook because sports maintenance mode is enabled.',
      );
      return { status: 'paused', message: 'Sports maintenance mode is active' };
    }

    try {
      // 1. Find the Market
      const market = await this.marketModel.findOne({
        sys_market_id: payload.sys_market_id,
      });
      if (!market) {
        this.logger.warn(
          `Market not found for settlement (sys_market_id: ${payload.sys_market_id})`,
        );
        return { status: 'failed', message: 'Market not found' };
      }

      // 2. Find All Pending Bets for this Market
      const bets = await this.betModel.find({
        marketId: market.market_id,
        status: 'PENDING',
      });

      if (bets.length === 0) {
        this.logger.log(`No pending bets found for market ${market.market_id}`);
        return { status: 'success', message: 'No pending bets to settle' };
      }

      this.logger.log(`Found ${bets.length} pending bets to settle.`);

      // 3. Process Runners Results
      const runnerStatusMap = new Map<number, string>();
      if (payload.runners) {
        payload.runners.forEach((r) =>
          runnerStatusMap.set(r.runner_id, r.status),
        );
      }

      let settledCount = 0;

      for (const bet of bets) {
        const selectionIdNum = Number(bet.selectionId);
        const status = runnerStatusMap.get(selectionIdNum);

        if (!status) continue;

        let betWon = false;
        // Normalize betType to lowercase ('back' or 'lay')
        const type = (bet.betType || 'back').toLowerCase();

        if (type === 'back') {
          if (status === 'WINNER') betWon = true;
          else if (status === 'LOSER') betWon = false;
          else continue;
        } else if (type === 'lay') {
          if (status === 'WINNER') betWon = false;
          else if (status === 'LOSER') betWon = true;
          else continue;
        }

        // 4. Settle Bet
        if (betWon) {
          await this.betModel.updateOne(
            { _id: bet._id },
            { $set: { status: 'WON', result_posted_at: new Date() } },
          );

          // Payout Calculation
          let payout = 0;
          if (type === 'back') {
            payout = bet.stake * bet.odds;
          } else {
            const liability = bet.stake * (bet.odds - 1);
            payout = liability + bet.stake;
          }

          await this.usersService.updateBalanceById(
            bet.userId,
            payout,
            'credit',
          );
        } else {
          await this.betModel.updateOne(
            { _id: bet._id },
            { $set: { status: 'LOST', result_posted_at: new Date() } },
          );
        }
        settledCount++;
      }

      return { status: 'success', message: `Settled ${settledCount} bets` };
    } catch (error) {
      this.logger.error(`Error handling bet result update: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  // --- Public Methods (Getters) ---

  async getCompetitions(sportId?: number) {
    if (sportId) {
      return this.competitionModel
        .find({ sport_id: sportId.toString() })
        .sort({ competition_name: 1 })
        .exec();
    }
    return this.competitionModel.find({}).sort({ competition_name: 1 }).exec();
  }

  async getSports() {
    return this.sportModel.find({}).sort({ oid: 1, sport_name: 1 }).exec();
  }

  async getTournamentEvents(competitionId: string) {
    return this.eventModel
      .find({ competition_id: competitionId })
      .sort({ open_date: 1 })
      .exec();
  }

  // --- Visibility Toggles ---

  async toggleSportVisibility(sportId: string, isVisible: boolean) {
    return this.sportModel.updateOne(
      { sport_id: sportId },
      { $set: { isVisible } },
    );
  }

  async toggleCompetitionVisibility(competitionId: string, isVisible: boolean) {
    return this.competitionModel.updateOne(
      { competition_id: competitionId },
      { $set: { isVisible } },
    );
  }

  async toggleEventVisibility(eventId: string, isVisible: boolean) {
    return this.eventModel.updateOne(
      { event_id: eventId },
      { $set: { isVisible } },
    );
  }

  async getEvents(sportId: number) {
    const cacheKey = `sports:events:${sportId}`;
    const redis = this.getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* Redis miss */
    }

    // Pre-filter: get competition IDs for this sport
    const competitions = await this.competitionModel
      .find({ sport_id: sportId.toString() }, { competition_id: 1 })
      .lean();
    const compIds = competitions.map((c) => c.competition_id);
    if (compIds.length === 0) return [];

    const events = await this.eventModel.aggregate([
      { $match: { competition_id: { $in: compIds } } },
      { $sort: { open_date: 1 } },
      { $limit: 1000 },
      {
        $lookup: {
          from: 'competitions',
          localField: 'competition_id',
          foreignField: 'competition_id',
          as: 'competition',
        },
      },
      { $unwind: { path: '$competition', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'sports',
          localField: 'competition.sport_id',
          foreignField: 'sport_id',
          as: 'competition.sport',
        },
      },
      {
        $unwind: {
          path: '$competition.sport',
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    try {
      await redis.set(cacheKey, JSON.stringify(events), 'EX', SportsService.SPORTS_CACHE_TTL_SECONDS);
    } catch (e) {
      /* non-fatal */
    }
    return events;
  }

  // Grouped data endpoint removed as grouping is no longer needed
  async getLiveEvents(sportId?: number) {
    const cacheKey = `sports:live:all`; // single shared cache — sport filter done on frontend
    const redis = this.getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* Redis miss — fall through to DB */
    }

    let matchQuery: any = { match_status: 'Live', isVisible: { $ne: false } };
    // Note: sport filtering is done on the frontend since older events may lack sport_id

    const events = await this.eventModel.aggregate([
      { $match: matchQuery },
      { $sort: { open_date: 1 } },
      { $limit: 500 },
      {
        $lookup: {
          from: 'competitions',
          localField: 'competition_id',
          foreignField: 'competition_id',
          as: 'competition',
        },
      },
      { $unwind: { path: '$competition', preserveNullAndEmptyArrays: true } },
      // Derive sport_id from competition when not stored directly on event
      {
        $addFields: {
          sport_id: { $ifNull: ['$sport_id', '$competition.sport_id'] },
          'competition.sport': {
            sport_id: { $ifNull: ['$sport_id', '$competition.sport_id'] },
          },
          competition_name: {
            $ifNull: ['$competition_name', '$competition.competition_name', ''],
          },
        },
      },
      // Only return fields needed for listing cards — no markets
      {
        $project: {
          event_id: 1,
          event_name: 1,
          match_status: 1,
          open_date: 1,
          home_team: 1,
          away_team: 1,
          score1: 1,
          score2: 1,
          competition_id: 1,
          competition_name: 1,
          sport_id: 1,
          in_play: 1,
          competition: 1,
        },
      },
    ]);

    try {
      await redis.set(cacheKey, JSON.stringify(events), 'EX', SportsService.SPORTS_CACHE_TTL_SECONDS);
    } catch (e) {
      /* non-fatal */
    }

    return events;
  }

  async getUpcomingEvents(sportId?: number) {
    const cacheKey = `sports:upcoming:all`; // single shared cache — sport filter done on frontend
    const redis = this.getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* Redis miss */
    }

    let matchQuery: any = {
      match_status: { $in: ['Pending', null] },
      isVisible: { $ne: false },
    };
    // Note: sport filtering is done on the frontend since older events may lack sport_id

    const events = await this.eventModel.aggregate([
      { $match: matchQuery },
      { $sort: { open_date: 1 } },
      { $limit: 500 },
      {
        $lookup: {
          from: 'competitions',
          localField: 'competition_id',
          foreignField: 'competition_id',
          as: 'competition',
        },
      },
      { $unwind: { path: '$competition', preserveNullAndEmptyArrays: true } },
      // Derive sport_id from competition when not stored directly on event
      {
        $addFields: {
          sport_id: { $ifNull: ['$sport_id', '$competition.sport_id'] },
          'competition.sport': {
            sport_id: { $ifNull: ['$sport_id', '$competition.sport_id'] },
          },
          competition_name: {
            $ifNull: ['$competition_name', '$competition.competition_name', ''],
          },
        },
      },
      {
        $project: {
          event_id: 1,
          event_name: 1,
          match_status: 1,
          open_date: 1,
          home_team: 1,
          away_team: 1,
          score1: 1,
          score2: 1,
          competition_id: 1,
          competition_name: 1,
          sport_id: 1,
          in_play: 1,
          competition: 1,
        },
      },
    ]);

    try {
      await redis.set(cacheKey, JSON.stringify(events), 'EX', SportsService.SPORTS_CACHE_TTL_SECONDS);
    } catch (e) {
      /* non-fatal */
    }

    return events;
  }

  // Sport definitions — mirrors ADMIN_SPORTS in TurnkeySyncService
  private readonly SPORT_LIST = [
    { eid: 4, name: 'Cricket' },
    { eid: 1, name: 'Football' },
    { eid: 2, name: 'Tennis' },
    { eid: 10, name: 'Horse Racing' },
    { eid: 66, name: 'Kabaddi' },
    { eid: 40, name: 'Politics' },
    { eid: 8, name: 'Table Tennis' },
    { eid: 15, name: 'Basketball' },
    { eid: 6, name: 'Boxing' },
    { eid: 18, name: 'Volleyball' },
    { eid: 22, name: 'Badminton' },
  ];

  /**
   * getAllEvents — Turnkey-only. Reads allevents:* Redis keys.
   * SR events are served separately via getSREvents().
   */
  async getAllEvents(sportId?: number) {
    const cacheKey = `sports:all:v4`; // v4 = Turnkey-only, no SR mixing
    const redis = this.getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) { /* Redis miss */ }

    const allEvents: any[] = [];

    await Promise.all(
      this.SPORT_LIST.map(async (sport) => {
        try {
          const raw = await redis.get(`allevents:${sport.eid}`);
          let feedEvents: any[] = [];
          if (raw) feedEvents = JSON.parse(raw);
          if (feedEvents.length === 0) return;

          for (const e of feedEvents) {
            const eventId = String(e?.gmid ?? e?.eid ?? e?.event_id ?? '');
            if (!eventId) continue;

            const inplay = !!(e?.iplay ?? e?.inplay ?? e?.in_play ?? false);
            const openDate = String(e?.stime ?? e?.open_date ?? '');

            // Auto-hide: skip non-live events that started > 5h ago
            const startMs = openDate ? new Date(openDate).getTime() : 0;
            const hoursSinceStart =
              startMs > 0 ? (Date.now() - startMs) / 3_600_000 : 0;
            if (!inplay && hoursSinceStart > 5) continue;

            const matchStatus = inplay ? 'Live' : 'Pending';
            const eventName = String(e?.ename ?? e?.event_name ?? '');
            const competitionId = String(e?.cid ?? e?.competition_id ?? '');
            const competitionName = String(
              e?.cname ?? e?.competition_name ?? '',
            );
            const parts = eventName.split(' v ');

            // ── Extract Match Odds from live odds cache ────────────────
            let matchOdds: {
              marketId: string;
              marketName: string;
              selectionId: string;
              name: string;
              back: number | null;
              betType: 'back';
            }[] = [];
            try {
              const oddsRaw = await redis.get(`odds:${eventId}`);
              if (oddsRaw) {
                const markets: any[] = JSON.parse(oddsRaw);
                // Prefer market named "Match Odds", else use first market
                const mkt =
                  markets.find((m) =>
                    String(m?.mname ?? '')
                      .toLowerCase()
                      .includes('match odds'),
                  ) || markets[0];

                if (mkt) {
                  // rt = array of {ri, ib, rt, bv, nat}
                  const rt: any[] = mkt.rt || [];
                  const marketId = String(
                    mkt.mid || mkt.market_id || mkt.id || '',
                  );
                  const marketName = String(
                    mkt.mname || mkt.market_name || 'Match Odds',
                  );
                  const grouped = new Map<
                    string,
                    {
                      marketId: string;
                      marketName: string;
                      selectionId: string;
                      name: string;
                      back: number | null;
                      betType: 'back';
                    }
                  >();
                  for (const r of rt) {
                    const ri = String(r.ri ?? r.selectionId ?? '');
                    if (!ri) continue;
                    const name = r.nat || `Runner ${ri}`;
                    if (!grouped.has(ri)) {
                      grouped.set(ri, {
                        marketId,
                        marketName,
                        selectionId: ri,
                        name,
                        back: null,
                        betType: 'back',
                      });
                    }
                    if (r.ib && r.rt) {
                      const cur = grouped.get(ri)!;
                      if (cur.back === null || r.rt < cur.back) cur.back = r.rt;
                    }
                  }
                  // Also handle section-based format
                  if (grouped.size === 0 && mkt.section) {
                    for (const sel of mkt.section || []) {
                      const name = sel.nat || sel.name || '';
                      const odds: any[] = sel.odds || [];
                      const back =
                        odds.find((o: any) => o.otype === 'back')?.odds ?? null;
                      const selectionId = String(
                        sel.sid ?? sel.selectionId ?? sel.selection_id ?? name,
                      );
                      if (name) {
                        grouped.set(selectionId, {
                          marketId,
                          marketName,
                          selectionId,
                          name,
                          back,
                          betType: 'back',
                        });
                      }
                    }
                  }
                  matchOdds = [...grouped.values()].slice(0, 3);
                }
              }
            } catch (_) {
              /* non-fatal — show card without odds */
            }

            allEvents.push({
              event_id: eventId,
              event_name: eventName,
              match_status: matchStatus,
              open_date: openDate,
              home_team: parts.length >= 2 ? parts[0].trim() : eventName,
              away_team: parts.length >= 2 ? parts[1].trim() : '',
              score1: e?.score1 ?? null,
              score2: e?.score2 ?? null,
              competition_id: competitionId,
              competition_name: competitionName,
              sport_id: String(sport.eid),
              in_play: inplay,
              match_odds: matchOdds.length > 0 ? matchOdds : undefined,
              competition: {
                competition_id: competitionId,
                competition_name: competitionName,
                sport_id: String(sport.eid),
                sport: { sport_id: String(sport.eid), sport_name: sport.name },
              },
            });
          }
        } catch (_) {
          // Skip sport on parse error
        }
      }),
    );

    // Deduplicate by event_id
    const deduped = [
      ...new Map(allEvents.map((e) => [e.event_id, e])).values(),
    ];

    // Keep this list effectively live so the sports lobby does not trail the betslip snapshot.
    try {
      await redis.set(cacheKey, JSON.stringify(deduped), 'EX', SportsService.SPORTS_CACHE_TTL_SECONDS);
    } catch (e) {
      /* non-fatal */
    }

    return deduped;
  }


  async getMatchDetails(matchId: string) {
    const events = await this.eventModel.aggregate([
      { $match: { event_id: matchId } },
      {
        $lookup: {
          from: 'competitions',
          localField: 'competition_id',
          foreignField: 'competition_id',
          as: 'competition',
        },
      },
      { $unwind: { path: '$competition', preserveNullAndEmptyArrays: true } },
      // Ensure competition_name is always set — use the event's own field as fallback if lookup returned nothing
      {
        $addFields: {
          competition: {
            $mergeObjects: [
              {
                competition_name: '$competition_name',
                sport_id: '$sport_id',
              },
              { $ifNull: ['$competition', {}] },
            ],
          },
          // Also expose competition_name at top level so frontend direct access works
          competition_name: {
            $ifNull: ['$competition.competition_name', '$competition_name', ''],
          },
        },
      },
      {
        $lookup: {
          from: 'sports',
          localField: 'competition.sport_id',
          foreignField: 'sport_id',
          as: 'competition.sport',
        },
      },
      {
        $unwind: {
          path: '$competition.sport',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'markets',
          localField: 'event_id',
          foreignField: 'event_id',
          as: 'markets',
        },
      },
      {
        $lookup: {
          from: 'marketodds',
          localField: 'markets.market_id',
          foreignField: 'market_id',
          as: 'allOdds',
        },
      },
    ]);

    const event = events[0] || null;

    if (event && event.markets && event.allOdds) {
      event.markets.forEach((market: any) => {
        market.marketOdds = event.allOdds.filter(
          (o: any) => o.market_id === market.market_id,
        );
      });
      delete event.allOdds;
    }

    return event;
  }

  // getGroupedData method removed; frontend now works directly with events without grouping

  async getActiveSystemMarketIds(): Promise<string[]> {
    // Not straightforward with Mongo if sys_market_id is not indexed or common
    // But logic: find markets with sys_market_id != null, then filter by event status.

    // 1. Find all active Events first
    const now = new Date();
    const activeEvents = await this.eventModel
      .find({
        $or: [
          { match_status: 'Live' },
          { match_status: 'Pending', open_date: { $gte: now.toISOString() } },
        ],
      })
      .select('event_id');

    const activeEventIds = activeEvents.map((e) => e.event_id);

    // 2. Find markets
    const markets = await this.marketModel.find({
      sys_market_id: { $ne: null },
      event_id: { $in: activeEventIds },
    });

    return markets.map((m) => m.sys_market_id.toString());
  }

  async getScorecard(matchId: string) {
    const token = await this.authenticate();
    if (!token) throw new Error('Auth failed');
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.API_URL}/get_scorecard`, {
          access_token: token,
          match_id: matchId,
        }),
      );
      return data;
    } catch (error) {
      this.logger.error(`Error fetching scorecard for ${matchId}`);
      return null;
    }
  }

  async updateSportLimits(sportId: string, minBet: number, maxBet: number) {
    return this.sportModel.updateOne(
      { sport_id: sportId },
      { $set: { minBet, maxBet } },
    );
  }

  async placeBet(
    userId: number,
    matchId: string,
    marketId: string,
    selectionId: string,
    selectionName: string,
    marketName: string,
    eventName: string,
    rate: number,
    amount: number,
    type: 'back' | 'lay',
    marketType: string,
  ) {
    await this.maintenanceService.assertScopeAvailable(
      'sports',
      'Sports betting is temporarily unavailable due to maintenance.',
      userId,
    );

    // 0. Validate Limits & Event Timing
    const event = await this.eventModel.findOne({ event_id: matchId });
    if (event) {
      const now = new Date();
      const openDate = new Date(event.open_date);

      // Prevent bets if match hasn't started and isn't Live
      if (openDate > now && event.match_status !== 'Live') {
        throw new Error('Betting is not permitted before the match starts.');
      }

      const competition = await this.competitionModel.findOne({
        competition_id: event.competition_id,
      });
      if (competition) {
        const sport = await this.sportModel.findOne({
          sport_id: competition.sport_id,
        });
        if (sport) {
          if (amount < (sport.minBet || 100)) {
            throw new Error(
              `Minimum bet for ${sport.sport_name} is ${sport.minBet || 100}`,
            );
          }
          if (amount > (sport.maxBet || 100000)) {
            throw new Error(
              `Maximum bet for ${sport.sport_name} is ${sport.maxBet || 100000}`,
            );
          }
        }
      }
    }

    // 0.5 Check Latest Odds Parity
    const market = await this.marketModel.findOne({ market_id: marketId });
    if (!market || !market.runners_data) {
      throw new Error('Market odds are unavailable or suspended.');
    }

    let oddsMatch = false;
    for (const runner of market.runners_data || []) {
      // Find specific matching selection
      if (
        runner.nat === selectionName ||
        (runner.id && runner.id.toString() === selectionId?.toString())
      ) {
        const oddsArray = runner.odds || [];
        // Check if requested rate still exists as a valid active odd
        for (const odd of oddsArray) {
          if (
            odd.otype?.toLowerCase() === type?.toLowerCase() &&
            parseFloat(odd.odds) === parseFloat(rate.toString())
          ) {
            oddsMatch = true;
            break;
          }
        }
      }
      if (oddsMatch) break;
    }

    if (!oddsMatch) {
      throw new Error(
        `Price changed. The requested odds ${rate} for ${type?.toUpperCase()} are no longer available.`,
      );
    }

    // 1. Validate User & Balance (Postgres)
    const wallet = await this.usersService.getWallet(userId);
    if (!wallet) throw new Error('User not found');
    if (wallet.balance < amount) throw new Error('Insufficient balance');

    // 2. Deduct Balance (Postgres)
    const userDetails = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    await this.usersService.updateBalance(
      userDetails.username,
      amount,
      'debit',
    );

    try {
      // 3. Authenticate
      const token = await this.authenticate();
      if (!token) {
        await this.usersService.updateBalance(
          userDetails.username,
          amount,
          'credit',
        );
        throw new Error('Auth failed');
      }

      // 4. Create Bet in MongoDB
      const localBet = await this.betModel.create({
        userId: userId,
        eventId: matchId,
        eventName: eventName,
        marketId: marketId,
        marketName: marketName,
        selectionId: selectionId,
        selectionName: selectionName,
        odds: rate,
        stake: amount,
        potentialWin: (rate - 1) * amount,
        status: 'PENDING',
      });

      // 5. Place Bet on MyZosh
      const payload = {
        access_token: token,
        match_id: matchId,
        market_id: marketId,
        selection_id: selectionId,
        rate: rate.toString(),
        amount: amount.toString(),
        bet_type: type,
        market_type: marketType,
      };

      const { data } = await firstValueFrom(
        this.httpService.post<MyZoshBetPlaceResponse>(
          `${this.API_URL}/bet-place`,
          payload,
        ),
      );

      this.logger.log(`Bet placed on MyZosh: ${JSON.stringify(data)}`);

      if (data.status.code === 200) {
        return { ...data, localBetId: localBet._id };
      } else {
        // Failed at MyZosh - Refund & Void
        await this.usersService.updateBalance(
          userDetails.username,
          amount,
          'credit',
        );

        await this.betModel.updateOne(
          { _id: localBet._id },
          { $set: { status: 'VOID' } },
        );

        throw new Error(
          data.status.message || 'Bet placement failed on exchange',
        );
      }
    } catch (error) {
      this.logger.error('Error placing bet');
      // Check if we need to refund (simplistic check: if error is NOT "Insufficient balance" etc)
      // Ideally we need transaction rollback or more robust state.
      throw error;
    }
  }

  async getUserBets(userId: number) {
    return this.betModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  // --- Internal Matching Engine ---

  async placeLimitOrder(
    userId: number,
    marketId: string,
    selectionId: string,
    type: OrderType,
    price: number,
    stake: number,
  ) {
    // 1. Validate User Balance (Simple check for now)
    const wallet = await this.usersService.getWallet(userId);
    if (!wallet) throw new Error('User not found');

    // For BACK bets, we lock stake. For LAY bets, we lock Liability ((price - 1) * stake)
    const lockedAmount = type === OrderType.BACK ? stake : (price - 1) * stake;

    if (wallet.balance < lockedAmount) throw new Error('Insufficient balance');

    // 2. Deduct Balance (Lock funds)
    const userDetails = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    await this.usersService.updateBalance(
      userDetails.username,
      lockedAmount,
      'debit',
    );

    try {
      // 3. Create Open Order
      const order = new this.orderModel({
        user_id: userId,
        market_id: marketId,
        selection_id: selectionId,
        type,
        price,
        stake,
        remaining_stake: stake,
        status: OrderStatus.OPEN,
      });
      await order.save();

      // 4. Match Order
      await this.matchOrder(order);

      return order;
    } catch (error) {
      // Refund on error
      await this.usersService.updateBalance(
        userDetails.username,
        lockedAmount,
        'credit',
      );
      throw error;
    }
  }

  private async matchOrder(incomingOrder: OrderDocument) {
    const isBack = incomingOrder.type === OrderType.BACK;
    const matchType = isBack ? OrderType.LAY : OrderType.BACK;

    // Find matching orders
    // BACK matches with LAY orders having price <= incomingPrice (prefer lower lay price? No, exchange rules:
    // If I BACK @ 2.0, I want 2.0 or HIGHER.
    // If I LAY @ 2.0, I want 2.0 or LOWER.

    // CORRECTION:
    // BACK order @ P: Matches with existing LAY orders where LayPrice >= P. (Wait, if I want to back at 2.0, and someone laid at 2.1, I get 2.1 which is better).
    // Standard matching:
    // Incoming BACK @ 2.0 matches Best Available LAY.
    // Best LAY is the HIGHEST price?
    // Let's think:
    // Lay side wants to sell low? No.
    // Backer wants High Odds.
    // Layer wants Low Odds.

    // Order Book:
    // Backs: [1.9, 1.8, 1.7] (Best is 1.9)
    // Lays: [2.1, 2.2, 2.3] (Best is 2.1)
    // Spread is 1.9 - 2.1. No match.

    // Incoming BACK @ 2.1:
    // Crosses spread. Matches with LAY @ 2.1.

    // Incoming BACK @ 2.2:
    // Matches matching LAY @ 2.1 (Better price for Backer).

    // So:
    // Incoming BACK @ P matches LAYs where LayPrice >= BackPrice?
    // Wait. Backer wants highest possible.
    // Layer available at 2.1. Backer asks 2.0.
    // Backer gets 2.1. (Matched at Maker Price usually, or incoming price? usually Maker price).
    // Let's stick to standard: Match if queryPrice overlaps best available.

    let matchingOrders;

    if (isBack) {
      // Looking for LAYs.
      // I bid 2.0. I match anything >= 2.0.
      // Sorting: We want the *Lowest* Lay price? Ref: "Lay bets (sorted by lowest price first)" in Prompt.
      // Wait, Prompt says "Lay bets (sorted by lowest price first)".
      // If Lay is offering 1.5, and I want 2.0.
      // Back 2.0 means I want to double my money.
      // Lay 1.5 means they pay 0.5 profit.
      // If I Back @ 2.0, I WON'T accept 1.5.
      // So I need Lay Price >= 2.0.
      // But usually Lays are the "Ask".
      // Backs are "Bid".
      // Bid 2.0. Ask 2.1. No match.
      // Ask 1.9. Match!
      // So if I Back @ 2.0, I Match any Lay >= 2.0.
      // Wait.
      // If I Lay @ 2.0, I am offering odds of 2.0. (I lose 1 unit for 1 unit stake).
      // If I Lay @ 1.5, I lose 0.5. (Better for Layer).
      // So Layers want LOWER odds.
      // Backers want HIGHER odds.

      // Match Condition: BackPrice <= LayPrice.
      // Example: Back @ 2.0. Existing Lay @ 2.1.
      // Backer wants 2.0. Layer offers 2.1.
      // Deal is POSSIBLE.
      // Price? Usually the resting order's price (2.1).

      // So: Incoming BACK @ P. Find Lays where Price >= P.
      // Sort Lays by DESC (Highest matched first? No, Backer wants highest, so yes).

      matchingOrders = await this.orderModel
        .find({
          market_id: incomingOrder.market_id,
          selection_id: incomingOrder.selection_id,
          type: matchType,
          status: { $in: [OrderStatus.OPEN, OrderStatus.PARTIAL] },
          price: { $gte: incomingOrder.price }, // Lay Price must be >= different
        })
        .sort({ price: -1, createdAt: 1 }); // Best Price for Backer is HIGHEST.
    } else {
      // Incoming LAY @ 2.0.
      // I want to Lay @ 2.0 or LOWER.
      // Existing Backs @ 1.9.
      // Lay @ 2.0 vs Back @ 1.9.
      // No match. Layer wants < 2.0 (less risk). Backer wants > 1.9.

      // Incoming LAY @ 1.8.
      // Existing Back @ 1.9.
      // Match!
      // Condition: LayPrice >= BackPrice (Wait, logic flip).
      // Layer wants <= P. Backer wants >= P.
      // Meet if BackPrice >= LayPrice.

      // Back @ 1.9. Lay @ 1.8.
      // Backer wants >= 1.9. Layer wants <= 1.8.
      // 1.9 >= 1.8. Yes.
      // Match Price: Maker's price (1.9).

      matchingOrders = await this.orderModel
        .find({
          market_id: incomingOrder.market_id,
          selection_id: incomingOrder.selection_id,
          type: matchType,
          status: { $in: [OrderStatus.OPEN, OrderStatus.PARTIAL] },
          price: { $lte: incomingOrder.price },
        })
        .sort({ price: 1, createdAt: 1 }); // Best Price for Layer is LOWEST.
      // Wait. Back orders sorted by Highest first?
      // A Backer at 1.5 is easier to satisfy than 2.0.
      // But Layer wants to sell high? No, Layer acts as "House".
      // Layer wants to payout LESS.
      // Payout is (Odds - 1) * Stake.
      // So Layer wants LOW Odds.
      // Existing Backs: [2.0, 1.9, 1.8].
      // Layer comes in at 1.9.
      // Can match with 1.9? Yes.
      // Can match with 2.0?
      // Backer wants 2.0. Layer wants 1.9. (Layer wants <= 1.9).
      // 2.0 > 1.9. So Layer gets 2.0? No, Layer would have to pay 2.0. Layer doesn't want that.
      // So Layer @ 1.9 CANNOT match Back @ 2.0.
      // Layer @ 1.9 CAN match Back @ 1.8 (Because Layer pays 1.8 which is < 1.9, good).

      // So for Incoming LAY: Match Backs where BackPrice <= LayPrice.
      // Sort Backs by Highest Price to see if we cross?
      // Actually, if I Lay @ 1.9, I am happy to take 1.8.
      // So find Backs with Price <= 1.9.
      // We want to match the "Best" Backs first?
      // The "Best" Back for me (Layer) is the lowest odds? Yes.
      // But standard matching engine matches "Market" best.
      // Who is the Maker? The Backer.
      // Backer @ 1.8 is waiting.
      // I come in Lay @ 1.9.
      // I match 1.8.
      // Price is 1.8.
      // (Note: Exchange logic can be tricky, typically "Best Execution" means matching constraints).

      // Let's rely on simple intersection:
      // Match if prices cross. Execute at Maker Price.
    }

    for (const makerOrder of matchingOrders) {
      if (incomingOrder.remaining_stake <= 0) break;

      const matchedStake = Math.min(
        incomingOrder.remaining_stake,
        makerOrder.remaining_stake,
      );
      const matchedPrice = makerOrder.price; // Maker dictates price in standard CLOB

      // Create Trade
      const trade = new this.tradeModel({
        market_id: incomingOrder.market_id,
        selection_id: incomingOrder.selection_id,
        price: matchedPrice,
        stake: matchedStake,
        maker_order_id: makerOrder._id,
        taker_order_id: incomingOrder._id,
      });
      await trade.save();

      this.logger.log(`Matched! Trade: ${matchedStake} @ ${matchedPrice}`);

      // Update Maker
      makerOrder.remaining_stake -= matchedStake;
      if (makerOrder.remaining_stake <= 0) {
        makerOrder.status = OrderStatus.MATCHED;
        makerOrder.remaining_stake = 0; // safety
      } else {
        makerOrder.status = OrderStatus.PARTIAL;
      }
      await makerOrder.save();

      // Update Incoming (Taker)
      incomingOrder.remaining_stake -= matchedStake;
      // Status update happens after loop or incrementally?
      // Let's do it after loop for final status, but we need strictly decreasing stick.

      // Update LTP in Market
      await this.marketModel.updateOne(
        { market_id: incomingOrder.market_id }, // Assuming generic market match
        // Note: Schema doesn't have LTP field on Market root, usually it's per runner.
        // Assuming runners_data is array.
        // We need to update the specific runner's LTP in `runners_data`.
        // This is hard with 'Mixed' type and array.
        // We will try arrayFilters if possible, or just standard pull/push/set.
        // For now, let's just log or try to set a top-level LTP if market was single-runner (unlikely).
        // Just setting a "last_trade" field for now.
        {
          $set: {
            last_trade: {
              price: matchedPrice,
              selection_id: incomingOrder.selection_id,
              timestamp: new Date(),
            },
          },
        },
      );

      // Important: Update LTP inside runners_data if possible
      await this.updateRunnerLTP(
        incomingOrder.market_id,
        incomingOrder.selection_id,
        matchedPrice,
      );
    }

    // TODO: User Balance Settlements (Credits/Debits for the matched portion) would go here.

    if (incomingOrder.remaining_stake <= 0) {
      incomingOrder.status = OrderStatus.MATCHED;
      incomingOrder.remaining_stake = 0;
    } else if (incomingOrder.remaining_stake < incomingOrder.stake) {
      incomingOrder.status = OrderStatus.PARTIAL;
    }
    await incomingOrder.save();
  }

  private async updateRunnerLTP(
    marketId: string,
    selectionId: string,
    price: number,
  ) {
    try {
      const market = await this.marketModel.findOne({ market_id: marketId });
      if (!market || !market.runners_data) return;

      let updated = false;
      // Assuming runners_data is array of objects with selectionId/runnerName etc
      const runners = market.runners_data.map((r: any) => {
        if (String(r.selectionId || r.selection_id) === String(selectionId)) {
          r.ltp = price;
          r.lastMatchedAt = new Date();
          updated = true;
        }
        return r;
      });

      if (updated) {
        await this.marketModel.updateOne(
          { market_id: marketId },
          { $set: { runners_data: runners } },
        );
      }
    } catch (e) {
      this.logger.error(`Failed to update LTP: ${e.message}`);
    }
  }

  async updateMatchStatusFromSocket(matchId: string, ip: any) {
    // ip: 1 = In Play (Live), 0 = Not In Play
    const isLive = ip == 1 || ip === true || ip === '1';

    const updateData: any = {};
    if (isLive) updateData.match_status = 'Live';

    if (Object.keys(updateData).length > 0) {
      await this.eventModel.updateOne(
        { event_id: matchId },
        { $set: updateData },
      );
      this.logger.log(
        `Socket Update: Match ${matchId} status set to ${updateData.match_status} (IP=${ip})`,
      );
    }
  }

  async updateMarketStatusFromSocket(marketId: string, ms: any) {
    // ms: Market Status.
    // 1 = Active/Open?
    const updateData: any = { marketStatus: ms };

    if (ms === 1 || ms === '1' || ms === 'OPEN' || ms === 'ACTIVE') {
      updateData.is_active = true;
    } else if (
      ms === 'SUSPENDED' ||
      ms === 'CLOSED' ||
      ms === 2 ||
      ms === 3 ||
      ms === 9
    ) {
      updateData.is_active = false;
    }

    await this.marketModel.updateOne(
      { market_id: marketId },
      { $set: updateData },
    );
  }

  async updateOddsFromSocket(updates: any[]) {
    if (!updates || !Array.isArray(updates)) return;

    for (const update of updates) {
      try {
        // update.bmi = sys_market_id / market_id (source)
        // update.eid = event_id (source)
        // update.rt = runners

        const bmi = update.bmi;
        const runners = update.rt;

        if (!bmi || !runners || !Array.isArray(runners)) continue;

        // Find market by sys_market_id (preferred) or market_id
        let market = await this.marketModel.findOne({
          $or: [{ sys_market_id: Number(bmi) }, { market_id: String(bmi) }],
        });

        if ((!market || !market.sys_market_id) && update.eid) {
          this.logger.log(
            `Exchange Market missing or no sys_id: ${bmi}. Importing for Event ${update.eid}...`,
          );
          // Lazy Import using event_id
          await this.importExchangeMarkets(
            null,
            null,
            null,
            String(update.eid),
          ); // nulls trigger auto-lookup

          // Re-fetch
          market = await this.marketModel.findOne({
            $or: [{ sys_market_id: Number(bmi) }, { market_id: String(bmi) }],
          });

          if (market && market.sys_market_id) {
            this.logger.log(
              `Imported and subscribing to sys_market_id: ${market.sys_market_id}`,
            );
            this.sportsSocketService.subscribe([String(market.sys_market_id)]);
          }
        }

        if (!market) continue;

        // We need to map 'rt' entries to specific runners (selectionId)
        // MarketOdd schema stores odds flatted: back0_price, etc. which usually corresponds to runner 0, 1, 2.
        // But wait, schema has ONE set of back0..2, lay0..2. This implies MarketOdd is PER RUNNER?
        // Let's re-read MarketOdd schema.
        // It has Runner1, Runner2. And back0..2.
        // Usually "back0_price" means "Best Back Price". "back1_price" is 2nd best.
        // BUT if we have multiple runners (Team A, Team B, Draw), we need odds FOR EACH RUNNER.
        // MarketOdd schema seems to store odds for "the market"? NO.
        // Lines 27-51: back0_price... lay2_size.
        // This looks like ONE ladder (3 levels).
        // If there are 3 runners, we need 3 MarketOdd documents? Or MarketOdd has nested structure?
        // Schema shows lines 15, 18: runner1, runner2. This is weird.
        // A standard MarketOdd usually links to a specific Runner (Selection).
        // OR, the schema expects us to store odds for *all* runners in one doc? But there's only one set of back0_price.
        // LIMITATION: The current MarketOdd schema seems designed for a 2-runner market or it's malformed/misunderstood.
        // However, `SportsMainContent` handles multiple runners: `uniqueRunners.forEach`.
        // It updates `marketOdds` array in local state.
        // `getLiveEvents` joins `marketodds` collection.
        // `MarketOdd` schema has `market_id` unique? `unique: true` at line 8.
        // IF `market_id` is unique, then standard MarketOdd schema can only hold odds for *one* thing or *aggregate*?
        // BUT `SportsMainContent` iterates runners.

        // Let's look at `SportsMainContent` again.
        // It says: `const currentOdds = market.marketOdds?.[0]`.
        // It seems the frontend *only* uses the first element of `marketOdds` array?
        // AND inside that, via `updateRunner(index, ...)`, it sets `back${index}_price`.
        // Wait. `index` in frontend `updateRunner(runnerIndex)` corresponds to `runnerIndex` in `runners_data`.
        // If `runnerIndex` is 0, it updates `back0_price`. If 1, `back1_price`.
        // This implies `back0` corresponds to Runner 0. `back1` to Runner 1.
        // So the parsed odds for Runner 0 are stored in `back0_...` fields of the SINGLE MarketOdd document.
        // This is a "Columnar" approach for up to 3 runners (0, 1, 2).
        // If there are more runners, this schema fails. But most matches have 2 or 3 (Draw).
        // Conclusion: Standardize on this Columnar approach.
        // Runner 0 -> keywords back0/lay0.
        // Runner 1 -> back1/lay1.
        // Runner 2 -> back2/lay2.

        // Prepare update object
        const updateOps: any = {};
        // We also update status/inplay if present?
        // if (update.ip) updateOps.inplay = update.ip === 1; // IP is usually on event, but maybe here too.

        const marketRunners = market.runners_data || [];

        // Group updates by selectionId (ri)
        const updatesByRi: Record<string, any[]> = {};
        runners.forEach((r: any) => {
          const ri = String(r.ri);
          if (!updatesByRi[ri]) updatesByRi[ri] = [];
          updatesByRi[ri].push(r);
        });

        Object.keys(updatesByRi).forEach((ri) => {
          // Find index in market.runners_data
          const runnerIndex = marketRunners.findIndex(
            (mr: any) => String(mr.selectionId || mr.selection_id) === ri,
          );

          if (runnerIndex !== -1 && runnerIndex <= 2) {
            const runnerUpdates = updatesByRi[ri];
            // Sort Backs (ib=true)
            // Standard: Best Back price is HIGHEST. But `pr` might be valid price?
            // Frontend says: `backs.sort((a,b) => (a.pr) - (b.pr))`.
            // If `pr` is 0, 1, 2 (level), then 0 is best.
            // Users usually want Level 0.
            const backs = runnerUpdates
              .filter((u) => u.ib)
              .sort((a, b) => (a.pr || 0) - (b.pr || 0));
            const lays = runnerUpdates
              .filter((u) => !u.ib)
              .sort((a, b) => (a.pr || 0) - (b.pr || 0));

            if (backs.length > 0) {
              const best = backs[0];
              updateOps[`back${runnerIndex}_price`] = best.rt; // rt is Rate/Price
              updateOps[`back${runnerIndex}_size`] = best.bv; // bv is Volume
            }
            if (lays.length > 0) {
              const best = lays[0];
              updateOps[`lay${runnerIndex}_price`] = best.rt;
              updateOps[`lay${runnerIndex}_size`] = best.bv;
            }
          }
        });

        if (Object.keys(updateOps).length > 0) {
          await this.marketOddModel.updateOne(
            { market_id: market.market_id },
            {
              $set: {
                ...updateOps,
                event_id: market.event_id,
              },
            },
            { upsert: true },
          );
        }
      } catch (e) {
        this.logger.error(`Error processing socket odds update: ${e.message}`);
      }
    }
  }

  async updateSessionOddsFromSocket(updates: any[]) {
    if (!updates || !Array.isArray(updates)) return;

    for (const update of updates) {
      try {
        // Infer fields. Common keys: id (market_id), val (status), b1/l1 (prices)
        const marketId = update.id || update.mid || update.market_id; // Check all common ID fields
        if (!marketId) continue;

        const updateData: any = {};

        // Status
        if (update.ms || update.game_status || update.status) {
          updateData.game_status =
            update.ms || update.game_status || update.status;
        }

        // Prices - Support various common keys
        if (update.b1 !== undefined) updateData.back_price = update.b1;
        if (update.bs1 !== undefined) updateData.back_size = update.bs1;
        if (update.l1 !== undefined) updateData.lay_price = update.l1;
        if (update.ls1 !== undefined) updateData.lay_size = update.ls1;

        // Alternative keys
        if (update.BackPrice1 !== undefined)
          updateData.back_price = update.BackPrice1;
        if (update.LayPrice1 !== undefined)
          updateData.lay_price = update.LayPrice1;
        if (update.BackSize1 !== undefined)
          updateData.back_size = update.BackSize1;
        if (update.LaySize1 !== undefined)
          updateData.lay_size = update.LaySize1;

        // Min/Max/SrNo
        if (update.min !== undefined) updateData.min = update.min;
        if (update.max !== undefined) updateData.max = update.max;
        if (update.sr !== undefined) updateData.sr_no = update.sr;

        if (Object.keys(updateData).length > 0) {
          // Try to update Session
          await this.sessionModel.updateOne(
            { market_id: String(marketId) },
            { $set: updateData },
          );
        }
      } catch (e) {
        this.logger.error(`Error updating session odds: ${e.message}`);
      }
    }
  }

  async updateFancyOddsFromSocket(updates: any[]) {
    if (!updates || !Array.isArray(updates)) return;

    for (const update of updates) {
      try {
        const marketId = update.id || update.mid || update.market_id;
        if (!marketId) continue;

        const updateData: any = {};

        if (update.ms || update.game_status || update.status)
          updateData.game_status =
            update.ms || update.game_status || update.status;

        // Fancy often has just "Rate" and "Score"? Or Back/Lay?
        // Assuming Back/Lay structure for now similar to Session
        if (update.b1 !== undefined) updateData.back_price = update.b1;
        if (update.bs1 !== undefined) updateData.back_size = update.bs1;
        if (update.l1 !== undefined) updateData.lay_price = update.l1;
        if (update.ls1 !== undefined) updateData.lay_size = update.ls1;

        // Min/Max/SrNo
        if (update.min !== undefined) updateData.min = update.min;
        if (update.max !== undefined) updateData.max = update.max;
        if (update.sr !== undefined) updateData.srno = update.sr; // Fancy uses 'srno'

        if (Object.keys(updateData).length > 0) {
          await this.fancyModel.updateOne(
            { market_id: String(marketId) },
            { $set: updateData },
          );
        }
      } catch (e) {
        this.logger.error(`Error updating fancy odds: ${e.message}`);
      }
    }
  }

  async updateBookmakerOddsFromSocket(updates: any[]) {
    // Bookmaker odds often look like Match Odds but might be sent separately
    // to avoid mixing with Exchange odds involved in matching.
    // Usage: Fixed odds, usually back/lay or just back.

    if (!updates || !Array.isArray(updates)) return;

    // Re-use updateOddsFromSocket logic or custom?
    // Let's assume they are similar to Match Odds (runners with prices).
    // But if they come as 'bm_odds', we process them here.
    await this.updateOddsFromSocket(updates);
  }
  async handleFancySocketMessage(updates: any[]) {
    if (!updates || !Array.isArray(updates)) return;

    for (const update of updates) {
      try {
        // update = { mi: 123, eid: 456, rt: [...] }
        const marketId = String(update.mi);
        const eventId = String(update.eid);

        if (!marketId || !eventId) continue;

        // 1. Check if Market exists and has sys_market_id
        let market = await this.marketModel.findOne({ market_id: marketId });

        if (!market || !market.sys_market_id) {
          // Import (this will fetch all session markets for the match)
          // We pass null for sport/tournament to trigger auto-lookup
          await this.importSessionMarkets(null, null, null, eventId);

          // Re-fetch
          market = await this.marketModel.findOne({ market_id: marketId });

          if (market && market.sys_market_id) {
            // 2. Subscribe to the new System Market ID
            // The user said: "set socket with imported marketed sys market id"
            this.sportsSocketService.subscribe([String(market.sys_market_id)]);
          }
        }

        // 3. Process the Odds Update (rt array)
        if (update.rt && Array.isArray(update.rt) && market) {
          // Reuse updateOddsFromSocket logic but adapted for single update object
          // We need to construct an object that updateOddsFromSocket's logic (or similar) can handle
          // OR just write specific logic here since 'rt' format is specific.

          // Helper to process RT array into MarketOdd format
          // update.rt = [{ri:..., rt:..., pt:...}, ...]
          const marketRunners = market.runners_data || [];
          const updateOps: any = {};

          const updatesByRi: Record<string, any[]> = {};
          update.rt.forEach((r: any) => {
            const ri = String(r.ri);
            if (!updatesByRi[ri]) updatesByRi[ri] = [];
            updatesByRi[ri].push(r);
          });

          Object.keys(updatesByRi).forEach((ri) => {
            // Find runner index
            const runnerIndex = marketRunners.findIndex(
              (mr: any) => String(mr.selectionId || mr.selection_id) === ri,
            );

            if (runnerIndex !== -1 && runnerIndex <= 2) {
              const runnerUpdates = updatesByRi[ri];
              // Sort and extract Best Prices
              const backs = runnerUpdates
                .filter((u: any) => u.ib)
                .sort((a: any, b: any) => (a.pr || 0) - (b.pr || 0));
              const lays = runnerUpdates
                .filter((u: any) => !u.ib)
                .sort((a: any, b: any) => (a.pr || 0) - (b.pr || 0));

              if (backs.length > 0) {
                // For Fancy/Session, usually rt is price/value.
                updateOps[`back${runnerIndex}_price`] = backs[0].rt;
                updateOps[`back${runnerIndex}_size`] = backs[0].bv;
              }
              if (lays.length > 0) {
                updateOps[`lay${runnerIndex}_price`] = lays[0].rt;
                updateOps[`lay${runnerIndex}_size`] = lays[0].bv;
              }
            }
          });

          if (Object.keys(updateOps).length > 0) {
            await this.marketOddModel.updateOne(
              { market_id: market.market_id },
              { $set: { ...updateOps, event_id: market.event_id } },
              { upsert: true },
            );
          }
        }
      } catch (e) {
        this.logger.error(
          `Error processing fancy socket message: ${e.message}`,
        );
      }
    }
  }
  // @Cron('*/5 * * * *') // Sync sidebar every 5 minutes - Handled by Rust
  public async syncSidebar() {
    if (this.isSyncing) return;
    this.logger.log('Starting Diamond Sports Sidebar sync...');
    try {
      const response = await firstValueFrom(
        this.httpService.get<DiamondSidebarResponse>(
          `${this.DIAMOND_API_URL}/sports/tree`,
          {
            headers: {
              'x-rapidapi-host': this.DIAMOND_API_HOST,
              'x-rapidapi-key': this.DIAMOND_API_KEY,
            },
          },
        ),
      );
      if (response.data && response.data.success && response.data.data) {
        await this.navigationModel.updateOne(
          { key: 'sidebar' },
          { $set: { tree: response.data.data.t1 } },
          { upsert: true },
        );
        this.logger.log('Successfully synced Sidebar navigation data.');
      }
    } catch (error) {
      this.logger.error(`Error in syncSidebar: ${error.message}`);
    }
  }

  public async getSidebar() {
    const doc = await this.navigationModel.findOne({ key: 'sidebar' }).exec();
    return doc ? doc.tree : [];
  }

  public async getMatchDetailsData(
    sportId: string,
    matchId: string,
    userId?: number,
  ) {
    let blockedTypes: string[] = [];
    if (userId) {
      try {
        const locks = await this.prisma.eventLock.findMany({
          where: { eventId: matchId, userBlocks: { has: userId } },
        });
        blockedTypes = locks.map((l) => l.betType);
      } catch (e) {
        // Ignore DB errors if table not pushed yet during dev
        this.logger.warn(`EventLock DB check failed: ${e.message}`);
      }
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<DiamondMatchDetailsResponse>(
          `${this.DIAMOND_API_URL}/sports/getDetailsData?sid=${sportId}&gmid=${matchId}`,
          {
            headers: {
              'x-rapidapi-host': this.DIAMOND_API_HOST,
              'x-rapidapi-key': this.DIAMOND_API_KEY,
            },
            timeout: 5000,
          },
        ),
      );

      const resData = response.data;
      if (
        resData &&
        resData.success &&
        resData.data &&
        resData.data.length > 0
      ) {
        let finalData = resData.data;

        // Kuber-style odds hiding for blocked users
        if (blockedTypes.includes('ALL')) {
          return [];
        }
        if (blockedTypes.includes('ODDS')) {
          finalData = finalData.filter(
            (m: any) => m.gtype !== 'match' && m.gtype !== 'MATCH',
          );
        }
        if (blockedTypes.includes('FANCY')) {
          finalData = finalData.filter(
            (m: any) =>
              m.gtype !== 'fancy' &&
              m.gtype !== 'FANCY' &&
              m.gtype !== 'session',
          );
        }
        // Globally hide any 'fancy' variant that is not exactly 'fancy' or 'fancy1'
        finalData = finalData.filter((m: any) => {
          const g = String(m?.gtype || '').toLowerCase();
          if (g.startsWith('fancy')) {
            return g === 'fancy' || g === 'fancy1';
          }
          return true;
        });

        // No mutating size here. Native UI values flow perfectly unmolested to the frontend!

        return finalData;
      }
      return [];
    } catch (error) {
      this.logger.error(
        `Error fetching match details for GMID ${matchId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Validate betslip odds are still current before placement.
   * Strategy: Redis (2s TTL by Rust) → Live Sports API → MongoDB fallback.
   * Each item: { eventId, marketId, selectionId, odds }
   */
  public async checkOdds(
    items: {
      eventId?: string;
      marketId: string;
      selectionId: string;
      odds: number;
    }[],
  ) {
    type OddsResult = {
      eventId: string;
      marketId: string;
      selectionId: string;
      requestedOdds: number;
      currentOdds: number | null;
      changed: boolean;
      suspended: boolean;
      eventStatus?: string | null;
      eventClosed?: boolean;
      reason?: string | null;
    };
    const results: OddsResult[] = [];
    const normalizeEventState = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    const isClosedEventState = (value: unknown) =>
      [
        'CLOSED',
        'COMPLETED',
        'ENDED',
        'FINISHED',
        'ABANDONED',
        'SETTLED',
      ].includes(normalizeEventState(value));

    // Group by eventId so we only fetch each event once
    const eventGroups = new Map<string, typeof items>();
    for (const item of items) {
      // eventId is the gmid from the bet's eventId field
      const eid = item.eventId || item.marketId.split('_')[0];
      if (!eventGroups.has(eid)) eventGroups.set(eid, []);
      eventGroups.get(eid)!.push({ ...item, eventId: eid });
    }

    for (const [eventId, group] of eventGroups) {
      const isSportradar = String(eventId).startsWith('sr:');
      // ── 1. Try Redis (Rust syncer stores odds:<gmid> every 2s with 3s TTL) ──
      let marketsData: any[] | null = null;
      let eventStatus: string | null = null;
      let eventClosed = false;

      // USER REQUEST: "not just redius hit hit api and grab from there"
      // User reversed request: "update from redis not from api"
      try {
        const cached = await this.getRedis().get(`odds:${eventId}`);
        if (cached) {
          marketsData = JSON.parse(cached);
          this.logger.debug(`checkOdds: Redis hit for event ${eventId}`);
        }
      } catch (redisErr) {
        this.logger.warn(
          `checkOdds: Redis miss for ${eventId}: ${redisErr.message}`,
        );
      }

      // ── 2. Fetch odds from Sportradar Redis or Turnkey API ─────────────────
      if (!marketsData) {
        try {
          if (isSportradar) {
            // ── Sportradar: read from Redis (populated every 1s by liveOddsTick) ──
            const redis = this.getRedis();
            const normalizeSportradarMarkets = (marketsBlob: any) => {
              const combinedMarkets = [
                ...(marketsBlob?.matchOdds ?? []),
                ...(marketsBlob?.premiumMarkets ?? []),
                ...(marketsBlob?.bookmakers ?? []),
                ...(marketsBlob?.fancyMarkets ?? []),
              ];

              return combinedMarkets.map((m: any) => ({
                mid: `${eventId}:${m.marketId}`,
                status:
                  m.status === 'Active' || m.marketStatus === 'OPEN' || m.marketStatus === 'Active'
                    ? 'OPEN'
                    : 'SUSPENDED',
                _srRunners: m.runners ?? [],
                _srMarketId: m.marketId,
                _srMarketName: m.marketName,
              }));
            };
            const applySportradarSnapshot = (snapshot: any) => {
              const event = snapshot?.event;
              if (!event) return false;

              eventStatus =
                String(event.eventStatus || event.status || '').trim() || null;
              eventClosed =
                isClosedEventState(event.status) ||
                isClosedEventState(event.eventStatus);

              const normalizedMarkets = normalizeSportradarMarkets(
                event.markets,
              );
              if (normalizedMarkets.length > 0) {
                marketsData = normalizedMarkets;
              }
              return true;
            };

            this.logger.debug(
              `checkOdds: fetching fresh Sportradar snapshot for ${eventId}`,
            );
            const liveData = await this.sportradarService
              .getListMarket('', eventId, { fresh: true })
              .catch(() => null);

            if (!applySportradarSnapshot(liveData)) {
              const cached = await redis
                .get(`sportradar:market:${eventId}`)
                .catch(() => null);
              if (cached) {
                applySportradarSnapshot(JSON.parse(cached));
                this.logger.debug(
                  `checkOdds: Sportradar market cache fallback hit for ${eventId}`,
                );
              }
            }

          } else {
            // ── Legacy Turnkey API (non-SR events) ───────────────────────────
            let sportId = '4'; // fallback (cricket)
            try {
              const event = (await this.eventModel
                .findOne({ event_id: eventId })
                .lean()) as any;
              if (event?.sport_id) sportId = String(event.sport_id);
            } catch (_) {
              /* ignore */
            }

            const endpoint = `/api/v1/sports/odds?gmid=${eventId}&sportsid=${sportId}`;
            const requests = this.SPORTS_FEED_URLS.map(async (baseUrl) => {
              const url = `${baseUrl}${endpoint}`;
              const resp = await import('rxjs').then((m) =>
                m.firstValueFrom(
                  this.httpService.get(url, {
                    headers: { 'x-turnkeyxgaming-key': this.SPORTS_API_KEY },
                    timeout: 3000,
                  })
                )
              );
              return resp.data;
            });
            const respData = await Promise.any(requests);

            // Shape: { data: { odds: { "<gmid>": [ ...markets ] } } }
            const oddsMap = respData?.data?.odds;
            if (oddsMap && oddsMap[eventId]) {
              marketsData = oddsMap[eventId];
              this.logger.debug(
                `checkOdds: Live Turnkey API hit for event ${eventId} (sport ${sportId})`,
              );
            }
          }
        } catch (apiErr) {
          this.logger.warn(
            `checkOdds: Odds fetch failed for ${eventId}: ${apiErr.message}`,
          );
        }
      }

      // ── Per-bet processing ───────────────────────────────────────────────
      for (const item of group) {
        if (eventClosed) {
          results.push({
            eventId,
            marketId: item.marketId,
            selectionId: item.selectionId,
            requestedOdds: item.odds,
            currentOdds: null,
            changed: true,
            suspended: true,
            eventStatus,
            eventClosed: true,
            reason: 'EVENT_CLOSED',
          });
          continue;
        }

        let currentOdds: number | null = null;
        let suspended = false;

        // ── 3a. Parse from Redis / Live API data ────────────────────────
        if (marketsData && marketsData.length > 0) {
          // Find the matching market by mid or _srMarketId
          const market = marketsData.find((m: any) => {
            const mid = String(m.mid || '');
            const srMarketId = String(m._srMarketId || '');
            const reqMarketId = String(item.marketId || '');
            
            return (
              mid === reqMarketId ||
              reqMarketId.endsWith(`_${mid}`) ||
              mid.endsWith(`:${reqMarketId}`) ||
              (srMarketId && srMarketId === reqMarketId)
            );
          });

          if (market) {
            if (market.status && market.status !== 'OPEN') suspended = true;

            // ── Sportradar runner path (_srRunners: runnerId + backPrices) ─
            if (market._srRunners && market._srRunners.length > 0) {
              const availableIds = market._srRunners.map((r: any) => String(r.runnerId || '?'));
              this.logger.debug(
                `checkOdds SR market=${item.marketId} sel=${item.selectionId} ` +
                `available_runnerIds=[${availableIds.join(',')}]`,
              );

              for (const runner of market._srRunners) {
                if (String(runner.runnerId) === String(item.selectionId)) {
                  if (runner.status && !['Active', 'ACTIVE'].includes(runner.status)) {
                    suspended = true;
                  }
                  const backPrice = runner.backPrices?.[0]?.price;
                  if (backPrice != null) {
                    currentOdds = parseFloat(String(backPrice));
                  }
                  break;
                }
              }

            } else {
              // ── Legacy Turnkey runner path (section: sid + odds array) ──
              const section: any[] = market.section || [];
              const availableSids = section.map((r: any) =>
                String(r.sid || r.selectionId || r.selection_id || '?'),
              );
              this.logger.debug(
                `checkOdds market=${item.marketId}(mid=${market.mid}) sel=${item.selectionId} ` +
                `available_sids=[${availableSids.join(',')}]`,
              );

              for (const runner of section) {
                const sid = String(
                  runner.sid || runner.selectionId || runner.selection_id || '',
                );
                if (sid === String(item.selectionId)) {
                  const oddsArr: any[] = runner.odds || [];
                  const backOdd = oddsArr.find(
                    (o: any) => o.otype === 'back' || o.ib === true,
                  );
                  if (backOdd) {
                    currentOdds = parseFloat(
                      String(backOdd.odds || backOdd.rt || backOdd.price || 0),
                    );
                  }
                  break;
                }
              }
            }
          }
        }

        // ── 3b. MongoDB fallback if API/Redis had no data ───────────────
        if (currentOdds === null && !suspended) {
          try {
            const dbMarket = (await this.marketModel
              .findOne({ market_id: item.marketId })
              .lean()) as any;
            if (dbMarket) {
              if (
                dbMarket.is_active === false ||
                dbMarket.status === 'SUSPENDED'
              )
                suspended = true;
              const section: any[] =
                dbMarket.runners_data || dbMarket.marketOdds || [];
              for (const runner of section) {
                const sid = String(
                  runner.sid || runner.selectionId || runner.selection_id || '',
                );
                if (sid === String(item.selectionId)) {
                  const oddsArr: any[] = runner.odds || [];
                  const backOdd = oddsArr.find(
                    (o: any) => o.otype === 'back' || o.ib === true,
                  );
                  if (backOdd) {
                    currentOdds = parseFloat(
                      String(backOdd.odds || backOdd.rt || backOdd.price || 0),
                    );
                  }
                  break;
                }
              }
            }
          } catch (dbErr) {
            this.logger.error(`checkOdds DB fallback error: ${dbErr.message}`);
          }
        }

        this.logger.debug(
          `checkOdds result: sel=${item.selectionId} requested=${item.odds} current=${currentOdds} suspended=${suspended}`,
        );

        // IMPORTANT: Only block if we POSITIVELY found different odds or explicit suspension.
        // If currentOdds is null (runner not matched / data unavailable), fail open — let the bet through.
        const oddsActuallyChanged =
          currentOdds !== null && Math.abs(currentOdds - item.odds) > 0.01;
        const changed = suspended || oddsActuallyChanged;
        const reason = suspended
          ? 'MARKET_SUSPENDED'
          : oddsActuallyChanged
            ? 'ODDS_CHANGED'
            : null;

        results.push({
          eventId,
          marketId: item.marketId,
          selectionId: item.selectionId,
          requestedOdds: item.odds,
          currentOdds,
          changed,
          suspended,
          eventStatus,
          eventClosed,
          reason,
        });
      }
    }

    return results;
  }

  public async getMatchWithMarketsFromDB(matchId: string) {
    try {
      const event = await this.eventModel.findOne({ event_id: matchId }).lean();
      if (!event) return null;

      const [markets, competition] = await Promise.all([
        this.marketModel.find({ event_id: matchId, is_active: true }).lean(),
        this.competitionModel
          .findOne({ competition_id: event.competition_id })
          .lean(),
      ]);

      return {
        ...event,
        sport_id: competition?.sport_id || null, // flat field for easy frontend access
        markets: markets,
      };
    } catch (error) {
      this.logger.error(`Error fetching DB match: ${error.message}`);
      return null;
    }
  }

  public async proxyStream(
    targetUrl: string,
  ): Promise<{ content: string | Buffer; contentType: string } | null> {
    this.logger.log(`[proxyStream] → ${targetUrl}`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const https = require('https');
      const agent = new https.Agent({ rejectUnauthorized: false }); // allow self-signed certs on port 9000

      const response = await firstValueFrom(
        this.httpService.get(targetUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxRedirects: 5,
          httpsAgent: agent,
        }),
      );

      this.logger.log(
        `[proxyStream] ← HTTP ${response.status} content-type=${response.headers['content-type']}`,
      );

      const contentType: string =
        (response.headers['content-type'] as string) || 'text/html';
      let content: string | Buffer;

      if (contentType.includes('text/html')) {
        let html = Buffer.from(response.data).toString('utf-8');

        // Inject <base> so relative asset URLs resolve to the upstream origin
        try {
          const parsed = new URL(targetUrl);
          const origin = `${parsed.protocol}//${parsed.host}`;
          const baseTag = `<base href="${origin}/">`;
          if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>${baseTag}`);
          } else if (html.includes('<head ')) {
            html = html.replace(/<head[^>]*>/, (m) => `${m}${baseTag}`);
          } else {
            html = baseTag + html;
          }
        } catch (_) {
          /* URL parse failed, skip base injection */
        }

        content = html;
      } else {
        content = Buffer.from(response.data);
      }

      return { content, contentType };
    } catch (error) {
      const status = error?.response?.status ?? 'NO_RESPONSE';
      const body = error?.response?.data
        ? Buffer.from(error.response.data).toString('utf-8').substring(0, 500)
        : '(no body)';
      this.logger.error(
        `[proxyStream] FAILED status=${status} url=${targetUrl}\n` +
        `  message: ${error.message}\n` +
        `  body: ${body}`,
      );
      return null;
    }
  }

  public async getTvUrl(
    sportId: string,
    matchId: string,
  ): Promise<string | null> {
    const endpoint = `/api/v1/sports/tv?gmid=${matchId}&sportsid=${sportId}`;
    this.logger.log(
      `[getTvUrl] Fetching TV URL across ${this.SPORTS_FEED_URLS.length} nodes for match ${matchId}`,
    );
    try {
      const requests = this.SPORTS_FEED_URLS.map(async (baseUrl) => {
        const url = `${baseUrl}${endpoint}`;
        const response = await import('rxjs').then((m) =>
          m.firstValueFrom(
            this.httpService.get(url, {
              headers: { 'x-turnkeyxgaming-key': this.SPORTS_API_KEY },
              timeout: 5000,
            }),
          )
        );
        return response.data;
      });
      const data = await Promise.any(requests);
      this.logger.log(
        `[getTvUrl] Response: ${JSON.stringify(data)}`,
      );
      // API response: { success: true, data: { tv_one: "..." } }
      return data?.data?.tv_one || null;
    } catch (error) {
      const status = error?.response?.status;
      const body = JSON.stringify(error?.response?.data ?? {});
      this.logger.warn(
        `[getTvUrl] FAILED (${status}) match=${matchId}: ${error.message} | body=${body}`,
      );
      return null;
    }
  }

  public async getScoreUrl(
    sportId: string,
    matchId: string,
  ): Promise<string | null> {
    const endpoint = `/api/v1/sports/score?gmid=${matchId}&sportsid=${sportId}`;
    this.logger.log(
      `[getScoreUrl] Fetching Score URL across ${this.SPORTS_FEED_URLS.length} nodes for match ${matchId}`,
    );
    try {
      const requests = this.SPORTS_FEED_URLS.map(async (baseUrl) => {
        const url = `${baseUrl}${endpoint}`;
        const response = await import('rxjs').then((m) =>
          m.firstValueFrom(
            this.httpService.get(url, {
              headers: { 'x-turnkeyxgaming-key': this.SPORTS_API_KEY },
              timeout: 5000,
            }),
          )
        );
        return response.data;
      });
      const data = await Promise.any(requests);
      this.logger.log(`[getScoreUrl] Response: ${JSON.stringify(data)}`);
      // API response: { success: true, data: { scoreurl: "..." } }
      return data?.data?.scoreurl || null;
    } catch (error) {
      const status = error?.response?.status;
      const body = JSON.stringify(error?.response?.data ?? {});
      // 404 = "Score room not found" — expected when match not live yet
      if (status === 404) {
        this.logger.log(
          `[getScoreUrl] 404 (score room not found) match=${matchId}`,
        );
      } else {
        this.logger.warn(
          `[getScoreUrl] FAILED (${status}) match=${matchId}: ${error.message} | body=${body}`,
        );
      }
      return null;
    }
  }

  public async getScorecardAndTvData(sportId: string, matchId: string) {
    try {
      // Updated to use TurnkeyXGaming API for TV & Scorecard streams as the primary source
      const response = await firstValueFrom(
        this.httpService.get<DiamondScorecardTvResponse>(
          `http://cloud.turnkeyxgaming.com:8086/sports/betfairscorecardandtv?diamondeventid=${matchId}&diamondsportsid=${sportId}`,
          {
            headers: {
              'x-turnkeyxgaming-key': '6a9d10424b039000ab1caa11',
            },
            timeout: 5000,
          },
        ),
      );

      if (response.data && response.data.status && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Error fetching TV/Scorecard data for event ${matchId}: ${error.message}`,
      );
      return null;
    }
  }

  // @Cron('*/5 * * * *') // Sync TopEvents every 5 minutes - Handled by Rust
  public async syncTopEvents() {
    if (this.isSyncing) return;
    try {
      const url = `${this.DIAMOND_API_URL}/sports/topevents`;
      const response = await firstValueFrom(
        this.httpService.get<DiamondTopEventsResponse>(url, {
          headers: {
            'x-rapidapi-host': this.DIAMOND_API_HOST,
            'x-rapidapi-key': this.DIAMOND_API_KEY,
          },
          timeout: 5000,
        }),
      );

      if (response.data && response.data.success && response.data.data) {
        const topEvents = response.data.data;

        await this.topEventModel.deleteMany({});

        const docs = topEvents.map((te) => ({
          name: te.name,
          sportId: te.sportId,
          event_id: te.id,
          lid: te.lid,
        }));

        if (docs.length > 0) {
          await this.topEventModel.insertMany(docs);
          this.logger.log(`Synced ${docs.length} Diamond Top Events.`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to sync Diamond Top Events: ${error.message}`);
    }
  }

  public async getTopEvents() {
    const cacheKey = 'sports:top-events';
    const redis = this.getRedis();
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* Redis miss */
    }

    try {
      const data = await this.topEventModel.find().lean();
      try {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', SportsService.SPORTS_CACHE_TTL_SECONDS);
      } catch (e) {
        /* non-fatal */
      }
      return data;
    } catch (error) {
      this.logger.error(`Error querying Top Events: ${error.message}`);
      return [];
    }
  }

  public async getHomeEvents() {
    const cacheKey = 'sports:home-events';
    const redis = this.getRedis();
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      /* Redis miss */
    }

    try {
      const data = await this.homeEventModel.find().lean();
      try {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', SportsService.SPORTS_CACHE_TTL_SECONDS);
      } catch (e) {
        /* non-fatal */
      }
      return data;
    } catch (error) {
      this.logger.error(`Error querying Home Events: ${error.message}`);
      return [];
    }
  }

  public async toggleEventPopular(
    eventId: string,
    isPopular: boolean,
    eventName?: string,
    sportId?: number,
  ) {
    try {
      if (isPopular) {
        // Fetch event details if name/sportId not provided
        let name = eventName;
        let sid = sportId;
        if (!name || !sid) {
          const event = await this.eventModel
            .findOne({ event_id: eventId })
            .lean();
          if (event) {
            name = name || (event as any).event_name;
            sid = sid || (event as any).sport_id;
          }
        }
        await this.topEventModel.updateOne(
          { event_id: String(eventId) },
          {
            $set: {
              event_id: String(eventId),
              name: name || 'Unknown',
              sportId: sid || 0,
              lid: '',
            },
          },
          { upsert: true },
        );
        this.logger.log(`Event ${eventId} marked as Popular.`);
      } else {
        await this.topEventModel.deleteOne({ event_id: String(eventId) });
        this.logger.log(`Event ${eventId} removed from Popular.`);
      }
      return { success: true, isPopular };
    } catch (error) {
      this.logger.error(
        `Error toggling popular for event ${eventId}: ${error.message}`,
      );
      throw error;
    }
  }

  // ─── Betfair native data methods ──────────────────────────────────────────

  /** Events listing from betfair_events collection */
  async getBetfairEvents(sportId?: string, eventId?: string) {
    try {
      const filter: any = { isVisible: true };
      if (sportId) filter.sportId = sportId;
      if (eventId) filter.eventId = eventId;
      else filter.status = 'OPEN'; // don't filter by status when fetching specific event
      const events = await this.betfairEventModel
        .find(filter)
        .sort({ inplay: -1, marketStartTime: 1 })
        .lean();
      return { success: true, data: events };
    } catch (e) {
      this.logger.error(`getBetfairEvents: ${e.message}`);
      return { success: false, data: [] };
    }
  }

  /** Single event by Betfair eventId */
  async getBetfairEventById(eventId: string) {
    try {
      const event = await this.betfairEventModel.findOne({ eventId }).lean();
      if (!event) return { success: false, data: null, message: 'Event not found' };
      return { success: true, data: event };
    } catch (e) {
      this.logger.error(`getBetfairEventById: ${e.message}`);
      return { success: false, data: null };
    }
  }

  /** Markets from betfair_markets collection for an event */
  async getBetfairMarkets(eventId: string) {
    try {
      const markets = await this.betfairMarketModel
        .find({ eventId, isVisible: true })
        .lean();
      return { success: true, data: markets };
    } catch (e) {
      this.logger.error(`getBetfairMarkets: ${e.message}`);
      return { success: false, data: [] };
    }
  }

  /** Seeded odds snapshot from Redis for page-load (avoids suspended flicker) */
  async getBetfairLiveOdds(eventId: string) {
    try {
      // Always fetch MongoDB docs for runner names (names aren't in Redis)
      const dbMarkets = await this.betfairMarketModel
        .find({ eventId, status: { $ne: 'CLOSED' } })
        .lean() as any[];

      // Try Redis cache for live odds
      const redis = this.getRedis();
      const cachedRaw = await redis.get(`betfair:odds:event:${eventId}`).catch(() => null);
      const cached: any[] | null = cachedRaw ? JSON.parse(cachedRaw) : null;

      // Build runnerName lookup: marketId → selectionId → name
      const nameIndex = new Map<string, Map<string, string>>();
      for (const m of dbMarkets) {
        const rmap = new Map<string, string>();
        for (const r of (m.runners ?? [])) {
          if (r.runnerName) rmap.set(String(r.selectionId), r.runnerName);
        }
        nameIndex.set(String(m.marketId), rmap);
      }

      // Merge names into Redis snapshot (if available), otherwise use DB data
      if (cached && cached.length > 0) {
        const enriched = cached.map((m: any) => {
          const rmap = nameIndex.get(String(m.marketId));
          if (!rmap?.size) return m;
          return {
            ...m,
            runners: (m.runners ?? []).map((r: any) => ({
              ...r,
              runnerName: rmap.get(String(r.selectionId)) || r.runnerName || '',
            })),
          };
        });
        return { success: true, data: enriched };
      }

      return { success: true, data: dbMarkets };
    } catch (e) {
      this.logger.error(`getBetfairLiveOdds: ${e.message}`);
      return { success: false, data: [] };
    }
  }

  /** Fancy + bookmaker data from Redis */
  async getBetfairFancyData(eventId: string) {
    try {
      const redis = this.getRedis();
      const [fancyRaw, bookmakerRaw] = await Promise.all([
        redis.get(`betfair:fancy:${eventId}`).catch(() => null),
        redis.get(`betfair:bookmaker:${eventId}`).catch(() => null),
      ]);
      const fancy    = fancyRaw    ? JSON.parse(fancyRaw)    : [];
      const bookmaker = bookmakerRaw ? JSON.parse(bookmakerRaw) : [];
      return {
        success: true,
        data: { fancy: fancy ?? [], bookmaker: bookmaker ?? [] },
      };
    } catch (e) {
      this.logger.error(`getBetfairFancyData: ${e.message}`);
      return { success: false, data: { fancy: [], bookmaker: [] } };
    }
  }

  /**
   * GET /sports/betfair/line-markets/:eventId
   * Returns all market IDs incl. line markets discovered via linemarket endpoint.
   * Source: Redis cache (betfair:linemarket:{eventId}), falls back to MongoDB.
   */
  async getBetfairLineMarkets(eventId: string) {
    try {
      const redis = this.getRedis();
      const cachedRaw = await redis.get(`betfair:linemarket:${eventId}`).catch(() => null);
      const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
      if (cached) {
        return { success: true, source: 'cache', data: cached };
      }

      // Fallback: read from MongoDB
      const markets = await this.betfairMarketModel
        .find({ eventId, isVisible: true })
        .select('marketId marketName marketType inplay status')
        .lean();

      const data = markets.map((m: any) => ({
        marketId: String(m.marketId),
        marketName: String(m.marketName ?? ''),
        inPlay: !!m.inplay,
        isMarket: true,
        marketType: m.marketType,
      }));

      return { success: true, source: 'db', data };
    } catch (e) {
      this.logger.error(`getBetfairLineMarkets: ${e.message}`);
      return { success: false, data: [] };
    }
  }

  /**
   * GET /sports/betfair/market-details/:marketId
   * Full metadata + runners for a single market.
   * Source: Redis cache (betfair:marketdetails:{marketId}), falls back to MongoDB.
   */
  async getBetfairMarketDetails(marketId: string) {
    try {
      const redis = this.getRedis();
      const cachedRaw = await redis.get(`betfair:marketdetails:${marketId}`).catch(() => null);
      const cached = cachedRaw ? JSON.parse(cachedRaw) : null;
      if (cached) {
        return { success: true, source: 'cache', data: cached };
      }

      // Fallback: MongoDB
      const market = await this.betfairMarketModel
        .findOne({ marketId })
        .lean();

      if (!market) return { success: false, data: null, message: 'Market not found' };
      return { success: true, source: 'db', data: market };
    } catch (e) {
      this.logger.error(`getBetfairMarketDetails: ${e.message}`);
      return { success: false, data: null };
    }
  }

  // ─── Betfair Sports admin/sidebar methods ──────────────────────────────────

  /** GET /sports/list — Betfair sports for sidebar + admin */
  async getBetfairSportsList() {
    try {
      const sports = await this.betfairSportModel
        .find({})
        .sort({ sortOrder: 1, name: 1 })
        .lean();

      // Map to the shape the sidebar AdminSport interface expects
      const mapped = sports.map((s: any) => ({
        sport_id: s.sportId,
        sport_name: s.name,
        isVisible: s.isActive !== false,
        tab: s.isTab !== false,
        isdefault: !!s.isDefault,
        sortOrder: s.sortOrder ?? 0,
      }));

      return mapped;
    } catch (e) {
      this.logger.error(`getBetfairSportsList: ${e.message}`);
      return [];
    }
  }

  /** PATCH /sports/betfair/sport/:sportId/toggle */
  async toggleBetfairSportVisibility(sportId: string, isVisible: boolean) {
    try {
      await this.betfairSportModel.updateOne(
        { sportId },
        { $set: { isActive: isVisible, isTab: isVisible } },
      );
      return { success: true, message: `Sport ${sportId} visibility set to ${isVisible}` };
    } catch (e) {
      this.logger.error(`toggleBetfairSportVisibility: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  /** POST /sports/betfair/seed-sports — upsert all TRACKED_SPORTS into DB */
  async seedBetfairSportsFromFeed() {
    try {
      const TRACKED = [
        { sportId: '4', name: 'Cricket', sortOrder: 1, isDefault: true },
        { sportId: '1', name: 'Football', sortOrder: 2, isDefault: false },
        { sportId: '2', name: 'Tennis', sortOrder: 3, isDefault: false },
        { sportId: '7', name: 'Horse Racing', sortOrder: 4, isDefault: false },
        { sportId: '6', name: 'Boxing', sortOrder: 5, isDefault: false },
        { sportId: '7522', name: 'Basketball', sortOrder: 6, isDefault: false },
        { sportId: '6423', name: 'American Football', sortOrder: 7, isDefault: false },
        { sportId: '7511', name: 'Baseball', sortOrder: 8, isDefault: false },
      ];

      const ops = TRACKED.map(s => ({
        updateOne: {
          filter: { sportId: s.sportId },
          update: { $set: { name: s.name, sortOrder: s.sortOrder, isDefault: s.isDefault, isActive: true, isTab: true } },
          upsert: true,
        },
      }));

      await this.betfairSportModel.bulkWrite(ops, { ordered: false });
      return { success: true, message: `${TRACKED.length} sports seeded` };
    } catch (e) {
      this.logger.error(`seedBetfairSportsFromFeed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }
  // ─── Sport Leagues (image management) ────────────────────────────────────────

  /** Return all visible sport leagues (with imageUrl). Used by frontend slider. */
  async getSportLeagues(): Promise<{ success: boolean; data: any[] }> {
    try {
      const leagues = await this.sportLeagueModel
        .find({ isVisible: true })
        .sort({ order: 1, eventCount: -1 })
        .lean();
      return { success: true, data: leagues };
    } catch (e) {
      this.logger.error(`getSportLeagues: ${e.message}`);
      return { success: false, data: [] };
    }
  }

  /** Update image URL for a league. Upserts the doc if not yet seeded. */
  async updateLeagueImage(
    competitionId: string,
    imageUrl: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.sportLeagueModel.updateOne(
        { competitionId },
        { $set: { imageUrl } },
        { upsert: false },
      );
      return { success: true, message: 'Image updated' };
    } catch (e) {
      this.logger.error(`updateLeagueImage: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  /**
   * Seed sport_leagues collection from the Sportradar Redis event cache.
   * Reads all cached events, groups by competitionId, upserts records.
   * Safe to call idempotently — only sets fields that are not yet set.
   */
  async seedSportLeagues(): Promise<{ success: boolean; seeded: number; message: string }> {
    try {
      const redis = this.getRedis();
      // Pull grouped events from Sportradar cache
      const keys = await redis.keys('sr:upcoming:*').catch(() => [] as string[]);
      const inplayKeys = await redis.keys('sr:inplay:*').catch(() => [] as string[]);
      const allKeys = [...new Set([...keys, ...inplayKeys])];

      // Aggregate by competitionId
      const compMap = new Map<string, {
        competitionId: string;
        competitionName: string;
        sportId: string;
        sportName: string;
        eventCount: number;
        liveCount: number;
      }>();

      for (const key of allKeys) {
        try {
          const raw = await redis.get(key).catch(() => null);
          if (!raw) continue;
          const events: any[] = JSON.parse(raw);
          const isLive = key.startsWith('sr:inplay:');
          for (const ev of events) {
            const cid = ev.competitionId ?? ev.competition_id;
            const cname = ev.competitionName ?? ev.competition_name ?? 'Unknown';
            const sid = ev.sportId ?? ev.sport_id ?? '';
            const sname = ev.sportName ?? ev.sport_name ?? '';
            if (!cid) continue;
            if (compMap.has(cid)) {
              const entry = compMap.get(cid)!;
              entry.eventCount++;
              if (isLive) entry.liveCount++;
            } else {
              compMap.set(cid, {
                competitionId: cid,
                competitionName: cname,
                sportId: sid,
                sportName: sname,
                eventCount: 1,
                liveCount: isLive ? 1 : 0,
              });
            }
          }
        } catch { continue; }
      }

      if (compMap.size === 0) {
        return { success: true, seeded: 0, message: 'No events in Redis cache to seed from' };
      }

      // Bulk upsert — preserve imageUrl and isVisible if already set
      const ops = [...compMap.values()].map((c, i) => ({
        updateOne: {
          filter: { competitionId: c.competitionId },
          update: {
            $set: {
              competitionName: c.competitionName,
              sportId: c.sportId,
              sportName: c.sportName,
              eventCount: c.eventCount,
              liveCount: c.liveCount,
            },
            $setOnInsert: {
              imageUrl: '',
              isVisible: true,
              order: i,
            },
          },
          upsert: true,
        },
      }));

      await this.sportLeagueModel.bulkWrite(ops, { ordered: false });
      this.logger.log(`seedSportLeagues: seeded ${compMap.size} leagues`);
      return { success: true, seeded: compMap.size, message: `${compMap.size} leagues seeded` };
    } catch (e) {
      this.logger.error(`seedSportLeagues: ${e.message}`);
      return { success: false, seeded: 0, message: e.message };
    }
  }

}
