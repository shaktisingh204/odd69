import {
  Controller, Get, Patch, Post, Delete,
  Body, Param, Query, ParseIntPipe, Req, UseGuards,
} from '@nestjs/common';
import { OriginalsAdminService } from './originals-admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TECH_MASTER, Role.SUPER_ADMIN)
@Controller('admin/originals')

export class OriginalsAdminController {
  constructor(private readonly adminService: OriginalsAdminService) {}

  // ─── Config ──────────────────────────────────────────────────────────────

  /** GET /admin/originals/config — all game configs */
  @Get('config')
  getAllConfigs() {
    return this.adminService.getAllConfigs();
  }

  /** GET /admin/originals/config/:game — config for one game */
  @Get('config/:game')
  getConfig(@Param('game') game: string) {
    return this.adminService.getConfig(game);
  }

  /** GET /admin/originals/access — global access config for Zeero Originals */
  @Get('access')
  getAccessConfig() {
    return this.adminService.getAccessConfig();
  }

  /**
   * PATCH /admin/originals/config/:game
   * Update game settings. Accepts any subset of:
   * isActive, maintenanceMode, maintenanceMessage,
   * minBet, maxBet, maxWin, houseEdgePercent, maxMultiplier,
   * targetGgrPercent, ggrWindowHours, ggrBiasStrength,
   * engagementMode, nearMissEnabled, bigWinThreshold, streakWindow,
   * displayRtpPercent, thumbnailUrl, gameName, gameDescription,
   * fakePlayerMin, fakePlayerMax
   */
  @Patch('config/:game')
  updateConfig(
    @Param('game') game: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.adminService.upsertConfig(game, body, req.user?.id);
  }

  /** POST /admin/originals/config/:game/enable — quickly enable a game without navigating away */
  @Post('config/:game/enable')
  enableGame(@Param('game') game: string, @Req() req: any) {
    return this.adminService.quickToggleGame(game, true, req.user?.id);
  }

  /** POST /admin/originals/config/:game/disable — quickly disable a game without navigating away */
  @Post('config/:game/disable')
  disableGame(@Param('game') game: string, @Req() req: any) {
    return this.adminService.quickToggleGame(game, false, req.user?.id);
  }

  /** PATCH /admin/originals/access — update who can play Zeero Originals */
  @Patch('access')
  updateAccessConfig(@Body() body: any, @Req() req: any) {
    return this.adminService.updateAccessConfig(body, req.user?.id);
  }

  // ─── Per-user GGR overrides ───────────────────────────────────────────────

  /** GET /admin/originals/config/:game/user-ggr — list all per-user overrides */
  @Get('config/:game/user-ggr')
  getPerUserGGR(@Param('game') game: string) {
    return this.adminService.getPerUserGGR(game);
  }

  /**
   * POST /admin/originals/config/:game/user-ggr/:userId
   * Set custom GGR target for a user. Body: { targetGgr: 20 }
   */
  @Post('config/:game/user-ggr/:userId')
  setPerUserGGR(
    @Param('game') game: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { targetGgr: number },
  ) {
    return this.adminService.setPerUserGGR(game, userId, body.targetGgr);
  }

  /** POST /admin/originals/config/:game/user-ggr/:userId/remove */
  @Post('config/:game/user-ggr/:userId/remove')
  removePerUserGGR(
    @Param('game') game: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.adminService.removePerUserGGR(game, userId);
  }

  // ─── GGR Stats ────────────────────────────────────────────────────────────
  // IMPORTANT: 'ggr' route must be declared BEFORE 'ggr/:game' so NestJS
  // doesn't match the literal "ggr" as a param.

  /** GET /admin/originals/ggr — live GGR for all games */
  @Get('ggr')
  getAllGGR() {
    return this.adminService.getAllGGR();
  }

  /** GET /admin/originals/ggr/:game — live GGR for one game */
  @Get('ggr/:game')
  getGGR(@Param('game') game: string) {
    return this.adminService.getLiveGGR(game);
  }

  /** GET /admin/originals/ggr/:game/history?hours=168 */
  @Get('ggr/:game/history')
  getGGRHistory(
    @Param('game') game: string,
    @Query('hours') hours: string,
  ) {
    return this.adminService.getGGRHistory(game, hours ? parseInt(hours) : 168);
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  /** GET /admin/originals/sessions[?game=mines] */
  @Get('sessions')
  getActiveSessions(@Query('game') game?: string) {
    return this.adminService.getActiveSessions(game);
  }

  // ─── Active games ─────────────────────────────────────────────────────────

  /** GET /admin/originals/active-games — all currently ACTIVE game rows */
  @Get('active-games')
  getActiveGames() {
    return this.adminService.getActiveGames();
  }

  /** POST /admin/originals/force-close/:gameId — force-close a specific game */
  @Post('force-close/:gameId')
  forceClose(
    @Param('gameId') gameId: string,
    @Req() req: any,
  ) {
    return this.adminService.forceCloseGame(gameId, req.user?.id);
  }

  /**
   * POST /admin/originals/force-close-user/:userId
   * Force-close ALL active games for a specific user (e.g. on account suspension).
   */
  @Post('force-close-user/:userId')
  forceCloseUserGames(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.forceCloseUserGames(userId);
  }

  // ─── Game History ─────────────────────────────────────────────────────────

  /** GET /admin/originals/history/:game?page=1&limit=50&userId=123 */
  @Get('history/:game')
  getHistory(
    @Param('game') game: string,
    @Query('page')   page:   string,
    @Query('limit')  limit:  string,
    @Query('userId') userId: string,
  ) {
    return this.adminService.getGameHistory(
      game,
      page   ? parseInt(page)   : 1,
      limit  ? parseInt(limit)  : 50,
      userId ? parseInt(userId) : undefined,
    );
  }

  /** GET /admin/originals/game/:gameId — detail for one game round */
  @Get('game/:gameId')
  getGameDetail(@Param('gameId') gameId: string) {
    return this.adminService.getGameDetail(gameId);
  }

  // ─── Engagement ───────────────────────────────────────────────────────────

  /** GET /admin/originals/engagement/:game */
  @Get('engagement/:game')
  getEngagementStats(@Param('game') game: string) {
    return this.adminService.getEngagementStats(game);
  }

  // ─── Player analytics ─────────────────────────────────────────────────────

  /** GET /admin/originals/player/:userId — originals stats for a specific user */
  @Get('player/:userId')
  getUserStats(@Param('userId', ParseIntPipe) userId: number) {
    return this.adminService.getUserOriginalsStats(userId);
  }

  // ─── Maintenance ──────────────────────────────────────────────────────────

  /** POST /admin/originals/prune-snapshots?days=30 — delete old GGR snapshots */
  @Post('prune-snapshots')
  pruneSnapshots(@Query('days') days: string) {
    return this.adminService.pruneOldSnapshots(days ? parseInt(days) : 30);
  }
}
