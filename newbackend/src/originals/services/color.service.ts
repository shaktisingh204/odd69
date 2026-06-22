import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../../prisma.service';
import { ColorGame, ColorGameDocument } from '../schemas/color-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import {
  generateServerSeed,
  hmacHex,
  rollInt,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
} from '../originals-helpers';

const GAME_KEY = 'color';
const GAME_SOURCE = 'COLOR';
const DEFAULT_MAX_BET = 15000;

// Payout multipliers (0.96 / p form — RTP 96%, house edge lives only here):
//   red   → p = 4/10 + 1/10 (the 0/5 shared half) ... but the canonical
//   Wingo payout used by the spec is the simple 0.96/p form below.
//   red / green = 1.92, violet = 4.8, number = 9.6.
const MULT_RED = 1.92;
const MULT_GREEN = 1.92;
const MULT_VIOLET = 4.8;
const MULT_NUMBER = 9.6;

type ColorPick = 'red' | 'green' | 'violet' | 'number';

export interface PlayColorDto {
  betAmount: number;
  pick: ColorPick;
  pickNumber?: number;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
  clientSeed?: string;
}

/**
 * Color mapping — MUST match newwebsite color/page.tsx `colorsForNumber`
 * EXACTLY so resultColors render correctly on the board:
 *   0          → ['red', 'violet']
 *   5          → ['green', 'violet']
 *   1,3,7,9    → ['green']   (odd)
 *   2,4,6,8    → ['red']     (even, non-zero)
 */
function colorsForNumber(n: number): string[] {
  if (n === 0) return ['red', 'violet'];
  if (n === 5) return ['green', 'violet'];
  if (n % 2 === 1) return ['green'];
  return ['red'];
}

@Injectable()
export class ColorService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(ColorGame.name)
    private readonly model: Model<ColorGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
  ) {}

  async play(userId: number, dto: PlayColorDto) {
    const {
      betAmount,
      pick,
      pickNumber,
      walletType = 'fiat',
      useBonus = false,
      clientSeed = 'odd69',
    } = dto;

    // ── 1. Validate inputs ───────────────────────────────────────────────
    if (!betAmount || betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (!['red', 'green', 'violet', 'number'].includes(pick)) {
      throw new BadRequestException(
        'Pick must be one of: red, green, violet, number',
      );
    }
    let resolvedPickNumber = 0;
    if (pick === 'number') {
      if (
        pickNumber === undefined ||
        pickNumber === null ||
        !Number.isInteger(pickNumber) ||
        pickNumber < 0 ||
        pickNumber > 9
      ) {
        throw new BadRequestException('pickNumber must be an integer 0–9');
      }
      resolvedPickNumber = pickNumber;
    }

    // ── 2. Config gating ─────────────────────────────────────────────────
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Game is currently unavailable');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(
        config.maintenanceMessage || 'Under maintenance',
      );
    }
    if (betAmount < (config?.minBet ?? 10)) {
      throw new BadRequestException(
        `Minimum bet is ${config?.minBet ?? 10}`,
      );
    }
    if (betAmount > (config?.maxBet ?? DEFAULT_MAX_BET)) {
      throw new BadRequestException(
        `Maximum bet is ${config?.maxBet ?? DEFAULT_MAX_BET}`,
      );
    }

    // ── 3. Load user ─────────────────────────────────────────────────────
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ── 4. Atomic stake debit ────────────────────────────────────────────
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // ── 5. Provably-fair outcome ─────────────────────────────────────────
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const result = rollInt(hmacHex(serverSeed, clientSeed, nonce), 10); // 0..9
    const resultColors = colorsForNumber(result);

    // ── 6. Win + multiplier + payout ─────────────────────────────────────
    let won = false;
    let multiplier = 0;
    if (pick === 'number') {
      won = result === resolvedPickNumber;
      if (won) multiplier = MULT_NUMBER;
    } else if (pick === 'red') {
      won = resultColors.includes('red');
      if (won) multiplier = MULT_RED;
    } else if (pick === 'green') {
      won = resultColors.includes('green');
      if (won) multiplier = MULT_GREEN;
    } else {
      // violet
      won = resultColors.includes('violet');
      if (won) multiplier = MULT_VIOLET;
    }

    let payout = won ? roundCurrency(betAmount * multiplier) : 0;
    if (config?.maxWin && payout > config.maxWin) {
      payout = roundCurrency(config.maxWin);
    }
    const status = won ? 'WON' : 'LOST';

    // ── 7. Persist game doc ──────────────────────────────────────────────
    const game = await this.model.create({
      userId,
      betAmount,
      pick,
      pickNumber: resolvedPickNumber,
      result,
      resultColors,
      multiplier,
      payout,
      status,
      serverSeed,
      clientSeed,
      serverSeedHash,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
    });
    const gameId = String(game._id);

    // ── 8. Stake (BET_PLACE) log ─────────────────────────────────────────
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      gameId,
      `Color bet: ${pick}${pick === 'number' ? ` ${resolvedPickNumber}` : ''}`,
    );

    // ── 9. Settle payout (credit + BET_WIN, or BET_LOSS) ─────────────────
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      gameId,
      `Color win: ${pick}${pick === 'number' ? ` ${resolvedPickNumber}` : ''}`,
      `Color loss: ${pick}${pick === 'number' ? ` ${resolvedPickNumber}` : ''}`,
    );

    // ── 10. GGR snapshot ─────────────────────────────────────────────────
    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, status === 'WON')
      .catch(() => undefined);

    // ── 11. Wagering progress ────────────────────────────────────────────
    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    // ── 12. Result (every field the frontend reads) ──────────────────────
    return {
      gameId,
      pick,
      pickNumber: resolvedPickNumber,
      result,
      resultColors,
      multiplier,
      payout,
      status,
      betAmount,
      serverSeed,
      serverSeedHash,
      clientSeed,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return games.map((g: any) => ({
      gameId: String(g._id),
      pick: g.pick,
      pickNumber: g.pickNumber,
      result: g.result,
      resultColors: g.resultColors,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      walletType: g.walletType,
      currency: g.currency,
      createdAt: g.createdAt,
    }));
  }
}
