import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Redis } from 'ioredis';
import { Public } from '../auth/public.decorator';
import { ExternalApiTokenGuard } from '../auth/external-api-token.guard';
import {
  BetfairSport,
  BetfairSportDocument,
} from '../sports/schemas/betfair-sport.schema';
import {
  BetfairEvent,
  BetfairEventDocument,
} from '../sports/schemas/betfair-event.schema';
import {
  BetfairMarket,
  BetfairMarketDocument,
} from '../sports/schemas/betfair-market.schema';

// Mongo fallback hard limit. The primary's betfair_events collection has
// compound indexes on {sportId, inplay, isVisible} but no covering index
// for all filter combinations + marketStartTime sort, so an unlimited
// scan on large sports (soccer, basketball) returns thousands of docs and
// times out the consumer. 500 is plenty for a per-sport listing.
const LIST_FALLBACK_LIMIT = 500;

// Per-endpoint Cache-Control max-age, used in both modes so nginx /
// CDN can absorb burst traffic. Live data (inplay, event, odds) has
// 1s TTL — matches Redis TTL on the writer.
const CC_SPORTS = 'public, max-age=60';
const CC_INPLAY = 'public, max-age=1';
const CC_UPCOMING = 'public, max-age=15';
const CC_EVENTS = 'public, max-age=15';
const CC_EVENT = 'public, max-age=1';
const CC_ODDS = 'public, max-age=1';
const CC_MARKET = 'public, max-age=1';
const CC_MARKET_RESULT = 'no-store';

// Forwarder cache (in-memory, TTL'd). Bounded to keep readers cheap
// to run alongside other modules.
const FORWARDER_CACHE_MAX = 500;
const FORWARDER_CACHE_TRIM = 50;
const FORWARDER_FETCH_TIMEOUT_MS = 4000;

type CacheEntry = { expiresAt: number; status: number; body: unknown };

/**
 * Read-only proxy over the Sportradar cache.
 *
 * Two operating modes, selected by env at boot:
 *
 *  1. **Writer mode** (default — `SPORTRADAR_PROXY_UPSTREAM` unset):
 *     Reads come from local Redis first, then Mongo. This is the
 *     mode the primary VPS runs.
 *
 *  2. **Forwarder mode** (`SPORTRADAR_PROXY_UPSTREAM` set, e.g. to
 *     `https://primary.example.com/api/sportradar-proxy`):
 *     Forwards every request to the writer over HTTPS, optionally
 *     caches the response in-process for a few seconds. Reader VPSes
 *     run this mode so they don't need access to the writer's Redis
 *     or Mongo and don't double-poll the upstream Sportradar API.
 *     Auth header sent upstream is `SPORTRADAR_PROXY_UPSTREAM_TOKEN`
 *     (falls back to `EXTERNAL_API_TOKEN`).
 *
 * Local-mode responses carry `source: "redis" | "mongo"` so consumers
 * can treat Mongo-sourced data as degraded. Forwarder-mode responses
 * pass through whatever the writer returned, verbatim.
 *
 * Auth on this server: `x-api-token` (or `x-turnkeyxgaming-key`).
 */
@Public()
@UseGuards(ExternalApiTokenGuard)
@Controller('sportradar-proxy')
export class SportradarProxyController {
  private readonly logger = new Logger(SportradarProxyController.name);

  // Forwarder mode config — captured at construction so reads are cheap.
  private readonly upstream: string | null;
  private readonly upstreamToken: string | undefined;
  private readonly forwarderCache = new Map<string, CacheEntry>();

