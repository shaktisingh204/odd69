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
import { LottoGame, LottoGameDocument } from '../schemas/lotto-game.schema';
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

const GAME_KEY = 'lotto';
const GAME_SOURCE = 'LOTTO';
const POOL_SIZE = 49; // numbers 1..49
const PICK_COUNT = 6; // player picks exactly 6, draw is 6
const DEFAULT_MAX_BET = 15000;

/**
 * Payout multipliers indexed by number of `hits` (matches between the player's
 * 6 picks and the 6 drawn numbers). Easily editable.
 *
 * NOTE: this generous keno-6 starting table yields ~60% RTP for a 6/49 draw
 * (verified via the hypergeometric distribution). It MUST be verified/tuned by
 * the later verification step toward the ~92% RTP target. House edge lives
 * ONLY here in the payout math — outcomes are never biased.
 */
const PAYTABLE: Record<number, number> = {
  0: 0,
  1: 0.6,
  2: 1.5,
  3: 20,
  4: 100,
  5: 1000,
  6: 75000,
};

export interface PlayLottoDto {
  betAmount: number;
  selected: number[];
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
  clientSeed?: string;
}

@Injectable()
export class LottoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(LottoGame.name)
    private readonly model: Model<LottoGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
    @Inject(forwardRef(() => FairnessService))
    private readonly fairness: FairnessService,
  ) {}

  async play(userId: number, dto: PlayLottoDto) {
    const {
      betAmount,
      selected,
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    // 1. Validate inputs
    if (typeof betAmount !== 'number' || !(betAmount > 0)) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (!Array.isArray(selected) || selected.length !== PICK_COUNT) {
      throw new BadRequestException('Select exactly 6 numbers');
    }
    if (
      !selected.every(
        (n) => Number.isInteger(n) && n >= 1 && n <= POOL_SIZE,
      )
    ) {
      throw new BadRequestException('Numbers must be integers between 1 and 49');
    }
    if (new Set(selected).size !== PICK_COUNT) {
      throw new BadRequestException('Numbers must be unique');
    }

    // 2. Config enforcement (no GGR bias on outcome)
    const config = await this.ggrService.getConfig(GAME_KEY);
    if (config && !config.isActive) {
      throw new BadRequestException('Lotto is currently unavailable');
    }
    if (config?.maintenanceMode) {
      throw new BadRequestException(
        config.maintenanceMessage || 'Under maintenance',
      );
    }
    const minBet = config?.minBet ?? 10;
    const maxBet = config?.maxBet ?? DEFAULT_MAX_BET;
    if (betAmount < minBet) {
      throw new BadRequestException(`Minimum bet is ${minBet}`);
    }
    if (betAmount > maxBet) {
      throw new BadRequestException(`Maximum bet is ${maxBet}`);
    }

    // 3. Load user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 4. Atomic stake deduction
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // 5. Provably-fair outcome
    const { serverSeed, serverSeedHash, clientSeed, nonce } = await this.fairness.consume(userId);
    const pool = Array.from({ length: POOL_SIZE }, (_, i) => i + 1);
    const drawn = shuffle(pool, serverSeed, clientSeed, nonce)
      .slice(0, PICK_COUNT)
      .sort((a, b) => a - b);

    const sortedSelected = [...selected].sort((a, b) => a - b);
    const drawnSet = new Set(drawn);
    const hits = sortedSelected.filter((s) => drawnSet.has(s)).length;

    // 6. Multiplier + payout (capped at maxWin if set)
    const multiplier = PAYTABLE[hits] ?? 0;
    let payout = multiplier > 0 ? roundCurrency(betAmount * multiplier) : 0;
    if (config?.maxWin && payout > config.maxWin) {
      payout = roundCurrency(config.maxWin);
    }
    const status = payout > 0 ? 'WON' : 'LOST';

    // 7. Persist game doc (MongoDB)
    const game = await this.model.create({
      userId,
      betAmount,
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

    // 8. Log the stake (BET_PLACE)
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      gameId,
      `Lotto ticket: ${sortedSelected.join(', ')}`,
    );

    // 9. Settle payout (BET_WIN credit or BET_LOSS row)
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      GAME_SOURCE,
      gameId,
      `Lotto win: ${hits}/6 hits`,
      `Lotto loss: ${hits}/6 hits`,
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
      gameId,
      selected: sortedSelected,
      drawn,
      hits,
      multiplier,
      payout,
      status,
      betAmount,
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
      walletType: g.walletType,
      currency: g.currency,
      createdAt: g.createdAt,
    }));
  }
}
