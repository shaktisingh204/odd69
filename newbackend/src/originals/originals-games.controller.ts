import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { OriginalsAdminService } from './originals-admin.service';
import { CoinflipService } from './services/coinflip.service';
import { ColorService } from './services/color.service';
import { KenoService } from './services/keno.service';
import { WheelService } from './services/wheel.service';
import { RouletteService } from './services/roulette.service';
import { LottoService } from './services/lotto.service';
import { JackpotService } from './services/jackpot.service';
import { HiloService } from './services/hilo.service';
import { TowersService } from './services/towers.service';

/**
 * Player-facing controller for the ODD69 Originals single-shot / multi-step
 * games. Each route is explicit (no `:game` param) so there is no ambiguity
 * with the existing `originals/games*` (public) and `originals/access`
 * (admin) controllers.
 *
 * NOTE: bodies are typed as `any` on purpose — the global ValidationPipe runs
 * with `whitelist: true`, so typing them as DTO classes would strip every
 * field that isn't decorated with class-validator. The game services do their
 * own validation.
 */
@Controller('originals')
@UseGuards(JwtAuthGuard)
export class OriginalsGamesController {
  constructor(
    private readonly adminService: OriginalsAdminService,
    private readonly coinflipService: CoinflipService,
    private readonly colorService: ColorService,
    private readonly kenoService: KenoService,
    private readonly wheelService: WheelService,
    private readonly rouletteService: RouletteService,
    private readonly lottoService: LottoService,
    private readonly jackpotService: JackpotService,
    private readonly hiloService: HiloService,
    private readonly towersService: TowersService,
  ) {}

  private uid(req: any): number {
    return Number(req.user?.id ?? req.user?.userId);
  }

  private async assertAccess(userId: number): Promise<void> {
    if (!(await this.adminService.canUserPlayOriginals(userId))) {
      throw new ForbiddenException(
        'ODD69 Originals access is not enabled for your account.',
      );
    }
  }

  // ── Coinflip ───────────────────────────────────────────────────────────────

  @Post('coinflip/play')
  async coinflipPlay(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.coinflipService.play(userId, body);
  }

  @Get('coinflip/history')
  coinflipHistory(@Req() req: any, @Query() query: any) {
    return this.coinflipService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Color ────────────────────────────────────────────────────────────────

  @Post('color/play')
  async colorPlay(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.colorService.play(userId, body);
  }

  @Get('color/history')
  colorHistory(@Req() req: any, @Query() query: any) {
    return this.colorService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Keno ─────────────────────────────────────────────────────────────────

  @Post('keno/play')
  async kenoPlay(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.kenoService.play(userId, body);
  }

  @Get('keno/history')
  kenoHistory(@Req() req: any, @Query() query: any) {
    return this.kenoService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Wheel ────────────────────────────────────────────────────────────────

  @Public()
  @Get('wheel/preview')
  wheelPreview(@Query() query: any) {
    return this.wheelService.preview(query.risk, Number(query.segments));
  }

  @Post('wheel/play')
  async wheelPlay(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.wheelService.play(userId, body);
  }

  @Get('wheel/history')
  wheelHistory(@Req() req: any, @Query() query: any) {
    return this.wheelService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Roulette ───────────────────────────────────────────────────────────────

  @Post('roulette/play')
  async roulettePlay(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.rouletteService.play(userId, body);
  }

  @Get('roulette/history')
  rouletteHistory(@Req() req: any, @Query() query: any) {
    return this.rouletteService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Lotto ────────────────────────────────────────────────────────────────

  @Post('lotto/play')
  async lottoPlay(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.lottoService.play(userId, body);
  }

  @Get('lotto/history')
  lottoHistory(@Req() req: any, @Query() query: any) {
    return this.lottoService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Jackpot ──────────────────────────────────────────────────────────────

  @Post('jackpot/play')
  async jackpotPlay(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.jackpotService.play(userId, body);
  }

  @Get('jackpot/history')
  jackpotHistory(@Req() req: any, @Query() query: any) {
    return this.jackpotService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Hi-Lo (multi-step) ─────────────────────────────────────────────────────

  @Post('hilo/start')
  async hiloStart(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.hiloService.start(userId, body);
  }

  @Post('hilo/action')
  hiloAction(@Req() req: any, @Body() body: any) {
    return this.hiloService.action(this.uid(req), body);
  }

  @Post('hilo/cashout')
  hiloCashout(@Req() req: any, @Body() body: any) {
    return this.hiloService.cashout(this.uid(req), body);
  }

  @Get('hilo/active')
  hiloActive(@Req() req: any) {
    return this.hiloService.getActive(this.uid(req));
  }

  @Get('hilo/history')
  hiloHistory(@Req() req: any, @Query() query: any) {
    return this.hiloService.getHistory(this.uid(req), Number(query.limit) || 20);
  }

  // ── Towers (multi-step) ─────────────────────────────────────────────────────

  @Post('towers/start')
  async towersStart(@Req() req: any, @Body() body: any) {
    const userId = this.uid(req);
    await this.assertAccess(userId);
    return this.towersService.start(userId, body);
  }

  @Post('towers/pick')
  towersPick(@Req() req: any, @Body() body: any) {
    return this.towersService.pick(this.uid(req), body);
  }

  @Post('towers/cashout')
  towersCashout(@Req() req: any, @Body() body: any) {
    return this.towersService.cashout(this.uid(req), body);
  }

  @Get('towers/active')
  towersActive(@Req() req: any) {
    return this.towersService.getActive(this.uid(req));
  }

  @Get('towers/history')
  towersHistory(@Req() req: any, @Query() query: any) {
    return this.towersService.getHistory(this.uid(req), Number(query.limit) || 20);
  }
}