  constructor(
    // Reads come from the proxy-dedicated Redis. Sportradar sync writes are
    // mirrored here by SportradarService so this Redis serves as a clean
    // data plane that doesn't compete with the main app's Redis traffic.
    // Unused in forwarder mode.
    @Inject('PROXY_REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel(BetfairSport.name)
    private readonly sportModel: Model<BetfairSportDocument>,
    @InjectModel(BetfairEvent.name)
    private readonly eventModel: Model<BetfairEventDocument>,
    @InjectModel(BetfairMarket.name)
    private readonly marketModel: Model<BetfairMarketDocument>,
  ) {
    const raw = process.env.SPORTRADAR_PROXY_UPSTREAM?.trim();
    this.upstream = raw ? raw.replace(/\/+$/, '') : null;
    this.upstreamToken =
      process.env.SPORTRADAR_PROXY_UPSTREAM_TOKEN ||
      process.env.EXTERNAL_API_TOKEN ||
      undefined;

    if (this.upstream) {
      this.logger.log(
        `Forwarder mode: proxying to ${this.upstream} (cache ${FORWARDER_CACHE_MAX} entries, ${FORWARDER_FETCH_TIMEOUT_MS}ms timeout)`,
      );
    } else {
      this.logger.log('Writer mode: serving from local Redis → Mongo.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Sports catalogue
  // ─────────────────────────────────────────────────────────────────────────
  @Get('sports')
  @Header('Cache-Control', CC_SPORTS)
  async getSports() {
    return this.serveGet('/sports', 'sportradar:sports', 60_000, () =>
      this.sportModel
        .find({ isActive: true })
        .sort({ sortOrder: 1 })
        .lean()
        .exec(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Inplay
  // ─────────────────────────────────────────────────────────────────────────
  @Get('inplay')
  @Header('Cache-Control', CC_INPLAY)
  async getAllInplay() {
    return this.serveGet('/inplay', 'sportradar:inplay:all', 1_000, () =>
      this.eventModel
        .find({ inplay: true, isVisible: true })
        .limit(LIST_FALLBACK_LIMIT)
        .lean()
        .exec(),
    );
  }

  @Get('inplay/:sportId')
  @Header('Cache-Control', CC_INPLAY)
  async getInplayBySport(@Param('sportId') sportId: string) {
    return this.serveGet(
      `/inplay/${encodeURIComponent(sportId)}`,
      `sportradar:inplay:${sportId}`,
      1_000,
      () =>
        this.eventModel
          .find({ sportId, inplay: true, isVisible: true })
          .limit(LIST_FALLBACK_LIMIT)
          .lean()
          .exec(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Upcoming
  //
  //  Sort is intentionally dropped — the only compound index covering these
  //  filters is {sportId, inplay, isVisible}, so a sort on marketStartTime
  //  would force an in-memory sort over thousands of docs and timeout the
  //  client. Consumers can sort after fetch.
  // ─────────────────────────────────────────────────────────────────────────
  @Get('upcoming')
  @Header('Cache-Control', CC_UPCOMING)
  async getAllUpcoming() {
    return this.serveGet('/upcoming', 'sportradar:upcoming:all', 15_000, () =>
      this.eventModel
        .find({ inplay: false, status: 'OPEN', isVisible: true })
        .limit(LIST_FALLBACK_LIMIT)
        .lean()
        .exec(),
    );
  }

  @Get('upcoming/:sportId')
  @Header('Cache-Control', CC_UPCOMING)
  async getUpcomingBySport(@Param('sportId') sportId: string) {
    return this.serveGet(
      `/upcoming/${encodeURIComponent(sportId)}`,
      `sportradar:upcoming:${sportId}`,
      15_000,
      () =>
        this.eventModel
          .find({
            sportId,
            inplay: false,
            status: 'OPEN',
            isVisible: true,
          })
          .limit(LIST_FALLBACK_LIMIT)
          .lean()
          .exec(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Events (full per-sport dump)
  // ─────────────────────────────────────────────────────────────────────────
  @Get('events/:sportId')
  @Header('Cache-Control', CC_EVENTS)
  async getEventsBySport(@Param('sportId') sportId: string) {
    return this.serveGet(
      `/events/${encodeURIComponent(sportId)}`,
      `sportradar:events:${sportId}`,
      15_000,
      () =>
        this.eventModel
          .find({ sportId, isVisible: true })
          .limit(LIST_FALLBACK_LIMIT)
          .lean()
          .exec(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Single event / odds / market
  // ─────────────────────────────────────────────────────────────────────────
  @Get('event/:eventId')
  @Header('Cache-Control', CC_EVENT)
  async getEvent(@Param('eventId') eventId: string) {
    return this.serveGet(
      `/event/${encodeURIComponent(eventId)}`,
      `sportradar:event:${eventId}`,
      1_000,
      async () => {
        const ev = await this.eventModel.findOne({ eventId }).lean().exec();
        if (!ev) return null;
        const markets = await this.marketModel
          .find({ eventId })
          .lean()
          .exec();
        return { ...ev, markets };
      },
    );
  }

  @Get('odds/:eventId')
  @Header('Cache-Control', CC_ODDS)
  async getOdds(@Param('eventId') eventId: string) {
    return this.serveGet(
      `/odds/${encodeURIComponent(eventId)}`,
      `sportradar:odds:${eventId}`,
      1_000,
      async () => {
        const markets = await this.marketModel
          .find({ eventId })
          .lean()
          .exec();
        return markets.length ? markets : null;
      },
    );
  }

  // The `sportradar:market:{id}` key is written by the live-odds loop only
  // when a user is actively viewing the match on the primary, so it's cold
  // for most events. Before 404'ing, try the bulk-populated
  // `sportradar:event:{id}` key and wrap it in the same envelope the
  // live-odds writer uses (`{success, event}`) so consumers see one shape.
  @Get('market/:eventId')
  @Header('Cache-Control', CC_MARKET)
  async getMarket(@Param('eventId') eventId: string) {
    if (this.upstream) {
      return this.forwardGet(`/market/${encodeURIComponent(eventId)}`, 1_000);
    }
    const primaryKey = `sportradar:market:${eventId}`;
    const raw = await this.redis.get(primaryKey).catch(() => null);
    if (raw) {
      return {
        key: primaryKey,
        source: 'redis',
        data: this.safeParse(raw),
      };
    }

    // Fallback 1: wrap the bulk-populated event cache in the market envelope.
    const eventRaw = await this.redis
      .get(`sportradar:event:${eventId}`)
      .catch(() => null);
    if (eventRaw) {
      return {
        key: primaryKey,
        source: 'redis-event-fallback',
        data: {
          success: true,
          message: 'Served from event cache (market key cold).',
          status: 'RS_OK',
          errorDescription: '',
          event: this.safeParse(eventRaw),
        },
      };
    }

    // Fallback 2: Mongo (shape-degraded — array of betfair_markets rows).
    const markets = await this.marketModel
      .find({ eventId })
      .lean()
      .exec()
      .catch(() => [] as any[]);
    if (markets.length) {
      return { key: primaryKey, source: 'mongo', data: markets };
    }

    throw new NotFoundException(`No cached data for ${primaryKey}`);
  }

  // market-result is ball-by-ball ephemeral (1s TTL in Redis) and is not
  // persisted to Mongo — intentionally no fallback in writer mode.
  @Get('market-result/:eventId')
  @Header('Cache-Control', CC_MARKET_RESULT)
  async getMarketResult(@Param('eventId') eventId: string) {
    return this.serveGet(
      `/market-result/${encodeURIComponent(eventId)}`,
      `sportradar:market-result:${eventId}`,
      0,
      async () => null,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Batch fetch — MGET multiple Redis keys in one round-trip.
  //  In forwarder mode, the request is forwarded as-is (writer does the MGET).
  //  Validation runs locally first to fail fast without a round trip.
  // ─────────────────────────────────────────────────────────────────────────
  @Post('batch')
  async batch(@Body() body: { keys?: unknown }) {
    const keys = Array.isArray(body?.keys) ? body.keys : null;
    if (!keys || keys.length === 0) {
      throw new BadRequestException('keys must be a non-empty array');
    }
    if (keys.length > 200) {
      throw new BadRequestException('max 200 keys per batch');
    }
    const stringKeys = keys.map((k) => String(k));
    for (const k of stringKeys) {
      if (!k.startsWith('sportradar:')) {
        throw new BadRequestException(`key "${k}" is not a sportradar:* key`);
      }
    }

    if (this.upstream) {
      return this.forwardPost('/batch', { keys: stringKeys });
    }

    const raws = await this.redis.mget(...stringKeys);
    const out: Record<string, unknown> = {};
    stringKeys.forEach((k, i) => {
      const raw = raws[i];
      out[k] = raw ? this.safeParse(raw) : null;
    });
    return { data: out };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Health
  // ─────────────────────────────────────────────────────────────────────────
  @Get('health')
  @Header('Cache-Control', 'no-store')
  async health() {
    const mode: 'writer' | 'forwarder' = this.upstream ? 'forwarder' : 'writer';

    const [pong, mongoOk] = await Promise.all([
      this.redis.ping().catch(() => null),
      this.sportModel
        .estimatedDocumentCount()
        .then(() => true)
        .catch(() => false),
    ]);

    const out: Record<string, unknown> = {
      mode,
      redis: pong === 'PONG' ? 'up' : 'down',
      mongo: mongoOk ? 'up' : 'down',
    };

    if (mode === 'forwarder') {
      const upstreamOk = await this.probeUpstream();
      out.upstream = upstreamOk ? 'up' : 'down';
      out.upstreamUrl = this.upstream;
      out.cacheSize = this.forwarderCache.size;
      out.ok = upstreamOk;
    } else {
      out.ok = pong === 'PONG' && mongoOk;
    }

    return out;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Internal — local read path (writer mode)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Routes a GET to the right backend depending on mode.
   * - writer mode: Redis → Mongo fallback, 404 if both empty.
   * - forwarder mode: HTTPS to upstream with TTL cache.
   */
  private async serveGet(
    forwardPath: string,
    redisKey: string,
    forwarderTtlMs: number,
    mongoFallback: () => Promise<unknown>,
  ): Promise<unknown> {
    if (this.upstream) {
      return this.forwardGet(forwardPath, forwarderTtlMs);
    }
    return this.servedWithFallback(redisKey, mongoFallback);
  }

  /**
   * Read Redis first; on miss, call `mongoFallback()` to reconstruct from
   * the persistent store. 404 only if both come back empty.
   */
  private async servedWithFallback(
    key: string,
    mongoFallback: () => Promise<unknown>,
  ): Promise<{ key: string; source: 'redis' | 'mongo'; data: unknown }> {
    const raw = await this.redis.get(key).catch(() => null);
    if (raw) {
      return { key, source: 'redis', data: this.safeParse(raw) };
    }

    let mongoData: unknown = null;
    try {
      mongoData = await mongoFallback();
    } catch (e: any) {
      this.logger.warn(
        `[sportradar-proxy] Mongo fallback failed for ${key}: ${e?.message}`,
      );
    }

    if (this.isEmpty(mongoData)) {
      throw new NotFoundException(`No cached data for ${key}`);
    }

    return { key, source: 'mongo', data: mongoData };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Internal — forwarder mode
  // ─────────────────────────────────────────────────────────────────────────

  private async forwardGet(path: string, ttlMs: number): Promise<unknown> {
    const cacheKey = `GET ${path}`;
    if (ttlMs > 0) {
      const hit = this.forwarderCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        if (hit.status >= 400) {
          throw new HttpException(hit.body as any, hit.status);
        }
        return hit.body;
      }
    }

    const { status, body } = await this.fetchUpstream('GET', path);
    if (status >= 200 && status < 300) {
      if (ttlMs > 0) {
        this.cacheSet(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          status,
          body,
        });
      }
      return body;
    }
    // Cache 404s briefly too — prevents a missing-event hot loop from hammering
    // the writer. 5xx are not cached.
    if (status === 404 && ttlMs > 0) {
      this.cacheSet(cacheKey, {
        expiresAt: Date.now() + Math.min(ttlMs, 2_000),
        status,
        body,
      });
    }
    throw new HttpException(
      body as string | Record<string, unknown>,
      status,
    );
  }

  private async forwardPost(path: string, payload: unknown): Promise<unknown> {
    const { status, body } = await this.fetchUpstream('POST', path, payload);
    if (status >= 200 && status < 300) return body;
    throw new HttpException(
      body as string | Record<string, unknown>,
      status,
    );
  }

  private async fetchUpstream(
    method: 'GET' | 'POST',
    path: string,
    payload?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    const url = `${this.upstream}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FORWARDER_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-api-token': this.upstreamToken ?? '',
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: ctrl.signal,
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: res.status, body };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `[sportradar-proxy] upstream ${method} ${path} failed: ${msg}`,
      );
      throw new BadGatewayException(
        `Upstream sportradar-proxy unreachable: ${msg}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async probeUpstream(): Promise<boolean> {
    try {
      const { status } = await this.fetchUpstream('GET', '/health');
      return status >= 200 && status < 300;
    } catch {
      return false;
    }
  }

  private cacheSet(key: string, entry: CacheEntry): void {
    if (this.forwarderCache.size >= FORWARDER_CACHE_MAX) {
      // Drop the oldest N entries — Map preserves insertion order.
      let dropped = 0;
      for (const k of this.forwarderCache.keys()) {
        this.forwarderCache.delete(k);
        if (++dropped >= FORWARDER_CACHE_TRIM) break;
      }
    }
    this.forwarderCache.set(key, entry);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Misc helpers
  // ─────────────────────────────────────────────────────────────────────────

  private isEmpty(v: unknown): boolean {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  private safeParse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
}
