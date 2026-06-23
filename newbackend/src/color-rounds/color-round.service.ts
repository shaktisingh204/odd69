import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { BonusService } from '../bonus/bonus.service';
import { OriginalsAdminService } from '../originals/originals-admin.service';
import { GGRService } from '../originals/ggr.service';
import {
  generateServerSeed,
  hmacHex,
  rollInt,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
} from '../originals/originals-helpers';
import {
  ColorRound,
  ColorRoundDocument,
  ColorRoom,
} from './schemas/color-round.schema';
import {
  ColorBet,
  ColorBetDocument,
  ColorBetType,
} from './schemas/color-bet.schema';

const GAME_KEY = 'color';
const GAME_SOURCE = 'COLOR_ROUNDS';
const DEFAULT_MIN_BET = 10;
const DEFAULT_MAX_BET = 15000;
const LOCK_WINDOW_MS = 5000; // betting closes for the final 5 seconds

/** Duration of each room, in milliseconds, keyed by room id. */
const ROOM_DURATIONS_MS: Record<ColorRoom, number> = {
  '30s': 30_000,
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
};

export const COLOR_ROOMS: ColorRoom[] = ['30s', '1m', '3m', '5m'];

// ── Payout table ─────────────────────────────────────────────────────────────
// Marketing odds are 2x / 4.5x / 9x; ODD69 applies a 4% house edge by scaling
// each multiplier ×0.96, identical to the single-shot color.service.ts
// (red/green 1.92, violet 4.8, number 9.6, big/small 1.92). The shared-violet
// rule from color.md: when the winning number is 0 or 5 the matching plain
// color (red on 0, green on 5) is SHARED with violet and pays the reduced
// 1.5x (×0.96 = 1.44) instead of 2x.
const MULT_COLOR = 1.92; // green / red on a pure color number
const MULT_COLOR_SHARED = 1.44; // green / red when it hits via 5 / 0 (shared with violet)
const MULT_VIOLET = 4.8; // violet (result is 0 or 5)
const MULT_NUMBER = 9.6; // exact number
const MULT_BIGSMALL = 1.92; // big / small

type RoomRuntime = {
  period: number;
  status: 'BETTING' | 'LOCKED' | 'SETTLED';
  serverSeedHash: string;
  endsAt: number; // epoch ms when the round draws (scheduling only — NOT used in the outcome)
};

export interface PlaceColorBetDto {
  room: ColorRoom;
  betType: ColorBetType;
  selection: string;
  amount: number;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
}

/**
 * Number → colors → size mapping (color.md, identical to the single-shot
 * ColorService.colorsForNumber):
 *   0       → ['red', 'violet'], Small
 *   5       → ['green', 'violet'], Big
 *   1,3,7,9 → ['green'],           (odd) Small/Big by range
 *   2,4,6,8 → ['red'],             (even, non-zero)
 * Big  = 5..9, Small = 0..4.
 */
function colorsForNumber(n: number): string[] {
  if (n === 0) return ['red', 'violet'];
  if (n === 5) return ['green', 'violet'];
  if (n % 2 === 1) return ['green'];
  return ['red'];
}

function sizeForNumber(n: number): 'Big' | 'Small' {
  return n >= 5 ? 'Big' : 'Small';
}

@Injectable()
export class ColorRoundService {
  private readonly logger = new Logger(ColorRoundService.name);

  /** Live in-memory snapshot of every room (read by the gateway for color:state). */
  private runtime = new Map<ColorRoom, RoomRuntime>();

  // Gateway callbacks
  private _onBetting:
    | ((p: {
        room: ColorRoom;
        period: number;
        serverSeedHash: string;
        endsIn: number;
        lockIn: number;
      }) => void)
    | null = null;
  private _onLock: ((p: { room: ColorRoom; period: number }) => void) | null =
    null;
  private _onResult:
    | ((p: {
        room: ColorRoom;
        period: number;
        result: number;
        resultColors: string[];
        size: string;
        serverSeed: string;
        serverSeedHash: string;
        winners: Array<{ userId: number; payout: number; betId: string }>;
      }) => void)
    | null = null;

  constructor(
    @InjectModel(ColorRound.name)
    private readonly roundModel: Model<ColorRoundDocument>,
    @InjectModel(ColorBet.name)
    private readonly betModel: Model<ColorBetDocument>,
    private readonly prisma: PrismaService,
    private readonly bonusService: BonusService,
    private readonly originalsAdminService: OriginalsAdminService,
    private readonly ggrService: GGRService,
  ) {}

  // ── Callback registration (gateway) ────────────────────────────────────────

