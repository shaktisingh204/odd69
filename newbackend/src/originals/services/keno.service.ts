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
import { KenoGame, KenoGameDocument } from '../schemas/keno-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import { FairnessService } from '../fairness.service';
import {
  generateServerSeed,
  shuffle,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
} from '../originals-helpers';

const GAME_KEY = 'keno';
const GAME_SOURCE = 'KENO';
const DEFAULT_MAX_BET = 25000;
const POOL_SIZE = 40; // numbers 1..40
const DRAW_COUNT = 10; // 10 numbers drawn each round
const MAX_PICK = 10;

type KenoRisk = 'low' | 'classic' | 'medium' | 'high';
const RISKS: KenoRisk[] = ['low', 'classic', 'medium', 'high'];

/**
 * Stake-style Keno paytable.  Keyed [risk][picks] = number[] indexed by hits.
 * multiplier = PAYTABLE[risk]?.[picks]?.[hits] ?? 0.
 * Target RTP ~95.5%. Easily editable — a later verification step tunes the
 * exact numbers. House edge lives ONLY here; outcomes are never biased.
 */
const PAYTABLE: Record<KenoRisk, Record<number, number[]>> = {
  low: {
    1: [0, 3.8],
    2: [0, 1.8, 4.3],
    3: [0, 0.96, 3, 10],
    4: [0, 0.78, 1.7, 4.9, 22],
    5: [0, 0.52, 1.2, 3.4, 12, 34],
    6: [0, 0, 1.2, 2.6, 7.9, 21, 61],
    7: [0, 0, 0.9, 2.2, 3.9, 12, 28, 105],
    8: [0, 0, 0, 2.4, 4, 6.5, 18, 52, 155],
    9: [0, 0, 0, 1.8, 3, 5.2, 8.9, 21, 61, 480],
    10: [0, 0, 0, 1.4, 2.3, 3.6, 6.4, 11, 24, 71, 1430],
  },
  classic: {
    1: [0, 3.8],
    2: [0, 1.5, 6.6],
    3: [0, 0.93, 2.6, 15],
    4: [0, 0.75, 1.7, 4.7, 30],
    5: [0, 0.52, 1.2, 3.3, 12, 49],
    6: [0, 0, 1, 3.1, 8.2, 18, 76],
    7: [0, 0, 0.53, 2.1, 6.3, 15, 53, 210],
    8: [0, 0, 0, 2, 4, 12, 30, 100, 360],
    9: [0, 0, 0, 1.4, 2.9, 7.7, 17, 62, 190, 555],
    10: [0, 0, 0, 1.1, 2.5, 4.1, 9.8, 29, 98, 310, 1230],
  },
  medium: {
    1: [0, 3.8],
    2: [0, 1.3, 8.1],
    3: [0, 0, 3.9, 35],
    4: [0, 0, 2.2, 8.9, 55],
    5: [0, 0, 1.4, 4.5, 18, 115],
    6: [0, 0, 0.76, 3, 11, 27, 185],
    7: [0, 0, 0, 2.7, 7.2, 20, 77, 340],
    8: [0, 0, 0, 1.7, 5, 12, 41, 180, 605],
    9: [0, 0, 0, 1.4, 2.9, 7.1, 21, 88, 345, 785],
    10: [0, 0, 0, 1, 2.2, 5, 14, 50, 175, 625, 1880],
  },
  high: {
    1: [0, 3.8],
    2: [0, 0, 16.47],
    3: [0, 0, 0, 78],
    4: [0, 0, 0, 9.8, 245],
    5: [0, 0, 0, 4.3, 46, 430],
    6: [0, 0, 0, 0, 11, 335, 670],
    7: [0, 0, 0, 0, 6.7, 86, 385, 770],
    8: [0, 0, 0, 0, 4.8, 19, 260, 575, 865],
    9: [0, 0, 0, 0, 3.8, 11, 54, 480, 770, 960],
    10: [0, 0, 0, 0, 3.4, 7.7, 12, 60, 480, 770, 1920],
  },
};

export interface PlayKenoDto {
  betAmount: number;
  selected: number[];
  risk?: KenoRisk;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
  clientSeed?: string;
}

