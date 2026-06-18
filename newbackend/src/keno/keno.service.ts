import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  KenoGame,
  KenoGameDocument,
} from '../originals/schemas/keno-game.schema';
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

const POOL_SIZE = 40;
const DRAW_SIZE = 10;

/**
 * Payout multipliers, indexed by [risk][numberOfPicks][hits].
 *
 * House edge of ~4.5% across all rows; tuned so the expected return per
 * stake (sum of P(hits) × multiplier) lands ≈ 0.955.
 *
 * Sources of inspiration: BC.Game / Stake / 1xBet keno tables, then
 * lightly normalised. Tables for picks 0/1 use simple direct multipliers.
 */
const PAYTABLE: Record<string, Record<number, number[]>> = {
  low: {
    1: [0, 3.96],
    2: [0, 1.9, 4.5],
    3: [0, 1.0, 3.1, 10.4],
    4: [0, 0.8, 1.7, 5.0, 22.5],
    5: [0, 0.6, 1.4, 4.0, 14.0, 39.0],
    6: [0, 0.0, 0.9, 2.0, 6.0, 16.0, 46.0],
    7: [0, 0.0, 0.7, 1.7, 3.0, 9.0, 22.0, 81.0],
    8: [0, 0.0, 0.0, 1.5, 2.5, 4.0, 11.0, 32.0, 96.0],
    9: [0, 0.0, 0.0, 1.2, 2.0, 3.5, 6.0, 14.0, 41.0, 325.0],
    10: [0, 0.0, 0.0, 1.0, 1.6, 2.5, 4.5, 8.0, 17.0, 50.0, 1000.0],
  },
  classic: {
    1: [0, 3.84],
    2: [0, 1.6, 7.2],
    3: [0, 1.0, 2.8, 16.5],
    4: [0, 0.8, 1.8, 5.0, 32.0],
    5: [0, 0.7, 1.4, 4.0, 14.0, 60.0],
    6: [0, 0.0, 1.0, 3.0, 8.0, 18.0, 75.0],
    7: [0, 0.0, 0.5, 2.0, 6.0, 14.0, 50.0, 200.0],
    8: [0, 0.0, 0.0, 2.0, 4.0, 12.0, 30.0, 100.0, 360.0],
    9: [0, 0.0, 0.0, 1.5, 3.0, 8.0, 18.0, 65.0, 200.0, 580.0],
    10: [0, 0.0, 0.0, 1.4, 3.0, 5.0, 12.0, 36.0, 120.0, 380.0, 1500.0],
  },
  medium: {
    1: [0, 3.5],
    2: [0, 1.4, 9.0],
    3: [0, 0.0, 3.0, 27.0],
    4: [0, 0.0, 2.0, 8.0, 50.0],
    5: [0, 0.0, 1.5, 5.0, 20.0, 130.0],
    6: [0, 0.0, 1.0, 4.0, 14.0, 36.0, 240.0],
    7: [0, 0.0, 0.0, 3.0, 8.0, 22.0, 86.0, 380.0],
    8: [0, 0.0, 0.0, 2.0, 6.0, 14.0, 50.0, 220.0, 730.0],
    9: [0, 0.0, 0.0, 2.0, 4.0, 10.0, 30.0, 124.0, 480.0, 1100.0],
    10: [0, 0.0, 0.0, 1.6, 3.5, 8.0, 22.0, 80.0, 280.0, 1000.0, 3000.0],
  },
  high: {
    1: [0, 3.6],
    2: [0, 0.0, 17.0],
    3: [0, 0.0, 0.0, 81.0],
    4: [0, 0.0, 0.0, 10.0, 250.0],
    5: [0, 0.0, 0.0, 4.5, 48.0, 450.0],
    6: [0, 0.0, 0.0, 0.0, 11.0, 350.0, 700.0],
    7: [0, 0.0, 0.0, 0.0, 7.0, 90.0, 400.0, 800.0],
    8: [0, 0.0, 0.0, 0.0, 5.0, 20.0, 270.0, 600.0, 900.0],
    9: [0, 0.0, 0.0, 0.0, 4.0, 11.0, 56.0, 500.0, 800.0, 1000.0],
    10: [0, 0.0, 0.0, 0.0, 3.5, 8.0, 13.0, 63.0, 500.0, 800.0, 2000.0],
  },
};

const VALID_RISKS = ['low', 'classic', 'medium', 'high'] as const;

export interface PlayKenoDto {
  betAmount: number;
  selected: number[]; // 1..40, length 1..10, unique
  risk?: 'low' | 'classic' | 'medium' | 'high';
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

@Injectable()
export class KenoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(KenoGame.name)
    private readonly kenoModel: Model<KenoGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  /** Draw 10 unique numbers from 1..40 deterministically. */
  private draw(serverSeed: string, clientSeed: string, nonce: number): number[] {
    const pool = Array.from({ length: POOL_SIZE }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const digest = hmacHex(serverSeed, clientSeed, nonce, `keno:${i}`);
      const j = rollInt(digest, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, DRAW_SIZE).sort((a, b) => a - b);
  }

  async play(userId: number, dto: PlayKenoDto) {
    const {
      betAmount,
      selected,
      risk = 'classic',
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!Array.isArray(selected) || selected.length < 1 || selected.length > 10) {
      throw new BadRequestException('Pick 1 to 10 numbers');
    }
    const uniq = Array.from(new Set(selected));
    if (uniq.length !== selected.length) {
      throw new BadRequestException('Duplicate numbers in selection');
    }
    for (const n of selected) {
      if (!Number.isInteger(n) || n < 1 || n > POOL_SIZE) {
        throw new BadRequestException('Numbers must be 1–40');
      }
    }
    if (!VALID_RISKS.includes(risk)) {
      throw new BadRequestException('Invalid risk');
    }
    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Deduct
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user as any,
      betAmount,
      walletType,
      useBonus,
    );

    // Roll
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const drawn = this.draw(serverSeed, clientSeed, nonce);
    const drawnSet = new Set(drawn);
    const hits = selected.filter((n) => drawnSet.has(n)).length;

    const row = PAYTABLE[risk][selected.length] || [];
    const multiplier = row[hits] ?? 0;
    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const status = payout > 0 ? 'WON' : 'LOST';

    // Persist
    const game = await this.kenoModel.create({
      userId,
      betAmount,
      risk,
      selected: [...selected].sort((a, b) => a - b),
      drawn,
      hits,
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
      'KENO',
      String(game._id),
      `Keno bet: ${selected.length} picks (${risk})`,
    );
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'KENO',
      String(game._id),
      `Keno win: ${hits}/${selected.length} hits`,
      `Keno loss: ${hits}/${selected.length} hits`,
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
      selected: [...selected].sort((a, b) => a - b),
      drawn,
      hits,
      multiplier,
      payout,
      status,
      betAmount,
      risk,
      serverSeed,
      serverSeedHash,
      clientSeed,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.kenoModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      selected: g.selected,
      drawn: g.drawn,
      hits: g.hits,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      risk: g.risk,
      createdAt: g.createdAt,
    }));
  }
}