  onBetting(cb: NonNullable<ColorRoundService['_onBetting']>) {
    this._onBetting = cb;
  }
  onLock(cb: NonNullable<ColorRoundService['_onLock']>) {
    this._onLock = cb;
  }
  onResult(cb: NonNullable<ColorRoundService['_onResult']>) {
    this._onResult = cb;
  }

  // ── Period id ───────────────────────────────────────────────────────────────

  /** Date-stamped sequence base, e.g. 20260623 * 100000. Resets the sequence daily. */
  private dailyBase(d = new Date()): number {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const stamp = y * 10000 + m * 100 + day; // 20260623
    return stamp * 100000;
  }

  private async nextPeriod(room: ColorRoom): Promise<number> {
    const base = this.dailyBase();
    const latest = await this.roundModel
      .findOne({ room })
      .sort({ period: -1 })
      .lean();
    if (latest && latest.period >= base) return latest.period + 1;
    return base + 1; // first round of the day
  }

  // ── Loop lifecycle ───────────────────────────────────────────────────────────

  /** Launch one independent continuous loop per room. */
  startLoops() {
    for (const room of COLOR_ROOMS) {
      this.runRound(room).catch((e) =>
        this.logger.error(`Color room ${room} loop error`, e),
      );
    }
    this.logger.log(`Color round loops started for rooms: ${COLOR_ROOMS.join(', ')}`);
  }

  private async runRound(room: ColorRoom): Promise<void> {
    const durationMs = ROOM_DURATIONS_MS[room];
    const period = await this.nextPeriod(room);

    // Commit: generate the per-round seed, publish only the hash.
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const openedAt = new Date();

    await this.roundModel.create({
      room,
      period,
      serverSeed,
      serverSeedHash,
      status: 'BETTING',
      openedAt,
    });

    const endsAt = Date.now() + durationMs;
    this.runtime.set(room, { period, status: 'BETTING', serverSeedHash, endsAt });

    this._onBetting?.({
      room,
      period,
      serverSeedHash,
      endsIn: durationMs,
      lockIn: Math.max(0, durationMs - LOCK_WINDOW_MS),
    });
    this.logger.debug(`[${room}] period ${period} — BETTING (${durationMs}ms)`);

    // Open betting until the final 5s.
    await this.sleep(Math.max(0, durationMs - LOCK_WINDOW_MS));

    // Lock betting for the final window.
    const rt = this.runtime.get(room);
    if (rt) rt.status = 'LOCKED';
    await this.roundModel.updateOne(
      { room, period },
      { $set: { status: 'LOCKED', lockedAt: new Date() } },
    );
    this._onLock?.({ room, period });
    this.logger.debug(`[${room}] period ${period} — LOCKED`);

    await this.sleep(LOCK_WINDOW_MS);

    // Draw + settle at lock+0.
    try {
      await this.settleRound(room);
    } catch (e) {
      this.logger.error(`[${room}] settle error on period ${period}`, e);
    }

    // Seamless: immediately start the next round (no dead air).
    this.runRound(room);
  }

