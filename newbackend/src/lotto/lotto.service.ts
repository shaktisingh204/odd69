import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  LottoGame,
  LottoGameDocument,
} from '../originals/schemas/lotto-game.schema';
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

const POOL_SIZE = 49;
const PICK_SIZE = 6;

const PAYOUTS: Record<number, number> = {
  0: 0,
  1: 0,
  2: 1, // money back
  3: 2,
  4: 10,
  5: 100,
  6: 1000,
};

export interface PlayLottoDto {
  betAmount: number;
  selected: number[]; // length 6
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

@Injectable()
export class LottoService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(LottoGame.name)
    private readonly lottoModel: Model<LottoGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  private draw(serverSeed: string, clientSeed: string, nonce: number): number[] {
    const pool = Array.from({ length: POOL_SIZE }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const digest = hmacHex(serverSeed, clientSeed, nonce, `lotto:${i}`);
      const j = rollInt(digest, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, PICK_SIZE).sort((a, b) => a - b);
  }

  async play(userId: number, dto: PlayLottoDto) {
    const {
      betAmount,
      selected,
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!Array.isArray(selected) || selected.length !== PICK_SIZE)
      throw new BadRequestException('Pick exactly 6 numbers');
    const uniq = Array.from(new Set(selected));
    if (uniq.length !== selected.length)
      throw new BadRequestException('Duplicate numbers in selection');
    for (const n of selected) {
      if (!Number.isInteger(n) || n < 1 || n > POOL_SIZE)
        throw new BadRequestException('Numbers must be 1–49');
    }
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
    const drawn = this.draw(serverSeed, clientSeed, nonce);
    const drawnSet = new Set(drawn);
    const hits = selected.filter((n) => drawnSet.has(n)).length;
    const multiplier = PAYOUTS[hits] ?? 0;
    const payout = parseFloat((betAmount * multiplier).toFixed(2));
    const status = payout > 0 ? 'WON' : 'LOST';

    const game = await this.lottoModel.create({
      userId,
      betAmount,
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
      'LOTTO',
      String(game._id),
      'Lotto ticket',
    );
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'LOTTO',
      String(game._id),
      `Lotto win: ${hits}/6`,
      `Lotto loss: ${hits}/6`,
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
      serverSeed,
      serverSeedHash,
      clientSeed,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.lottoModel
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
      createdAt: g.createdAt,
    }));
  }
}
