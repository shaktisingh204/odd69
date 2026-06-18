import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ExternalApiTokenGuard } from '../auth/external-api-token.guard';
import { SportsService } from '../sports/sports.service';

/**
 * ExternalSportsController
 * -------------------------
 * Exposes a read-only sports data API for external / partner websites.
 * All routes require a valid static token in the `x-api-token` header
 * (or `?api_token=` query param as fallback).
 *
 * Base path: /api/external/sports
 *
 * Authentication: Static token via ExternalApiTokenGuard
 *   Header:  x-api-token: <EXTERNAL_API_TOKEN>
 *   OR Query: ?api_token=<EXTERNAL_API_TOKEN>
 */
@Public()   // Skip global JwtAuthGuard
@UseGuards(ExternalApiTokenGuard)
@Controller('external/sports')
export class ExternalSportsController {
    constructor(private readonly sportsService: SportsService) { }

    // ------------------------------------------------------------------
    // Navigation & Discovery
    // ------------------------------------------------------------------

    /**
     * GET /api/external/sports/sidebar
     * Full sport → competition → event tree for navigation.
     */
    @Get('sidebar')
    async getSidebar() {
        try {
            const data = await this.sportsService.getSidebar();
            return {
                success: true,
                status: 200,
                data: { t1: data },
            };
        } catch (error) {
            return { success: false, status: 500, message: error.message };
        }
    }

    /**
     * GET /api/external/sports/list
     * Flat list of all sports.
     */
    @Get('list')
    async getSports() {
        return this.sportsService.getSports();
    }

    /**
     * GET /api/external/sports/competitions?sportId=4
     * All competitions, optionally filtered by sport.
     */
    @Get('competitions')
    async getCompetitions(@Query('sportId') sportId?: string) {
        return this.sportsService.getCompetitions(sportId ? Number(sportId) : undefined);
    }

    // ------------------------------------------------------------------
    // Event Listings
    // ------------------------------------------------------------------

    /**
     * GET /api/external/sports/live?sportId=4
     * All currently live events.
     */
    @Get('live')
    async getLiveEvents(@Query('sportId') sportId?: string) {
        return this.sportsService.getLiveEvents(sportId ? Number(sportId) : undefined);
    }

    /**
     * GET /api/external/sports/upcoming?sportId=4
     * All upcoming (pre-match) events.
     */
    @Get('upcoming')
    async getUpcomingEvents(@Query('sportId') sportId?: string) {
        return this.sportsService.getUpcomingEvents(sportId ? Number(sportId) : undefined);
    }

    /**
     * GET /api/external/sports/all-events?sportId=4
     * Combined live + upcoming — saves a round-trip for the partner site.
     */
    @Get('all-events')
    async getAllEvents(@Query('sportId') sportId?: string) {
        return this.sportsService.getAllEvents(sportId ? Number(sportId) : undefined);
    }

    /**
     * GET /api/external/sports/home-events
     * Featured/pinned events shown on the home page.
     */
    @Get('home-events')
    async getHomeEvents() {
        return this.sportsService.getHomeEvents();
    }

    /**
     * GET /api/external/sports/top-events
     * Top/trending events (cross-sport).
     */
    @Get('top-events')
    async getTopEvents() {
        return this.sportsService.getTopEvents();
    }

    /**
     * GET /api/external/sports/events/:sportId
     * All events for a specific sport (by numeric ID).
     */
    @Get('events/:sportId')
    async getEvents(@Param('sportId') sportId: string) {
        return this.sportsService.getEvents(Number(sportId));
    }

    /**
     * GET /api/external/sports/tournament/:id/events
     * Events belonging to a specific tournament/competition.
     */
    @Get('tournament/:id/events')
    async getTournamentEvents(@Param('id') id: string) {
        return this.sportsService.getTournamentEvents(id);
    }

    // ------------------------------------------------------------------
    // Match Detail
    // ------------------------------------------------------------------

    /**
     * GET /api/external/sports/match-details/:sportId/:matchId
     * Full match detail including markets, odds, runners.
     */
    @Get('match-details/:sportId/:matchId')
    async getMatchDetails(
        @Param('sportId') sportId: string,
        @Param('matchId') matchId: string,
    ) {
        try {
            const data = await this.sportsService.getMatchDetailsData(sportId, matchId, undefined);
            return {
                success: true,
                status: 200,
                data: Array.isArray(data) ? data : data ? [data] : [],
            };
        } catch (error) {
            return { success: false, status: 500, message: error.message };
        }
    }

    /**
     * GET /api/external/sports/db/match/:matchId
     * Match + all markets directly from DB (no external API call).
     */
    @Get('db/match/:matchId')
    async getMatchFromDB(@Param('matchId') matchId: string) {
        return this.sportsService.getMatchWithMarketsFromDB(matchId);
    }

    /**
     * GET /api/external/sports/market-status/:matchId
     * Current market status for a match (active / suspended).
     */
    @Get('market-status/:matchId')
    async getMarketStatus(@Param('matchId') matchId: string) {
        return this.sportsService.getMatchStatus(matchId);
    }

    // ------------------------------------------------------------------
    // Score & Media
    // ------------------------------------------------------------------

    /**
     * GET /api/external/sports/scorecard/:matchId
     * Live scorecard data.
     */
    @Get('scorecard/:matchId')
    async getScorecard(@Param('matchId') matchId: string) {
        return this.sportsService.getScorecard(matchId);
    }