  /**
   * Draw the shared result for the room's current LOCKED round, settle every
   * PENDING bet, broadcast, and mark the round SETTLED.
   */
  async settleRound(room: ColorRoom): Promise<void> {
    const round = await this.roundModel
      .findOne({ room, status: 'LOCKED' })
      .sort({ period: -1 });
    if (!round) {
      this.logger.warn(`[${room}] settleRound: no LOCKED round found`);
      return;
    }

    // ── Provably-fair draw (pure HMAC — NO Date.now in the outcome) ──────────
    // clientSeed = the period id, nonce = 0, matching hmacHex/rollInt helpers.
    const digest = hmacHex(round.serverSeed, String(round.period), 0);
    const result = rollInt(digest, 10); // 0..9
    const resultColors = colorsForNumber(result);
    const size = sizeForNumber(result);
    const settledAt = new Date();

    await this.roundModel.updateOne(
      { _id: round._id },
      { $set: { result, resultColors, size, status: 'SETTLED', settledAt } },
    );
    const rt = this.runtime.get(room);
    if (rt) rt.status = 'SETTLED';

    // ── Settle all PENDING bets for this period ──────────────────────────────
    const bets = await this.betModel.find({
      room,
      period: round.period,
      status: 'PENDING',
    });

    const winners: Array<{ userId: number; payout: number; betId: string }> = [];
    let totalPaidOut = 0;

    const maxWin = await this.getMaxWin();

    for (const bet of bets) {
      const multiplier = this.multiplierFor(
        bet.betType,
        bet.selection,
        result,
        resultColors,
        size,
      );
      const won = multiplier > 0;
      let payout = won ? roundCurrency(bet.amount * multiplier) : 0;
      if (maxWin && payout > maxWin) payout = roundCurrency(maxWin);

      bet.status = won ? 'WON' : 'LOST';
      bet.multiplier = won ? multiplier : 0;
      bet.payout = payout;
      await bet.save();

      const betId = String(bet._id);

      // Credit + BET_WIN (or BET_LOSS) via shared helper.
      await settlePayout(
        this.prisma,
        bet.userId,
        bet.amount,
        payout,
        bet.walletType,
        bet.bonusAmount,
        GAME_SOURCE,
        betId,
        `Color ${room} #${round.period} win: ${bet.betType} ${bet.selection} → ${result}`,
        `Color ${room} #${round.period} loss: ${bet.betType} ${bet.selection} → ${result}`,
      );

      // Push a wallet refresh so the player's balance updates after settlement.
      this.bonusService.emitWalletRefresh(bet.userId);

      if (won) {
        totalPaidOut += payout;
        winners.push({ userId: bet.userId, payout, betId });
      }
    }

    await this.roundModel.updateOne(
      { _id: round._id },
      { $inc: { totalPaidOut } },
    );

    // GGR snapshot (best-effort, color uses the shared 'color' config key).
    this.ggrService
      .updateSnapshot(GAME_KEY, 0, totalPaidOut, totalPaidOut > 0)
      .catch(() => undefined);

    this.logger.debug(
      `[${room}] period ${round.period} SETTLED → ${result} (${resultColors.join('/')}, ${size}); ${bets.length} bets, ${winners.length} winners`,
    );

    this._onResult?.({
      room,
      period: round.period,
      result,
      resultColors,
      size,
      serverSeed: round.serverSeed, // REVEAL after the draw
      serverSeedHash: round.serverSeedHash,
      winners,
    });
  }

  /**
   * Return the win multiplier for a bet against the drawn result, or 0 for a
   * loss. Implements the shared-violet rule for 0 / 5.
   */
  private multiplierFor(
    betType: ColorBetType,
    selection: string,
    result: number,
    resultColors: string[],
    size: string,
  ): number {
    if (betType === 'number') {
      return Number(selection) === result ? MULT_NUMBER : 0;
    }

    if (betType === 'bigsmall') {
      const sel = selection.toLowerCase();
      if (sel === 'big') return size === 'Big' ? MULT_BIGSMALL : 0;
      if (sel === 'small') return size === 'Small' ? MULT_BIGSMALL : 0;
      return 0;
    }

    // betType === 'color'
    const sel = selection.toLowerCase();
    if (sel === 'violet') {
      return resultColors.includes('violet') ? MULT_VIOLET : 0;
    }
    if (sel === 'green' || sel === 'red') {
      if (!resultColors.includes(sel)) return 0;
      // Shared-violet: green via 5, or red via 0, pays the reduced 1.5x.
      const isShared = result === 0 || result === 5;
      return isShared ? MULT_COLOR_SHARED : MULT_COLOR;
    }
    return 0;
  }

  // ── Bet placement ─────────────────────────────────────────────────────────────

  async placeBet(userId: number, dto: PlaceColorBetDto) {
    const {
      room,
      betType,
      selection: rawSelection,
      amount,
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    // ── 1. Validate room + phase ─────────────────────────────────────────────
    if (!COLOR_ROOMS.includes(room)) {
      throw new BadRequestException('Invalid room');
    }
    const rt = this.runtime.get(room);
    if (!rt || rt.status !== 'BETTING') {
      throw new BadRequestException('Betting is closed for this round');
    }
    // Hard guard against the lock window even if a tick was missed.
    if (rt.endsAt - Date.now() <= LOCK_WINDOW_MS) {
      throw new BadRequestException('Betting is closed — wait for the next round');
    }
    const period = rt.period;

    // ── 2. Validate bet type + selection ─────────────────────────────────────
    const selection = this.validateSelection(betType, rawSelection);

    // ── 3. Validate amount + config ──────────────────────────────────────────
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      throw new BadRequestException('Bet amount must be positive');
    }
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && config.isActive === false) {
      throw new BadRequestException('Game is currently unavailable');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(config.maintenanceMessage || 'Under maintenance');
    }
    const minBet = config?.minBet ?? DEFAULT_MIN_BET;
    const maxBet = config?.maxBet ?? DEFAULT_MAX_BET;
    if (amount < minBet) throw new BadRequestException(`Minimum bet is ${minBet}`);
    if (amount > maxBet) throw new BadRequestException(`Maximum bet is ${maxBet}`);

