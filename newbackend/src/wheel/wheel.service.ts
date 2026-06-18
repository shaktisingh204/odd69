import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  WheelGame,
  WheelGameDocument,
} from '../originals/schemas/wheel-game.schema';
import { BonusService } from '../bonus/bonus.service';
import {
  generateServerSeed,
  hmacHex,
  rollInt,
  deductStake,
  settlePayout,
  logStakeTransaction,
  WalletType,
} from '../originals/originals-helpers';

/**
 * Stake-style segmented wheel. Every (risk, segments) combo has its own
 * payout table. Tables are derived programmatically and held in a cache so
 * the player can switch between segment counts without restarting.
 *
 * House edge target: ~3% across the board.
 */

const VALID_SEGMENTS = [10, 20, 30, 40, 50] as const;
type SegmentCount = (typeof VALID_SEGMENTS)[number];
type Risk = 'low' | 'medium' | 'high';

const TARGET_RTP = 0.97;

/**
 * Build the multiplier vector for a given (risk, segments) combo.
 *
 *   low    — most slots win small (1.2× / 1.5×), with a few zero traps
 *   medium — half the slots are zero, the rest pay 1.5×–4×, plus one big slot
 *   high   — every slot is zero except the last, which holds the whole RTP
 */
function buildWheel(risk: Risk, segments: number): number[] {
  if (risk === 'high') {
    const arr = Array(segments).fill(0);
    arr[segments - 1] = parseFloat((segments * TARGET_RTP).toFixed(2));
    return arr;
  }

  if (risk === 'low') {
    const arr: number[] = new Array(segments).fill(0);
    // Low: ~80% of slots win 1.2× or 1.5×, rest are 0.
    // Layout: 0 every 5 slots (≈ 20%), the rest alternate between 1.2 and 1.5
    for (let i = 0; i < segments; i++) {
      if (i % 5 === 4) {
        arr[i] = 0; // trap
      } else {
        arr[i] = i % 2 === 0 ? 1.5 : 1.2;
      }
    }
    // Tune total RTP to TARGET_RTP exactly by scaling 1.2 and 1.5 cells
    const sum = arr.reduce((a, b) => a + b, 0);
    const wantedSum = segments * TARGET_RTP;
    if (sum > 0) {
      const k = wantedSum / sum;
      for (let i = 0; i < segments; i++)
        if (arr[i] > 0) arr[i] = parseFloat((arr[i] * k).toFixed(2));
    }
    return arr;
  }

  // medium: 50% of slots are 0, with a few jackpot slots
  const arr: number[] = new Array(segments).fill(0);
  // pattern: every other slot non-zero, with the last slot being the jackpot
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 1) arr[i] = 1.7;
  }
  arr[segments - 1] = Math.max(2, segments / 8); // jackpot grows with segments
  // tune to TARGET_RTP
  const sum = arr.reduce((a, b) => a + b, 0);
  const wantedSum = segments * TARGET_RTP;
  if (sum > 0) {
    const k = wantedSum / sum;
    for (let i = 0; i < segments; i++)
      if (arr[i] > 0) arr[i] = parseFloat((arr[i] * k).toFixed(2));
  }
  return arr;
}

const WHEEL_CACHE = new Map<string, number[]>();
function getWheel(risk: Risk, segments: number): number[] {
  const key = `${risk}:${segments}`;
  if (!WHEEL_CACHE.has(key)) WHEEL_CACHE.set(key, buildWheel(risk, segments));
  return WHEEL_CACHE.get(key)!;
}

export interface PlayWheelDto {
  betAmount: number;
  risk?: Risk;
  segments?: SegmentCount;
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

@Injectable()
export class WheelService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(WheelGame.name)
    private readonly wheelModel: Model<WheelGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  async play(userId: number, dto: PlayWheelDto) {
    const {
      betAmount,
      risk = 'medium',
      segments = 30,
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');
    if (!['low', 'medium', 'high'].includes(risk))
      throw new BadRequestException('Invalid risk');
    if (!VALID_SEGMENTS.includes(segments as SegmentCount))
      throw new BadRequestException('Segments must be 10/20/30/40/50');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user as any,
      betAmount,
      walletType,
      useBonus,
    );

    const wheel = getWheel(risk as Risk, segments);
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const digest = hmacHex(
      serverSeed,
      clientSeed,
      nonce,
      `wheel:${risk}:${segments}`,
    );
    const slot = rollInt(digest, segments);
    const multiplier = wheel[slot];
    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const status = payout > 0 ? 'WON' : 'LOST';

    const game = await this.wheelModel.create({
      userId,
      betAmount,
      risk,
      segments,
      slot,
      multiplier,
      payout,
      status,
      serverSeed,
      clientSeed,
      serverSeedHash,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : (user as any).currency || 'INR',
    });

    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      'WHEEL',
      String(game._id),
      `Wheel bet (${risk})`,
    );
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'WHEEL',
      String(game._id),
      `Wheel win × ${multiplier}`,
      `Wheel loss (${risk})`,
    );

    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    return {
      gameId: String(game._id),
      risk,
      slot,
      segments,
      multiplier,
      payout,
      status,
      betAmount,
      wheelMultipliers: wheel,
      serverSeed,
      serverSeedHash,
      clientSeed,
    };
  }

  /**
   * Public preview endpoint — players (and the UI) can preview the wheel
   * for a given (risk, segments) combo without placing a bet.
   */
  getWheelPreview(risk: Risk, segments: SegmentCount) {
    const wheel = getWheel(risk, segments);
    const unique = Array.from(new Set(wheel)).sort((a, b) => a - b);
    return { risk, segments, wheel, uniqueMultipliers: unique };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.wheelModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      risk: g.risk,
      slot: g.slot,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
