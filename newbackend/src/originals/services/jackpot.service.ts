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
import {
  JackpotGame,
  JackpotGameDocument,
} from '../schemas/jackpot-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import {
  generateServerSeed,
  hmacHex,
  rollFloat,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
  WalletType,
} from '../originals-helpers';

const GAME_KEY = 'jackpot';
const GAME_SOURCE = 'JACKPOT';
const DEFAULT_MAX_BET = 25000;

type JackpotTier = 'BUST' | 'MINI' | 'SMALL' | 'BIG' | 'MEGA' | 'GRAND';

/**
 * Provably-fair tier table (RTP 97.5%).
 * Probabilities solved so Σ p·mult = 0.9752:
 *   GRAND  p=0.0005 mult=180
 *   MEGA   p=0.0040 mult=28
 *   BIG    p=0.0200 mult=8
 *   SMALL  p=0.1000 mult=2.8
 *   MINI   p=0.2380 mult=1.4
 *   BUST   p=0.6375 mult=0
 *
 * Cumulative thresholds against r in [0,1):
 *   r < 0.0005           → GRAND
 *   r < 0.0045           → MEGA
 *   r < 0.0245           → BIG
 *   r < 0.1245           → SMALL
 *   r < 0.3625           → MINI
 *   else                 → BUST
 */
function resolveTier(r: number): { tier: JackpotTier; multiplier: number } {
  if (r < 0.0005) return { tier: 'GRAND', multiplier: 180 };
  if (r < 0.0045) return { tier: 'MEGA', multiplier: 28 };
  if (r < 0.0245) return { tier: 'BIG', multiplier: 8 };
  if (r < 0.1245) return { tier: 'SMALL', multiplier: 2.8 };
  if (r < 0.3625) return { tier: 'MINI', multiplier: 1.4 };
  return { tier: 'BUST', multiplier: 0 };
}

export interface PlayJackpotDto {
  betAmount: number;
  walletType?: WalletType;
  useBonus?: boolean;
  clientSeed?: string;
}

@Injectable()
export class JackpotService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(JackpotGame.name)
    private readonly model: Model<JackpotGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
  ) {}

  async play(userId: number, dto: PlayJackpotDto) {
    const {
      betAmount,
      walletType = 'fiat',
      useBonus = false,
      clientSeed = 'odd69',
    } = dto;

    // 1. Validate inputs
    if (typeof betAmount !== 'number' || !isFinite(betAmount) || betAmount <= 0) {
      throw new BadRequestException('Bet must be positive');
    }
    if (walletType !== 'fiat' && walletType !== 'crypto') {
      throw new BadRequestException('Invalid wallet type');
    }

    // 2. Enforce GGR config gates
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Game is currently disabled');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(
        config.maintenanceMessage || 'Under maintenance',
      );
    }
    if (betAmount < (config?.minBet ?? 10)) {
      throw new BadRequestException(`Minimum bet is ${config?.minBet ?? 10}`);
    }
    if (betAmount > (config?.maxBet ?? DEFAULT_MAX_BET)) {
      throw new BadRequestException(
        `Maximum bet is ${config?.maxBet ?? DEFAULT_MAX_BET}`,
      );
    }

    // 3. Load user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 4. Atomic stake debit
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // 5. Provably-fair outcome
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const r = rollFloat(hmacHex(serverSeed, clientSeed, nonce));
    const { tier, multiplier } = resolveTier(r);

    // 6. Payout (cap at maxWin)
    let payout = multiplier > 0 ? roundCurrency(betAmount * multiplier) : 0;
    if (config?.maxWin && payout > config.maxWin) {
      payout = roundCurrency(config.maxWin);
    }
    const status = payout > 0 ? 'WON' : 'LOST';

    // 7. Persist game doc
    const game = await this.model.create({
      userId,
      betAmount,
      tier,
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

    // 8. Stake log
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      `Jackpot bet`,
    );

    // 9. Settle payout (credit + BET_WIN, or BET_LOSS when payout=0)
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      String(game._id),
      `Jackpot win: ${tier} x${multiplier}`,
      `Jackpot loss: ${tier}`,
    );

    // 10. GGR snapshot
    await this.ggrService
      .updateSnapshot(GAME_KEY, 0, 0, status === 'WON')
      .catch(() => undefined);

    // 11. Wagering progress
    await this.bonusService
      .recordWagering(
        userId,
        betAmount,
        'CASINO',
        bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    // 12. Result (every field the frontend reads)
    return {
      gameId: String(game._id),
      tier,
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
      tier: g.tier,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
