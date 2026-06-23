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
  RouletteGame,
  RouletteGameDocument,
} from '../schemas/roulette-game.schema';
import { GGRService } from '../ggr.service';
import { BonusService } from '../../bonus/bonus.service';
import { FairnessService } from '../fairness.service';
import {
  generateServerSeed,
  hmacHex,
  rollInt,
  roundCurrency,
  deductStake,
  logStakeTransaction,
  settlePayout,
} from '../originals-helpers';

const DEFAULT_MAX_BET = 50000;

/** European single-zero red pockets. */
const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type RouletteBetKind =
  | 'number'
  | 'red'
  | 'black'
  | 'odd'
  | 'even'
  | 'high'
  | 'low'
  | 'dozen1'
  | 'dozen2'
  | 'dozen3'
  | 'col1'
  | 'col2'
  | 'col3';

interface RouletteChipBet {
  kind: RouletteBetKind | string;
  value?: number;
  amount: number;
}

export interface PlayRouletteDto {
  bets: RouletteChipBet[];
  clientSeed?: string;
  walletType?: 'fiat' | 'crypto';
  useBonus?: boolean;
}

const VALID_KINDS = new Set<string>([
  'number',
  'red',
  'black',
  'odd',
  'even',
  'high',
  'low',
  'dozen1',
  'dozen2',
  'dozen3',
  'col1',
  'col2',
  'col3',
]);

/** Determine whether a single chip bet wins given the result number. */
function isWinner(kind: string, value: number | undefined, result: number): boolean {
  switch (kind) {
    case 'number':
      return value === result;
    case 'red':
      return RED.has(result);
    case 'black':
      return result !== 0 && !RED.has(result);
    case 'odd':
      return result !== 0 && result % 2 === 1;
    case 'even':
      return result !== 0 && result % 2 === 0;
    case 'high':
      return result >= 19 && result <= 36;
    case 'low':
      return result >= 1 && result <= 18;
    case 'dozen1':
      return result >= 1 && result <= 12;
    case 'dozen2':
      return result >= 13 && result <= 24;
    case 'dozen3':
      return result >= 25 && result <= 36;
    case 'col1':
      return result !== 0 && result % 3 === 1;
    case 'col2':
      return result !== 0 && result % 3 === 2;
    case 'col3':
      return result !== 0 && result % 3 === 0;
    default:
      return false;
  }
}

/** Total return multiplier on a winning chip (stake included). */
function payoutMultiplier(kind: string): number {
  if (kind === 'number') return 36;
  if (
    kind === 'red' ||
    kind === 'black' ||
    kind === 'odd' ||
    kind === 'even' ||
    kind === 'high' ||
    kind === 'low'
  ) {
    return 2;
  }
  // dozens + columns
  return 3;
}

@Injectable()
export class RouletteService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(RouletteGame.name)
    private readonly model: Model<RouletteGameDocument>,
    @Inject(forwardRef(() => GGRService))
    private readonly ggrService: GGRService,
    private readonly bonusService: BonusService,
    @Inject(forwardRef(() => FairnessService))
    private readonly fairness: FairnessService,
  ) {}

  async play(userId: number, dto: PlayRouletteDto) {
    const {
      bets,
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    // 1. Validate inputs
    if (!Array.isArray(bets) || bets.length === 0) {
      throw new BadRequestException('Place at least one chip');
    }
    for (const b of bets) {
      if (!b || !VALID_KINDS.has(b.kind)) {
        throw new BadRequestException(`Invalid bet kind: ${b?.kind}`);
      }
      if (typeof b.amount !== 'number' || !(b.amount > 0)) {
        throw new BadRequestException('Each bet amount must be positive');
      }
      if (b.kind === 'number') {
        if (
          typeof b.value !== 'number' ||
          !Number.isInteger(b.value) ||
          b.value < 0 ||
          b.value > 36
        ) {
          throw new BadRequestException('Number bet value must be 0–36');
        }
      }
    }

    const betAmount = roundCurrency(bets.reduce((s, b) => s + b.amount, 0));
    if (betAmount <= 0) throw new BadRequestException('Total bet must be positive');

    // 2. GGR config (no outcome bias — only gating + limits)
    const config = await this.ggrService.getConfig('roulette');
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

    // 4. Atomic stake deduction (total of all chips)
    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user,
      betAmount,
      walletType,
      useBonus,
    );

    // 5. Provably-fair outcome: 0..36 on a single-zero wheel
    const { serverSeed, serverSeedHash, clientSeed, nonce } = await this.fairness.consume(userId);
    const result = rollInt(hmacHex(serverSeed, clientSeed, nonce), 37);
    const resultColor =
      result === 0 ? 'green' : RED.has(result) ? 'red' : 'black';

    // 6. Compute payout (sum over winning chips) + optional maxWin cap
    let payout = 0;
    for (const b of bets) {
      if (isWinner(b.kind, b.value, result)) {
        payout += roundCurrency(b.amount * payoutMultiplier(b.kind));
      }
    }
    payout = roundCurrency(payout);
    if (config?.maxWin && payout > config.maxWin) {
      payout = roundCurrency(config.maxWin);
    }
    const status = payout > 0 ? 'WON' : 'LOST';
    const multiplier = betAmount > 0 ? roundCurrency(payout / betAmount) : 0;

    // 7. Persist game doc
    const game = await this.model.create({
      userId,
      betAmount,
      bets: bets.map((b) => ({ kind: b.kind, value: b.value, amount: b.amount })),
      result,
      resultColor,
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

    // 8. BET_PLACE log
    await logStakeTransaction(
      this.prisma,
      userId,
      betAmount,
      walletType,
      bonusUsed,
      'ROULETTE',
      String(game._id),
      `Roulette bet: ${bets.length} chip${bets.length === 1 ? '' : 's'}`,
    );

    // 9. Settle (credit + BET_WIN, or BET_LOSS when payout = 0)
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'ROULETTE',
      String(game._id),
      `Roulette win: landed on ${result} (${resultColor})`,
      `Roulette loss: landed on ${result} (${resultColor})`,
    );

    // 10. GGR snapshot (no bias)
    await this.ggrService
      .updateSnapshot('roulette', 0, 0, status === 'WON')
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

    // 12. Result (matches frontend response contract)
    return {
      gameId: String(game._id),
      bets: game.bets,
      result,
      resultColor,
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
      bets: g.bets,
      result: g.result,
      resultColor:
        g.resultColor ??
        (g.result === 0 ? 'green' : RED.has(g.result) ? 'red' : 'black'),
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