@Injectable()
export class KenoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(KenoGame.name)
    private readonly model: Model<KenoGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
    @Inject(forwardRef(() => FairnessService))
    private readonly fairness: FairnessService,
  ) {}

  async play(userId: number, dto: PlayKenoDto) {
    const {
      betAmount,
      selected,
      risk = 'classic',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    // 1. Validate inputs
    if (!betAmount || betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (!RISKS.includes(risk)) {
      throw new BadRequestException('Risk must be low, classic, medium or high');
    }
    if (!Array.isArray(selected) || selected.length < 1 || selected.length > MAX_PICK) {
      throw new BadRequestException('Pick 1–10 numbers');
    }
    const uniqueSelected = Array.from(new Set(selected));
    if (uniqueSelected.length !== selected.length) {
      throw new BadRequestException('Selected numbers must be unique');
    }
    for (const n of uniqueSelected) {
      if (!Number.isInteger(n) || n < 1 || n > POOL_SIZE) {
        throw new BadRequestException('Numbers must be integers in 1–40');
      }
    }

    // 2. GGR config gating
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Keno is currently unavailable');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(config.maintenanceMessage || 'Under maintenance');
    }
    if (betAmount < (config?.minBet ?? 10)) {
      throw new BadRequestException(`Minimum bet is ${config?.minBet ?? 10}`);
    }
    if (betAmount > (config?.maxBet ?? DEFAULT_MAX_BET)) {
      throw new BadRequestException(`Maximum bet is ${config?.maxBet ?? DEFAULT_MAX_BET}`);
    }

    // 3. User
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

    // 5. Provably-fair outcome — fresh server seed per round
    const { serverSeed, serverSeedHash, clientSeed, nonce } = await this.fairness.consume(userId);
    const pool = Array.from({ length: POOL_SIZE }, (_, i) => i + 1);
    const drawn = shuffle(pool, serverSeed, clientSeed, nonce)
      .slice(0, DRAW_COUNT)
      .sort((a, b) => a - b);

    const sortedSelected = [...uniqueSelected].sort((a, b) => a - b);
    const drawnSet = new Set(drawn);
    const hits = sortedSelected.filter((s) => drawnSet.has(s)).length;

    // 6. Multiplier + payout (house edge lives in the paytable above)
    const multiplier = PAYTABLE[risk]?.[sortedSelected.length]?.[hits] ?? 0;
    let payout = multiplier > 0 ? roundCurrency(betAmount * multiplier) : 0;
    const maxWin = (config as any)?.maxWin;
    if (typeof maxWin === 'number' && maxWin > 0 && payout > maxWin) {
      payout = roundCurrency(maxWin);
    }
    const status = payout > 0 ? 'WON' : 'LOST';

    // 7. Persist game doc (field names match keno-game.schema.ts)
    const game = await this.model.create({
      userId,
      betAmount,
      risk,
      selected: sortedSelected,
      drawn,
      hits,
      multiplier,
      payout,
      status,
      serverSeed,
      clientSeed,
      serverSeedHash,
      nonce,
      walletType,
      usedBonus: bonusUsed > 0,
      bonusAmount: bonusUsed,
      currency: walletType === 'crypto' ? 'USD' : user.currency || 'INR',
    });
    const gameId = String(game._id);

    // 8. BET_PLACE log (stake already debited)
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      gameId,
      `Keno bet: ${sortedSelected.length} picks (${risk})`,
    );

    // 9. Settle payout (credits + BET_WIN, or BET_LOSS when payout = 0)
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      gameId,
      `Keno win: ${hits}/${sortedSelected.length} hits ×${multiplier}`,
      `Keno loss: ${hits}/${sortedSelected.length} hits`,
    );

    // 10. GGR snapshot (never biases outcomes)
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
      gameId,
      selected: sortedSelected,
      drawn,
      hits,
      multiplier,
      payout,
      status,
      betAmount,
      risk,
      serverSeedHash,
      clientSeed,
      nonce,
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
      selected: g.selected,
      drawn: g.drawn,
      hits: g.hits,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      risk: g.risk,
      walletType: g.walletType,
      currency: g.currency,
      createdAt: g.createdAt,
    }));
  }
}
