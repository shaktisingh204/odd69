import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  JackpotGame,
  JackpotGameDocument,
} from '../originals/schemas/jackpot-game.schema';
import { BonusService } from '../bonus/bonus.service';
import {
  generateServerSeed,
  hmacHex,
  rollFloat,
  deductStake,
  settlePayout,
  logStakeTransaction,
  WalletType,
} from '../originals/originals-helpers';

/**
 * High-volatility single-roll slot. Uniform float in [0,1) → tier:
 *
 *   p < 0.55       → BUST     0×       (55%)
 *   p < 0.85       → MINI     1.5×     (30%)
 *   p < 0.95       → SMALL    3×       (10%)
 *   p < 0.98       → BIG      8×       ( 3%)
 *   p < 0.997      → MEGA     50×      ( 1.7%)
 *   p < 1          → GRAND    1000×    ( 0.3%)
 *
 * Expected return:
 *   0.55*0 + 0.30*1.5 + 0.10*3 + 0.03*8 + 0.017*50 + 0.003*1000 = 4.84  ❌ way too high
 * Recompute with edge ~5%:
 *   0.55*0 + 0.30*1.5 + 0.10*3 + 0.03*8 + 0.0195*50 + 0.0005*1000
 *   = 0 + 0.45 + 0.30 + 0.24 + 0.975 + 0.5 = 2.465 ❌
 *
 * Use these:
 *   BUST    p<0.50           0×
 *   MINI    p<0.80   (30%)   1.5×
 *   SMALL   p<0.93   (13%)   2.5×
 *   BIG     p<0.985  (5.5%)  4×
 *   MEGA    p<0.998  (1.3%)  20×
 *   GRAND   p<1      (0.2%)  100×
 *
 * EV = 0.30*1.5 + 0.13*2.5 + 0.055*4 + 0.013*20 + 0.002*100
 *    = 0.45 + 0.325 + 0.22 + 0.26 + 0.20 = 1.455 ❌ still too high
 *
 * Calibrated table (final):
 *   BUST    p<0.70           0×
 *   MINI    p<0.88   (18%)   1.5×       0.27
 *   SMALL   p<0.97   (9%)    3×         0.27
 *   BIG     p<0.995  (2.5%)  8×         0.20
 *   MEGA    p<0.9995 (0.45%) 30×        0.135
 *   GRAND   p<1      (0.05%) 200×       0.10
 *   total RTP ≈ 0.975  → house edge ~2.5% (we'll round multipliers below for ~5%)
 */

interface Tier {
  p: number;
  tier: string;
  multiplier: number;
}

const TIERS: Tier[] = [
  { p: 0.7, tier: 'BUST', multiplier: 0 },
  { p: 0.88, tier: 'MINI', multiplier: 1.4 },
  { p: 0.97, tier: 'SMALL', multiplier: 2.8 },
  { p: 0.995, tier: 'BIG', multiplier: 8 },
  { p: 0.9995, tier: 'MEGA', multiplier: 28 },
  { p: 1.0001, tier: 'GRAND', multiplier: 180 },
];

function tierForRoll(p: number): Tier {
  for (const t of TIERS) {
    if (p < t.p) return t;
  }
  return TIERS[TIERS.length - 1];
}

export interface PlayJackpotDto {
  betAmount: number;
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

@Injectable()
export class JackpotService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(JackpotGame.name)
    private readonly jackpotModel: Model<JackpotGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  async play(userId: number, dto: PlayJackpotDto) {
    const {
      betAmount,
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');

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

    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const digest = hmacHex(serverSeed, clientSeed, nonce, 'jackpot');
    const p = rollFloat(digest);
    const tier = tierForRoll(p);
    const multiplier = tier.multiplier;
    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const status = payout > 0 ? 'WON' : 'LOST';

    const game = await this.jackpotModel.create({
      userId,
      betAmount,
      tier: tier.tier,
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
      'JACKPOT',
      String(game._id),
      'Jackpot bet',
    );
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'JACKPOT',
      String(game._id),
      `Jackpot ${tier.tier} × ${multiplier}`,
      `Jackpot bust`,
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
      tier: tier.tier,
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
    const games = await this.jackpotModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      tier: g.tier,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
