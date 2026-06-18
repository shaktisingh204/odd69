import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { FantasyService } from './fantasy.service';
import { FantasyExtrasService } from './fantasy-extras.service';
import {
  CreateFantasyTeamDto,
  JoinContestDto,
  MatchListQueryDto,
  CreateContestDto,
  UpdatePointsSystemDto,
  ApplyPromocodeDto,
  CreatePrivateContestDto,
  CloneTeamDto,
  JoinByInviteDto,
  UpdateFantasyConfigDto,
  CreatePromocodeDto,
  CreateContestTemplateDto,
  BulkAttachTemplatesDto,
  SettleContestDto,
  RefundContestDto,
  OverridePlayerCreditDto,
  ManualPointsDto,
  BroadcastNotificationDto,
  UpsertBonusRuleDto,
  GrantPowerupDto,
  UpdateStreakScheduleDto,
} from './dto/fantasy.dto';
import { Public } from '../auth/public.decorator';
import { SecurityTokenGuard } from '../auth/security-token.guard';

@Controller('fantasy')
export class FantasyController {
  constructor(
    private readonly fantasyService: FantasyService,
    private readonly extras: FantasyExtrasService,
  ) {}

  // ═══════════════════════════════════════
  //  PUBLIC — Matches / Contests (existing)
  // ═══════════════════════════════════════

  @Public()
  @Get('config')
  async getPublicConfig() {
    return this.extras.getConfig();
  }

  @Public()
  @Get('matches')
  async getMatches(@Query() query: MatchListQueryDto) {
    return this.fantasyService.getMatches(
      query.status, query.page || 1, query.limit || 20, query.competitionId, query.managed,
    );
  }

  @Public()
  @Get('matches/:id')
  async getMatch(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchById(id);
  }

  @Public()
  @Get('matches/:id/squads')
  async getMatchSquads(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchSquads(id);
  }

  @Public()
  @Get('matches/:id/points')
  async getMatchPoints(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchPoints(id);
  }

  @Public()
  @Get('matches/:id/live')
  async getMatchLive(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchLive(id);
  }

  @Public()
  @Get('matches/:id/scorecard')
  async getMatchScorecard(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchScorecard(id);
  }

  @Public()
  @Get('matches/:id/info')
  async getMatchInfo(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchInfo(id);
  }

  @Public()
  @Get('matches/:id/playing11')
  async getMatchPlaying11(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchPlaying11(id);
  }

  @Public()
  @Get('matches/:id/commentary')
  async getMatchCommentary(
    @Param('id', ParseIntPipe) id: number,
    @Query('innings') innings?: string,
  ) {
    return this.fantasyService.getMatchCommentary(id, innings ? parseInt(innings) : undefined);
  }

