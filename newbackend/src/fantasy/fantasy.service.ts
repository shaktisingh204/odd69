import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import axios, { AxiosInstance } from 'axios';

import { FantasyMatch, FantasyMatchDocument } from './schemas/fantasy-match.schema';
import { FantasyContest, FantasyContestDocument } from './schemas/fantasy-contest.schema';
import { FantasyTeam, FantasyTeamDocument } from './schemas/fantasy-team.schema';
import { FantasyEntry, FantasyEntryDocument } from './schemas/fantasy-entry.schema';
import { FantasyPointsSystem, FantasyPointsSystemDocument } from './schemas/fantasy-points-system.schema';
import { FantasyCompetition, FantasyCompetitionDocument } from './schemas/fantasy-competition.schema';
import { FantasyPlayerImage, FantasyPlayerImageDocument } from './schemas/fantasy-player-image.schema';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events.gateway';
import { ReferralService } from '../referral/referral.service';
import { CreateFantasyTeamDto, JoinContestDto, CreateContestDto, UpdatePointsSystemDto } from './dto/fantasy.dto';

/**
 * Team colors for gradient badges on frontend.
 */
const TEAM_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-rose-500 to-red-600',
  'from-amber-400 to-orange-500',
  'from-yellow-400 to-amber-500',
  'from-emerald-500 to-green-700',
  'from-violet-500 to-purple-700',
  'from-sky-400 to-blue-600',
  'from-fuchsia-500 to-purple-600',
  'from-teal-400 to-cyan-600',
  'from-pink-500 to-rose-600',
];

/**
 * Normalize role strings from the API (bat, wk, all, bowl)
 * to our internal canonical names.
 */
function normalizeRole(apiRole: string): string {
  const r = (apiRole || '').toLowerCase();
  if (r === 'wk' || r.includes('keeper')) return 'keeper';
  if (r === 'bat' || r.includes('bats')) return 'batsman';
  if (r === 'all' || r.includes('allrounder')) return 'allrounder';
  if (r === 'bowl' || r.includes('bowler')) return 'bowler';
  return 'batsman';
}

@Injectable()
export class FantasyService implements OnModuleInit {
  private readonly logger = new Logger(FantasyService.name);
  private apiClient: AxiosInstance;

  // EntitySport auth
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly staticToken: string | null;
  private cachedToken: string | null = null;
  private cachedTokenExpiresAt = 0; // unix seconds
  private tokenFetchPromise: Promise<string | null> | null = null;
  private readonly TOKEN_REDIS_KEY = 'fantasy:entitysport:token';

  // Redis cache TTLs
  private readonly MATCH_CACHE_TTL = 300;   // 5 minutes
  private readonly POINTS_CACHE_TTL = 60;   // 1 minute
  private readonly SQUAD_CACHE_TTL = 300;   // 5 minutes

  constructor(
    @InjectModel(FantasyMatch.name) private matchModel: Model<FantasyMatchDocument>,
    @InjectModel(FantasyContest.name) private contestModel: Model<FantasyContestDocument>,
    @InjectModel(FantasyTeam.name) private teamModel: Model<FantasyTeamDocument>,
    @InjectModel(FantasyEntry.name) private entryModel: Model<FantasyEntryDocument>,
    @InjectModel(FantasyPointsSystem.name) private pointsSystemModel: Model<FantasyPointsSystemDocument>,
    @InjectModel(FantasyCompetition.name) private competitionModel: Model<FantasyCompetitionDocument>,
    @InjectModel(FantasyPlayerImage.name) private playerImageModel: Model<FantasyPlayerImageDocument>,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly configService: ConfigService,
    private readonly referralService: ReferralService,
  ) {
    const baseURL =
      this.configService.get<string>('ENTITYSPORT_API_URL') ||
      this.configService.get<string>('FANTASY_API_URL') ||
      'https://restapi.entitysport.com';

    this.accessKey = this.configService.get<string>('ENTITYSPORT_ACCESS_KEY') || '';
    this.secretKey = this.configService.get<string>('ENTITYSPORT_SECRET_KEY') || '';
    this.staticToken =
      this.configService.get<string>('ENTITYSPORT_TOKEN') ||
      this.configService.get<string>('FANTASY_API_TOKEN') ||
      null;

    this.apiClient = axios.create({ baseURL, timeout: 15000 });
  }

  async onModuleInit() {
    await this.seedDefaultPointsSystem();
  }

  // ────────────────────────────────────────
  // EntitySport auth token management
  // https://www.doc.entitysport.com/getting-started#obtaining-token18
  // ────────────────────────────────────────

