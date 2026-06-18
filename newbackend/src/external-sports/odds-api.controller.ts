// ─────────────────────────────────────────────────────────────────────────────
// OddsApiController  (legacy compatibility layer)
//
// The Odds API is NO LONGER the data source. Sportradar is now primary.
// These routes are kept alive so any old frontend bundle or external clients
// don't receive 404s. They now proxy to SportradarService.
//
//   GET /api/odds/sports             → Sportradar sports list (Redis)
//   GET /api/odds/events/:sport      → stub (no direct sportKey mapping)
//   GET /api/odds/quota              → disabled
//   GET /api/odds/force-sync         → triggers Sportradar full sync
//
// Legacy aliases:
//   GET /api/odds-sports             → same as /api/odds/sports
//   GET /api/odds-events?sport=X     → stub
// ─────────────────────────────────────────────────────────────────────────────

import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { OddsApiSyncService } from './odds-api-sync.service';
import { SportradarService } from '../sports/sportradar.service';

// ─── Primary controller: /api/odds/* ─────────────────────────────────────────

@Controller('odds')
export class OddsApiController {
  private readonly logger = new Logger(OddsApiController.name);

  constructor(
    private readonly oddsApiSync: OddsApiSyncService,
    private readonly sportradarService: SportradarService,
  ) {}

  /**
   * GET /api/odds/sports
   * Now returns Sportradar sports list (cached in Redis, falls back to MongoDB).
   */
  @Public()
  @Get('sports')
  async getSports() {
    const sports = await this.sportradarService.getSportsFromCache();
    return { source: 'sportradar', count: sports.length, data: sports };
  }

  /**
   * GET /api/odds/events/:sport
   * Accepts either a Sportradar sportId (sr:sport:1) or a legacy Odds API key.
   * Resolves to Sportradar events from Redis when given a Sportradar ID.
   */
  @Public()
  @Get('events/:sport')
  async getEvents(@Param('sport') sport: string) {
    // If it's a Sportradar ID, serve directly
    if (sport.startsWith('sr:sport:')) {
      const events = await this.sportradarService.getEventsBySport(sport);
      return { source: 'sportradar', sport_key: sport, count: events.length, data: events };
    }
    // Legacy Odds API key — return empty (Odds API no longer active)
    this.logger.warn(`[OddsApiCompat] Legacy key requested: ${sport} — returning empty (Sportradar active)`);
    return { source: 'sportradar', sport_key: sport, count: 0, data: [] };
  }

  /** GET /api/odds/quota — disabled */
  @Public()
  @Get('quota')
  async getQuota() {
    return { source: 'sportradar', message: 'Odds API quota tracking disabled. Sportradar is the active data source.' };
  }

  /**
   * GET /api/odds/force-sync
   * Triggers a full Sportradar sync (sports + all events).
   */
  @Public()
  @Get('force-sync')
  async forceSync(@Query('sport') sport?: string) {
    if (sport) {
      this.logger.log(`[OddsApiCompat] force-sync requested for: ${sport}`);
      const result = await this.sportradarService.syncEventsForSport(sport);
      return { message: `Sportradar sync complete for ${sport}`, ...result };
    }
    this.logger.log('[OddsApiCompat] Full Sportradar sync triggered via legacy route');
    this.sportradarService.syncAllSportsEvents().catch(() => {});
    return { message: 'Full Sportradar sync started in background' };
  }
}

// ─── Legacy alias: /api/odds-sports ──────────────────────────────────────────

@Controller('odds-sports')
export class OddsSportsLegacyController {
  constructor(private readonly sportradarService: SportradarService) {}

  /** GET /api/odds-sports → Sportradar sports list */
  @Public()
  @Get()
  async getSports() {
    return this.sportradarService.getSportsFromCache();
  }
}

// ─── Legacy alias: /api/odds-events ──────────────────────────────────────────

@Controller('odds-events')
export class OddsEventsLegacyController {
  constructor(private readonly sportradarService: SportradarService) {}

  /**
   * GET /api/odds-events?sport=sr:sport:1
   * Returns Sportradar events for the given sportId.
   */
  @Public()
  @Get()
  async getEvents(@Query('sport') sport = 'sr:sport:1') {
    if (sport.startsWith('sr:sport:')) {
      return this.sportradarService.getEventsBySport(sport);
    }
    return [];
  }
}