  @Public()
  @Get('matches/:id/match-stats')
  async getMatchStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchStatistics(id);
  }

  @Public()
  @Get('matches/:id/wagonwheel')
  async getMatchWagonWheel(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getMatchWagonWheel(id);
  }

  @Public()
  @Get('competitions/:id/stat-types')
  async getCompetitionStatTypes(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getCompetitionStatTypes(id);
  }

  @Public()
  @Get('matches/:id/contests')
  async getContests(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getContests(id);
  }

  @Public()
  @Get('seasons')
  async getSeasons() {
    return this.fantasyService.getSeasons();
  }

  @Public()
  @Get('seasons/:year/competitions')
  async getSeasonCompetitions(
    @Param('year') year: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fantasyService.getSeasonCompetitions(year, parseInt(page) || 1, parseInt(limit) || 100);
  }

  @Public()
  @Get('competitions')
  async getCompetitions(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fantasyService.getCompetitions(status, parseInt(page) || 1, parseInt(limit) || 20);
  }

  @Public()
  @Get('competitions/:id')
  async getCompetition(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getCompetitionById(id);
  }

  @Public()
  @Get('competitions/:id/matches')
  async getCompetitionMatches(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fantasyService.getCompetitionMatches(id, parseInt(page) || 1, parseInt(limit) || 50);
  }

  @Public()
  @Get('competitions/:id/teams')
  async getCompetitionTeams(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getCompetitionTeams(id);
  }

  @Public()
  @Get('competitions/:id/standings')
  async getCompetitionStandings(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getCompetitionStandings(id);
  }

  @Public()
  @Get('competitions/:id/stats/:statType')
  async getCompetitionStats(
    @Param('id', ParseIntPipe) id: number,
    @Param('statType') statType: string,
  ) {
    return this.fantasyService.getCompetitionStats(id, statType);
  }

  @Public()
  @Get('players')
  async searchPlayers(@Query('search') search?: string) {
    return this.fantasyService.searchPlayers(search);
  }

  @Public()
  @Get('players/:id')
  async getPlayerProfile(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getPlayerProfile(id);
  }

  @Public()
  @Get('players/:id/stats')
  async getPlayerStats(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getPlayerStats(id);
  }

  @Public()
  @Get('teams/:id')
  async getTeamInfo(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getTeamInfo(id);
  }

  @Public()
  @Get('teams/:id/matches')
  async getTeamMatches(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') status?: string,
  ) {
    return this.fantasyService.getTeamMatches(id, status ? parseInt(status) : undefined);
  }

  @Public()
  @Get('teams/:id/players')
  async getTeamPlayers(@Param('id', ParseIntPipe) id: number) {
    return this.fantasyService.getTeamPlayers(id);
  }

  @Public()
  @Get('iccranks')
  async getIccRankings() {
    return this.fantasyService.getIccRankings();
  }

  @Public()
  @Get('contests/:contestId/leaderboard')
  async getLeaderboard(
    @Param('contestId') contestId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fantasyService.getContestLeaderboard(contestId, parseInt(page) || 1, parseInt(limit) || 50);
  }

  @Public()
  @Get('points-system')
  async getPointsSystem(@Query('format') format?: string) {
    return this.fantasyService.getPointsSystem(format);
  }

  @Public()
  @Get('season-leaderboard')
  async getSeasonLb(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.extras.seasonLeaderboard(parseInt(page) || 1, parseInt(limit) || 50);
  }

  // ═══════════════════════════════════════
  //  AUTH — User Actions
  // ═══════════════════════════════════════

  @Post('teams')
  async createTeam(@Request() req, @Body() dto: CreateFantasyTeamDto) {
    return this.fantasyService.createTeam(req.user.userId, dto);
  }

  @Get('my-teams/:matchId')
  async getMyTeams(@Request() req, @Param('matchId', ParseIntPipe) matchId: number) {
    return this.fantasyService.getUserTeams(req.user.userId, matchId);
  }

  @Get('my-teams')
  async getAllMyTeams(@Request() req, @Query('matchId') matchId?: string) {
    return this.extras.listMyTeams(req.user.userId, matchId ? parseInt(matchId) : undefined);
  }

  @Post('teams/clone')
  async cloneTeam(@Request() req, @Body() dto: CloneTeamDto) {
    return this.extras.cloneTeam(req.user.userId, dto.sourceTeamId, dto.newName);
  }

  @Post('join-contest')
  async joinContest(@Request() req, @Body() dto: JoinContestDto) {
    return this.fantasyService.joinContest(req.user.userId, dto);
  }

  @Post('join-by-invite')
  async joinByInvite(@Request() req, @Body() dto: JoinByInviteDto) {
    const contest = await this.extras.resolveInvite(dto.inviteCode);
    return this.fantasyService.joinContest(req.user.userId, {
      contestId: String(contest._id),
      teamId: dto.teamId,
      matchId: contest.matchId,
    } as any);
  }

  @Post('private-contests')
  async createPrivate(@Request() req, @Body() dto: CreatePrivateContestDto) {
    return this.extras.createPrivateContest(req.user.userId, dto);
  }

  @Get('private-contests/invite/:code')
  async lookupInvite(@Param('code') code: string) {
    return this.extras.resolveInvite(code);
  }

  @Post('promocode/apply')
  async applyPromo(@Request() req, @Body() dto: ApplyPromocodeDto) {
    return this.extras.applyPromocode(req.user.userId, dto);
  }

  @Get('streak')
  async getStreak(@Request() req) {
    return this.extras.getStreak(req.user.userId);
  }

  @Post('streak/claim')
  async claimStreak(@Request() req) {
    return this.extras.claimStreak(req.user.userId);
  }

  @Get('powerups')
  async getPowerups(@Request() req) {
    return this.extras.listPowerups(req.user.userId);
  }

  @Get('notifications')
  async getNotifications(@Request() req, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    return this.extras.listNotifications(req.user.userId, unread === 'true', parseInt(limit) || 50);
  }

  @Post('notifications/read')
  async markNotifs(@Request() req, @Body() body: { id?: string }) {
    return this.extras.markRead(req.user.userId, body?.id);
  }

  @Get('my-rank')
  async myRank(@Request() req) {
    return this.extras.myRank(req.user.userId);
  }

  @Get('stats')
  async getStats(@Request() req) {
    return this.extras.userFantasyStats(req.user.userId);
  }

  @Get('referrals')
  async myReferrals(@Request() req) {
    return this.extras.myReferrals(req.user.userId);
  }

  @Get('history')
  async getHistory(
    @Request() req,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fantasyService.getUserHistory(req.user.userId, status, parseInt(page) || 1, parseInt(limit) || 20);
  }

  // ═══════════════════════════════════════
  //  ADMIN (protected by x-admin-token)
  // ═══════════════════════════════════════

  // Global config
  @UseGuards(SecurityTokenGuard)
  @Get('admin/config')
  async adminGetConfig() {
    return this.extras.getConfig();
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/config')
  async adminUpdateConfig(@Body() dto: UpdateFantasyConfigDto, @Request() req) {
    return this.extras.updateConfig(dto as any, req.headers['x-admin-user'] || 'admin');
  }

  // Basic contest + points (original)
  @UseGuards(SecurityTokenGuard)
  @Post('admin/contests')
  async createContest(@Body() dto: CreateContestDto) {
    return this.fantasyService.createContest(dto);
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/points-system')
  async updatePointsSystem(@Body() dto: UpdatePointsSystemDto) {
    return this.fantasyService.updatePointsSystem(dto);
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/sync')
  async triggerSync() {
    const result = await this.fantasyService.triggerSync();
    const attach = await this.extras.autoAttachNewMatches().catch(() => ({ attached: 0 }));
    return { ...result, ...attach };
  }

  // Contest lifecycle
  @UseGuards(SecurityTokenGuard)
  @Post('admin/contests/cancel')
  async adminCancelContest(@Body() dto: RefundContestDto, @Request() req) {
    return this.extras.cancelContest(dto.contestId, dto.reason || 'admin cancelled', dto.cancelContest !== false, req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/contests/refund')
  async adminRefundContest(@Body() dto: RefundContestDto, @Request() req) {
    const n = await this.extras.refundContest(dto.contestId, dto.reason || '', req.headers['x-admin-user'] || 'admin');
    return { refunded: n };
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/contests/settle')
  async adminSettleContest(@Body() dto: SettleContestDto, @Request() req) {
    return this.extras.settleContestByMatchPoints(dto.contestId, dto.note || '', req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/contests/duplicate')
  async adminDuplicateContest(@Body() body: { contestId: string }, @Request() req) {
    return this.extras.duplicateContest(body.contestId, req.headers['x-admin-user'] || 'admin');
  }

  // Templates
  @UseGuards(SecurityTokenGuard)
  @Get('admin/templates')
  async adminListTemplates() {
    return this.extras.listTemplates();
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/templates')
  async adminCreateTemplate(@Body() dto: CreateContestTemplateDto, @Request() req) {
    return this.extras.createTemplate(dto, req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Patch('admin/templates/:id')
  async adminUpdateTemplate(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.extras.updateTemplate(id, dto, req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Delete('admin/templates/:id')
  async adminDeleteTemplate(@Param('id') id: string, @Request() req) {
    return this.extras.deleteTemplate(id, req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/templates/attach')
  async adminAttachTemplates(@Body() dto: BulkAttachTemplatesDto, @Request() req) {
    return this.extras.attachTemplatesToMatch(dto.matchId, dto.templateIds, req.headers['x-admin-user'] || 'admin');
  }

  // Promocodes
  @UseGuards(SecurityTokenGuard)
  @Get('admin/promocodes')
  async adminListPromos() {
    return this.extras.listPromocodes();
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/promocodes')
  async adminCreatePromo(@Body() dto: CreatePromocodeDto, @Request() req) {
    return this.extras.createPromocode(dto, req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Patch('admin/promocodes/:id')
  async adminUpdatePromo(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.extras.updatePromocode(id, dto, req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Delete('admin/promocodes/:id')
  async adminDeletePromo(@Param('id') id: string, @Request() req) {
    return this.extras.deletePromocode(id, req.headers['x-admin-user'] || 'admin');
  }

  // Player credit overrides
  @UseGuards(SecurityTokenGuard)
  @Get('admin/credit-overrides')
  async adminListCreditOverrides(@Query('matchId') matchId?: string) {
    return this.extras.listCreditOverrides(matchId ? Number(matchId) : undefined);
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/credit-overrides')
  async adminOverrideCredit(@Body() dto: OverridePlayerCreditDto, @Request() req) {
    return this.extras.overrideCredit(dto.matchId, dto.playerId, dto.newCredit, dto.reason || '', req.headers['x-admin-user'] || 'admin');
  }

  // Manual points
  @UseGuards(SecurityTokenGuard)
  @Post('admin/manual-points')
  async adminManualPoints(@Body() dto: ManualPointsDto, @Request() req) {
    return this.extras.setManualPoints(dto.matchId, dto.playerId, dto.points, dto.reason || '', req.headers['x-admin-user'] || 'admin');
  }

  // Match enable/disable
  @UseGuards(SecurityTokenGuard)
  @Post('admin/matches/:id/disable')
  async adminDisableMatch(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Request() req) {
    return this.extras.setMatchDisabled(id, true, body?.reason || '', req.headers['x-admin-user'] || 'admin');
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/matches/:id/enable')
  async adminEnableMatch(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.extras.setMatchDisabled(id, false, '', req.headers['x-admin-user'] || 'admin');
  }

  // Notifications
  @UseGuards(SecurityTokenGuard)
  @Post('admin/notifications/broadcast')
  async adminBroadcast(@Body() dto: BroadcastNotificationDto, @Request() req) {
    return this.extras.broadcastNotification(dto, req.headers['x-admin-user'] || 'admin');
  }

  // Bonus rules
  @UseGuards(SecurityTokenGuard)
  @Get('admin/bonus-rules')
  async adminListBonusRules() {
    return this.extras.listBonusRules();
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/bonus-rules')
  async adminUpsertBonusRule(@Body() dto: UpsertBonusRuleDto, @Request() req) {
    return this.extras.upsertBonusRule(dto, req.headers['x-admin-user'] || 'admin');
  }

  // Streak schedule
  @UseGuards(SecurityTokenGuard)
  @Get('admin/streak-schedule')
  async adminGetStreakSchedule() {
    return this.extras.getStreakSchedule();
  }

  @UseGuards(SecurityTokenGuard)
  @Post('admin/streak-schedule')
  async adminSetStreakSchedule(@Body() dto: UpdateStreakScheduleDto, @Request() req) {
    return this.extras.updateStreakSchedule(dto.schedule, req.headers['x-admin-user'] || 'admin');
  }

  // Powerups
  @UseGuards(SecurityTokenGuard)
  @Post('admin/powerups/grant')
  async adminGrantPowerup(@Body() dto: GrantPowerupDto, @Request() req) {
    const ids = dto.userId ? [dto.userId] : (dto.userIds || []);
    for (const uid of ids) {
      await this.extras.grantPowerup(uid, dto.type, dto.count, dto.source || 'admin');
    }
    return { success: true, count: ids.length };
  }

  // Activity log
  @UseGuards(SecurityTokenGuard)
  @Get('admin/activity-log')
  async adminActivityLog(@Query('page') page?: string, @Query('limit') limit?: string, @Query('action') action?: string) {
    return this.extras.listActivityLog(parseInt(page) || 1, parseInt(limit) || 100, action);
  }

  // CSV export
  @UseGuards(SecurityTokenGuard)
  @Get('admin/export/entries')
  async adminExportEntries(@Query('matchId') matchId?: string, @Query('contestId') contestId?: string, @Res() res?: Response) {
    const csv = await this.extras.exportEntriesCsv(
      matchId ? Number(matchId) : undefined,
      contestId,
    );
    res?.setHeader('Content-Type', 'text/csv');
    res?.setHeader('Content-Disposition', 'attachment; filename="fantasy-entries.csv"');
    res?.send(csv);
  }

  // User fantasy ban
  @UseGuards(SecurityTokenGuard)
  @Post('admin/users/:id/fantasy-ban')
  async adminBanUserFantasy(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string; banned?: boolean }, @Request() req) {
    return this.extras.setUserFantasyBan(id, body.banned !== false, body.reason || '', req.headers['x-admin-user'] || 'admin');
  }
}
