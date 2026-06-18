import { Controller, Get, Post, Patch, Body, Param, Query, Res, UseGuards, Request, Logger } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { SportsService } from './sports.service';
import { SportradarService } from './sportradar.service';

import { WebhookPayloadDto } from './dto/webhook.dto';
import { SecurityTokenGuard } from '../auth/security-token.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MyZoshGetTournamentsRequest, MyZoshGetMatchesRequest } from './sports.types';

@Controller('sports')
export class SportsController {
    private readonly logger = new Logger(SportsController.name);

    constructor(
        private readonly sportsService: SportsService,
        private readonly sportradarService: SportradarService,
    ) { }

    // ─── Internal / Admin ops — X-Admin-Token required ─────────────────────────

    @UseGuards(SecurityTokenGuard)
    @Get('sync-data')
    async syncData() {
        try {
            await this.sportsService.syncAll();
            return { status: 200, message: 'Sync started and completed' };
        } catch (error) {
            return {
                status: {
                    code: 500,
                    message: error.message || 'Internal Server Error'
                }
            };
        }
    }

    @UseGuards(SecurityTokenGuard)
    @Get('clear-data')
    async clearSportsData() {
        return this.sportsService.clearSportsData();
    }

    @UseGuards(SecurityTokenGuard)
    @Get('force-token-refresh')
    async forceTokenRefresh() {
        try {
            return {
                status: {
                    code: 200,
                    message: 'Token refresh disabled (provider changed)'
                },
                data: {}
            };
        } catch (error) {
            return {
                status: {
                    code: 500,
                    message: error.message || 'Internal Server Error'
                }
            };
        }
    }

    // import-all-markets removed

    @UseGuards(SecurityTokenGuard)
    @Get('import-exchange-markets')
    async importExchangeMarkets(
        @Query('match_id') match_id: string,
        @Query('access_token') access_token?: string,
        @Query('sport_id') sport_id?: string,
        @Query('tournament_id') tournament_id?: string
    ) {
        try {
            return await this.sportsService.importExchangeMarkets(access_token, sport_id || '', tournament_id || '', match_id);
        } catch (error) {
            return {
                status: { code: 500, message: error.message }
            };
        }
    }

    @UseGuards(SecurityTokenGuard)
    @Get('import-session-markets')
    async importSessionMarkets(
        @Query('match_id') match_id: string,
        @Query('access_token') access_token?: string,
        @Query('sport_id') sport_id?: string,
        @Query('tournament_id') tournament_id?: string
    ) {
        try {
            return await this.sportsService.importSessionMarkets(
                access_token,
                sport_id || '',
                tournament_id || '',
                match_id
            );
        } catch (error) {
            return {
                status: { code: 500, message: error.message }
            };
        }
    }

    // import-markets manual trigger removed

    @UseGuards(SecurityTokenGuard)
    @Get('sync-market')
    async syncMarketsEndpoint() {
        return this.sportsService.syncMarkets();
    }

    // ─── Public sports data ─────────────────────────────────────────────────────

    @Public()
    @Get('sidebar')
    async getSidebar() {
        try {
            const data = await this.sportsService.getSidebar();
            return {
                success: true,
                msg: "success",
                status: 200,
                data: {
                    t1: data
                }
            };
        } catch (error) {
            return {
                success: false,
                msg: error.message,
                status: 500
            };
        }
    }

    @Public()
    @Get('match-details/:sportId/:matchId')
    async getMatchDetails(
        @Param('sportId') sportId: string,
        @Param('matchId') matchId: string,
        @Query('userId') userId?: string
    ) {
        try {
            const data = await this.sportsService.getMatchDetailsData(sportId, matchId, userId ? Number(userId) : undefined);
            return {
                success: true,
                msg: "success",
                status: 200,
                data: Array.isArray(data) ? data : (data ? [data] : [])
            };
        } catch (error) {
            return {
                success: false,
                msg: error.message,
                status: 500
            };
        }
    }

    @Public()
    @Post('webhook/status')
    async handleMarketStatus(@Body() payload: WebhookPayloadDto) {
        return this.sportsService.handleMarketStatusUpdate(payload);
    }

    @Public()
    @Post('webhook/result')
    async handleBetResult(@Body() payload: WebhookPayloadDto) {
        return this.sportsService.handleBetResultUpdate(payload);
    }

    // ─── Admin API proxy — token secured ───────────────────────────────────────

