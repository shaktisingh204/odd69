import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  RouletteGame,
  RouletteGameDocument,
} from '../originals/schemas/roulette-game.schema';
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

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type BetKind =
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

const VALID_KINDS: BetKind[] = [
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
];

export interface BetInput {
  kind: BetKind;
  value?: number;
  amount: number;
}

export interface PlayRouletteDto {
  bets: BetInput[];
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

function payoutMultiplier(kind: BetKind): number {
  switch (kind) {
    case 'number':
      return 36; // 35:1 plus the stake → 36x
    case 'red':
    case 'black':
    case 'odd':
    case 'even':
    case 'high':
    case 'low':
      return 2; // 1:1
    case 'dozen1':
    case 'dozen2':
    case 'dozen3':
    case 'col1':
    case 'col2':
    case 'col3':
      return 3; // 2:1
  }
}

function isWinner(kind: BetKind, value: number | undefined, result: number): boolean {
  if (result === 0) {
    return kind === 'number' && value === 0;
  }
  switch (kind) {
    case 'number':
      return value === result;
    case 'red':
      return RED_NUMBERS.has(result);
    case 'black':
      return !RED_NUMBERS.has(result);
    case 'odd':
      return result % 2 === 1;
    case 'even':
      return result % 2 === 0;
    case 'high':
      return result >= 19;
    case 'low':
      return result <= 18;
    case 'dozen1':
      return result >= 1 && result <= 12;
    case 'dozen2':
      return result >= 13 && result <= 24;
    case 'dozen3':
      return result >= 25 && result <= 36;
    case 'col1':
      return result % 3 === 1;
    case 'col2':
      return result % 3 === 2;
    case 'col3':
      return result % 3 === 0;
  }
}

@Injectable()
export class RouletteService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(RouletteGame.name)
    private readonly rouletteModel: Model<RouletteGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  async play(userId: number, dto: PlayRouletteDto) {
    const {
      bets,
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!Array.isArray(bets) || bets.length === 0) {
      throw new BadRequestException('Place at least one bet');
    }
    if (bets.length > 20) {
      throw new BadRequestException('Too many bets in one round');
    }
    let totalStake = 0;
    for (const b of bets) {
      if (!VALID_KINDS.includes(b.kind))
        throw new BadRequestException(`Unknown bet kind: ${b.kind}`);
      if (b.kind === 'number') {
        if (b.value === undefined || b.value < 0 || b.value > 36)
          throw new BadRequestException('Number bet value must be 0–36');
      }
      if (!(b.amount > 0))
        throw new BadRequestException('Each bet amount must be positive');
      totalStake += b.amount;
    }
    totalStake = parseFloat(totalStake.toFixed(2));

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { bonusUsed } = await deductStake(
      this.prisma,
      userId,
      user as any,
      totalStake,
      walletType,
      useBonus,
    );

    // Spin
    const { serverSeed, serverSeedHash } = generateServerSeed();
    const nonce = Date.now();
    const digest = hmacHex(serverSeed, clientSeed, nonce, 'roulette');
    const result = rollInt(digest, 37); // 0..36

    // Compute payout
    let payout = 0;
    for (const b of bets) {
      if (isWinner(b.kind, b.value, result)) {
        payout += b.amount * payoutMultiplier(b.kind);
      }
    }
    payout = parseFloat(payout.toFixed(2));
    const status = payout > 0 ? 'WON' : 'LOST';

    const game = await this.rouletteModel.create({
      userId,
      betAmount: totalStake,
      bets,
      result,
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
      totalStake,
      walletType,
      bonusUsed,
      'ROULETTE',
      String(game._id),
      `Roulette: ${bets.length} bets`,
    );
    await settlePayout(
      this.prisma,
      userId,
      totalStake,
      payout,
      walletType,
      bonusUsed,
      'ROULETTE',
      String(game._id),
      `Roulette win: landed ${result}`,
      `Roulette loss: landed ${result}`,
    );

    await this.bonusService
      .recordWagering(
        userId,
        totalStake,
        'CASINO',
        bonusUsed > 0 ? 'fiatbonus' : 'main',
        bonusUsed,
      )
      .catch(() => this.bonusService.emitWalletRefresh(userId));

    return {
      gameId: String(game._id),
      bets,
      result,
      resultColor:
        result === 0 ? 'green' : RED_NUMBERS.has(result) ? 'red' : 'black',
      payout,
      status,
      betAmount: totalStake,
      serverSeed,
      serverSeedHash,
      clientSeed,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.rouletteModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      bets: g.bets,
      result: g.result,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