    /**
     * GET /api/external/sports/scorecard-tv/:sportId/:matchId
     * Combined scorecard + live TV URL.
     */
    @Get('scorecard-tv/:sportId/:matchId')
    async getScorecardAndTv(
        @Param('sportId') sportId: string,
        @Param('matchId') matchId: string,
    ) {
        return this.sportsService.getScorecardAndTvData(sportId, matchId);
    }

    /**
     * GET /api/external/sports/tv-url/:sportId/:matchId
     * Live TV stream URL for a match.
     */
    @Get('tv-url/:sportId/:matchId')
    async getTvUrl(
        @Param('sportId') sportId: string,
        @Param('matchId') matchId: string,
    ) {
        const url = await this.sportsService.getTvUrl(sportId, matchId);
        return { url };
    }

    /**
     * GET /api/external/sports/score-url/:sportId/:matchId
     * Score/widget URL for embedding.
     */
    @Get('score-url/:sportId/:matchId')
    async getScoreUrl(
        @Param('sportId') sportId: string,
        @Param('matchId') matchId: string,
    ) {
        const url = await this.sportsService.getScoreUrl(sportId, matchId);
        return { url };
    }

    // ------------------------------------------------------------------
    // Misc
    // ------------------------------------------------------------------

    /**
     * GET /api/external/sports/team-icons
     * Team icon mapping.
     */
    @Get('team-icons')
    async getTeamIcons() {
        return this.sportsService.getTeamIcons();
    }

    // ------------------------------------------------------------------
    // ⚡ RAW Turnkey Gaming API Data (straight from Redis cache)
    // No transformation — exact upstream JSON from TurnkeyXGaming feeds.
    // Cache freshness: sports=24h | events=60s | odds=3s (live=800ms cycle)
    // ------------------------------------------------------------------

    /**
     * GET /api/external/sports/raw/sports
     * Raw sports list exactly as Turnkey sends it.
     * Cache: 24h TTL (refreshed every 24h)
     *
     * Response shape:
     * { source, data: [{ eid, id, ename, name, active, tab, isdefault, oid }] }
     */
    @Get('raw/sports')
    async getRawSports() {
        return this.sportsService.getRawSports();
    }

    /**
     * GET /api/external/sports/raw/events/:sportId
     * Raw events for a specific sport from Turnkey feed.
     * Cache: 1h TTL (refreshed every 60s)
     * Sport IDs: 4=Cricket, 1=Football, 2=Tennis, 10=Horse Racing, 66=Kabaddi
     *            40=Politics, 15=Basketball, 6=Boxing, 18=Volleyball, 22=Badminton
     *
     * Response shape:
     * { source, sport_id, count, data: [{ gmid, eid, ename, cid, cname, stime, iplay, ... }] }
     */
    @Get('raw/events/:sportId')
    async getRawEvents(@Param('sportId') sportId: string) {
        return this.sportsService.getRawEvents(sportId);
    }

    /**
     * GET /api/external/sports/raw/all-events
     * Raw events for ALL sports combined — one request, everything.
     * Cache: 1h TTL (refreshed every 60s per sport)
     *
     * Response shape:
     * { source, total_events, by_sport: { "4": [...], "1": [...], "2": [...], ... } }
     */
    @Get('raw/all-events')
    async getRawAllEvents() {
        return this.sportsService.getRawAllEvents();
    }

    /**
     * GET /api/external/sports/raw/odds/:gmid
     * Raw odds for a single match from Turnkey — real-time, 3s cache.
     * For live matches this is updated every 800ms on the server.
     * gmid = match ID (e.g. 31005885)
     *
     * Response shape:
     * { source, gmid, fetched_at, data: [{ mid, mname, gtype, status, section: [...runners] }] }
     *
     * Key fields inside each market:
     *   mid      → market ID
     *   mname    → market name (e.g. "Match Odds", "Bookmaker", "Over/Under 2.5")
     *   gtype    → market type code
     *   status   → "OPEN" | "SUSPENDED" | "CLOSED"
     *   section  → array of runners/selections with odds
     *   section[].nat   → runner name
     *   section[].sid   → selection ID
     *   section[].odds  → [{ otype: "back"|"lay", odds, size }]
     */
    @Get('raw/odds/:gmid')
    async getRawOdds(@Param('gmid') gmid: string) {
        return this.sportsService.getRawOdds(gmid);
    }

    /**
     * GET /api/external/sports/raw/odds-batch?gmids=31005885,31005886,31005887
     * Raw odds for multiple matches at once — efficient batch lookup.
     * Max 20 gmids per request.
     *
     * Response shape:
     * { source, fetched_at, requested, found, odds: { "31005885": [...markets], "31005886": null } }
     * null means no cached odds for that gmid (not live / not found)
     */
    @Get('raw/odds-batch')
    async getRawOddsBatch(@Query('gmids') gmidsParam: string) {
        if (!gmidsParam) throw new BadRequestException('gmids query param required (comma-separated match IDs)');
        const gmids = gmidsParam.split(',').map(g => g.trim()).filter(Boolean).slice(0, 20);
        if (gmids.length === 0) throw new BadRequestException('At least one gmid required');
        return this.sportsService.getRawOddsBatch(gmids);
    }
}