    // ── 4. Access gate ───────────────────────────────────────────────────────
    if (!(await this.originalsAdminService.canUserPlayOriginals(userId))) {
      throw new BadRequestException(
        'ODD69 Originals access is not enabled for your account.',
      );
    }

    // ── 5. Load user + atomic stake debit ────────────────────────────────────
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Re-check phase right before debiting to minimise the lock-race window.
    const liveRt = this.runtime.get(room);
    if (
      !liveRt ||
      liveRt.status !== 'BETTING' ||
      liveRt.period !== period ||
      liveRt.endsAt - Date.now() <= LOCK_WINDOW_MS
    ) {
      throw new BadRequestException('Betting is closed for this round');
    }

    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      amount,
      walletType,
      useBonus,
    );

    // ── 6. Create PENDING bet ────────────────────────────────────────────────
    const bet = await this.betModel.create({
      room,
      period,
      userId,
      betType,
      selection,
      amount,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
      status: 'PENDING',
    });
    const betId = String(bet._id);

    // ── 7. Stake (BET_PLACE) log ─────────────────────────────────────────────
    await logStakeTransaction(
      this.prisma,
      userId,
      amount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      betId,
      `Color ${room} #${period} bet: ${betType} ${selection}`,
    );

    await this.roundModel.updateOne(
      { room, period },
      { $inc: { totalWagered: amount } },
    );

    // ── 8. Wagering progress ─────────────────────────────────────────────────
    await this.bonusService
      .recordWagering(
        userId,
        amount,
        'CASINO',
        walletType === 'crypto' ? 'crypto' : bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    return {
      betId,
      room,
      period,
      betType,
      selection,
      amount,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
    };
  }

  private validateSelection(betType: ColorBetType, selection: string): string {
    const sel = String(selection ?? '').toLowerCase().trim();
    if (betType === 'color') {
      if (!['green', 'red', 'violet'].includes(sel)) {
        throw new BadRequestException('Color selection must be green, red, or violet');
      }
      return sel;
    }
    if (betType === 'bigsmall') {
      if (!['big', 'small'].includes(sel)) {
        throw new BadRequestException('Selection must be big or small');
      }
      return sel;
    }
    if (betType === 'number') {
      const n = Number(sel);
      if (!Number.isInteger(n) || n < 0 || n > 9) {
        throw new BadRequestException('Number selection must be an integer 0–9');
      }
      return String(n);
    }
    throw new BadRequestException('betType must be color, number, or bigsmall');
  }

  private async getMaxWin(): Promise<number> {
    const config = await this.ggrService.getConfig(GAME_KEY).catch(() => null);
    return (config as any)?.maxWin ?? 150000;
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  /** Public, masked-free state for a room (current period + phase + timeLeft). */
  getState(room: ColorRoom) {
    const rt = this.runtime.get(room);
    if (!rt) {
      return { room, period: 0, status: 'BETTING' as const, timeLeft: 0, serverSeedHash: '' };
    }
    const timeLeft = Math.max(0, rt.endsAt - Date.now());
    return {
      room,
      period: rt.period,
      status: rt.status,
      timeLeft, // ms until the draw
      lockIn: Math.max(0, timeLeft - LOCK_WINDOW_MS),
      serverSeedHash: rt.serverSeedHash,
    };
  }

  /** State for every room (for the initial color:state broadcast). */
  getAllStates() {
    return COLOR_ROOMS.map((r) => this.getState(r));
  }

  /** Global shared results history for a room (identical for all users). */
  async getHistory(room: ColorRoom, limit = 30) {
    const rounds = await this.roundModel
      .find({ room, status: 'SETTLED' })
      .sort({ period: -1 })
      .limit(limit)
      .lean();
    return rounds.map((r) => ({
      room: r.room,
      period: r.period,
      result: r.result,
      resultColors: r.resultColors,
      size: r.size,
      serverSeed: r.serverSeed, // revealed for settled rounds
      serverSeedHash: r.serverSeedHash,
      totalWagered: r.totalWagered,
      settledAt: (r as any).settledAt,
    }));
  }

  /** The requesting player's own bets/orders. */
  async getMyBets(userId: number, limit = 30) {
    const bets = await this.betModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return bets.map((b) => ({
      betId: String(b._id),
      room: b.room,
      period: b.period,
      betType: b.betType,
      selection: b.selection,
      amount: b.amount,
      status: b.status,
      payout: b.payout,
      multiplier: b.multiplier,
      walletType: b.walletType,
      currency: b.currency,
      createdAt: (b as any).createdAt,
    }));
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