    @UseGuards(SecurityTokenGuard)
    @Post('get_tournaments')
    async getTournaments(@Body() body: MyZoshGetTournamentsRequest) {
        try {
            return await this.sportsService.getTournamentsFromApi(body.access_token, body.sport_id, body.source_id);
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data?.status?.message || error.message;
            return {
                status: {
                    code: status,
                    message: message
                },
                data: {}
            };
        }
    }

    @UseGuards(SecurityTokenGuard)
    @Post('get_matches')
    async getMatches(@Body() body: MyZoshGetMatchesRequest) {
        try {
            return await this.sportsService.getMatchesFromApi(body.access_token, body.sport_id, body.tournament_id, body.source_id);
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data?.status?.message || error.message;
            return {
                status: {
                    code: status,
                    message: message
                },
                data: {}
            };
        }
    }

    // ─── Public sports feed ─────────────────────────────────────────────────────

    @Public()
    @Get('competitions')
    async getCompetitions(@Query('sportId') sportId?: string) {
        return this.sportsService.getCompetitions(sportId ? Number(sportId) : undefined);
    }

    @Public()
    @Get('tournament/:id/events')
    async getTournamentEvents(@Param('id') id: string) {
        return this.sportsService.getTournamentEvents(id);
    }

    /** GET /sports/list — serves betfair_sports for sidebar + admin */
    @Public()
    @Get('list')
    async getSports() {
        return this.sportsService.getBetfairSportsList();
    }

    /** PATCH /sports/betfair/sport/:sportId/toggle — admin visibility toggle */
    @Patch('betfair/sport/:sportId/toggle')
    async toggleBetfairSport(
        @Param('sportId') sportId: string,
        @Body('isVisible') isVisible: boolean,
    ) {
        return this.sportsService.toggleBetfairSportVisibility(sportId, isVisible);
    }

    /** POST /sports/betfair/seed-sports — manually trigger sports seed from feed */
    @Post('betfair/seed-sports')
    async seedBetfairSports() {
        return this.sportsService.seedBetfairSportsFromFeed();
    }

    @Public()
    @Get('live')
    async getLiveEvents(@Query('sportId') sportId?: string) {
        return this.sportsService.getLiveEvents(sportId ? Number(sportId) : undefined);
    }

    @Public()
    @Get('upcoming')
    async getUpcomingEvents(@Query('sportId') sportId?: string) {
        return this.sportsService.getUpcomingEvents(sportId ? Number(sportId) : undefined);
    }

    /** Combined live + upcoming — halves frontend round trips */
    @Public()
    @Get('all-events')
    async getAllEvents(@Query('sportId') sportId?: string) {
        return this.sportsService.getAllEvents(sportId ? Number(sportId) : undefined);
    }

    @Public()
    @Get('events/:sportId')
    async getEvents(@Param('sportId') sportId: string) {
        return this.sportsService.getEvents(Number(sportId));
    }

    @Public()
    @Get('scorecard/:matchId')
    async getScorecard(@Param('matchId') matchId: string) {
        return this.sportsService.getScorecard(matchId);
    }

    @Public()
    @Get('db/match/:matchId')
    async getMatchFromDB(@Param('matchId') matchId: string) {
        return this.sportsService.getMatchWithMarketsFromDB(matchId);
    }

    @Public()
    @Get('tv-url/:sportId/:matchId')
    async getTvUrl(@Param('sportId') sportId: string, @Param('matchId') matchId: string) {
        const url = await this.sportsService.getTvUrl(sportId, matchId);
        return { url };
    }

    // Proxies TV/score HTML — strips CSP frame-ancestors so iframes work on any domain
    @Public()
    @Get('stream-proxy')
    async streamProxy(@Query('url') targetUrl: string, @Res() res: any) {
        if (!targetUrl) return res.status(400).json({ message: 'url query param required' });

        // SECURITY: whitelist allowed domains to prevent open-redirect / SSRF
        const ALLOWED_HOSTS = [
            'primarydiamondfeeds.com',
            'turnkeyxgaming.com',
            'dpmatka.in',
            'crictv.in',
            'crfreed.com',
            '365cric.com',
            'cfreedstream.xyz',
            'cricstream.me',
            'sqr7.xyz',
        ];
        try {
            const parsed = new URL(targetUrl);
            const hostname = parsed.hostname.toLowerCase();
            const isAllowed = ALLOWED_HOSTS.some(
                (h) => hostname === h || hostname.endsWith('.' + h),
            );
            if (!isAllowed) {
                this.logger.warn(`[stream-proxy] Blocked non-whitelisted host: ${hostname}`);
                return res.status(403).json({ message: 'Host not allowed' });
            }
        } catch {
            return res.status(400).json({ message: 'Invalid URL' });
        }

        const result = await this.sportsService.proxyStream(targetUrl);
        if (!result) {
            res.set('Content-Type', 'text/html');
            return res.status(200).send('<!DOCTYPE html><html><body></body></html>');
        }

        res.set('Content-Type', result.contentType);
        res.set('Cache-Control', 'no-store');
        res.set('X-Frame-Options', 'ALLOWALL');
        return res.send(result.content);
    }

