import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from '../prisma.service';
import {
  CoinflipGame,
  CoinflipGameDocument,
} from '../originals/schemas/coinflip-game.schema';
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

const HOUSE_EDGE = 0.02; // 2%
const MULT = parseFloat(((1 - HOUSE_EDGE) / 0.5).toFixed(4)); // 1.96

export interface PlayCoinflipDto {
  betAmount: number;
  pick: 'heads' | 'tails';
  clientSeed?: string;
  walletType?: WalletType;
  useBonus?: boolean;
}

@Injectable()
export class CoinflipService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(CoinflipGame.name)
    private readonly coinflipModel: Model<CoinflipGameDocument>,
    private readonly bonusService: BonusService,
  ) {}

  async play(userId: number, dto: PlayCoinflipDto) {
    const {
      betAmount,
      pick,
      clientSeed = 'zeero',
      walletType = 'fiat',
      useBonus = false,
    } = dto;

    if (!(betAmount > 0)) throw new BadRequestException('Bet must be positive');
    if (pick !== 'heads' && pick !== 'tails')
      throw new BadRequestException('Pick must be heads or tails');

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
    const digest = hmacHex(serverSeed, clientSeed, nonce, 'coinflip');
    const bit = rollInt(digest, 2); // 0 or 1
    const result: 'heads' | 'tails' = bit === 0 ? 'heads' : 'tails';
    const won = result === pick;
    const payout = won ? parseFloat((betAmount * MULT).toFixed(2)) : 0;
    const status = won ? 'WON' : 'LOST';

    const game = await this.coinflipModel.create({
      userId,
      betAmount,
      pick,
      result,
      multiplier: MULT,
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
      'COINFLIP',
      String(game._id),
      `Coinflip: ${pick}`,
    );
    await settlePayout(
      this.prisma,
      userId,
      betAmount,
      payout,
      walletType,
      bonusUsed,
      'COINFLIP',
      String(game._id),
      `Coinflip win: ${result}`,
      `Coinflip loss: ${result}`,
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
      pick,
      result,
      multiplier: MULT,
      payout,
      status,
      betAmount,
      serverSeed,
      serverSeedHash,
      clientSeed,
    };
  }

  async getHistory(userId: number, limit = 20) {
    const games = await this.coinflipModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return games.map((g: any) => ({
      gameId: String(g._id),
      pick: g.pick,
      result: g.result,
      multiplier: g.multiplier,
      payout: g.payout,
      status: g.status,
      betAmount: g.betAmount,
      createdAt: g.createdAt,
    }));
  }
}