  /**
   * Return a valid access token for the EntitySport REST API.
   * Resolution order:
   *   1. In-memory cached token (still valid)
   *   2. Redis-cached token (survives restarts)
   *   3. Static ENTITYSPORT_TOKEN env (for dev / long-lived subscription tokens)
   *   4. POST /v2/auth/ with access_key + secret_key
   */
  private async getToken(forceRefresh = false): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);

    if (!forceRefresh && this.cachedToken && this.cachedTokenExpiresAt - 60 > now) {
      return this.cachedToken;
    }

    if (!forceRefresh) {
      const cached = await this.redisService.getPacket<{ token: string; expires: number }>(this.TOKEN_REDIS_KEY);
      if (cached?.token && cached.expires - 60 > now) {
        this.cachedToken = cached.token;
        this.cachedTokenExpiresAt = cached.expires;
        return cached.token;
      }
    }

    // Static token (used when access/secret keys aren't configured)
    if (!this.accessKey || !this.secretKey) {
      if (this.staticToken) {
        this.cachedToken = this.staticToken;
        this.cachedTokenExpiresAt = now + 3600;
        return this.staticToken;
      }
      this.logger.error('EntitySport auth not configured: set ENTITYSPORT_ACCESS_KEY + ENTITYSPORT_SECRET_KEY or ENTITYSPORT_TOKEN');
      return null;
    }

    // De-duplicate concurrent token fetches
    if (this.tokenFetchPromise) return this.tokenFetchPromise;

    this.tokenFetchPromise = (async () => {
      try {
        const res = await this.apiClient.post('/v2/auth/', null, {
          params: {
            access_key: this.accessKey,
            secret_key: this.secretKey,
            extend: true, // long-lived token tied to subscription end
          },
        });

        const body = res.data;
        if (body?.status !== 'ok' || !body?.response?.token) {
          this.logger.error(`EntitySport auth failed: ${JSON.stringify(body)}`);
          return null;
        }

        const token = body.response.token as string;
        const expires = Number(body.response.expires) || now + 3600;

        this.cachedToken = token;
        this.cachedTokenExpiresAt = expires;

        const ttl = Math.max(60, expires - now - 60);
        await this.redisService.setPacket(this.TOKEN_REDIS_KEY, { token, expires }, ttl);

        this.logger.log(`EntitySport token refreshed (expires ${new Date(expires * 1000).toISOString()})`);
        return token;
      } catch (err: any) {
        this.logger.error(`EntitySport auth request failed: ${err.message}`);
        return null;
      } finally {
        this.tokenFetchPromise = null;
      }
    })();

    return this.tokenFetchPromise;
  }

  // ────────────────────────────────────────
  // External API wrapper (auto-retry on 401)
  // ────────────────────────────────────────

  private async fetchApi(path: string, params: Record<string, any> = {}) {
    const doRequest = async (token: string) => {
      return this.apiClient.get(path, { params: { token, ...params } });
    };

    try {
      let token = await this.getToken();
      if (!token) return null;

      try {
        const res = await doRequest(token);
        return res.data;
      } catch (err: any) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        const isAuthError =
          status === 401 ||
          status === 403 ||
          body?.status === 'unauthorized' ||
          body?.response === 'Invalid token' ||
          body?.response === 'Token expired';

        if (isAuthError) {
          this.logger.warn(`EntitySport ${path} returned auth error — refreshing token and retrying`);
          token = await this.getToken(true);
          if (!token) return null;
          const res = await doRequest(token);
          return res.data;
        }
        throw err;
      }
    } catch (err: any) {
      this.logger.error(`Fantasy API failed: ${path} — ${err.message}`);
      return null;
    }
  }

  // ════════════════════════════════════════
  //  PUBLIC READ ENDPOINTS (served from Mongo + Redis cache)
  // ══════════════��═════════════════════════

  async getMatches(status?: number, page = 1, limit = 20, competitionId?: number, managed?: boolean) {
    const cacheKey = `fantasy:matches:${status || 'all'}:${competitionId || 'all'}:${page}:${managed ? 'managed' : 'all'}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const filter: any = { isDisabled: { $ne: true } };
    if (status) filter.status = status;
    if (competitionId) filter.competitionId = competitionId;
    if (managed) filter.isManaged = true;

    // status 2 = result/completed → sort newest first; otherwise soonest first
    const sortDir = status === 2 ? -1 : 1;

    const [matches, total] = await Promise.all([
      this.matchModel
        .find(filter)
        .sort({ startDate: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-squads -fantasyPoints -fantasyPointsBreakdown')
        .lean(),
      this.matchModel.countDocuments(filter),
    ]);

    const result = { matches, total, page, limit };
    await this.redisService.setPacket(cacheKey, result, this.MATCH_CACHE_TTL);
    return result;
  }

  async getMatchById(matchId: number) {
    const cacheKey = `fantasy:match:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const match = await this.matchModel.findOne({ externalMatchId: matchId }).lean();
    if (!match) throw new BadRequestException('Match not found');

    await this.redisService.setPacket(cacheKey, match, this.MATCH_CACHE_TTL);
    return match;
  }

  async getMatchSquads(matchId: number) {
    const cacheKey = `fantasy:squads:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const match = await this.matchModel.findOne(
      { externalMatchId: matchId },
      { squads: 1, teamA: 1, teamB: 1, playing11Announced: 1 },
    ).lean();
    if (!match) throw new BadRequestException('Match not found');

    const [enrichedSquads, enrichedTeams] = await Promise.all([
      this.enrichSquadImages(match.squads || []),
      this.enrichTeamLogos(match.teamA, match.teamB),
    ]);

    const result = {
      squads: enrichedSquads,
      teamA: enrichedTeams.teamA,
      teamB: enrichedTeams.teamB,
      playing11Announced: match.playing11Announced,
    };
    await this.redisService.setPacket(cacheKey, result, this.SQUAD_CACHE_TTL);
    return result;
  }

  /**
   * Overlay Cloudflare-hosted IPL headshots onto squad players by matching on
   * normalized display name. EntitySport returns empty `image` fields; this
   * backfills them at response time from `fantasy_player_images` (populated by
   * the admin IPL Assets scraper).
   */
  private async enrichSquadImages(squads: any[]): Promise<any[]> {
    if (!squads?.length) return squads;

    const needsImage = squads.filter(p => !p.image);
    if (!needsImage.length) return squads;

    const normalized = needsImage.map(p => this.normalizePlayerName(p.name));
    const docs = await this.playerImageModel
      .find({ $or: [{ normalizedName: { $in: normalized } }, { aliases: { $in: normalized } }] })
      .select({ normalizedName: 1, aliases: 1, cfUrl: 1 })
      .lean();

    if (!docs.length) return squads;

    // Build lookup: any alias → cfUrl
    const byKey = new Map<string, string>();
    for (const d of docs) {
      byKey.set(d.normalizedName, d.cfUrl);
      for (const a of d.aliases || []) byKey.set(a, d.cfUrl);
    }

    return squads.map(p => {
      if (p.image) return p;
      const cfUrl = byKey.get(this.normalizePlayerName(p.name));
      return cfUrl ? { ...p, image: cfUrl } : p;
    });
  }

  /**
   * Overlay Cloudflare team logos onto teamA/teamB when the EntitySport logo
   * is missing or unreliable. Uses the `team_icons` collection populated by
   * the admin scraper (same collection used by the Sports team-icons page).
   */
  private async enrichTeamLogos(teamA: any, teamB: any): Promise<{ teamA: any; teamB: any }> {
    if (!teamA && !teamB) return { teamA, teamB };

    const names = [teamA?.name, teamB?.name].filter(Boolean).map((n: string) => n.toLowerCase().trim());
    if (!names.length) return { teamA, teamB };

    const docs = await this.matchModel.db
      .collection('team_icons')
      .find({ team_name: { $in: names } }, { projection: { team_name: 1, icon_url: 1 } })
      .toArray();

    const byName = new Map(docs.map(d => [d.team_name as string, d.icon_url as string]));
    const overlay = (t: any) => {
      if (!t?.name) return t;
      const cf = byName.get(t.name.toLowerCase().trim());
      return cf ? { ...t, logo: cf, thumb: t.thumb || cf } : t;
    };
    return { teamA: overlay(teamA), teamB: overlay(teamB) };
  }

  private normalizePlayerName(raw: string): string {
    return (raw || '')
      .toLowerCase()
      .replace(/[.'`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getMatchPoints(matchId: number) {
    const cacheKey = `fantasy:points:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const match = await this.matchModel.findOne(
      { externalMatchId: matchId },
      { fantasyPoints: 1, fantasyPointsBreakdown: 1 },
    ).lean();
    if (!match) throw new BadRequestException('Match not found');

    const result = {
      fantasyPoints: match.fantasyPoints,
      breakdown: match.fantasyPointsBreakdown,
    };
    await this.redisService.setPacket(cacheKey, result, this.POINTS_CACHE_TTL);
    return result;
  }

  async getMatchLive(matchId: number) {
    const cacheKey = `fantasy:live:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/matches/${matchId}/live`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.POINTS_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getMatchScorecard(matchId: number) {
    const cacheKey = `fantasy:scorecard:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/matches/${matchId}/scorecard`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  /**
   * Match Info API — returns venue, umpires, toss, match officials and more.
   * Cached 5 min. Result is also persisted to MongoDB (umpires, matchMeta).
   */
  async getMatchInfo(matchId: number) {
    const cacheKey = `fantasy:match-info:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/matches/${matchId}/info`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      // Persist umpires + meta to Mongo in background
      setImmediate(() => this.persistMatchInfo(matchId, data.response));
      return data.response;
    }
    return null;
  }

  /**
   * Match Playing11 API — confirmed playing 11 per side.
   * Cached 5 min. Also overlays isPlaying11 on our squads and persists playing11Ids.
   */
  async getMatchPlaying11(matchId: number) {
    const cacheKey = `fantasy:playing11:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/matches/${matchId}/playing11`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.SQUAD_CACHE_TTL);
      setImmediate(() => this.persistPlaying11(matchId, data.response));
      return data.response;
    }
    return null;
  }

  /**
   * Match Innings Commentary API — ball-by-ball commentary.
   * Short cache (30s) so live commentary stays fresh.
   */
  async getMatchCommentary(matchId: number, innings?: number) {
    const cacheKey = `fantasy:commentary:${matchId}:${innings || 'all'}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const params: any = {};
    if (innings) params.innings_number = innings;
    const data = await this.fetchApi(`/v2/matches/${matchId}/innings`, params);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, 30); // 30s — live data
      return data.response;
    }
    return null;
  }

  /**
   * Match Statistics API — batting/bowling stats per player for this match.
   * Cached 5 min.
   */
  async getMatchStatistics(matchId: number) {
    const cacheKey = `fantasy:match-stats:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/matches/${matchId}/stats`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  /**
   * Match Wagon Wheel API — shot placement data per batsman.
   * Cached 5 min.
   */
  async getMatchWagonWheel(matchId: number) {
    const cacheKey = `fantasy:wagonwheel:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/matches/${matchId}/wagonwheel`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  /**
   * Competition Statistic Type API — lists available stat categories for a competition
   * (e.g. most_runs, most_wickets, highest_sr, etc.) before calling getCompetitionStats.
   * Cached 1 hour — rarely changes.
   */
  async getCompetitionStatTypes(cid: number) {
    const cacheKey = `fantasy:comp-stattypes:${cid}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/competitions/${cid}/stattypes`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, 3600);
      return data.response;
    }
    return null;
  }

  // ── Competitions / Series ────────────────

  async getCompetitions(status?: string, page = 1, limit = 20) {
    const cacheKey = `fantasy:competitions:${status || 'all'}:${page}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi('/v2/competitions', {
      status, per_page: limit, paged: page,
    });

    if (data) {
      await this.redisService.setPacket(cacheKey, data, this.MATCH_CACHE_TTL);

      // Persist competitions to MongoDB and upload logos to Cloudflare in background
      const items: any[] = data?.response?.items ?? [];
      setImmediate(() => this.persistCompetitions(items));
    }
    return data;
  }

  /** Persist competition list items to MongoDB and upload new logos to Cloudflare. */
  private async persistCompetitions(items: any[]) {
    for (const item of items) {
      const cid = item.cid;
      if (!cid) continue;

      const logoUrl: string = item.logo_url || item.thumb_url || item.image || '';
      const existing = await this.competitionModel.findOne({ cid }, { cfLogoUrl: 1, logoUrl: 1 }).lean();

      const base: any = {
        cid,
        title: item.title || '',
        abbr: item.abbr || '',
        type: item.type || '',
        category: item.category || '',
        matchFormat: item.match_format || '',
        season: item.season || '',
        status: item.status || '',
        country: item.country || '',
        logoUrl,
      };

      const needsUpload = logoUrl && (!existing?.cfLogoUrl || existing?.logoUrl !== logoUrl);
      if (needsUpload) {
        const cf = await this.uploadLogoToCloudflare(logoUrl, String(cid));
        if (cf) {
          base.cfLogoUrl = cf.cfUrl;
          base.cfImageId = cf.imageId;
          base.cfUploadedAt = new Date();
        }
      } else if (existing?.cfLogoUrl) {
        base.cfLogoUrl = existing.cfLogoUrl;
        base.cfImageId = existing.cfImageId;
      }

      await this.competitionModel.updateOne({ cid }, { $set: base }, { upsert: true });
    }
  }

  async getCompetitionById(cid: number) {
    const cacheKey = `fantasy:competition:${cid}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/competitions/${cid}/`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getCompetitionMatches(cid: number, page = 1, limit = 50) {
    const cacheKey = `fantasy:comp-matches:${cid}:${page}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/competitions/${cid}/matches/`, {
      per_page: limit, paged: page,
    });
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getCompetitionTeams(cid: number) {
    const cacheKey = `fantasy:comp-teams:${cid}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/competitions/${cid}/teams/`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getCompetitionStandings(cid: number) {
    const cacheKey = `fantasy:comp-standings:${cid}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/competitions/${cid}/standings/`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getCompetitionStats(cid: number, statType: string) {
    const cacheKey = `fantasy:comp-stats:${cid}:${statType}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/competitions/${cid}/stats/${statType}`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  // ── Seasons ──────────────────────────────

  async getSeasons() {
    const cacheKey = 'fantasy:seasons';
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi('/v2/seasons/');
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, 3600); // 1 hour
      return data.response;
    }
    return null;
  }

  async getSeasonCompetitions(year: string, page = 1, limit = 100) {
    const cacheKey = `fantasy:season-comps:${year}:${page}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/seasons/${year}/competitions`, {
      per_page: limit, paged: page,
    });
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  // ── Players ──────────────────────────────

  async searchPlayers(query?: string) {
    const cacheKey = `fantasy:players:${query || 'all'}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi('/v2/players', query ? { search: query } : {});
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getPlayerProfile(pid: number) {
    const cacheKey = `fantasy:player:${pid}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/players/${pid}`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getPlayerStats(pid: number) {
    const cacheKey = `fantasy:player-stats:${pid}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/players/${pid}/stats`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  // ── Teams ────────────────────────────────

  async getTeamInfo(teamId: number) {
    const cacheKey = `fantasy:team:${teamId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/teams/${teamId}`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getTeamMatches(teamId: number, status?: number) {
    const cacheKey = `fantasy:team-matches:${teamId}:${status || 'all'}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const params: any = {};
    if (status) params.status = status;
    const data = await this.fetchApi(`/v2/teams/${teamId}/matches`, params);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  async getTeamPlayers(teamId: number) {
    const cacheKey = `fantasy:team-players:${teamId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi(`/v2/teams/${teamId}/player`);
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, this.MATCH_CACHE_TTL);
      return data.response;
    }
    return null;
  }

  // ── ICC Rankings ─────────────────────────

  async getIccRankings() {
    const cacheKey = 'fantasy:iccranks';
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchApi('/v2/iccranks');
    if (data?.response) {
      await this.redisService.setPacket(cacheKey, data.response, 3600); // 1 hour
      return data.response;
    }
    return null;
  }

  // ════════════════════════════════════════
  //  CONTESTS (Mongo)
  // ═══════════════════════��════════════════

  async getContests(matchId: number) {
    const cacheKey = `fantasy:contests:${matchId}`;
    const cached = await this.redisService.getPacket<any>(cacheKey);
    if (cached) return cached;

    const contests = await this.contestModel.find({ matchId, isActive: true }).lean();
    await this.redisService.setPacket(cacheKey, contests, this.MATCH_CACHE_TTL);
    return contests;
  }

  async createContest(dto: CreateContestDto) {
    const match = await this.matchModel.findOne({ externalMatchId: dto.matchId }).lean();
    if (!match) throw new BadRequestException('Match not found');
    if (new Date() >= new Date(match.startDate)) throw new BadRequestException('Cannot create contest — match has already started');
    if (match.status === 2 || match.status === 3) throw new BadRequestException('Cannot create contest — match is live or completed');

    const contest = await this.contestModel.create(dto);
    await this.redisService.getClient().del(`fantasy:contests:${dto.matchId}`);
    return contest;
  }

  async autoCreateContests(matchId: number) {
    const existing = await this.contestModel.countDocuments({ matchId });
    if (existing > 0) return;

    const templates: Array<{
      title: string; type: string; entryFee: number; totalPrize: number; maxSpots: number;
      icon: string; accent: string; phase: 'full' | 'innings1' | 'innings2' | 'powerplay';
      prizeBreakdown: Array<{ rankFrom: number; rankTo: number; prize: number }>;
    }> = [
      // --- Full match contests ---
      { title: 'Mega Contest', type: 'mega', phase: 'full', entryFee: 49, totalPrize: 500000, maxSpots: 150000, icon: 'Crown', accent: 'text-brand-gold', prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: 100000 }, { rankFrom: 2, rankTo: 10, prize: 10000 }, { rankFrom: 11, rankTo: 100, prize: 1000 }, { rankFrom: 101, rankTo: 1000, prize: 100 }] },
      { title: 'Head to Head', type: 'head2head', phase: 'full', entryFee: 99, totalPrize: 180, maxSpots: 2, icon: 'Users', accent: 'text-teal-400', prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: 180 }] },
      { title: 'Winner Takes All', type: 'winner_takes_all', phase: 'full', entryFee: 100, totalPrize: 9500, maxSpots: 100, icon: 'Trophy', accent: 'text-pink-400', prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: 9500 }] },
      { title: 'Practice Contest', type: 'practice', phase: 'full', entryFee: 0, totalPrize: 0, maxSpots: 1000, icon: 'Shield', accent: 'text-success', prizeBreakdown: [] },
      // --- Phase-specific contests ---
      { title: '1st Innings Blast', type: 'winner_takes_all', phase: 'innings1', entryFee: 29, totalPrize: 2500, maxSpots: 100, icon: 'Flame', accent: 'text-orange-400', prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: 2500 }] },
      { title: '2nd Innings Chase', type: 'winner_takes_all', phase: 'innings2', entryFee: 29, totalPrize: 2500, maxSpots: 100, icon: 'Zap', accent: 'text-blue-400', prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: 2500 }] },
      { title: 'Powerplay Frenzy', type: 'winner_takes_all', phase: 'powerplay', entryFee: 19, totalPrize: 1500, maxSpots: 100, icon: 'Bolt', accent: 'text-yellow-400', prizeBreakdown: [{ rankFrom: 1, rankTo: 1, prize: 1500 }] },
    ];

    await this.contestModel.insertMany(
      templates.map((t) => ({ ...t, matchId, isAutoCreated: true })),
    );
  }

  // ════════════════════════════════════════
  //  TEAM CREATION
  // ══════════════════════���═════════════════

  async createTeam(userId: number, dto: CreateFantasyTeamDto) {
    const match = await this.matchModel.findOne({ externalMatchId: dto.matchId }).lean();
    if (!match) throw new BadRequestException('Match not found');
    // Lock team creation at start time (status may still be 1 but entries must close at kickoff)
    if (new Date() >= new Date(match.startDate)) throw new BadRequestException('Match has started — team creation is locked');
    if (match.status === 2 || match.status === 3) throw new BadRequestException(
      match.status === 3 ? 'Match is live — team creation is locked' : 'Match is completed',
    );

    if (dto.players.length !== 11) throw new BadRequestException('Team must have exactly 11 players');

    const captains = dto.players.filter((p) => p.isCaptain);
    const viceCaptains = dto.players.filter((p) => p.isViceCaptain);
    if (captains.length !== 1) throw new BadRequestException('Exactly 1 captain required');
    if (viceCaptains.length !== 1) throw new BadRequestException('Exactly 1 vice-captain required');
    if (captains[0].playerId === viceCaptains[0].playerId) throw new BadRequestException('Captain and vice-captain must be different');

    const totalCredits = dto.players.reduce((sum, p) => sum + (p.credit || 0), 0);

    const teamACount = dto.players.filter((p) => p.teamId === match.teamA?.id).length;
    const teamBCount = dto.players.filter((p) => p.teamId === match.teamB?.id).length;
    if (teamACount < 1 || teamBCount < 1) throw new BadRequestException('Must have at least 1 player from each team');

    const roles = dto.players.map((p) => normalizeRole(p.role));
    if (!roles.includes('keeper')) throw new BadRequestException('At least 1 wicket-keeper required');
    if (!roles.includes('batsman')) throw new BadRequestException('At least 1 batsman required');
    if (!roles.includes('bowler')) throw new BadRequestException('At least 1 bowler required');
    if (!roles.includes('allrounder')) throw new BadRequestException('At least 1 all-rounder required');

    const existingCount = await this.teamModel.countDocuments({ userId, matchId: dto.matchId });

    return this.teamModel.create({
      userId,
      matchId: dto.matchId,
      teamName: dto.teamName || `Team ${existingCount + 1}`,
      players: dto.players,
      captainId: captains[0].playerId,
      viceCaptainId: viceCaptains[0].playerId,
      totalCredits,
    });
  }

  async getUserTeams(userId: number, matchId: number) {
    return this.teamModel.find({ userId, matchId }).lean();
  }

  // ════════════════════════════════════════
  //  JOIN CONTEST (wallet debit)
  // ════════════════��═══════════════════════

  async joinContest(userId: number, dto: JoinContestDto) {
    const lockKey = `fantasy:join:${userId}:${dto.contestId}`;
    const locked = await this.redisService.acquireLock(lockKey, 10);
    if (!locked) throw new BadRequestException('Please wait, processing previous request');

    try {
      const contest = await this.contestModel.findById(dto.contestId);
      if (!contest) throw new BadRequestException('Contest not found');
      if (!contest.isActive) throw new BadRequestException('Contest is no longer active');
      if (contest.filledSpots >= contest.maxSpots) throw new BadRequestException('Contest is full');

      const team = await this.teamModel.findById(dto.teamId);
      if (!team || team.userId !== userId) throw new BadRequestException('Invalid team');
      if (team.matchId !== dto.matchId) throw new BadRequestException('Team is for a different match');

      const existingEntry = await this.entryModel.findOne({
        userId, contestId: dto.contestId, teamId: dto.teamId,
      });
      if (existingEntry) throw new BadRequestException('Already joined this contest with this team');

      const match = await this.matchModel.findOne({ externalMatchId: dto.matchId }).lean();
      // Block at start time regardless of API status (API sets live 30 min before start)
      if (!match || new Date() >= new Date(match.startDate) || match.status === 2 || match.status === 3) {
        throw new BadRequestException('Cannot join — match has started or is completed');
      }

      const entryFee = contest.entryFee;

      if (entryFee > 0) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new BadRequestException('User not found');

        const balance = parseFloat(user.balance.toString());
        if (balance < entryFee) {
          throw new BadRequestException(`Insufficient balance. Need ₹${entryFee}, have ₹${balance.toFixed(2)}`);
        }

        await this.prisma.user.update({
          where: { id: userId },
          data: { balance: { decrement: entryFee } },
        });

        await this.prisma.transaction.create({
          data: {
            userId,
            amount: entryFee,
            type: 'FANTASY_ENTRY',
            status: 'COMPLETED',
            paymentMethod: 'WALLET',
            remarks: `Fantasy contest entry: ${contest.title} (Match #${dto.matchId})`,
          },
        });

        const updatedUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { balance: true } });
        this.eventsGateway.emitUserWalletUpdate(userId, {
          balance: parseFloat(updatedUser.balance.toString()),
        });
      }

      const entry = await this.entryModel.create({
        userId,
        contestId: dto.contestId,
        teamId: dto.teamId,
        matchId: dto.matchId,
        entryFee,
        status: 'pending',
      });

      await this.contestModel.updateOne({ _id: dto.contestId }, { $inc: { filledSpots: 1 } });
      await this.redisService.getClient().del(`fantasy:contests:${dto.matchId}`);

      // Trigger referral BET_VOLUME award for paid entries (non-blocking)
      if (entryFee > 0) {
        this.referralService
          .checkAndAward(userId, 'BET_VOLUME', entryFee, `fantasy_entry_${entry._id}`)
          .catch((err) => this.logger.warn(`Referral check failed for fantasy entry ${entry._id}: ${err.message}`));
      }

      return entry;
    } finally {
      await this.redisService.releaseLock(lockKey);
    }
  }

  // ════════════════════════════════════════
  //  USER HISTORY & STATS
  // ════════════════════════════════════════

  async getUserHistory(userId: number, status?: string, page = 1, limit = 20) {
    const filter: any = { userId };
    if (status === 'won') filter.winnings = { $gt: 0 };
    if (status === 'lost') filter.$and = [{ status: 'settled' }, { winnings: 0 }];

    const [entries, total] = await Promise.all([
      this.entryModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.entryModel.countDocuments(filter),
    ]);

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const [match, contest] = await Promise.all([
          this.matchModel.findOne({ externalMatchId: entry.matchId }, { title: 1, teamA: 1, teamB: 1, competitionTitle: 1, startDate: 1, status: 1 }).lean(),
          this.contestModel.findById(entry.contestId, { title: 1, maxSpots: 1, filledSpots: 1 }).lean(),
        ]);
        return { ...entry, match, contest };
      }),
    );

    return { entries: enriched, total, page, limit };
  }

  async getUserStats(userId: number) {
    const [totalEntries, wonEntries, totalWinnings, totalSpent] = await Promise.all([
      this.entryModel.countDocuments({ userId }),
      this.entryModel.countDocuments({ userId, winnings: { $gt: 0 } }),
      this.entryModel.aggregate([{ $match: { userId } }, { $group: { _id: null, total: { $sum: '$winnings' } } }]),
      this.entryModel.aggregate([{ $match: { userId } }, { $group: { _id: null, total: { $sum: '$entryFee' } } }]),
    ]);

    return {
      totalMatches: totalEntries,
      won: wonEntries,
      lost: totalEntries - wonEntries,
      winRate: totalEntries > 0 ? Math.round((wonEntries / totalEntries) * 100) : 0,
      totalWinnings: totalWinnings[0]?.total || 0,
      totalSpent: totalSpent[0]?.total || 0,
    };
  }

  // ════════════════════════════════════════
  //  LEADERBOARD
  // ════════════════════════════════════════

  async getContestLeaderboard(contestId: string, page = 1, limit = 50) {
    const contest = await this.contestModel.findById(contestId, { matchId: 1 }).lean();
    if (!contest) return [];

    const match = await this.matchModel
      .findOne({ externalMatchId: contest.matchId }, { status: 1, startDate: 1 })
      .lean();
    // Rival teams become visible once the match is locked (status 2/3/4 OR kickoff passed)
    const teamsVisible =
      !!match &&
      (match.status === 2 ||
        match.status === 3 ||
        match.status === 4 ||
        new Date() >= new Date(match.startDate));

    const entries = await this.entryModel
      .find({ contestId })
      .sort({ totalPoints: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return Promise.all(
      entries.map(async (entry) => {
        const user = await this.prisma.user.findUnique({
          where: { id: entry.userId },
          select: { username: true },
        });
        const projection: Record<string, 1> = { teamName: 1, captainId: 1, viceCaptainId: 1 };
        if (teamsVisible) {
          projection.players = 1;
          projection.totalCredits = 1;
        }
        const team = await this.teamModel
          .findById(entry.teamId, projection)
          .lean();
        return {
          ...entry,
          username: user?.username,
          team,
          teamsVisible,
        };
      }),
    );
  }

  // ════════════════════════════════════════
  //  POINTS SYSTEM (admin configurable)
  // ══════════��═════════════════════════════

  async getPointsSystem(format?: string) {
    if (format) return this.pointsSystemModel.findOne({ format }).lean();
    return this.pointsSystemModel.find().lean();
  }

  async updatePointsSystem(dto: UpdatePointsSystemDto) {
    const { format, ...updates } = dto;
    return this.pointsSystemModel.findOneAndUpdate({ format }, { $set: updates }, { returnDocument: 'after', upsert: true });
  }

  private async seedDefaultPointsSystem() {
    for (const format of ['T20', 'ODI', 'Test']) {
      const exists = await this.pointsSystemModel.findOne({ format });
      if (!exists) {
        await this.pointsSystemModel.create({ format });
        this.logger.log(`Seeded default points system for ${format}`);
      }
    }
  }

  // ════════════════════════════════════════
  //  CRON JOBS — 10x reduced frequency
  //  Budget: 10 lakh/month ≈ 33k/day
  // ════════════════════════════════════════

  /**
   * Sync match statuses every 10 minutes as required by EntitySport docs.
   * Status codes: 1=Upcoming, 2=Result/Completed, 3=Live, 4=Cancelled
   * Also syncs pre_squad=true (managed) matches for the managed tab.
   * API calls: 4 status calls + 1 pre_squad call = 5 calls × 6 ticks/hour = 30 calls/hour.
   */
  @Cron('*/10 * * * *')
  async syncMatches() {
    this.logger.log('Syncing fantasy matches (all statuses + managed)…');
    try {
      // Sync all statuses: 1=upcoming, 2=result, 3=live, 4=cancelled
      for (const status of [1, 2, 3, 4]) {
        const data = await this.fetchApi('/v2/matches/', { status, per_page: 50 });
        const items = data?.response?.items;
        if (Array.isArray(items)) {
          await this.upsertMatches(items, status);
        }
      }

      // Enrich live matches with Match Info API (toss, umpires, venue metadata)
      // Runs after main sync so we have the match doc in Mongo already.
      const liveInDb = await this.matchModel.find({ status: 3 }, { externalMatchId: 1 }).lean();
      for (const m of liveInDb) {
        try {
          const infoData = await this.fetchApi(`/v2/matches/${m.externalMatchId}/info`);
          if (infoData?.response) {
            await this.persistMatchInfo(m.externalMatchId, infoData.response);
          }
        } catch (err: any) {
          this.logger.warn(`Match info sync failed for ${m.externalMatchId}: ${err.message}`);
        }
      }
      if (liveInDb.length > 0) {
        this.logger.log(`Enriched ${liveInDb.length} live matches with Match Info API`);
      }

      // Sync managed matches (pre_squad=true) — mark isManaged=true on these
      const managedData = await this.fetchApi('/v2/matches/', { status: 1, pre_squad: true, per_page: 100 });
      const managedItems: any[] = managedData?.response?.items ?? [];
      if (managedItems.length > 0) {
        const managedIds = managedItems.map((i: any) => i.match_id).filter(Boolean);
        // Mark matched IDs as managed
        await this.matchModel.updateMany(
          { externalMatchId: { $in: managedIds } },
          { $set: { isManaged: true } },
        );
        // Unmark any upcoming matches that are no longer in the managed list
        await this.matchModel.updateMany(
          { status: 1, externalMatchId: { $nin: managedIds } },
          { $set: { isManaged: false } },
        );
        this.logger.log(`Marked ${managedIds.length} matches as managed`);
      }
    } catch (err) {
      this.logger.error('Match sync failed', err.message);
    }
  }

  /**
   * Sync fantasy points every 10 min (was 1).
   * Only for matches with status=2 in our DB.
   * Uses the /point endpoint which includes full points breakdown.
   * ~1 call per live match × 6 ticks/hour = very cheap.
   */
  @Cron('*/10 * * * *')
  async syncFantasyPoints() {
    const liveMatches = await this.matchModel.find({ status: 3 }).lean();
    if (liveMatches.length === 0) return;

    this.logger.log(`Syncing points for ${liveMatches.length} live matches`);
    for (const match of liveMatches) {
      try {
        // /v2/matches/:id/point returns match info + points.teama.playing11[] + points.teamb.playing11[]
        const data = await this.fetchApi(`/v2/matches/${match.externalMatchId}/point`);
        if (!data?.response?.points) continue;

        const resp = data.response;
        const pointsMap: Record<string, number> = {};
        const breakdownMap: Record<string, Record<string, number>> = {};

        // Parse teama + teamb points
        for (const side of ['teama', 'teamb']) {
          const players = resp.points?.[side]?.playing11;
          if (!Array.isArray(players)) continue;

          for (const p of players) {
            const pid = String(p.pid);
            pointsMap[pid] = parseInt(p.point) || 0;
            breakdownMap[pid] = {
              starting11: parseInt(p.starting11) || 0,
              run: parseInt(p.run) || 0,
              four: parseInt(p.four) || 0,
              six: parseInt(p.six) || 0,
              sr: parseInt(p.sr) || 0,
              duck: parseInt(p.duck) || 0,
              wkts: parseInt(p.wkts) || 0,
              maidenover: parseInt(p.maidenover) || 0,
              er: parseInt(p.er) || 0,
              catch: parseInt(p.catch) || 0,
              runoutstumping: parseInt(p.runoutstumping) || 0,
              runoutthrower: parseInt(p.runoutthrower) || 0,
              runoutcatcher: parseInt(p.runoutcatcher) || 0,
              directrunout: parseInt(p.directrunout) || 0,
              stumping: parseInt(p.stumping) || 0,
              bonuscatch: parseInt(p.bonuscatch) || 0,
              '50runbonus': parseInt(p['50runbonus']) || 0,
              '100runbonus': parseInt(p['100runbonus']) || 0,
              '3wicketbonus': parseInt(p['3wicketbonus']) || 0,
              '5wicketbonus': parseInt(p['5wicketbonus']) || 0,
            };
          }
        }

        // Also update match status/scores from the response
        const updateData: any = {
          fantasyPoints: pointsMap,
          fantasyPointsBreakdown: breakdownMap,
          pointsLastSyncedAt: new Date(),
        };

        // Update scores if available
        if (resp.teama?.scores) {
          updateData.scoreA = {
            scores: resp.teama.scores,
            scores_full: resp.teama.scores_full,
            overs: resp.teama.overs,
          };
        }
        if (resp.teamb?.scores) {
          updateData.scoreB = {
            scores: resp.teamb.scores,
            scores_full: resp.teamb.scores_full,
            overs: resp.teamb.overs,
          };
        }
        if (resp.status) updateData.status = resp.status;
        if (resp.status_note) updateData.statusNote = resp.status_note;
        if (resp.result) updateData.result = resp.result;

        await this.matchModel.updateOne(
          { externalMatchId: match.externalMatchId },
          { $set: updateData },
        );

        // Update all pending entries with latest points
        await this.recalcEntryPoints(match.externalMatchId, pointsMap);

        // Invalidate caches
        const rc = this.redisService.getClient();
        await rc.del(`fantasy:points:${match.externalMatchId}`);
        await rc.del(`fantasy:match:${match.externalMatchId}`);
      } catch (err) {
        this.logger.error(`Points sync failed for match ${match.externalMatchId}`, err.message);
      }
    }
  }

  /**
   * Sync squads for upcoming matches every 60 min (was 10).
   * Uses competition squads endpoint for matches without squads,
   * and match-level squads for playing11.
   */
  @Cron('0 * * * *')
  async syncSquads() {
    // Matches that need squads
    const needSquads = await this.matchModel.find({
      status: { $in: [1, 3] }, // 1=upcoming, 3=live
      $or: [{ squads: { $size: 0 } }, { squads: { $exists: false } }],
    }).lean();

    for (const match of needSquads) {
      try {
        // 1) Get full player details from competition squads
        //    (has fantasy_player_rating, nationality, batting_style, bowling_style)
        const compData = await this.fetchApi(
          `/v2/competitions/${match.competitionId}/squads/${match.externalMatchId}`,
        );
        let squads = this.parseCompetitionSquads(compData?.response, match);

        // 2) Get playing11 status from match squads
        const matchData = await this.fetchApi(`/v2/matches/${match.externalMatchId}/squads`);
        const matchSquads = this.parseMatchSquads(matchData?.response, match);

        if (squads.length > 0 && matchSquads.length > 0) {
          // Merge: overlay playing11/captain from match squads onto comp squads
          const matchMap = new Map(matchSquads.map((p) => [p.playerId, p]));
          for (const player of squads) {
            const mp = matchMap.get(player.playerId);
            if (mp) {
              player.isPlaying11 = mp.isPlaying11;
              player.isCaptain = mp.isCaptain;
              player.roleStr = mp.roleStr;
            }
          }
        } else if (squads.length === 0) {
          // Fallback: use match squads only
          squads = matchSquads;
        }

        // 3) Overlay confirmed playing 11 from the dedicated Playing11 API
        //    (more reliable than the squads playing11 flag — accounts for last-minute changes)
        const p11Data = await this.fetchApi(`/v2/matches/${match.externalMatchId}/playing11`);
        const p11Ids = this.parsePlayingElevenIds(p11Data?.response);
        if (p11Ids.size > 0) {
          for (const player of squads) {
            player.isPlaying11 = p11Ids.has(player.playerId);
          }
        }

        if (squads.length > 0) {
          // Backfill teamA/teamB logos from the match squads response when
          // the existing match doc's team logos are missing.
          const teamImages = this.parseMatchTeams(matchData?.response);
          const setFields: Record<string, any> = {
            squads,
            playing11Announced: squads.some((s) => s.isPlaying11),
            playing11Ids: [...p11Ids],
            lastSyncedAt: new Date(),
          };
          if (match.teamA?.id) {
            const img = teamImages.get(match.teamA.id);
            if (img?.logo && !match.teamA.logo) setFields['teamA.logo'] = img.logo;
            if (img?.thumb && !match.teamA.thumb) setFields['teamA.thumb'] = img.thumb;
          }
          if (match.teamB?.id) {
            const img = teamImages.get(match.teamB.id);
            if (img?.logo && !match.teamB.logo) setFields['teamB.logo'] = img.logo;
            if (img?.thumb && !match.teamB.thumb) setFields['teamB.thumb'] = img.thumb;
          }

          await this.matchModel.updateOne(
            { externalMatchId: match.externalMatchId },
            { $set: setFields },
          );
          await this.redisService.getClient().del(`fantasy:squads:${match.externalMatchId}`);
          await this.redisService.getClient().del(`fantasy:playing11:${match.externalMatchId}`);
        }
      } catch (err) {
        this.logger.error(`Squad sync failed for match ${match.externalMatchId}`, err.message);
      }
    }
  }

  /**
   * Settle completed matches every 30 min (was 5).
   * No external API calls — purely internal DB.
   */
  @Cron('*/30 * * * *')
  async settleCompletedMatches() {
    // Only settle status=2 (Result/Completed). Status 3 = Live, should not be settled yet.
    const completedMatches = await this.matchModel.find({ status: 2 }).lean();

    for (const match of completedMatches) {
      const pendingEntries = await this.entryModel.countDocuments({
        matchId: match.externalMatchId,
        status: 'pending',
      });
      if (pendingEntries === 0) continue;

      // Only settle if we have points data
      if (!match.fantasyPoints || Object.keys(match.fantasyPoints).length === 0) continue;

      // Require a result string for definitive completion
      if (!match.result) continue;

      this.logger.log(`Settling match ${match.externalMatchId} (${pendingEntries} pending entries)`);
      await this.settleMatch(match.externalMatchId);
    }
  }

  // ════════════════════════════════════════
  //  SETTLEMENT
  // ═══════════════��════════════════════════

  private async settleMatch(matchId: number) {
    const match = await this.matchModel.findOne({ externalMatchId: matchId }).lean();
    if (!match || !match.fantasyPoints || Object.keys(match.fantasyPoints).length === 0) return;

    const pointsSystem = await this.pointsSystemModel.findOne({
      format: match.format || 'T20',
    }).lean();
    if (!pointsSystem) return;

    const contests = await this.contestModel.find({ matchId }).lean();

    for (const contest of contests) {
      const entries = await this.entryModel.find({ contestId: String(contest._id), status: 'pending' }).lean();
      if (entries.length === 0) continue;

      // Calculate points for each entry
      const scored = await Promise.all(
        entries.map(async (entry) => {
          const team = await this.teamModel.findById(entry.teamId).lean();
          if (!team) return { entry, totalPoints: 0 };

          let totalPoints = 0;
          const playerPoints: Record<string, number> = {};

          for (const player of team.players) {
            const pid = String(player.playerId);
            let pts = match.fantasyPoints[pid] || 0;

            // Captain 2x, vice-captain 1.5x
            if (player.playerId === team.captainId) {
              pts *= pointsSystem.captainMultiplier;
            } else if (player.playerId === team.viceCaptainId) {
              pts *= pointsSystem.viceCaptainMultiplier;
            }

            playerPoints[pid] = pts;
            totalPoints += pts;
          }

          await this.teamModel.updateOne({ _id: team._id }, { $set: { totalPoints, playerPoints } });
          return { entry, totalPoints };
        }),
      );

      scored.sort((a, b) => b.totalPoints - a.totalPoints);

      for (let i = 0; i < scored.length; i++) {
        const { entry, totalPoints } = scored[i];
        const rank = i + 1;
        let winnings = 0;

        for (const tier of contest.prizeBreakdown) {
          if (rank >= tier.rankFrom && rank <= tier.rankTo) {
            winnings = tier.prize;
            break;
          }
        }

        await this.entryModel.updateOne(
          { _id: entry._id },
          { $set: { rank, totalPoints, winnings, status: 'settled' } },
        );

        if (winnings > 0) {
          await this.prisma.user.update({
            where: { id: entry.userId },
            data: { balance: { increment: winnings } },
          });

          await this.prisma.transaction.create({
            data: {
              userId: entry.userId,
              amount: winnings,
              type: 'FANTASY_WINNING',
              status: 'COMPLETED',
              paymentMethod: 'WALLET',
              remarks: `Fantasy winning: Rank #${rank} in ${contest.title} (Match #${matchId})`,
            },
          });

          const updatedUser = await this.prisma.user.findUnique({
            where: { id: entry.userId }, select: { balance: true },
          });
          this.eventsGateway.emitUserWalletUpdate(entry.userId, {
            balance: parseFloat(updatedUser.balance.toString()),
          });

          // Trigger referral BET_VOLUME award for fantasy winnings (non-blocking)
          this.referralService
            .checkAndAward(entry.userId, 'BET_VOLUME', winnings, `fantasy_win_${String(entry._id)}`)
            .catch((err) => this.logger.warn(`Referral check failed for fantasy win ${entry._id}: ${err.message}`));
        }
      }
    }
  }

  // ════════════════════════════════════════
  //  PARSERS — map exact API response fields
  // ════════════════���═══════════════════════

  // ════════════════════════════════════════
  //  CLOUDFLARE IMAGES — competition logos
  // ════════════════════════════════════════

  /**
   * Resolve a team logo URL → Cloudflare Images URL.
   * Checks Redis first (24h TTL), uploads to CF on miss, falls back to the
   * original EntitySport CDN URL if CF upload fails or creds aren't set.
   */
  private async resolveTeamLogo(teamId: number | undefined, sourceUrl: string): Promise<string> {
    if (!sourceUrl) return '';
    if (!teamId) return sourceUrl;

    const cacheKey = `fantasy:team-logo-cf:${teamId}`;
    const cached = await this.redisService.getClient().get(cacheKey);
    if (cached) return cached;

    const cf = await this.uploadLogoToCloudflare(sourceUrl, `team-${teamId}`);
    if (cf) {
      // Cache for 24 hours — team logos almost never change
      await this.redisService.getClient().set(cacheKey, cf.cfUrl, 'EX', 86400);
      this.logger.log(`Team ${teamId} logo uploaded to CF: ${cf.cfUrl}`);
      return cf.cfUrl;
    }

    // CF not configured or upload failed — use original URL and cache it
    await this.redisService.getClient().set(cacheKey, sourceUrl, 'EX', 3600);
    return sourceUrl;
  }

  /**
   * Download an image from a remote URL and upload it to Cloudflare Images.
   * Returns { cfUrl, imageId } on success, null on failure.
   */
  private async uploadLogoToCloudflare(
    sourceUrl: string,
    imageId: string,
  ): Promise<{ cfUrl: string; imageId: string } | null> {
    const accountId = this.configService.get<string>('CF_ACCOUNT_ID');
    const token = this.configService.get<string>('CF_IMAGES_TOKEN');
    if (!accountId || !token) return null;

    try {
      // Fetch the remote image
      const imgRes = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
      if (!imgRes.ok) {
        this.logger.warn(`CF logo: failed to fetch ${sourceUrl} (${imgRes.status})`);
        return null;
      }

      const contentType = imgRes.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await imgRes.arrayBuffer());

      // Upload to Cloudflare Images via multipart
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('file', buffer, { filename: `competition-${imageId}.png`, contentType });
      form.append('id', `fantasy-competition-${imageId}`);

      const cfApiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`;
      const cfRes = await fetch(cfApiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
        body: form.getBuffer() as any,
      });

      const json = (await cfRes.json()) as any;
      if (!json.success) {
        // Image may already exist — re-fetch existing
        const errCode = json.errors?.[0]?.code;
        if (errCode === 5409) {
          // duplicate — retrieve the existing image
          const getRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/fantasy-competition-${imageId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const getJson = (await getRes.json()) as any;
          if (getJson.success) {
            const cfUrl = getJson.result.variants?.[0] ??
              `https://imagedelivery.net/${accountId}/fantasy-competition-${imageId}/public`;
            return { cfUrl, imageId: `fantasy-competition-${imageId}` };
          }
        }
        this.logger.warn(`CF logo upload failed for ${imageId}: ${JSON.stringify(json.errors)}`);
        return null;
      }

      const cfImageId: string = json.result.id;
      const cfUrl: string =
        json.result.variants?.[0] ??
        `https://imagedelivery.net/${accountId}/${cfImageId}/public`;

      return { cfUrl, imageId: cfImageId };
    } catch (err: any) {
      this.logger.warn(`CF logo upload error for ${imageId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Sync competition logos from EntitySport → Cloudflare Images → MongoDB.
   * Runs every 6 hours. Only uploads logos not yet on Cloudflare.
   */
  @Cron('0 */6 * * *')
  async syncCompetitionLogos() {
    this.logger.log('Syncing competition logos…');
    try {
      // Fetch all competitions (paginate up to 5 pages of 100)
      for (let page = 1; page <= 5; page++) {
        const data = await this.fetchApi('/v2/competitions', { per_page: 100, paged: page });
        const items: any[] = data?.response?.items ?? [];
        if (items.length === 0) break;

        for (const item of items) {
          const cid = item.cid;
          if (!cid) continue;

          const existing = await this.competitionModel.findOne({ cid }).lean();

          // Upsert basic competition data
          const logoUrl: string = item.logo_url || item.thumb_url || item.image || '';
          const base: any = {
            cid,
            title: item.title || '',
            abbr: item.abbr || '',
            type: item.type || '',
            category: item.category || '',
            matchFormat: item.match_format || '',
            season: item.season || '',
            status: item.status || '',
            country: item.country || '',
            logoUrl,
          };

          // Upload to Cloudflare only if logo changed or not yet uploaded
          const needsUpload =
            logoUrl &&
            (!existing?.cfLogoUrl || existing?.logoUrl !== logoUrl);

          if (needsUpload) {
            const cf = await this.uploadLogoToCloudflare(logoUrl, String(cid));
            if (cf) {
              base.cfLogoUrl = cf.cfUrl;
              base.cfImageId = cf.imageId;
              base.cfUploadedAt = new Date();
              this.logger.log(`Competition ${cid} logo uploaded to CF: ${cf.cfUrl}`);
            }
          } else if (existing?.cfLogoUrl) {
            base.cfLogoUrl = existing.cfLogoUrl;
            base.cfImageId = existing.cfImageId;
          }

          await this.competitionModel.updateOne({ cid }, { $set: base }, { upsert: true });
        }
      }
    } catch (err: any) {
      this.logger.error(`Competition logo sync failed: ${err.message}`);
    }
  }

  /**
   * Upsert matches from /v2/matches/?status=N response.
   *
   * Each item has: match_id, title, short_title, subtitle, format_str,
   * status, status_note, teama {team_id, name, short_name, logo_url, scores, overs},
   * teamb {…}, date_start, timestamp_start, venue {name, location, country},
   * competition {cid, title, abbr, match_format}, result, winning_team_id
   */
  private async upsertMatches(items: any[], status: number) {
    for (const item of items) {
      const mid = item.match_id;
      if (!mid) continue;

      const ta = item.teama || {};
      const tb = item.teamb || {};
      const comp = item.competition || {};
      const venue = item.venue || {};
      const toss = item.toss || {};

      // ── Competition logo — prefer CF URL stored in Mongo ──────────────────
      const storedComp = comp.cid
        ? await this.competitionModel.findOne({ cid: comp.cid }, { cfLogoUrl: 1, logoUrl: 1 }).lean()
        : null;
      const compLogoUrl: string = storedComp?.cfLogoUrl || storedComp?.logoUrl || comp.logo_url || comp.thumb_url || '';

      // ── Team logos — upload to Cloudflare on first encounter ──────────────
      const taLogoUrl: string = ta.logo_url || ta.flag_url || ta.image || ta.logo || '';
      const tbLogoUrl: string = tb.logo_url || tb.flag_url || tb.image || tb.logo || '';

      const taLogo = await this.resolveTeamLogo(ta.team_id, taLogoUrl);
      const tbLogo = await this.resolveTeamLogo(tb.team_id, tbLogoUrl);

      const data: any = {
        externalMatchId: mid,
        title: item.title || `${ta.name || 'TBA'} vs ${tb.name || 'TBA'}`,
        shortTitle: item.short_title || '',
        subtitle: item.subtitle || '',
        matchNumber: item.match_number || '',
        competitionId: comp.cid || 0,
        competitionTitle: comp.title || comp.abbr || '',
        format: item.format_str || 'T20',
        statusStr: item.status_str || '',
        teamA: {
          id: ta.team_id || 0,
          name: ta.name || 'TBA',
          short: ta.short_name || ta.short || 'TBA',
          logo: taLogo,
          thumb: taLogo,
          color: TEAM_COLORS[(ta.team_id || 0) % TEAM_COLORS.length],
        },
        teamB: {
          id: tb.team_id || 0,
          name: tb.name || 'TBA',
          short: tb.short_name || tb.short || 'TBA',
          logo: tbLogo,
          thumb: tbLogo,
          color: TEAM_COLORS[((tb.team_id || 0) + 3) % TEAM_COLORS.length],
        },
        venue: venue.name ? `${venue.name}${venue.location ? `, ${venue.location}` : ''}` : '',
        startDate: item.date_start ? new Date(item.date_start + ' UTC') : new Date(item.timestamp_start * 1000),
        status: item.status || status,
        statusNote: item.status_note || '',
        result: item.result || '',
        toss: {
          text: toss.text || '',
          winner: toss.winner || 0,
          decision: toss.decision || 0,
        },
        competition: {
          cid: comp.cid || 0,
          title: comp.title || '',
          abbr: comp.abbr || '',
          type: comp.type || '',
          category: comp.category || '',
          matchFormat: comp.match_format || '',
          season: comp.season || '',
          status: comp.status || '',
          country: comp.country || '',
          totalMatches: comp.total_matches || '',
          totalTeams: comp.total_teams || '',
          logoUrl: compLogoUrl,          // CF URL if available, otherwise original
        },
        lastSyncedAt: new Date(),
      };

      // Scores for live/completed (includes scores_full like "164/8 (20 ov)")
      if (ta.scores) {
        data.scoreA = { scores: ta.scores, scores_full: ta.scores_full, overs: ta.overs };
      }
      if (tb.scores) {
        data.scoreB = { scores: tb.scores, scores_full: tb.scores_full, overs: tb.overs };
      }

      await this.matchModel.updateOne(
        { externalMatchId: mid },
        { $set: data },
        { upsert: true },
      );

      // Auto-create contests for upcoming
      if (status === 1) {
        await this.autoCreateContests(mid);
      }
    }
  }

  /**
   * Parse competition squads from /v2/competitions/:cid/squads/:matchId.
   *
   * Response: { squad_type, squads: [{ team_id, players: [{ pid, title, playing_role, fantasy_player_rating, … }] }] }
   */
  private parseCompetitionSquads(response: any, match: any): any[] {
    if (!response?.squads) return [];
    const squads: any[] = [];

    for (const teamSquad of response.squads) {
      const teamId = teamSquad.team_id || teamSquad.team?.tid;
      const teamName = teamSquad.title || teamSquad.team?.title || '';
      const players = teamSquad.players;
      if (!Array.isArray(players)) continue;

      for (const p of players) {
        squads.push({
          playerId: p.pid,
          name: p.title || p.first_name || 'Unknown',
          shortName: p.short_name || '',
          role: normalizeRole(p.playing_role || p.role || 'bat'),
          roleStr: '',
          teamId,
          teamName,
          credit: p.fantasy_player_rating ? parseFloat(p.fantasy_player_rating) : 8.0,
          isPlaying11: false,
          isCaptain: false,
          image: p.thumb_url || p.logo_url || p.image || p.pic || p.flag_url || '',
          nationality: p.nationality || '',
          battingStyle: p.batting_style || '',
          bowlingStyle: p.bowling_style || '',
          bowlingType: p.bowling_type || '',
        });
      }
    }
    return squads;
  }

  /**
   * Parse match squads from /v2/matches/:id/squads.
   *
   * Response shape (per EntitySport Match Playing11 API):
   *   {
   *     teama:   { team_id, squads: [{ player_id, name, role, role_str, playing11, substitute, out, in }] },
   *     teamb:   { team_id, squads: [...] },
   *     teams:   [{ tid, title, thumb_url, logo_url, ... }],
   *     players: [{ pid, title, short_name, thumb_url, logo_url, fantasy_player_rating,
   *                 playing_role, batting_style, bowling_style, nationality, ... }],
   *   }
   *
   * We join squads[].player_id → players[].pid to hydrate each squad entry
   * with the richer data (image, credit, batting/bowling style, nationality).
   */
  private parseMatchSquads(response: any, match: any): any[] {
    if (!response) return [];

    // Build lookup of player metadata from the top-level `players` array.
    // This is where thumb_url / logo_url / fantasy_player_rating actually live
    // in the Match Playing11 response.
    const playerMeta = new Map<number, any>();
    for (const p of response.players || []) {
      const pid = typeof p.pid === 'number' ? p.pid : parseInt(p.pid);
      if (!isNaN(pid)) playerMeta.set(pid, p);
    }

    const squads: any[] = [];
    for (const side of ['teama', 'teamb']) {
      const sideData = response[side];
      if (!sideData?.squads) continue;

      const teamId = sideData.team_id || (side === 'teama' ? match.teamA?.id : match.teamB?.id);
      const teamName = side === 'teama' ? match.teamA?.name : match.teamB?.name;

      for (const p of sideData.squads) {
        const pid = parseInt(p.player_id) || p.pid;
        const meta = playerMeta.get(pid) || {};

        squads.push({
          playerId: pid,
          name: meta.title || p.name || 'Unknown',
          shortName: meta.short_name || '',
          role: normalizeRole(meta.playing_role || p.role || 'bat'),
          roleStr: p.role_str || '',
          teamId,
          teamName: teamName || '',
          credit: Number(meta.fantasy_player_rating) || 8.5,
          isPlaying11: p.playing11 === 'true' || p.playing11 === true,
          isCaptain: (p.role_str || '').includes('C'),
          image: meta.thumb_url || meta.logo_url || '',
          nationality: meta.nationality || '',
          battingStyle: meta.batting_style || '',
          bowlingStyle: meta.bowling_style || '',
          bowlingType: '',
        });
      }
    }
    return squads;
  }

  /**
   * Pull team logos (thumb_url / logo_url) from the `teams` array in the
   * Match Playing11 response. Returned as { teamId -> {logo, thumb} } so the
   * sync loop can backfill teamA / teamB on the match doc.
   */
  private parseMatchTeams(response: any): Map<number, { logo: string; thumb: string }> {
    const byId = new Map<number, { logo: string; thumb: string }>();
    for (const t of response?.teams || []) {
      const id = typeof t.tid === 'number' ? t.tid : parseInt(t.tid);
      if (isNaN(id)) continue;
      byId.set(id, { logo: t.logo_url || '', thumb: t.thumb_url || '' });
    }
    return byId;
  }

  /**
   * Recalculate entry points for all pending entries of a match.
   * Uses the API-provided `point` field directly (already pre-calculated).
   */
  private async recalcEntryPoints(matchId: number, pointsMap: Record<string, number>) {
    const entries = await this.entryModel.find({ matchId, status: 'pending' }).lean();
    const pointsSystem = await this.pointsSystemModel.findOne({ format: 'T20' }).lean();
    if (!pointsSystem) return;

    for (const entry of entries) {
      const team = await this.teamModel.findById(entry.teamId).lean();
      if (!team) continue;

      let totalPoints = 0;
      for (const player of team.players) {
        const pid = String(player.playerId);
        let pts = pointsMap[pid] || 0;

        if (player.playerId === team.captainId) pts *= pointsSystem.captainMultiplier;
        else if (player.playerId === team.viceCaptainId) pts *= pointsSystem.viceCaptainMultiplier;

        totalPoints += pts;
      }

      await this.entryModel.updateOne({ _id: entry._id }, { $set: { totalPoints } });
    }
  }

  // ════════════════════════════════════════
  //  PARSERS — Playing11 / Info persists
  // ════════════════════════════════════════

  /**
   * Extract player IDs from the Playing11 API response.
   * Response shape: { teama: { playing11: [{pid, name, ...}] }, teamb: { playing11: [...] } }
   */
  private parsePlayingElevenIds(response: any): Set<number> {
    const ids = new Set<number>();
    if (!response) return ids;
    for (const side of ['teama', 'teamb']) {
      const players = response[side]?.playing11;
      if (Array.isArray(players)) {
        for (const p of players) {
          const pid = parseInt(p.pid || p.player_id || p.id);
          if (pid) ids.add(pid);
        }
      }
    }
    return ids;
  }

  /**
   * Persist playing11Ids to match doc and overlay isPlaying11 on stored squads.
   */
  private async persistPlaying11(matchId: number, response: any) {
    const ids = this.parsePlayingElevenIds(response);
    if (ids.size === 0) return;

    const idArray = [...ids];
    const match = await this.matchModel.findOne({ externalMatchId: matchId }, { squads: 1 }).lean();
    if (!match) return;

    const updatedSquads = (match.squads || []).map((p: any) => ({
      ...p,
      isPlaying11: ids.has(p.playerId),
    }));

    await this.matchModel.updateOne(
      { externalMatchId: matchId },
      {
        $set: {
          playing11Ids: idArray,
          squads: updatedSquads,
          playing11Announced: idArray.length > 0,
        },
      },
    );

    await this.redisService.getClient().del(`fantasy:squads:${matchId}`);
    await this.redisService.getClient().del(`fantasy:match:${matchId}`);
    this.logger.log(`Playing11 persisted for match ${matchId} — ${idArray.length} players confirmed`);
  }

  /**
   * Persist umpires and match meta from Match Info API response to MongoDB.
   */
  private async persistMatchInfo(matchId: number, response: any) {
    if (!response) return;

    const umpires: Array<{ name: string; role: string }> = [];
    const umpireFields = [
      ['first_umpire', 'first_umpire'],
      ['second_umpire', 'second_umpire'],
      ['third_umpire', 'third_umpire'],
      ['referee', 'referee'],
    ];
    for (const [key, role] of umpireFields) {
      const u = response[key];
      if (u?.name) umpires.push({ name: u.name, role });
    }
    // Also handle flat umpires array if present
    if (Array.isArray(response.umpires)) {
      for (const u of response.umpires) {
        const name = u.name || u.title;
        const role = u.role || u.umpire_type || 'umpire';
        if (name) umpires.push({ name, role });
      }
    }

    const matchMeta: Record<string, any> = {};
    if (response.venue) matchMeta.venue = response.venue;
    if (response.pitch) matchMeta.pitch = response.pitch;
    if (response.weather) matchMeta.weather = response.weather;
    if (response.toss) {
      matchMeta.toss = response.toss;
    }

    const update: any = { matchMeta };
    if (umpires.length > 0) update.umpires = umpires;
    // Update toss text if we get better data
    if (response.toss?.text) {
      update.toss = {
        text: response.toss.text,
        winner: response.toss.winner || 0,
        decision: response.toss.decision || 0,
      };
    }

    await this.matchModel.updateOne({ externalMatchId: matchId }, { $set: update });
    await this.redisService.getClient().del(`fantasy:match:${matchId}`);
  }

  // ════════════════════════════════════════
  //  MANUAL ADMIN TRIGGER
  // ════════════════════════════════════════

  async triggerSync() {
    await this.syncMatches();
    await this.syncSquads();
    await this.syncFantasyPoints();
    return { message: 'Sync triggered successfully' };
  }
}