    @Public()
    @Get('score-url/:sportId/:matchId')
    async getScoreUrl(@Param('sportId') sportId: string, @Param('matchId') matchId: string) {
        const url = await this.sportsService.getScoreUrl(sportId, matchId);
        return { url };
    }

    @Public()
    @Get('scorecard-tv/:sportId/:matchId')
    async getScorecardAndTvData(@Param('sportId') sportId: string, @Param('matchId') matchId: string) {
        return this.sportsService.getScorecardAndTvData(sportId, matchId);
    }

    @Public()
    @Get('top-events')
    async getTopEvents() {
        return this.sportsService.getTopEvents();
    }

    @Public()
    @Get('home-events')
    async getHomeEvents() {
        return this.sportsService.getHomeEvents();
    }

    @Public()
    @Get('team-icons')
    async getTeamIcons() {
        return this.sportsService.getTeamIcons();
    }

    @Public()
    @Get('market-status/:matchId')
    async getMarketStatus(@Param('matchId') matchId: string) {
        return this.sportsService.getMatchStatus(matchId);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('import-market/:matchId')
    async importMarket(@Param('matchId') matchId: string) {
        return this.sportsService.ensureMarketImported(matchId);
    }

    // ─── check-odds: called by the frontend betslip (requires JWT) ─────────────

    @UseGuards(JwtAuthGuard)
    @Post('check-odds')
    async checkOdds(
        @Body()
        body: {
            bets: {
                eventId?: string;
                marketId: string;
                selectionId: string;
                odds: number;
            }[];
        }
    ) {
        try {
            const results = await this.sportsService.checkOdds(body.bets || []);
            return { success: true, results };
        } catch (error) {
            return { success: false, results: [], error: error.message };
        }
    }

    // ─── Bet placement (JWT required — userId from token, NOT request body) ─────

    @UseGuards(JwtAuthGuard)
    @Post('bet/place')
    async placeBet(
        @Request() req: any,
        @Body() body: {
            matchId: string;
            marketId: string;
            selectionId: string;
            selectionName: string;
            marketName: string;
            eventName: string;
            rate: number;
            amount: number;
            type: 'back' | 'lay';
            marketType: string;
        }
    ) {
        const userId: number = req.user.userId ?? req.user.sub;
        return this.sportsService.placeBet(
            userId,
            body.matchId,
            body.marketId,
            body.selectionId,
            body.selectionName,
            body.marketName,
            body.eventName,
            body.rate,
            body.amount,
            body.type,
            body.marketType
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('bets/:userId')
    async getUserBets(@Param('userId') userId: string) {
        return this.sportsService.getUserBets(Number(userId));
    }

    // ─── Admin Visibility Toggles (X-Admin-Token required) ─────────────────────

    @UseGuards(SecurityTokenGuard)
    @Post('toggle/sport/:id')
    async toggleSport(@Param('id') id: string, @Body() body: { isVisible: boolean }) {
        return this.sportsService.toggleSportVisibility(id, body.isVisible);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('toggle/competition/:id')
    async toggleCompetition(@Param('id') id: string, @Body() body: { isVisible: boolean }) {
        return this.sportsService.toggleCompetitionVisibility(id, body.isVisible);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('toggle/event/:id')
    async toggleEvent(@Param('id') id: string, @Body() body: { isVisible: boolean }) {
        return this.sportsService.toggleEventVisibility(id, body.isVisible);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('toggle/popular/:id')
    async togglePopularEvent(@Param('id') id: string, @Body() body: { isPopular: boolean; eventName?: string; sportId?: number }) {
        return this.sportsService.toggleEventPopular(id, body.isPopular, body.eventName, body.sportId);
    }

    @UseGuards(SecurityTokenGuard)
    @Post('limits/sport/:id')
    async updateSportLimits(@Param('id') id: string, @Body() body: { minBet: number; maxBet: number }) {
        return this.sportsService.updateSportLimits(id, body.minBet, body.maxBet);
    }

    // ─── Betfair native endpoints ──────────────────────────────────────────────────

    /** GET /sports/betfair/events?sportId=4&eventId=35436411 — events from betfair_events */
    @Public()
    @Get('betfair/events')
    async getBetfairEvents(
        @Query('sportId') sportId?: string,
        @Query('eventId') eventId?: string,
    ) {
        return this.sportsService.getBetfairEvents(sportId, eventId);
    }

    /** GET /sports/betfair/event/:eventId  — single event by Betfair eventId */
    @Public()
    @Get('betfair/event/:eventId')
    async getBetfairEvent(@Param('eventId') eventId: string) {
        return this.sportsService.getBetfairEventById(eventId);
    }

    /** GET /sports/betfair/markets/:eventId  — markets from betfair_markets collection */
    @Public()
    @Get('betfair/markets/:eventId')
    async getBetfairMarkets(@Param('eventId') eventId: string) {
        return this.sportsService.getBetfairMarkets(eventId);
    }

    /** GET /sports/betfair/live-odds/:eventId  — latest odds from Redis (page-load seed) */
    @Public()
    @Get('betfair/live-odds/:eventId')
    async getBetfairLiveOdds(@Param('eventId') eventId: string) {
        return this.sportsService.getBetfairLiveOdds(eventId);
    }

    /** GET /sports/betfair/fancy/:eventId  — latest fancy+bookmaker from Redis */
    @Public()
    @Get('betfair/fancy/:eventId')
    async getBetfairFancy(@Param('eventId') eventId: string) {
        return this.sportsService.getBetfairFancyData(eventId);
    }

    /** GET /sports/betfair/line-markets/:eventId  — all market IDs inc. line markets */
    @Public()
    @Get('betfair/line-markets/:eventId')
    async getBetfairLineMarkets(@Param('eventId') eventId: string) {
        return this.sportsService.getBetfairLineMarkets(eventId);
    }

    /** GET /sports/betfair/market-details/:marketId  — full metadata + runners for one market */
    @Public()
    @Get('betfair/market-details/:marketId')
    async getBetfairMarketDetails(@Param('marketId') marketId: string) {
        return this.sportsService.getBetfairMarketDetails(marketId);
    }

    // ─── Sportradar endpoints ─────────────────────────────────────────────────────

    /**
     * GET /sports/sportradar/sports
     * Cached sports list (Redis → MongoDB fallback).
     * Shape: { sport_id, sport_name, isVisible, tab, isdefault, sortOrder }[]
     */
    @Public()
    @Get('sportradar/sports')
    async getSportsradarSports() {
        return this.sportradarService.getSportsFromCache();
    }

    /**
     * GET /sports/sportradar/events?sportId=sr%3Asport%3A1
     * Cached events for a sport (Redis 3min TTL → MongoDB fallback).
     */
    @Public()
    @Get('sportradar/events')
    async getSportsradarEvents(@Query('sportId') sportId: string) {
        if (!sportId) return { success: false, data: [], message: 'sportId required' };
        const data = await this.sportradarService.getEventsBySport(sportId);
        return { success: true, count: data.length, data };
    }

    /**
     * GET /sports/sportradar/events/all
     * All sports events grouped by sportId — for homepage / lobby.
     * Returns: { "sr:sport:1": [...], "sr:sport:21": [...], ... }
     */
    @Public()
    @Get('sportradar/events/all')
    async getSportsradarAllEvents() {
        const data = await this.sportradarService.getAllEventsGrouped();
        return { success: true, data };
    }

    /**
     * GET /sports/sportradar/event?eventId=sr%3Amatch%3A123
     * Full raw Sportradar event from Redis — every key, every market, every runner.
     * Used by match-detail page. Returns null if not cached.
     * NOTE: Query param (not path param) to avoid NestJS colon-routing conflict with sr:match IDs.
     */
    @Public()
    @Get('sportradar/event')
    async getSportsradarEvent(@Query('eventId') eventId: string) {
        if (!eventId) {
            return { success: false, data: null, message: 'eventId is required' };
        }
        console.log(`[/sports/sportradar/event] eventId=${eventId} — resolving`);
        const data = await this.sportradarService.getEventById(eventId);
        if (!data) {
            console.warn(`[/sports/sportradar/event] eventId=${eventId} — not found in any tier`);
            return { success: false, data: null, message: 'Event not found in cache' };
        }
        return { success: true, data };
    }

    /**
     * GET /sports/sportradar/odds?eventId=sr%3Amatch%3A123
     * Full markets blob for an event from Redis.
     * Keys: matchOdds, bookmakers, fancyMarkets, premiumMarkets, premiumTopic, premiumBaseUrl, etc.
     * NOTE: Query param to avoid colon-routing conflict.
     */
    @Public()
    @Get('sportradar/odds')
    async getSportsradarOdds(@Query('eventId') eventId: string) {
        if (!eventId) return { success: false, data: null, message: 'eventId is required' };
        const data = await this.sportradarService.getOddsByEventId(eventId);
        if (!data) return { success: false, data: null, message: 'Odds not found in cache' };
        return { success: true, data };
    }

    /**
     * GET /sports/sportradar/events-count
     * Returns event counts per sport (upcoming + inplay) from Redis in O(sports) time.
     * Response: { sports: [{ sportId, sportName, upcoming, inplay, total }], totalEvents, totalLive }
     * Sports with 0 events are omitted.
     */
    @Public()
    @Get('sportradar/events-count')
    async getSportsradarEventsCount() {
        return this.sportradarService.getEventsCount();
    }

    /**
     * GET /sports/sportradar/inplay
     * All in-play events across ALL sports (flat array, Redis 30s TTL).
     * Includes real homeScore/awayScore and status: IN_PLAY.
     * Used by "Top Live" rail on homepage.
     */
    @Public()
    @Get('sportradar/inplay')
    async getSportsradarAllInplay() {
        const data = await this.sportradarService.getAllInplayEvents();
        return { success: true, count: data.length, data };
    }

    /**
     * GET /sports/sportradar/inplay/:sportId
     * In-play events for a specific sport (Redis 30s TTL).
     */
    @Public()
    @Get('sportradar/inplay/:sportId')
    async getSportsradarInplayBySport(@Param('sportId') sportId: string) {
        const data = await this.sportradarService.getInplayEventsBySport(sportId);
        return { success: true, count: data.length, sportId, data };
    }

    /**
     * POST /sports/sportradar/sync-inplay
     * Manually trigger an immediate inplay sync (admin debug).
     */
    @UseGuards(SecurityTokenGuard)
    @Post('sportradar/sync-inplay')
    async syncSportsradarInplay() {
        await this.sportradarService.syncAllInplayEvents();
        const count = (await this.sportradarService.getAllInplayEvents()).length;
        return { success: true, message: `Inplay sync complete: ${count} live events` };
    }

    /**
     * GET /sports/sportradar/upcoming?sportId=sr%3Asport%3A21&pageNo=1
     * Upcoming events for a sport (or all sports if no sportId).
     * sportId uses sr:sport:X format — MUST be query param (colon in path breaks NestJS router).
     * pageNo is 1-indexed, PAGE_SIZE=100. Returns paginated slice from cached data.
     */
    @Public()
    @Get('sportradar/upcoming')
    async getSportsradarUpcoming(
        @Query('sportId') sportId?: string,
        @Query('pageNo') pageNoStr?: string,
    ) {
        const pageNo = Math.max(1, Number(pageNoStr || 1));
        const PAGE_SIZE = 100;

        let all: any[];
        if (sportId) {
            all = await this.sportradarService.getUpcomingEventsBySport(sportId);
        } else {
            all = await this.sportradarService.getAllUpcomingEvents();
        }

        const total = all.length;
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (pageNo - 1) * PAGE_SIZE;
        const data  = all.slice(start, start + PAGE_SIZE);

        return {
            success: true,
            sportId: sportId ?? 'all',
            pageNo,
            pages,
            total,
            count: data.length,
            data,
        };
    }

    /**
     * POST /sports/sportradar/sync-upcoming
     * Manually trigger an upcoming events sync for all sports (admin).
     */
    @UseGuards(SecurityTokenGuard)
    @Post('sportradar/sync-upcoming')
    async syncSportsradarUpcoming() {
        await this.sportradarService.syncAllUpcomingEvents();
        const count = (await this.sportradarService.getAllUpcomingEvents()).length;
        return { success: true, message: `Upcoming sync complete: ${count} events` };
    }

    /**
     * GET /sports/sportradar/raw-events?sportId=sr%3Asport%3A1&pageNo=1
     * Raw single page from Sportradar API — admin debug only.
     */
    @UseGuards(SecurityTokenGuard)
    @Get('sportradar/raw-events')
    async getSportsradarRawEvents(
        @Query('sportId') sportId: string,
        @Query('pageNo') pageNo?: string,
    ) {
        return this.sportradarService.getRawEventsPage(sportId, Number(pageNo || 1));
    }

    /**
     * GET /sports/sportradar/raw
     * Raw all-sports list from Sportradar API — admin debug only.
     */
    @UseGuards(SecurityTokenGuard)
    @Get('sportradar/raw')
    async getSportsradarRaw() {
        return this.sportradarService.getRawSportsFromApi();
    }

    /**
     * POST /sports/sportradar/seed
     * Re-seeds sports from Sportradar API into betfair_sports DB.
     */
    @UseGuards(SecurityTokenGuard)
    @Post('sportradar/seed')
    async seedSportsradar() {
        return this.sportradarService.seedSportsFromApi();
    }

    /**
     * POST /sports/sportradar/sync-events
     * Triggers a full events-catalogue sync for all active sports.
     * Runs in background; returns immediately with job status.
     */
    @UseGuards(SecurityTokenGuard)
    @Post('sportradar/sync-events')
    async syncSportsradarEvents() {
        // Fire-and-forget — don't await (could take minutes for all sports)
        this.sportradarService.syncAllSportsEvents().catch(() => {});
        return { success: true, message: 'Events sync started in background for all active sports' };
    }

    /**
     * POST /sports/sportradar/sync-events/:sportId
     * Syncs events for a single sport — awaits completion.
     */
    @UseGuards(SecurityTokenGuard)
    @Post('sportradar/sync-events/:sportId')
    async syncSportsradarEventsBySport(@Param('sportId') sportId: string) {
        return this.sportradarService.syncEventsForSport(sportId);
    }

    /**
     * GET /sports/sportradar/market?sportId=sr%3Asport%3A1&eventId=sr%3Amatch%3A123
     * Full market detail for a single event.
     * Reads from Redis cache (30s TTL) or fetches from upstream on miss.
     * Response: { success, event } — odds are in event.markets.premiumMarkets[].
     */
    @Public()
    @Get('sportradar/market')
    async getSportsradarMarket(
        @Query('sportId') sportId: string,
        @Query('eventId') eventId: string,
        @Query('fresh') fresh?: string,
    ) {
        if (!eventId) {
            return { success: false, message: 'eventId is required' };
        }
        return this.sportradarService.getListMarket(sportId ?? '', eventId, {
            fresh: fresh === '1' || fresh === 'true',
        });
    }

    // ─── Sport Leagues (image management) ────────────────────────────────────────

    /**
     * GET /sports/sportradar/market-result?sportId=sr%3Asport%3A21&eventId=sr%3Amatch%3A123
     * Fetches market results including runner result field (won/lost).
     * Used by admin settlement dashboard. Secured by X-Admin-Token.
     * Response: { success, event: { eventId, eventName, markets: { matchOdds: [...] } } }
     */
    @UseGuards(SecurityTokenGuard)
    @Get('sportradar/market-result')
    async getSportsradarMarketResult(
        @Query('sportId') sportId: string,
        @Query('eventId') eventId: string,
    ) {
        if (!eventId) {
            return { success: false, message: 'eventId is required' };
        }
        return this.sportradarService.getMarketResult(sportId ?? '', eventId);
    }

    /** GET /sports/leagues — all visible sport leagues with imageUrl (public) */
    @Public()
    @Get('leagues')
    async getSportLeagues() {
        return this.sportsService.getSportLeagues();
    }

    /** PATCH /sports/leagues/:competitionId/image — update league image URL (admin) */
    @UseGuards(SecurityTokenGuard)
    @Patch('leagues/:competitionId/image')
    async updateLeagueImage(
        @Param('competitionId') competitionId: string,
        @Body('imageUrl') imageUrl: string,
    ) {
        return this.sportsService.updateLeagueImage(competitionId, imageUrl);
    }

    /** POST /sports/leagues/seed — re-seed leagues from Redis event cache (admin) */
    @UseGuards(SecurityTokenGuard)
    @Post('leagues/seed')
    async seedSportLeagues() {
        return this.sportsService.seedSportLeagues();
    }
}
